import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { extractPptxText, isPptxFile } from "@/lib/pptx-text";
import { getStorage } from "@/lib/storage";
import { jsonStringArray } from "@/lib/utils";
import { screenSubmission } from "@/services/gemini";

export async function runScreening(user: CurrentUser, submissionId: string) {
  return runScreeningForSubmission(user, submissionId, true);
}

async function runScreeningForSubmission(user: CurrentUser, submissionId: string, applyRateLimit: boolean) {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      files: true,
      track: true,
      event: { include: { tracks: true, criteria: { orderBy: { order: "asc" } } } },
    },
  });
  if (!sub) throw new NotFoundError("Submission");
  await assertCanManageEvent(user, sub.eventId);
  if (applyRateLimit) {
    await enforceRateLimit(
      `screening:organizer:${user.id}:event:${sub.eventId}`,
      30,
      60 * 60 * 1000,
      "Too many screening runs for this event.",
    );
  }
  if (sub.status === "DRAFT") throw new AppError("Draft submissions are not screened. Wait until the team submits.");

  const storage = getStorage();
  const files = await Promise.all(
    sub.files.map(async (file) => {
      const pptx = isPptxFile(file.fileName, file.mimeType);
      const data =
        file.mimeType === "application/pdf" || pptx
          ? await storage.get(file.storageKey).catch((error: unknown) => {
              console.error(`[CampusOS] Could not read screening file ${file.fileName}`, error);
              return undefined;
            })
          : undefined;
      return {
        fileName: file.fileName,
        mimeType: file.mimeType,
        data: file.mimeType === "application/pdf" ? data : undefined,
        slides: pptx && data ? await extractPptxText(data) : undefined,
      };
    }),
  );

  const result = await screenSubmission({
    eventName: sub.event.name,
    title: sub.title,
    abstract: sub.abstract,
    technologies: jsonStringArray(sub.technologies),
    declaredTrack: sub.track?.name ?? null,
    repoUrl: sub.repoUrl,
    demoUrl: sub.demoUrl,
    tracks: sub.event.tracks.map((t) => ({ name: t.name, description: t.description })),
    criteria: sub.event.criteria.map((c) => ({ name: c.name, description: c.description })),
    files,
  });

  const review = await db.aIReview.create({
    data: {
      submissionId: sub.id,
      model: result.model,
      mode: result.mode,
      summary: result.output.summary,
      suggestedTrack: result.output.suggestedTrack,
      trackFitScore: result.output.trackFitScore,
      trackFitRationale: result.output.trackFitRationale,
      observations: result.output.observations as Prisma.InputJsonValue,
      missingInfo: result.output.missingInfo as Prisma.InputJsonValue,
      evidence: result.output.evidence as Prisma.InputJsonValue,
      extracted: result.output.extracted as Prisma.InputJsonValue,
      rawOutput: (result.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      createdById: user.id,
    },
  });
  await audit({
    actorId: user.id,
    eventId: sub.eventId,
    action: result.mode === "LIVE" ? "ai.screening_completed" : "ai.screening_demo_generated",
    entityType: "AIReview",
    entityId: review.id,
    metadata: { submissionId: sub.id, model: result.model, mode: result.mode },
  });
  return review;
}

/** Sequential batch to stay well within API rate limits. */
export async function runScreeningBatch(user: CurrentUser, eventId: string, submissionIds: string[]) {
  await assertCanManageEvent(user, eventId);
  await enforceRateLimit(
    `screening:organizer:${user.id}:event:${eventId}`,
    30,
    60 * 60 * 1000,
    "Too many screening runs for this event.",
  );
  const ids = submissionIds.slice(0, 10);
  const owned = await db.submission.findMany({ where: { id: { in: ids }, eventId }, select: { id: true } });
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const { id } of owned) {
    try {
      await runScreeningForSubmission(user, id, false);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof AppError ? err.message : "Failed" });
      if (err instanceof AppError && err.status >= 500) break; // stop on provider errors
    }
  }
  return results;
}

export async function decideAIReview(
  user: CurrentUser,
  input: {
    reviewId: string;
    decision: "ACCEPTED" | "OVERRIDDEN" | "DISMISSED";
    note?: string;
    submissionStatus: "UNCHANGED" | "UNDER_REVIEW" | "SHORTLISTED" | "REJECTED";
  },
) {
  const review = await db.aIReview.findUnique({ where: { id: input.reviewId }, include: { submission: true } });
  if (!review) throw new NotFoundError("AI review");
  await assertCanManageEvent(user, review.submission.eventId);
  if (input.decision === "OVERRIDDEN" && !input.note) {
    throw new AppError("Explain why you are overriding the AI suggestion.", 400, { note: ["Required when overriding"] });
  }
  await db.$transaction(async (tx) => {
    await tx.aIReview.update({
      where: { id: review.id },
      data: {
        status: input.decision,
        humanDecisionNote: input.note ?? null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    if (input.submissionStatus !== "UNCHANGED") {
      await tx.submission.update({ where: { id: review.submissionId }, data: { status: input.submissionStatus } });
    }
    await audit(
      {
        actorId: user.id,
        eventId: review.submission.eventId,
        action: "ai.review_decided",
        entityType: "AIReview",
        entityId: review.id,
        metadata: {
          decision: input.decision,
          submissionStatus: input.submissionStatus,
          aiMode: review.mode,
          decidedBy: "human",
        },
      },
      tx,
    );
  });
}

export async function listScreeningQueue(eventId: string) {
  const submissions = await db.submission.findMany({
    where: { eventId, status: { not: "DRAFT" } },
    orderBy: { submittedAt: "asc" },
    include: {
      team: { select: { name: true } },
      track: true,
      files: { select: { id: true, fileName: true, mimeType: true, storageKey: true } },
      aiReviews: {
        orderBy: { createdAt: "desc" },
        include: { reviewedBy: { select: { name: true } }, createdBy: { select: { name: true } } },
      },
    },
  });
  const storage = getStorage();
  return Promise.all(
    submissions.map(async (submission) => ({
      ...submission,
      files: await Promise.all(
        submission.files.map(async (file) => {
          const { storageKey, ...displayFile } = file;
          if (!isPptxFile(file.fileName, file.mimeType)) return { ...displayFile, slideCount: null };
          try {
            const data = await storage.get(storageKey);
            return { ...displayFile, slideCount: (await extractPptxText(data)).length };
          } catch (error) {
            console.error(`[CampusOS] Could not count slides in ${file.fileName}`, error);
            return { ...displayFile, slideCount: 0 };
          }
        }),
      ),
    })),
  );
}
