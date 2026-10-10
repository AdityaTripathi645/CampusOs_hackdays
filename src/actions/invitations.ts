"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRole } from "@/lib/domain";
import { audit } from "@/lib/audit";
import { AppError, toActionState, type ActionState } from "@/lib/errors";
import { acceptInvitationSchema, formToObject, invitationSchema, zodFieldErrors } from "@/lib/validation";
import {
  acceptInvitationForExistingUser,
  acceptInvitationForNewUser,
  createInvitation,
  revokeInvitation,
} from "@/services/invitations";

export async function createAdminInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireUser(["ADMIN"]);
    const parsed = invitationSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    }
    await createInvitation(admin, parsed.data);
    revalidatePath("/settings");
    return { ok: true, message: `Invitation created for ${parsed.data.email}; email delivery was attempted.` };
  } catch (error) {
    return toActionState(error);
  }
}

export async function createEventJudgeInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const organizer = await requireUser(["ADMIN", "ORGANIZER"]);
    const parsed = invitationSchema.safeParse({
      email: formData.get("email"),
      role: "JUDGE",
      eventId: formData.get("eventId"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Please enter a valid email.", fieldErrors: zodFieldErrors(parsed.error) };
    }
    await createInvitation(organizer, parsed.data);
    revalidatePath(`/events/${parsed.data.eventId}/judging`);
    return { ok: true, message: `Judge invitation created for ${parsed.data.email}; email delivery was attempted.` };
  } catch (error) {
    return toActionState(error);
  }
}

export async function revokeInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireUser(["ADMIN"]);
    await revokeInvitation(admin, String(formData.get("invitationId") ?? ""));
    revalidatePath("/settings");
    return { ok: true, message: "Invitation revoked." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = acceptInvitationSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    const mode = String(formData.get("mode") ?? "");
    let userId: string;
    let invitationId: string;
    let role: string;
    let eventId: string | null;

    if (mode === "new") {
      if (!parsed.data.name) {
        return { ok: false, error: "Please enter your name.", fieldErrors: { name: ["Required"] } };
      }
      const accepted = await acceptInvitationForNewUser(parsed.data.token, {
        name: parsed.data.name,
        password: parsed.data.password,
      });
      userId = accepted.userId;
      invitationId = accepted.invitationId;
      role = accepted.role;
      eventId = accepted.eventId;
    } else if (mode === "existing") {
      const accepted = await acceptInvitationForExistingUser(parsed.data.token, parsed.data.password);
      userId = accepted.userId;
      invitationId = accepted.invitationId;
      role = accepted.role;
      eventId = accepted.eventId;
    } else {
      throw new AppError("Choose a valid invitation acceptance method.");
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, sessionVersion: true },
    });
    if (!user || !isRole(user.role) || !isRole(role)) throw new AppError("Could not finish accepting this invitation.");
    await audit({
      actorId: user.id,
      eventId,
      action: "invitation.accepted",
      entityType: "Invitation",
      entityId: invitationId,
      metadata: { role },
    });
    await createSession({ ...user, role: user.role });
    redirect("/dashboard");
  } catch (error) {
    return toActionState(error);
  }
}
