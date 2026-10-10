import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { isSubmissionStatus, type SubmissionStatus } from "@/lib/domain";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getStorage, maxUploadBytes } from "@/lib/storage";
import { ALLOWED_UPLOAD_TYPES, type submissionSchema } from "@/lib/validation";
import { submissionConfirmationEmail } from "@/emails";
import { sendNotificationBatch } from "@/services/email-notifications";

type SubmissionInput = z.infer<typeof submissionSchema>;

/** Sniff file signatures so a renamed executable can't pass as a PDF. */
function looksLikeAllowedFile(buf: Buffer, mime: string) {
  if (mime === "application/pdf") return buf.subarray(0, 5).toString("latin1") === "%PDF-";
  if (mime.includes("openxmlformats")) return buf[0] === 0x50 && buf[1] === 0x4b; // ZIP container
  if (mime === "application/vnd.ms-powerpoint") return buf[0] === 0xd0 && buf[1] === 0xcf; // OLE2
  return false;
}

export async function saveSubmission(user: CurrentUser, input: SubmissionInput, files: File[]) {
  if (user.role !== "PARTICIPANT") throw new ForbiddenError("Only participants can submit projects.");
  const membership = await db.teamMember.findUnique({
    where: { eventId_userId: { eventId: input.eventId, userId: user.id } },
    include: {
      team: {
        include: {
          submission: true,
          _count: { select: { members: true } },
          members: {
            include: {
              user: { select: { name: true, email: true, emailNotifications: true, isDemo: true } },
            },
          },
        },
      },
    },
  });
  if (!membership) throw new ForbiddenError("Create or join a team before submitting.");
  const event = await db.event.findUniqueOrThrow({ where: { id: input.eventId } });
  if (new Date() > event.submissionDeadline) throw new AppError("The submission deadline has passed.");
  if (!["PUBLISHED", "LIVE"].includes(event.status)) throw new AppError("Submissions are not open for this event.");

  const team = membership.team;
  const existing = team.submission;
  const existingStatus = existing?.status;
  if (existingStatus !== undefined && !isSubmissionStatus(existingStatus)) {
    throw new AppError("This submission has an invalid status and cannot be edited.");
  }
  if (existing && ["SHORTLISTED", "REJECTED"].includes(existing.status)) {
    throw new ConflictError("This submission has been reviewed and can no longer be edited.");
  }
  if (input.trackId) {
    const track = await db.track.findFirst({ where: { id: input.trackId, eventId: input.eventId } });
    if (!track) throw new AppError("Unknown track.");
  }
  if (input.intent === "submit" && team._count.members < event.minTeamSize) {
    throw new AppError(`Teams need at least ${event.minTeamSize} member(s) to submit.`);
  }

  // Validate files before writing anything.
  const realFiles = files.filter((f) => f && f.size > 0);
  if (realFiles.length > 3) throw new AppError("Attach at most 3 files.");
  const prepared: { file: File; buf: Buffer; ext: string }[] = [];
  for (const f of realFiles) {
    const ext = ALLOWED_UPLOAD_TYPES[f.type];
    if (!ext) throw new AppError(`"${f.name}" is not a PDF, PPT or PPTX file.`, 400, { files: ["Unsupported file type"] });
    if (f.size > maxUploadBytes()) throw new AppError(`"${f.name}" is larger than ${process.env.MAX_UPLOAD_MB ?? 20} MB.`);
    const buf = Buffer.from(await f.arrayBuffer());
    if (!looksLikeAllowedFile(buf, f.type)) throw new AppError(`"${f.name}" does not look like a valid ${ext.toUpperCase()} file.`);
    prepared.push({ file: f, buf, ext });
  }

  const status: SubmissionStatus =
    input.intent === "submit" ? (existingStatus && existingStatus !== "DRAFT" ? existingStatus : "SUBMITTED") : existingStatus ?? "DRAFT";
  const data = {
    title: input.title,
    abstract: input.abstract,
    trackId: input.trackId ?? null,
    technologies: input.technologies,
    repoUrl: input.repoUrl ?? null,
    demoUrl: input.demoUrl ?? null,
  };

  const storage = getStorage();
  const storedKeys: string[] = [];
  let submission: Awaited<ReturnType<typeof db.submission.findUniqueOrThrow>>;
  try {
    for (const p of prepared) {
      const key = `${input.eventId}/${team.id}/${randomUUID()}.${p.ext}`;
      await storage.put(key, p.buf, p.file.type);
      storedKeys.push(key);
    }

    submission = await db.$transaction(async (tx) => {
      const sub = existing
        ? await tx.submission.update({
            where: { id: existing.id },
            data: {
              ...data,
              status,
              version: { increment: 1 },
              submittedAt: input.intent === "submit" && !existing.submittedAt ? new Date() : existing.submittedAt,
              isDemo: false,
            },
          })
        : await tx.submission.create({
            data: {
              ...data,
              eventId: input.eventId,
              teamId: team.id,
              status,
              submittedAt: input.intent === "submit" ? new Date() : null,
            },
          });
      for (const [i, p] of prepared.entries()) {
        await tx.submissionFile.create({
          data: {
            submissionId: sub.id,
            fileName: p.file.name.slice(0, 200),
            mimeType: p.file.type,
            size: p.file.size,
            storageKey: storedKeys[i]!,
            uploadedById: user.id,
          },
        });
      }
      await tx.submissionRevision.create({
        data: {
          submissionId: sub.id,
          version: sub.version,
          snapshot: { ...data, status, files: prepared.map((p) => p.file.name) },
          note: input.intent === "submit" ? "Submitted" : "Draft saved",
          createdById: user.id,
        },
      });
      await audit(
        {
          actorId: user.id,
          eventId: input.eventId,
          action: input.intent === "submit" ? "submission.submitted" : "submission.draft_saved",
          entityType: "Submission",
          entityId: sub.id,
          metadata: { version: sub.version, files: prepared.length },
        },
        tx,
      );
      return sub;
    });
  } catch (err) {
    // Roll back stored files if the DB write failed.
    await Promise.all(storedKeys.map((k) => storage.delete(k).catch(() => undefined)));
    throw err;
  }

  if (input.intent === "submit") {
    const notifications = await sendNotificationBatch(
      membership.team.members.map((member) => ({
        email: member.user.email,
        emailNotifications: member.user.emailNotifications,
        isDemo: member.user.isDemo,
        content: submissionConfirmationEmail({
          participantName: member.user.name,
          teamName: team.name,
          eventName: event.name,
          version: submission.version,
        }),
      })),
      { template: "submission-confirmation", eventId: input.eventId },
    );
    return { ...submission, notificationsBackground: notifications.background };
  }
  return { ...submission, notificationsBackground: false };
}

export async function deleteSubmissionFile(user: CurrentUser, fileId: string) {
  const file = await db.submissionFile.findUnique({ where: { id: fileId }, include: { submission: true } });
  if (!file) throw new NotFoundError("File");
  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: file.submission.teamId, userId: user.id } },
  });
  if (!membership) throw new ForbiddenError();
  if (!["DRAFT", "SUBMITTED"].includes(file.submission.status)) throw new ConflictError("Files are locked after review starts.");
  await db.submissionFile.delete({ where: { id: fileId } });
  await getStorage().delete(file.storageKey).catch(() => undefined);
  await audit({
    actorId: user.id,
    eventId: file.submission.eventId,
    action: "submission.file_removed",
    entityType: "Submission",
    entityId: file.submissionId,
    metadata: { fileName: file.fileName },
  });
}

/** Authorised download: team members, event managers, or judges assigned to the submission. */
export async function getFileForDownload(user: CurrentUser, fileId: string) {
  const file = await db.submissionFile.findUnique({ where: { id: fileId }, include: { submission: { include: { event: true } } } });
  if (!file) throw new NotFoundError("File");
  const sub = file.submission;
  const allowed =
    user.role === "ADMIN" ||
    (user.role === "ORGANIZER" && sub.event.ownerId === user.id) ||
    (await db.teamMember.findUnique({ where: { teamId_userId: { teamId: sub.teamId, userId: user.id } } })) !== null ||
    (await db.judgeAssignment.findFirst({ where: { submissionId: sub.id, eventJudge: { userId: user.id } } })) !== null;
  if (!allowed) throw new ForbiddenError();
  return { file };
}

export async function setSubmissionStatus(user: CurrentUser, submissionId: string, status: SubmissionStatus) {
  const sub = await db.submission.findUnique({ where: { id: submissionId } });
  if (!sub) throw new NotFoundError("Submission");
  await assertCanManageEvent(user, sub.eventId);
  await db.submission.update({ where: { id: submissionId }, data: { status } });
  await audit({
    actorId: user.id,
    eventId: sub.eventId,
    action: "submission.status_changed",
    entityType: "Submission",
    entityId: submissionId,
    metadata: { from: sub.status, to: status, decidedBy: "human" },
  });
}

export async function listEventSubmissions(eventId: string) {
  return db.submission.findMany({
    where: { eventId },
    orderBy: { updatedAt: "desc" },
    include: {
      team: { include: { members: { include: { user: { select: { name: true } } } } } },
      track: true,
      files: true,
      aiReviews: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { assignments: true } },
    },
  });
}
