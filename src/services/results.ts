import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { ScoringMethod } from "@/lib/domain";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ConflictError } from "@/lib/errors";
import { aggregate, rank } from "@/lib/scoring";
import { toCsv } from "@/lib/utils";
import { resultsPublishedEmail } from "@/emails";
import { sendNotificationBatch } from "@/services/email-notifications";

export type ResultRow = {
  submissionId: string;
  title: string;
  teamName: string;
  trackId: string | null;
  trackName: string | null;
  trackRank: number | null;
  judgeCount: number;
  assigned: number;
  score: number;
  isDemo: boolean;
};

/** Preview what results would look like with a given method — nothing is stored. */
export async function previewResults(user: CurrentUser, eventId: string, method: ScoringMethod) {
  await assertCanManageEvent(user, eventId);
  const subs = await db.submission.findMany({
    where: { eventId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } },
    include: {
      team: { select: { name: true } },
      track: true,
      assignments: { include: { evaluation: true } },
    },
  });
  const scored = subs
    .map((s): Omit<ResultRow, "score"> & { score: number | null } => {
      const values = s.assignments
        .map((a) => a.evaluation)
        .filter((e) => e && e.status === "SUBMITTED" && !e.excluded && typeof e.totalScore === "number")
        .map((e) => e!.totalScore!);
      const anyDemo = s.isDemo || s.assignments.some((a) => a.evaluation?.isDemo === true);
      return {
        submissionId: s.id,
        title: s.title,
        teamName: s.team.name,
        trackId: s.trackId,
        trackName: s.track?.name ?? null,
        trackRank: null,
        judgeCount: values.length,
        assigned: s.assignments.length,
        score: aggregate(values, method),
        isDemo: anyDemo,
      };
    });
  const withScores = scored.flatMap((s) => (s.score === null ? [] : [{ ...s, score: s.score, trackRank: null as number | null }]));
  const byTrack = new Map<string, typeof withScores>();
  for (const row of withScores) {
    if (!row.trackId) continue;
    const rows = byTrack.get(row.trackId) ?? [];
    rows.push(row);
    byTrack.set(row.trackId, rows);
  }
  for (const rows of byTrack.values()) {
    for (const row of rank(rows)) row.trackRank = row.rank;
  }
  const unscored = subs.length - withScores.length;
  return { rows: rank(withScores), unscored };
}

export async function computeResults(user: CurrentUser, eventId: string, method: ScoringMethod) {
  const event = await assertCanManageEvent(user, eventId);
  if (event.resultsPublished) throw new ConflictError("Unpublish results before recomputing them.");
  const existingAwards = await db.prizeAward.count({ where: { prize: { eventId } } });
  if (existingAwards > 0) throw new ConflictError("Revoke existing prize awards before recomputing results.");
  const { rows, unscored } = await previewResults(user, eventId, method);
  if (rows.length === 0) throw new AppError("No submitted evaluations yet — nothing to compute.");
  await db.$transaction(async (tx) => {
    await tx.result.deleteMany({ where: { eventId } });
    await tx.result.createMany({
      data: rows.map((r) => ({
        eventId,
        submissionId: r.submissionId,
        trackId: r.trackId,
        rank: r.rank,
        trackRank: r.trackRank,
        finalScore: r.score,
        judgeCount: r.judgeCount,
        method,
      })),
    });
    await tx.event.update({ where: { id: eventId }, data: { scoringMethod: method } });
    await audit(
      { actorId: user.id, eventId, action: "results.computed", entityType: "Result", metadata: { method, ranked: rows.length, unscored } },
      tx,
    );
  });
  return { ranked: rows.length, unscored };
}

export async function setResultsPublished(user: CurrentUser, eventId: string, publish: boolean) {
  const event = await assertCanManageEvent(user, eventId);
  let unawardedPrizeCount = 0;
  if (publish) {
    const count = await db.result.count({ where: { eventId } });
    if (count === 0) throw new AppError("Compute results before publishing.");
    const open = await db.reviewTicket.count({ where: { eventId, status: "OPEN" } });
    if (open > 0) throw new ConflictError(`Resolve ${open} open FairJudge ticket(s) before publishing.`);
    const pendingEvals = await db.judgeAssignment.count({
      where: { eventId, OR: [{ evaluation: null }, { evaluation: { status: "DRAFT" } }] },
    });
    if (pendingEvals > 0) throw new ConflictError(`${pendingEvals} assigned evaluation(s) are not submitted yet.`);
    const [prizeCount, awardedPrizeCount] = await Promise.all([
      db.prize.count({ where: { eventId } }),
      db.prizeAward.count({ where: { prize: { eventId } } }),
    ]);
    unawardedPrizeCount = prizeCount - awardedPrizeCount;
  }
  await db.event.update({ where: { id: eventId }, data: { resultsPublished: publish } });
  await audit({
    actorId: user.id,
    eventId,
    action: publish ? "results.published" : "results.unpublished",
    entityType: "Event",
    entityId: eventId,
  });
  if (!publish) return { notificationsBackground: false, notificationCount: 0, unawardedPrizeCount: 0 };

  const approved = await db.registration.findMany({
    where: { eventId, status: "APPROVED" },
    select: {
      user: { select: { name: true, email: true, emailNotifications: true, isDemo: true } },
    },
  });
  const notifications = await sendNotificationBatch(
    approved.map(({ user: participant }) => ({
      email: participant.email,
      emailNotifications: participant.emailNotifications,
      isDemo: participant.isDemo,
      content: resultsPublishedEmail({ participantName: participant.name, eventName: event.name, eventId }),
    })),
    { template: "results-published", eventId },
  );
  return {
    notificationsBackground: notifications.background,
    notificationCount: notifications.attempted,
    unawardedPrizeCount,
  };
}

export async function getStoredResults(eventId: string) {
  return db.result.findMany({
    where: { eventId },
    orderBy: { rank: "asc" },
    include: {
      track: true,
      submission: {
        select: {
          title: true,
          isDemo: true,
          team: { select: { name: true } },
          prizeAwards: { include: { prize: true } },
        },
      },
    },
  });
}

export async function getPrizeSuggestions(user: CurrentUser, eventId: string) {
  await assertCanManageEvent(user, eventId);
  const [prizes, results] = await Promise.all([
    db.prize.findMany({
      where: { eventId },
      orderBy: [{ track: { name: "asc" } }, { name: "asc" }],
      include: {
        track: true,
        award: {
          include: { submission: { select: { title: true, team: { select: { name: true } } } } },
        },
      },
    }),
    getStoredResults(eventId),
  ]);
  return prizes.map((prize) => ({
    ...prize,
    suggestion:
      results.find((result) =>
        (!prize.trackId || result.trackId === prize.trackId) &&
        (prize.trackId ? result.trackRank : result.rank) === prize.rank
      ) ?? null,
  }));
}

export async function awardPrize(user: CurrentUser, eventId: string, prizeId: string, resultId: string) {
  await assertCanManageEvent(user, eventId);
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { resultsPublished: true } });
  if (event.resultsPublished) throw new ConflictError("Unpublish results before awarding or changing a prize.");
  const [prize, result] = await Promise.all([
    db.prize.findFirst({ where: { id: prizeId, eventId }, include: { award: true } }),
    db.result.findFirst({ where: { id: resultId, eventId }, include: { submission: { select: { id: true, title: true } } } }),
  ]);
  if (!prize || !result) throw new AppError("Prize or result not found.", 404);
  if (prize.award) throw new ConflictError("This prize has already been awarded.");
  if (prize.trackId && prize.trackId !== result.trackId)
    throw new AppError("The selected result is not in this prize's track.");

  await db.$transaction(async (tx) => {
    const award = await tx.prizeAward.create({
      data: { prizeId, submissionId: result.submission.id, awardedById: user.id },
    });
    await audit(
      {
        actorId: user.id,
        eventId,
        action: "prize.awarded",
        entityType: "PrizeAward",
        entityId: award.id,
        metadata: { prizeId, prize: prize.name, submissionId: result.submission.id, submission: result.submission.title },
      },
      tx,
    );
  });
}

export async function revokePrizeAward(user: CurrentUser, eventId: string, awardId: string) {
  await assertCanManageEvent(user, eventId);
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { resultsPublished: true } });
  if (event.resultsPublished) throw new ConflictError("Unpublish results before revoking a prize award.");
  const award = await db.prizeAward.findFirst({
    where: { id: awardId, prize: { eventId } },
    include: { prize: true, submission: { select: { title: true } } },
  });
  if (!award) throw new AppError("Prize award not found.", 404);

  await db.$transaction(async (tx) => {
    await tx.prizeAward.delete({ where: { id: award.id } });
    await audit(
      {
        actorId: user.id,
        eventId,
        action: "prize.revoked",
        entityType: "PrizeAward",
        entityId: award.id,
        metadata: { prizeId: award.prizeId, prize: award.prize.name, submissionId: award.submissionId, submission: award.submission.title },
      },
      tx,
    );
  });
}

export async function resultsCsv(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  const rows = await getStoredResults(eventId);
  const csv = toCsv(
    rows.map((r) => ({
      rank: r.rank,
      track_rank: r.trackRank ?? "",
      project: r.submission.title,
      team: r.submission.team.name,
      track: r.track?.name ?? "",
      prizes: r.submission.prizeAwards.map((award) => award.prize.name).join("; "),
      final_score: r.finalScore,
      judges_counted: r.judgeCount,
      method: r.method,
      published: event.resultsPublished ? "yes" : "no",
      demo_data: r.submission.isDemo ? "yes" : "no",
    })),
  );
  await audit({ actorId: user.id, eventId, action: "results.exported", entityType: "Event", entityId: eventId });
  return { csv, filename: `${event.slug}-results${event.resultsPublished ? "" : "-DRAFT"}.csv` };
}
