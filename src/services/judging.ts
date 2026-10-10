import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { weightedTotal, type ScoreMap } from "@/lib/scoring";
import { judgeAssignmentsEmail } from "@/emails";
import { sendNotificationBatch, sendUserNotification } from "@/services/email-notifications";

const JUDGEABLE = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] as const;

// ─── Organizer side ──────────────────────────────────────────────────────────

export async function addJudge(user: CurrentUser, eventId: string, email: string, expertise?: string) {
  const event = await assertCanManageEvent(user, eventId);
  const judge = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!judge) throw new NotFoundError("A user with that email");
  if (judge.role !== "JUDGE") throw new AppError("That account is not a Judge account. An admin can change its role in Settings.");
  const existing = await db.eventJudge.findUnique({ where: { eventId_userId: { eventId, userId: judge.id } } });
  if (existing) throw new ConflictError("This judge is already on the panel.");
  const row = await db.eventJudge.create({ data: { eventId, userId: judge.id, expertise: expertise || null } });
  await audit({ actorId: user.id, eventId, action: "judge.added", entityType: "EventJudge", entityId: row.id, metadata: { judge: judge.email } });
  await sendUserNotification(
    {
      email: judge.email,
      emailNotifications: judge.emailNotifications,
      isDemo: judge.isDemo,
    },
    "judge-assignments",
    judgeAssignmentsEmail({ judgeName: judge.name, eventName: event.name, newProjects: 0 }),
    eventId,
  );
  return row;
}

export async function removeJudge(user: CurrentUser, eventJudgeId: string) {
  const row = await db.eventJudge.findUnique({
    where: { id: eventJudgeId },
    include: { assignments: { include: { evaluation: true } } },
  });
  if (!row) throw new NotFoundError("Judge");
  await assertCanManageEvent(user, row.eventId);
  if (row.assignments.some((a) => a.evaluation?.status === "SUBMITTED")) {
    throw new ConflictError("This judge has submitted evaluations and cannot be removed. Use FairJudge to exclude scores.");
  }
  await db.eventJudge.delete({ where: { id: row.id } });
  await audit({ actorId: user.id, eventId: row.eventId, action: "judge.removed", entityType: "EventJudge", entityId: row.id });
}

/**
 * Balanced auto-assignment: each judgeable submission gets up to
 * `judgesPerSubmission` judges, preferring the least-loaded judge and
 * skipping conflicts (a judge who is a member of the team).
 */
export async function autoAssign(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  const judges = await db.eventJudge.findMany({
    where: { eventId },
    include: {
      user: { select: { name: true, email: true, emailNotifications: true, isDemo: true } },
      _count: { select: { assignments: true } },
    },
  });
  if (judges.length === 0) throw new AppError("Add judges to the panel first.");
  const submissions = await db.submission.findMany({
    where: { eventId, status: { in: [...JUDGEABLE] } },
    include: { assignments: true, team: { include: { members: { select: { userId: true } } } } },
    orderBy: { submittedAt: "asc" },
  });
  if (submissions.length === 0) throw new AppError("No submitted projects to assign yet.");

  const load = new Map<string, number>(judges.map((j) => [j.id, j._count.assignments] as [string, number]));
  const creates: { eventId: string; eventJudgeId: string; submissionId: string }[] = [];
  let shortfall = 0;
  for (const sub of submissions) {
    const memberIds = new Set(sub.team.members.map((m) => m.userId));
    const already = new Set(sub.assignments.map((a) => a.eventJudgeId));
    let needed = event.judgesPerSubmission - already.size;
    const candidates = judges
      .filter((j) => !already.has(j.id) && !memberIds.has(j.userId))
      .sort((a, b) => load.get(a.id)! - load.get(b.id)!);
    for (const j of candidates) {
      if (needed <= 0) break;
      creates.push({ eventId, eventJudgeId: j.id, submissionId: sub.id });
      load.set(j.id, load.get(j.id)! + 1);
      needed--;
    }
    if (needed > 0) shortfall += needed;
  }
  if (creates.length) await db.judgeAssignment.createMany({ data: creates });
  await audit({
    actorId: user.id,
    eventId,
    action: "judging.auto_assigned",
    entityType: "JudgeAssignment",
    metadata: { created: creates.length, shortfall },
  });
  const newAssignmentsByJudge = new Map<string, number>();
  for (const assignment of creates) {
    newAssignmentsByJudge.set(assignment.eventJudgeId, (newAssignmentsByJudge.get(assignment.eventJudgeId) ?? 0) + 1);
  }
  const notifications = await sendNotificationBatch(
    judges.flatMap((judge) => {
      const newProjects = newAssignmentsByJudge.get(judge.id) ?? 0;
      if (newProjects === 0) return [];
      return [{
        email: judge.user.email,
        emailNotifications: judge.user.emailNotifications,
        isDemo: judge.user.isDemo,
        content: judgeAssignmentsEmail({ judgeName: judge.user.name, eventName: event.name, newProjects }),
      }];
    }),
    { template: "judge-assignments", eventId },
  );
  return { created: creates.length, shortfall, notificationsBackground: notifications.background };
}

export async function removeAssignment(user: CurrentUser, assignmentId: string) {
  const a = await db.judgeAssignment.findUnique({ where: { id: assignmentId }, include: { evaluation: true } });
  if (!a) throw new NotFoundError("Assignment");
  await assertCanManageEvent(user, a.eventId);
  if (a.evaluation?.status === "SUBMITTED") throw new ConflictError("Submitted evaluations cannot be unassigned.");
  await db.judgeAssignment.delete({ where: { id: a.id } });
  await audit({ actorId: user.id, eventId: a.eventId, action: "judging.unassigned", entityType: "JudgeAssignment", entityId: a.id });
}

/** Organizer view of progress — counts only, never individual scores. */
export async function judgingOverview(eventId: string) {
  const judges = await db.eventJudge.findMany({
    where: { eventId },
    include: {
      user: { select: { name: true, email: true, isDemo: true } },
      assignments: {
        include: {
          evaluation: { select: { status: true } },
          submission: { select: { id: true, title: true, team: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return judges.map((j) => ({
    id: j.id,
    name: j.user.name,
    email: j.user.email,
    expertise: j.expertise,
    isDemo: j.isDemo || j.user.isDemo,
    total: j.assignments.length,
    submitted: j.assignments.filter((a) => a.evaluation?.status === "SUBMITTED").length,
    inProgress: j.assignments.filter((a) => a.evaluation?.status === "DRAFT").length,
    assignments: j.assignments.map((a) => ({
      id: a.id,
      submissionTitle: a.submission.title,
      teamName: a.submission.team.name,
      status: a.evaluation?.status === "SUBMITTED" ? "SUBMITTED" : a.evaluation ? "IN_PROGRESS" : "ASSIGNED",
    })),
  }));
}

// ─── Judge side ──────────────────────────────────────────────────────────────

export async function listMyAssignments(user: CurrentUser) {
  return db.judgeAssignment.findMany({
    where: { eventJudge: { userId: user.id } },
    include: {
      event: { select: { id: true, name: true, status: true } },
      submission: { include: { team: { select: { name: true } }, track: true } },
      evaluation: { select: { status: true, totalScore: true, updatedAt: true, submittedAt: true, isDemo: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAssignmentForJudge(user: CurrentUser, assignmentId: string) {
  const a = await db.judgeAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      eventJudge: true,
      event: { include: { criteria: { orderBy: { order: "asc" } } } },
      submission: {
        include: {
          team: { include: { members: { include: { user: { select: { name: true } } } } } },
          track: true,
          files: { select: { id: true, fileName: true, mimeType: true, size: true } },
        },
      },
      evaluation: true,
    },
  });
  // Judges only see their own assignments — and only their own scores.
  if (!a || a.eventJudge.userId !== user.id) throw new NotFoundError("Assignment");
  return a;
}

export async function saveEvaluation(
  user: CurrentUser,
  assignmentId: string,
  form: FormData,
): Promise<{ submitted: boolean; total: number | null }> {
  if (user.role !== "JUDGE") throw new ForbiddenError("Only judges can score projects.");
  const a = await getAssignmentForJudge(user, assignmentId);
  if (a.evaluation?.status === "SUBMITTED") {
    throw new ConflictError("This evaluation was submitted and is locked. An organizer can reopen it via FairJudge.");
  }
  if (!["LIVE", "JUDGING"].includes(a.event.status)) throw new AppError("Judging is not open for this event.");

  const intent = form.get("intent") === "submit" ? "submit" : "draft";
  const scores: ScoreMap = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const c of a.event.criteria) {
    const raw = String(form.get(`score_${c.id}`) ?? "").trim();
    if (!raw) {
      if (intent === "submit") fieldErrors[`score_${c.id}`] = ["Score required"];
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > c.maxScore) {
      fieldErrors[`score_${c.id}`] = [`Enter 0–${c.maxScore}`];
      continue;
    }
    scores[c.id] = Math.round(n * 10) / 10;
  }
  const feedback = String(form.get("feedback") ?? "").trim().slice(0, 5000);
  if (intent === "submit" && feedback.length < 20) fieldErrors.feedback = ["Write at least 20 characters of feedback"];
  if (Object.keys(fieldErrors).length) throw new AppError("Please fix the highlighted scores.", 400, fieldErrors);

  const total = weightedTotal(
    a.event.criteria.map((c) => ({ id: c.id, name: c.name, weight: c.weight, maxScore: c.maxScore })),
    scores,
  );
  const data = {
    scores: scores as Prisma.InputJsonValue,
    totalScore: total,
    feedback: feedback || null,
    status: intent === "submit" ? ("SUBMITTED" as const) : ("DRAFT" as const),
    submittedAt: intent === "submit" ? new Date() : null,
    isDemo: false,
  };
  await db.$transaction(async (tx) => {
    await tx.evaluation.upsert({
      where: { assignmentId: a.id },
      create: { assignmentId: a.id, ...data },
      update: data,
    });
    await tx.judgeAssignment.update({
      where: { id: a.id },
      data: { status: intent === "submit" ? "SUBMITTED" : "IN_PROGRESS" },
    });
    await audit(
      {
        actorId: user.id,
        eventId: a.eventId,
        action: intent === "submit" ? "evaluation.submitted" : "evaluation.draft_saved",
        entityType: "Evaluation",
        entityId: a.id,
        // Scores are deliberately not written to the audit log to keep them private.
        metadata: { assignmentId: a.id },
      },
      tx,
    );
  });
  return { submitted: intent === "submit", total };
}
