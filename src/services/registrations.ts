import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { RegistrationStatus } from "@/lib/domain";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { randomCode } from "@/lib/utils";
import { parseRegistrationFields, registrationState } from "@/services/events";
import { registrationReceivedEmail, registrationStatusEmail, teamJoinedEmail } from "@/emails";
import { sendNotificationBatch, sendUserNotification } from "@/services/email-notifications";

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerForEvent(user: CurrentUser, eventId: string, form: FormData) {
  if (user.role !== "PARTICIPANT") throw new ForbiddenError("Only participant accounts can register for events.");
  if (!user.emailVerifiedAt) throw new AppError("Verify your email address before registering for events.");
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError("Event");

  const window = registrationState(event);
  if (!window.open) throw new AppError(window.reason ?? "Registration is closed.");

  const existing = await db.registration.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
  if (existing && existing.status !== "WITHDRAWN") throw new ConflictError("You are already registered for this event.");

  if (event.eligibility && form.get("eligibilityConfirmed") !== "on") {
    throw new AppError("Please confirm you meet the eligibility criteria.", 400, {
      eligibilityConfirmed: ["Required"],
    });
  }

  // Validate organizer-defined registration fields on the server.
  const fields = parseRegistrationFields(event.registrationFields);
  const answers: Record<string, string | boolean> = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const f of fields) {
    const name = `field_${f.key}`;
    if (f.type === "checkbox") {
      const checked = form.get(name) === "on";
      if (f.required && !checked) fieldErrors[name] = ["Required"];
      answers[f.key] = checked;
      continue;
    }
    const raw = String(form.get(name) ?? "").trim();
    if (f.required && !raw) {
      fieldErrors[name] = ["Required"];
      continue;
    }
    if (raw.length > 2000) fieldErrors[name] = ["Too long (max 2000 characters)"];
    if (f.type === "select" && raw && !(f.options ?? []).includes(raw)) fieldErrors[name] = ["Choose a valid option"];
    if (raw) answers[f.key] = raw;
  }
  if (Object.keys(fieldErrors).length) throw new AppError("Please fix the highlighted fields.", 400, fieldErrors);

  const activeCount = await db.registration.count({
    where: { eventId, status: { in: ["PENDING", "APPROVED"] } },
  });
  const status: RegistrationStatus =
    event.maxParticipants && activeCount >= event.maxParticipants ? "WAITLISTED" : "PENDING";

  const registration = existing
    ? await db.registration.update({
        where: { id: existing.id },
        data: { status, answers: answers as Prisma.InputJsonValue, isDemo: false },
      })
    : await db.registration.create({
        data: {
          eventId,
          userId: user.id,
          status,
          answers: answers as Prisma.InputJsonValue,
          checkInCode: `CO-${randomCode(10)}`,
        },
      });

  await audit({
    actorId: user.id,
    eventId,
    action: "registration.created",
    entityType: "Registration",
    entityId: registration.id,
    metadata: { status },
  });
  await sendUserNotification(
    user,
    "registration-received",
    registrationReceivedEmail({ participantName: user.name, eventName: event.name, waitlisted: status === "WAITLISTED" }),
    eventId,
  );
  return registration;
}

export async function withdrawRegistration(user: CurrentUser, eventId: string) {
  const reg = await db.registration.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
  if (!reg) throw new NotFoundError("Registration");
  const membership = await db.teamMember.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
  if (membership) throw new ConflictError("Leave your team before withdrawing.");
  await db.registration.update({ where: { id: reg.id }, data: { status: "WITHDRAWN" } });
  await audit({ actorId: user.id, eventId, action: "registration.withdrawn", entityType: "Registration", entityId: reg.id });
}

export async function setRegistrationStatus(user: CurrentUser, registrationId: string, status: RegistrationStatus) {
  const reg = await db.registration.findUnique({
    where: { id: registrationId },
    include: {
      user: { select: { name: true, email: true, emailNotifications: true, isDemo: true } },
      event: { select: { id: true, name: true } },
    },
  });
  if (!reg) throw new NotFoundError("Registration");
  await assertCanManageEvent(user, reg.eventId);
  const updated = await db.registration.update({ where: { id: registrationId }, data: { status } });
  await audit({
    actorId: user.id,
    eventId: reg.eventId,
    action: "registration.status_changed",
    entityType: "Registration",
    entityId: registrationId,
    metadata: { from: reg.status, to: status },
  });
  if (
    reg.status !== status &&
    (status === "APPROVED" || status === "REJECTED" || status === "WAITLISTED")
  ) {
    await sendUserNotification(
      reg.user,
      `registration-${status.toLowerCase()}`,
      registrationStatusEmail({
        participantName: reg.user.name,
        eventName: reg.event.name,
        eventId: reg.event.id,
        status,
        checkInCode: updated.checkInCode,
      }),
      reg.eventId,
    );
  }
}

export async function approveAllPending(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  const approved = await db.registration.count({ where: { eventId, status: "APPROVED" } });
  const pending = await db.registration.findMany({
    where: { eventId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      checkInCode: true,
      user: { select: { name: true, email: true, emailNotifications: true, isDemo: true } },
    },
  });
  const room = event.maxParticipants ? Math.max(0, event.maxParticipants - approved) : pending.length;
  const newlyApproved = pending.slice(0, room);
  const ids = newlyApproved.map((r) => r.id);
  if (ids.length) await db.registration.updateMany({ where: { id: { in: ids } }, data: { status: "APPROVED" } });
  await audit({
    actorId: user.id,
    eventId,
    action: "registration.bulk_approved",
    entityType: "Registration",
    metadata: { count: ids.length },
  });
  const notifications = await sendNotificationBatch(
    newlyApproved.map((registration) => ({
      email: registration.user.email,
      emailNotifications: registration.user.emailNotifications,
      isDemo: registration.user.isDemo,
      content: registrationStatusEmail({
        participantName: registration.user.name,
        eventName: event.name,
        eventId,
        status: "APPROVED",
        checkInCode: registration.checkInCode,
      }),
    })),
    { template: "registration-approved", eventId },
  );
  return { count: ids.length, notificationsBackground: notifications.background };
}

export async function listEventRegistrations(eventId: string) {
  return db.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true, institution: true, isDemo: true } },
      seat: { include: { room: true } },
      attendance: true,
    },
  });
}

// ─── Teams ───────────────────────────────────────────────────────────────────

async function requireActiveRegistration(userId: string, eventId: string) {
  const reg = await db.registration.findUnique({ where: { eventId_userId: { eventId, userId } } });
  if (!reg || ["WITHDRAWN", "REJECTED"].includes(reg.status)) {
    throw new ForbiddenError("Register for the event before joining a team.");
  }
  return reg;
}

export async function createTeam(user: CurrentUser, input: { eventId: string; name: string; trackId?: string }) {
  await requireActiveRegistration(user.id, input.eventId);
  const existing = await db.teamMember.findUnique({
    where: { eventId_userId: { eventId: input.eventId, userId: user.id } },
  });
  if (existing) throw new ConflictError("You are already in a team for this event.");
  if (input.trackId) {
    const track = await db.track.findFirst({ where: { id: input.trackId, eventId: input.eventId } });
    if (!track) throw new AppError("Unknown track.");
  }
  const clash = await db.team.findUnique({ where: { eventId_name: { eventId: input.eventId, name: input.name } } });
  if (clash) throw new ConflictError("A team with that name already exists.");

  const team = await db.team.create({
    data: {
      eventId: input.eventId,
      name: input.name,
      trackId: input.trackId ?? null,
      leaderId: user.id,
      inviteCode: randomCode(6),
      members: { create: { userId: user.id, eventId: input.eventId, role: "LEADER" } },
    },
  });
  await audit({ actorId: user.id, eventId: input.eventId, action: "team.created", entityType: "Team", entityId: team.id });
  return team;
}

export async function joinTeam(user: CurrentUser, input: { eventId: string; inviteCode: string }) {
  await requireActiveRegistration(user.id, input.eventId);
  const team = await db.team.findUnique({
    where: { inviteCode: input.inviteCode },
    include: {
      event: true,
      leader: { select: { name: true, email: true, emailNotifications: true, isDemo: true } },
      _count: { select: { members: true } },
    },
  });
  if (!team || team.eventId !== input.eventId) throw new NotFoundError("Team with that invite code");
  if (team._count.members >= team.event.maxTeamSize) throw new ConflictError("This team is full.");
  try {
    await db.teamMember.create({ data: { teamId: team.id, userId: user.id, eventId: team.eventId } });
  } catch {
    throw new ConflictError("You are already in a team for this event.");
  }
  await audit({ actorId: user.id, eventId: team.eventId, action: "team.joined", entityType: "Team", entityId: team.id });
  if (team.leaderId !== user.id) {
    await sendUserNotification(
      team.leader,
      "team-member-joined",
      teamJoinedEmail({
        leaderName: team.leader.name,
        participantName: user.name,
        teamName: team.name,
        eventName: team.event.name,
      }),
      team.eventId,
    );
  }
  return team;
}

export async function leaveTeam(user: CurrentUser, teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { members: { orderBy: { joinedAt: "asc" } }, submission: true },
  });
  if (!team) throw new NotFoundError("Team");
  const me = team.members.find((m) => m.userId === user.id);
  if (!me) throw new ForbiddenError("You are not in this team.");
  if (team.submission && team.submission.status !== "DRAFT") {
    throw new ConflictError("Your team has already submitted. Contact the organizer to change membership.");
  }
  const others = team.members.filter((m) => m.userId !== user.id);
  await db.$transaction(async (tx) => {
    if (others.length === 0) {
      await tx.team.delete({ where: { id: team.id } });
    } else {
      await tx.teamMember.delete({ where: { id: me.id } });
      if (team.leaderId === user.id) {
        const next = others[0]!;
        await tx.team.update({ where: { id: team.id }, data: { leaderId: next.userId } });
        await tx.teamMember.update({ where: { id: next.id }, data: { role: "LEADER" } });
      }
    }
    await audit(
      { actorId: user.id, eventId: team.eventId, action: "team.left", entityType: "Team", entityId: team.id },
      tx,
    );
  });
}

export async function listEventTeams(eventId: string) {
  return db.team.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    include: {
      track: true,
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: "asc" } },
      submission: { select: { id: true, title: true, status: true } },
    },
  });
}
