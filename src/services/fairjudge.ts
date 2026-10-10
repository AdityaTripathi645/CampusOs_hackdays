import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { spread } from "@/lib/scoring";

/**
 * FairJudge surfaces *score differences* for human review. A large spread is
 * a prompt to look closer — it is never treated as evidence of judge bias.
 */

const scoreMapSchema = z.record(z.string(), z.number());

export async function openReviewStage(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  if (event.scoresRevealed) return;
  await db.event.update({ where: { id: eventId }, data: { scoresRevealed: true } });
  await audit({
    actorId: user.id,
    eventId,
    action: "fairjudge.review_stage_opened",
    entityType: "Event",
    entityId: eventId,
    metadata: { note: "Individual judge scores became visible to authorised reviewers" },
  });
}

export async function getDiscrepancyReport(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  const criteria = await db.rubricCriterion.findMany({ where: { eventId }, orderBy: { order: "asc" } });
  const submissions = await db.submission.findMany({
    where: { eventId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } },
    include: {
      team: { select: { name: true } },
      tickets: { orderBy: { createdAt: "desc" } },
      assignments: {
        include: {
          eventJudge: { include: { user: { select: { name: true } } } },
          evaluation: true,
        },
      },
    },
    orderBy: { title: "asc" },
  });

  const progress = submissions.map((s) => ({
    id: s.id,
    submitted: s.assignments.filter((a) => a.evaluation?.status === "SUBMITTED").length,
    assigned: s.assignments.length,
  }));

  if (!event.scoresRevealed) {
    return { revealed: false as const, threshold: event.discrepancyThreshold, progress, rows: [] };
  }

  const rows = submissions.map((s) => {
    const evals = s.assignments
      .filter((a) => a.evaluation?.status === "SUBMITTED")
      .map((a) => {
        const scores = scoreMapSchema.safeParse(a.evaluation!.scores);
        return {
          evaluationId: a.evaluation!.id,
          judgeName: a.eventJudge.user.name,
          total: a.evaluation!.totalScore ?? 0,
          scores: scores.success ? scores.data : {},
          excluded: a.evaluation!.excluded,
          isDemo: a.evaluation!.isDemo,
          feedback: a.evaluation!.feedback,
        };
      });
    const counted = evals.filter((e) => !e.excluded);
    const totalSpread = spread(counted.map((e) => e.total));
    const criterionSpreads = criteria.map((c) => {
      const vals = counted.map((e) => e.scores[c.id]).filter((v): v is number => typeof v === "number");
      // Normalise to 0–100 so criteria with different max scores are comparable.
      return { criterionId: c.id, name: c.name, spread: spread(vals.map((v) => (v / c.maxScore) * 100)) };
    });
    return {
      submissionId: s.id,
      title: s.title,
      teamName: s.team.name,
      evaluations: evals,
      spread: totalSpread,
      criterionSpreads,
      flagged: counted.length >= 2 && totalSpread >= event.discrepancyThreshold,
      openTicket: s.tickets.find((t) => t.status === "OPEN") ?? null,
      tickets: s.tickets,
    };
  });
  return { revealed: true as const, threshold: event.discrepancyThreshold, progress, rows };
}

export async function openTicket(user: CurrentUser, eventId: string, submissionId: string, reason: string) {
  const event = await assertCanManageEvent(user, eventId);
  if (!event.scoresRevealed) throw new AppError("Open the review stage before creating review tickets.");
  const sub = await db.submission.findFirst({ where: { id: submissionId, eventId } });
  if (!sub) throw new NotFoundError("Submission");
  const open = await db.reviewTicket.findFirst({ where: { submissionId, status: "OPEN" } });
  if (open) throw new ConflictError("A review ticket is already open for this project.");
  const evals = await db.evaluation.findMany({
    where: { assignment: { submissionId }, status: "SUBMITTED", excluded: false },
    select: { totalScore: true },
  });
  const ticket = await db.reviewTicket.create({
    data: {
      eventId,
      submissionId,
      reason: reason.slice(0, 1000) || "Score difference above threshold",
      spread: spread(evals.map((e) => e.totalScore ?? 0)),
      openedById: user.id,
    },
  });
  await audit({ actorId: user.id, eventId, action: "fairjudge.ticket_opened", entityType: "ReviewTicket", entityId: ticket.id, metadata: { submissionId } });
  return ticket;
}

export async function decideTicket(
  user: CurrentUser,
  input: {
    ticketId: string;
    decision: "KEEP_SCORES" | "REQUEST_RESCORE" | "EXCLUDE_EVALUATION" | "DISMISS";
    targetEvaluationId?: string;
    decisionNote: string;
  },
) {
  const ticket = await db.reviewTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw new NotFoundError("Ticket");
  await assertCanManageEvent(user, ticket.eventId);
  if (ticket.status !== "OPEN") throw new ConflictError("This ticket is already closed.");

  const needsTarget = input.decision === "REQUEST_RESCORE" || input.decision === "EXCLUDE_EVALUATION";
  let target: { id: string; assignmentId: string } | null = null;
  if (needsTarget) {
    if (!input.targetEvaluationId) throw new AppError("Choose which evaluation this decision applies to.", 400, { targetEvaluationId: ["Required"] });
    target = await db.evaluation.findFirst({
      where: { id: input.targetEvaluationId, assignment: { submissionId: ticket.submissionId } },
      select: { id: true, assignmentId: true },
    });
    if (!target) throw new AppError("That evaluation does not belong to this project.");
  }

  await db.$transaction(async (tx) => {
    if (input.decision === "REQUEST_RESCORE" && target) {
      await tx.evaluation.update({ where: { id: target.id }, data: { status: "DRAFT", submittedAt: null } });
      await tx.judgeAssignment.update({ where: { id: target.assignmentId }, data: { status: "IN_PROGRESS" } });
    }
    if (input.decision === "EXCLUDE_EVALUATION" && target) {
      await tx.evaluation.update({ where: { id: target.id }, data: { excluded: true } });
    }
    await tx.reviewTicket.update({
      where: { id: ticket.id },
      data: {
        status: input.decision === "DISMISS" ? "DISMISSED" : "RESOLVED",
        decision: input.decision === "DISMISS" ? null : input.decision,
        targetEvaluationId: target?.id ?? null,
        decisionNote: input.decisionNote,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
    });
    await audit(
      {
        actorId: user.id,
        eventId: ticket.eventId,
        action: "fairjudge.ticket_decided",
        entityType: "ReviewTicket",
        entityId: ticket.id,
        metadata: { decision: input.decision, targetEvaluationId: target?.id ?? null, note: input.decisionNote },
      },
      tx,
    );
  });
}
