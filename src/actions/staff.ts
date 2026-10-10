"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { Role, ScoringMethod } from "@/lib/domain";
import { audit } from "@/lib/audit";
import { type ActionState, AppError, toActionState } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { aiDecisionSchema, formToObject, ticketDecisionSchema, zodFieldErrors } from "@/lib/validation";
import { decideAIReview, runScreening, runScreeningBatch } from "@/services/screening";
import { autoAllocateSeats, checkIn, clearSeats, undoCheckIn, type CheckInResult } from "@/services/operations";
import { addJudge, autoAssign, removeAssignment, removeJudge } from "@/services/judging";
import { decideTicket, openReviewStage, openTicket } from "@/services/fairjudge";
import { awardPrize, computeResults, revokePrizeAward, setResultsPublished } from "@/services/results";

const STAFF: Role[] = ["ORGANIZER", "ADMIN"];
const ev = (fd: FormData) => String(fd.get("eventId") ?? "");
const refresh = (eventId: string) => revalidatePath(`/events/${eventId}`, "layout");

// ─── AI screening ────────────────────────────────────────────────────────────

export async function runScreeningAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const review = await runScreening(user, String(fd.get("submissionId") ?? ""));
    refresh(ev(fd));
    return {
      ok: true,
      message:
        review.mode === "LIVE"
          ? "Gemini analysis saved. Review it and record a human decision."
          : "Demo heuristic saved (Gemini is not configured). It is labelled as non-AI output.",
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function runScreeningBatchAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const ids = fd.getAll("submissionIds").map(String).filter(Boolean);
    if (ids.length === 0) return { ok: false, error: "Select at least one submission." };
    const results = await runScreeningBatch(user, ev(fd), ids);
    refresh(ev(fd));
    const okCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (failed.length) return { ok: okCount > 0, error: `${okCount} screened, ${failed.length} failed: ${failed[0]!.error}` };
    return { ok: true, message: `${okCount} submission(s) screened.` };
  } catch (err) {
    return toActionState(err);
  }
}

export async function decideAIReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const parsed = aiDecisionSchema.safeParse(formToObject(fd));
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    await decideAIReview(user, parsed.data);
    refresh(ev(fd));
    return { ok: true, message: "Human decision recorded." };
  } catch (err) {
    return toActionState(err);
  }
}

// ─── Operations ──────────────────────────────────────────────────────────────

export type CheckInState = ActionState & { result?: CheckInResult };

export async function checkInAction(_prev: CheckInState, fd: FormData): Promise<CheckInState> {
  try {
    const user = await requireUser(STAFF);
    await enforceRateLimit(`check-in:operator:${user.id}`, 120, 60 * 1000, "Too many check-in attempts.");
    const method = fd.get("method") === "QR" ? "QR" : "MANUAL";
    const result = await checkIn(user, ev(fd), String(fd.get("code") ?? ""), method);
    if (result.status === "checked_in") refresh(ev(fd));
    return { ok: true, result };
  } catch (err) {
    return toActionState(err);
  }
}

export async function undoCheckInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    await undoCheckIn(user, String(fd.get("registrationId") ?? ""));
    refresh(ev(fd));
    return { ok: true, message: "Check-in removed." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function autoAllocateSeatsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const { assigned, unplaced } = await autoAllocateSeats(user, ev(fd));
    refresh(ev(fd));
    return {
      ok: true,
      message: `${assigned} seat(s) assigned.${unplaced ? ` ${unplaced} participant(s) could not be placed — add room capacity.` : ""}`,
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function clearSeatsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const n = await clearSeats(user, ev(fd));
    refresh(ev(fd));
    return { ok: true, message: `${n} seat assignment(s) cleared.` };
  } catch (err) {
    return toActionState(err);
  }
}

// ─── Judging ─────────────────────────────────────────────────────────────────

export async function addJudgeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) return { ok: false, error: "Enter the judge's email.", fieldErrors: { email: ["Required"] } };
    await addJudge(user, ev(fd), email, String(fd.get("expertise") ?? "").trim().slice(0, 120) || undefined);
    refresh(ev(fd));
    return { ok: true, message: "Judge added to the panel." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function removeJudgeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    await removeJudge(user, String(fd.get("eventJudgeId") ?? ""));
    refresh(ev(fd));
    return { ok: true, message: "Judge removed." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function autoAssignAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const { created, shortfall, notificationsBackground } = await autoAssign(user, ev(fd));
    refresh(ev(fd));
    return {
      ok: true,
      message: `${created} assignment(s) created.${shortfall ? ` ${shortfall} slot(s) unfilled — add more judges.` : ""}${notificationsBackground ? " Judge notifications are being sent in the background." : ""}`,
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function removeAssignmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    await removeAssignment(user, String(fd.get("assignmentId") ?? ""));
    refresh(ev(fd));
    return { ok: true, message: "Assignment removed." };
  } catch (err) {
    return toActionState(err);
  }
}

// ─── FairJudge ───────────────────────────────────────────────────────────────

export async function openReviewStageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    await openReviewStage(user, ev(fd));
    refresh(ev(fd));
    return { ok: true, message: "Review stage opened. Individual scores are now visible to authorised reviewers." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function openTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    await openTicket(user, ev(fd), String(fd.get("submissionId") ?? ""), String(fd.get("reason") ?? "").trim());
    refresh(ev(fd));
    return { ok: true, message: "Review ticket opened." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function decideTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const parsed = ticketDecisionSchema.safeParse(formToObject(fd));
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
    await decideTicket(user, parsed.data);
    refresh(ev(fd));
    return { ok: true, message: "Decision recorded." };
  } catch (err) {
    return toActionState(err);
  }
}

// ─── Results ─────────────────────────────────────────────────────────────────

const METHODS: ScoringMethod[] = ["MEAN", "MEDIAN", "TRIMMED_MEAN"];

export async function computeResultsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const method = String(fd.get("method")) as ScoringMethod;
    if (!METHODS.includes(method)) throw new AppError("Choose a scoring method.");
    const { ranked, unscored } = await computeResults(user, ev(fd), method);
    refresh(ev(fd));
    return { ok: true, message: `${ranked} project(s) ranked.${unscored ? ` ${unscored} without submitted evaluations were left out.` : ""}` };
  } catch (err) {
    return toActionState(err);
  }
}

export async function setPublishedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const publish = fd.get("publish") === "true";
    const result = await setResultsPublished(user, ev(fd), publish);
    refresh(ev(fd));
    revalidatePath("/explore", "layout");
    return {
      ok: true,
      message: publish
        ? `Results published.${result.unawardedPrizeCount ? ` ${result.unawardedPrizeCount} prize(s) remain unawarded.` : ""}${result.notificationsBackground ? " Participant notifications are being sent in the background." : ""}`
        : "Results unpublished.",
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function awardPrizeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const eventId = ev(fd);
    await awardPrize(user, eventId, String(fd.get("prizeId") ?? ""), String(fd.get("resultId") ?? ""));
    refresh(eventId);
    revalidatePath(`/explore/${eventId}`);
    return { ok: true, message: "Prize awarded. The leaderboard will show it after results are published." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function revokePrizeAwardAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(STAFF);
    const eventId = ev(fd);
    await revokePrizeAward(user, eventId, String(fd.get("awardId") ?? ""));
    refresh(eventId);
    revalidatePath(`/explore/${eventId}`);
    return { ok: true, message: "Prize award revoked." };
  } catch (err) {
    return toActionState(err);
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

const ROLES: Role[] = ["ADMIN", "ORGANIZER", "PARTICIPANT", "JUDGE"];

export async function setUserRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireUser(["ADMIN"]);
    const userId = String(fd.get("userId") ?? "");
    const role = String(fd.get("role")) as Role;
    if (!ROLES.includes(role)) throw new AppError("Invalid role.");
    if (userId === admin.id && role !== "ADMIN") throw new AppError("You cannot remove your own admin role.");
    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) throw new AppError("User not found.", 404);
    await db.user.update({ where: { id: userId }, data: { role } });
    await audit({
      actorId: admin.id,
      action: "user.role_changed",
      entityType: "User",
      entityId: userId,
      metadata: { from: target.role, to: role, email: target.email },
    });
    revalidatePath("/settings");
    return { ok: true, message: `${target.name} is now ${role.toLowerCase()}.` };
  } catch (err) {
    return toActionState(err);
  }
}
