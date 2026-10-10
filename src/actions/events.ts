"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { REGISTRATION_STATUSES, SUBMISSION_STATUSES, type RegistrationStatus, type SubmissionStatus } from "@/lib/domain";
import { type ActionState, toActionState } from "@/lib/errors";
import { eventSchema, formToObject, zodFieldErrors } from "@/lib/validation";
import { createEvent, deleteEvent, updateEvent } from "@/services/events";
import { approveAllPending, setRegistrationStatus } from "@/services/registrations";
import { setSubmissionStatus } from "@/services/submissions";

export async function createEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const parsed = eventSchema.safeParse(formToObject(fd));
    if (!parsed.success)
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    const event = await createEvent(user, parsed.data);
    id = event.id;
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath("/events");
  redirect(`/events/${id}`);
}

export async function updateEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const eventId = String(fd.get("eventId") ?? "");
    const parsed = eventSchema.safeParse(formToObject(fd));
    if (!parsed.success)
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    await updateEvent(user, eventId, parsed.data);
    revalidatePath(`/events/${eventId}`, "layout");
    return { ok: true, message: "Event settings saved." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    await deleteEvent(user, String(fd.get("eventId") ?? ""));
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath("/events");
  redirect("/events");
}

const REG_STATUSES: readonly RegistrationStatus[] = REGISTRATION_STATUSES.filter((status) => status !== "WITHDRAWN");

export async function setRegistrationStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const status = String(fd.get("status")) as RegistrationStatus;
    if (!REG_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
    await setRegistrationStatus(user, String(fd.get("registrationId") ?? ""), status);
    revalidatePath(`/events/${String(fd.get("eventId") ?? "")}`, "layout");
    return { ok: true, message: `Registration marked ${status.toLowerCase()}.` };
  } catch (err) {
    return toActionState(err);
  }
}

export async function approveAllPendingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const eventId = String(fd.get("eventId") ?? "");
    const result = await approveAllPending(user, eventId);
    revalidatePath(`/events/${eventId}`, "layout");
    return {
      ok: true,
      message: `${result.count} registration(s) approved.${result.notificationsBackground ? " Email notifications are being sent in the background." : ""}`,
    };
  } catch (err) {
    return toActionState(err);
  }
}

const SUB_STATUSES: readonly SubmissionStatus[] = SUBMISSION_STATUSES.filter((status) => status !== "DRAFT");

export async function setSubmissionStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const status = String(fd.get("status")) as SubmissionStatus;
    if (!SUB_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
    await setSubmissionStatus(user, String(fd.get("submissionId") ?? ""), status);
    revalidatePath(`/events/${String(fd.get("eventId") ?? "")}`, "layout");
    return { ok: true, message: "Submission status updated." };
  } catch (err) {
    return toActionState(err);
  }
}
