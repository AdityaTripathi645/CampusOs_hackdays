import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { hashAuthToken, hashPassword, verifyPassword } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { invitationEmail } from "@/emails";
import { sendEmail } from "@/lib/email";

export type InvitationRole = "ORGANIZER" | "JUDGE" | "ADMIN";
const INVITATION_LIFETIME = 7 * 24 * 60 * 60 * 1000;

function invitationUrl(token: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
}

export async function createInvitation(
  inviter: CurrentUser,
  input: { email: string; role: InvitationRole; eventId?: string },
) {
  if (inviter.role !== "ADMIN" && !(inviter.role === "ORGANIZER" && input.role === "JUDGE" && input.eventId)) {
    throw new ForbiddenError("You cannot invite that role.");
  }

  let eventName: string | null = null;
  if (input.eventId) {
    if (input.role !== "JUDGE") throw new AppError("Only judge invitations can be linked to an event.");
    const event = await assertCanManageEvent(inviter, input.eventId);
    eventName = event.name;
  }
  if (inviter.role === "ORGANIZER" && !input.eventId) {
    throw new AppError("Choose an event for this judge invitation.");
  }

  const email = input.email.trim().toLowerCase();
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: {
        email,
        role: input.role,
        eventId: input.eventId ?? null,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    return tx.invitation.create({
      data: {
        email,
        role: input.role,
        eventId: input.eventId ?? null,
        tokenHash: hashAuthToken(rawToken),
        invitedById: inviter.id,
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME),
      },
    });
  });

  await audit({
    actorId: inviter.id,
    eventId: input.eventId,
    action: "invitation.created",
    entityType: "Invitation",
    entityId: invitation.id,
    metadata: { role: input.role },
  });
  const content = invitationEmail({ role: input.role.toLowerCase(), eventName, url: invitationUrl(rawToken) });
  await sendEmail({ to: email, template: "invitation", eventId: input.eventId, ...content });
  return invitation;
}

export async function listPendingInvitations() {
  return db.invitation.findMany({
    where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      event: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });
}

export async function revokeInvitation(admin: CurrentUser, invitationId: string) {
  if (admin.role !== "ADMIN") throw new ForbiddenError();
  const now = new Date();
  const result = await db.invitation.updateMany({
    where: { id: invitationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { revokedAt: now },
  });
  if (result.count !== 1) throw new NotFoundError("Pending invitation");
  await audit({
    actorId: admin.id,
    action: "invitation.revoked",
    entityType: "Invitation",
    entityId: invitationId,
  });
}

async function claimInvitation(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], rawToken: string) {
  const now = new Date();
  const invitation = await tx.invitation.findUnique({
    where: { tokenHash: hashAuthToken(rawToken) },
  });
  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.acceptedAt ||
    invitation.expiresAt <= now ||
    !["ORGANIZER", "JUDGE", "ADMIN"].includes(invitation.role)
  ) {
    throw new AppError("This invitation is invalid, expired, revoked, or already used.");
  }
  const claimed = await tx.invitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { acceptedAt: now },
  });
  if (claimed.count !== 1) throw new AppError("This invitation has already been used.");
  return invitation;
}

async function applyInvitationToUser(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  invitation: Awaited<ReturnType<typeof claimInvitation>>,
  userId: string,
) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.email !== invitation.email) throw new AppError("This invitation does not match the signed-in account.");

  const targetRole = invitation.role as InvitationRole;
  const role = user.role === "ADMIN" ? user.role : targetRole;
  const updated = await tx.user.update({
    where: { id: user.id },
    data: { role, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  if (invitation.role === "JUDGE" && invitation.eventId) {
    await tx.eventJudge.upsert({
      where: { eventId_userId: { eventId: invitation.eventId, userId: user.id } },
      create: { eventId: invitation.eventId, userId: user.id },
      update: {},
    });
  }
  return updated;
}

export async function acceptInvitationForNewUser(
  rawToken: string,
  input: { name: string; password: string },
) {
  return db.$transaction(async (tx) => {
    const invitation = await claimInvitation(tx, rawToken);
    if (await tx.user.findUnique({ where: { email: invitation.email }, select: { id: true } })) {
      throw new AppError("An account already uses this email. Sign in to accept the invitation.");
    }
    const user = await tx.user.create({
      data: {
        name: input.name.trim(),
        email: invitation.email,
        role: invitation.role,
        passwordHash: await hashPassword(input.password),
        emailVerifiedAt: new Date(),
      },
    });
    if (invitation.role === "JUDGE" && invitation.eventId) {
      await tx.eventJudge.create({ data: { eventId: invitation.eventId, userId: user.id } });
    }
    return { userId: user.id, role: invitation.role, invitationId: invitation.id, eventId: invitation.eventId };
  });
}

export async function acceptInvitationForExistingUser(rawToken: string, password: string) {
  return db.$transaction(async (tx) => {
    const invitation = await claimInvitation(tx, rawToken);
    const user = await tx.user.findUnique({ where: { email: invitation.email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError("The email or password is incorrect.");
    }
    const updated = await applyInvitationToUser(tx, invitation, user.id);
    return { userId: updated.id, role: updated.role, name: updated.name, invitationId: invitation.id, eventId: invitation.eventId, sessionVersion: updated.sessionVersion };
  });
}
