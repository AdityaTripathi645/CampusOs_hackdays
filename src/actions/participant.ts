"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { type ActionState, toActionState } from "@/lib/errors";
import { createTeamSchema, formToObject, joinTeamSchema, submissionSchema, zodFieldErrors } from "@/lib/validation";
import { createTeam, joinTeam, leaveTeam, registerForEvent, withdrawRegistration } from "@/services/registrations";
import { deleteSubmissionFile, saveSubmission } from "@/services/submissions";

function refresh(eventId: string) {
  revalidatePath(`/explore/${eventId}`, "layout");
  revalidatePath("/my");
  revalidatePath("/dashboard");
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    const eventId = String(fd.get("eventId") ?? "");
    const reg = await registerForEvent(user, eventId, fd);
    refresh(eventId);
    return {
      ok: true,
      message:
        reg.status === "WAITLISTED"
          ? "The event is at capacity — you're on the waitlist."
          : "Registered! The organizer will review your registration.",
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function withdrawAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    const eventId = String(fd.get("eventId") ?? "");
    await withdrawRegistration(user, eventId);
    refresh(eventId);
    return { ok: true, message: "Registration withdrawn." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function createTeamAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    const parsed = createTeamSchema.safeParse(formToObject(fd));
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    const team = await createTeam(user, parsed.data);
    refresh(parsed.data.eventId);
    return { ok: true, message: `Team created. Share invite code ${team.inviteCode} with teammates.` };
  } catch (err) {
    return toActionState(err);
  }
}

export async function joinTeamAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    const parsed = joinTeamSchema.safeParse(formToObject(fd));
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    const team = await joinTeam(user, parsed.data);
    refresh(parsed.data.eventId);
    return { ok: true, message: `You joined ${team.name}.` };
  } catch (err) {
    return toActionState(err);
  }
}

export async function leaveTeamAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    await leaveTeam(user, String(fd.get("teamId") ?? ""));
    refresh(String(fd.get("eventId") ?? ""));
    return { ok: true, message: "You left the team." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function saveSubmissionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    const parsed = submissionSchema.safeParse(formToObject(fd));
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    const files = fd.getAll("files").filter((f): f is File => typeof f !== "string");
    const sub = await saveSubmission(user, parsed.data, files);
    refresh(parsed.data.eventId);
    revalidatePath(`/events/${parsed.data.eventId}`, "layout");
    return {
      ok: true,
      message:
        parsed.data.intent === "submit"
          ? `Submission received (version ${sub.version}).${sub.notificationsBackground ? " Team email notifications are being sent in the background." : ""}`
          : `Draft saved (version ${sub.version}). Remember to submit before the deadline.`,
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteFileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["PARTICIPANT"]);
    await deleteSubmissionFile(user, String(fd.get("fileId") ?? ""));
    refresh(String(fd.get("eventId") ?? ""));
    return { ok: true, message: "File removed." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function setEmailNotificationsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const emailNotifications = fd.get("emailNotifications") === "on";
    await db.user.update({ where: { id: user.id }, data: { emailNotifications } });
    revalidatePath("/settings");
    return {
      ok: true,
      message: emailNotifications ? "Email notifications enabled." : "Email notifications disabled.",
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function setLocaleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const locale = String(fd.get("locale") ?? "");
    if (locale !== "en" && locale !== "hi") return { ok: false, error: "Choose English or Hindi." };
    await db.user.update({ where: { id: user.id }, data: { locale } });
    revalidatePath("/", "layout");
    return { ok: true, message: locale === "hi" ? "भाषा की पसंद सहेजी गई।" : "Language preference saved." };
  } catch (err) {
    return toActionState(err);
  }
}
