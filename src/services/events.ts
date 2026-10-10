import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, ConflictError, ForbiddenError } from "@/lib/errors";
import { randomCode, slugify } from "@/lib/utils";
import { registrationFieldSchema, type EventInput, type RegistrationField } from "@/lib/validation";
import { z } from "zod";

export function parseRegistrationFields(value: Prisma.JsonValue): RegistrationField[] {
  const parsed = z.array(registrationFieldSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function listManagedEvents(user: CurrentUser) {
  return db.event.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    orderBy: { startsAt: "desc" },
    include: {
      _count: { select: { registrations: true, teams: true, submissions: true, attendance: true } },
    },
  });
}

export async function listPublicEvents() {
  return db.event.findMany({
    where: { status: { in: ["PUBLISHED", "LIVE", "JUDGING", "COMPLETED"] } },
    orderBy: { startsAt: "asc" },
    include: { tracks: true, _count: { select: { registrations: true, teams: true } } },
  });
}

export async function getEventWithConfig(eventId: string) {
  return db.event.findUnique({
    where: { id: eventId },
    include: {
      tracks: { orderBy: { name: "asc" } },
      criteria: { orderBy: { order: "asc" } },
      rooms: { orderBy: { name: "asc" }, include: { _count: { select: { seats: true } } } },
      prizes: { orderBy: { order: "asc" }, include: { track: true } },
      owner: { select: { name: true, email: true } },
    },
  });
}

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name) || "event";
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const existing = await db.event.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${randomCode(4).toLowerCase()}`;
  }
  return `${base}-${Date.now()}`;
}

function scalarData(input: EventInput) {
  return {
    name: input.name,
    tagline: input.tagline ?? null,
    description: input.description,
    venue: input.venue ?? null,
    status: input.status,
    registrationOpensAt: input.registrationOpensAt,
    registrationClosesAt: input.registrationClosesAt,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    submissionDeadline: input.submissionDeadline,
    timeZone: input.timeZone,
    eligibility: input.eligibility ?? null,
    maxParticipants: input.maxParticipants ?? null,
    minTeamSize: input.minTeamSize,
    maxTeamSize: input.maxTeamSize,
    scoringMethod: input.scoringMethod,
    discrepancyThreshold: input.discrepancyThreshold,
    judgesPerSubmission: input.judgesPerSubmission,
    registrationFields: input.registrationFields as Prisma.InputJsonValue,
  };
}

export async function createEvent(user: CurrentUser, input: EventInput) {
  if (user.role !== "ADMIN" && user.role !== "ORGANIZER") throw new ForbiddenError("Only organizers can create events.");
  const slug = await uniqueSlug(input.name);
  const event = await db.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        ...scalarData(input),
        slug,
        ownerId: user.id,
        tracks: { create: input.tracks.map((t) => ({ name: t.name, description: t.description || null })) },
        criteria: {
          create: input.criteria.map((c, i) => ({
            name: c.name,
            description: c.description || null,
            weight: c.weight,
            maxScore: c.maxScore,
            order: i,
          })),
        },
        rooms: {
          create: input.rooms.map((r) => ({ name: r.name, building: r.building || null, capacity: r.capacity })),
        },
      },
    });
    const tracks = await tx.track.findMany({ where: { eventId: created.id }, select: { id: true, name: true } });
    for (const [index, prize] of (input.prizes ?? []).entries()) {
      const track = prize.trackName
        ? tracks.find((candidate) => candidate.name.toLowerCase() === prize.trackName!.toLowerCase())
        : undefined;
      await tx.prize.create({
        data: {
          eventId: created.id,
          trackId: track?.id ?? null,
          name: prize.name,
          rank: prize.rank,
          description: prize.description || null,
          amount: prize.amount ?? null,
          order: index,
        },
      });
    }
    await audit(
      { actorId: user.id, eventId: created.id, action: "event.created", entityType: "Event", entityId: created.id },
      tx,
    );
    return created;
  });
  return event;
}

export async function updateEvent(user: CurrentUser, eventId: string, input: EventInput) {
  await assertCanManageEvent(user, eventId);
  const current = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      tracks: true,
      criteria: true,
      rooms: { include: { _count: { select: { seats: true } } } },
      prizes: { include: { award: true, track: true } },
    },
  });

  // Guard rubric changes once judging has produced scores.
  const evaluationCount = await db.evaluation.count({ where: { assignment: { eventId } } });
  const incomingCriteriaIds = new Set(input.criteria.map((c) => c.id).filter(Boolean));
  const removedCriteria = current.criteria.filter((c) => !incomingCriteriaIds.has(c.id));
  const addedCriteria = input.criteria.filter((c) => !c.id);
  if (evaluationCount > 0 && (removedCriteria.length > 0 || addedCriteria.length > 0)) {
    throw new ConflictError(
      "Judging has started: criteria cannot be added or removed. You can still edit names, descriptions and weights.",
    );
  }
  const changedMax = input.criteria.some((c) => {
    const old = current.criteria.find((o) => o.id === c.id);
    return old && old.maxScore !== c.maxScore;
  });
  if (evaluationCount > 0 && changedMax) {
    throw new ConflictError("Judging has started: a criterion's maximum score cannot change.");
  }

  const incomingRoomIds = new Set(input.rooms.map((r) => r.id).filter(Boolean));
  const removedRooms = current.rooms.filter((r) => !incomingRoomIds.has(r.id));
  const blockedRoom = removedRooms.find((r) => r._count.seats > 0);
  if (blockedRoom) {
    throw new ConflictError(`Room "${blockedRoom.name}" has seat assignments. Clear seats before removing it.`);
  }
  const shrunk = input.rooms.find((r) => {
    const old = current.rooms.find((o) => o.id === r.id);
    return old && r.capacity < old._count.seats;
  });
  if (shrunk) throw new ConflictError(`Room "${shrunk.name}" already has more seats assigned than the new capacity.`);

  const incomingTrackIds = new Set(input.tracks.map((t) => t.id).filter(Boolean));
  const removedTracks = current.tracks.filter((t) => !incomingTrackIds.has(t.id));
  const prizes =
    input.prizes ??
    current.prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      rank: prize.rank,
      description: prize.description ?? "",
      trackName: prize.track?.name ?? undefined,
      amount: prize.amount ?? undefined,
    }));
  const incomingPrizeIds = new Set(prizes.map((p) => p.id).filter(Boolean));
  const removedPrizes = current.prizes.filter((p) => !incomingPrizeIds.has(p.id));
  const removedAwardedPrize = removedPrizes.find((p) => p.award);
  if (removedAwardedPrize) {
    throw new ConflictError(`Prize "${removedAwardedPrize.name}" has already been awarded and cannot be removed.`);
  }
  const editedAwardedPrize = prizes.find((prize) => {
    const existing = current.prizes.find((item) => item.id === prize.id);
    return (
      existing?.award &&
      (existing.name !== prize.name ||
        existing.rank !== prize.rank ||
        (existing.track?.name ?? "").toLowerCase() !== (prize.trackName ?? "").toLowerCase())
    );
  });
  if (editedAwardedPrize) {
    throw new ConflictError(`Revoke the award for "${editedAwardedPrize.name}" before changing its name or track.`);
  }

  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: scalarData(input) });

    if (removedTracks.length) await tx.track.deleteMany({ where: { id: { in: removedTracks.map((t) => t.id) } } });
    for (const t of input.tracks) {
      if (t.id && current.tracks.some((o) => o.id === t.id)) {
        await tx.track.update({ where: { id: t.id }, data: { name: t.name, description: t.description || null } });
      } else {
        await tx.track.create({ data: { eventId, name: t.name, description: t.description || null } });
      }
    }

    if (removedCriteria.length)
      await tx.rubricCriterion.deleteMany({ where: { id: { in: removedCriteria.map((c) => c.id) } } });
    for (const [i, c] of input.criteria.entries()) {
      const data = { name: c.name, description: c.description || null, weight: c.weight, maxScore: c.maxScore, order: i };
      if (c.id && current.criteria.some((o) => o.id === c.id)) {
        await tx.rubricCriterion.update({ where: { id: c.id }, data });
      } else {
        await tx.rubricCriterion.create({ data: { ...data, eventId } });
      }
    }

    if (removedRooms.length) await tx.room.deleteMany({ where: { id: { in: removedRooms.map((r) => r.id) } } });
    for (const r of input.rooms) {
      const data = { name: r.name, building: r.building || null, capacity: r.capacity };
      if (r.id && current.rooms.some((o) => o.id === r.id)) {
        await tx.room.update({ where: { id: r.id }, data });
      } else {
        await tx.room.create({ data: { ...data, eventId } });
      }
    }

    if (removedPrizes.length)
      await tx.prize.deleteMany({ where: { id: { in: removedPrizes.map((p) => p.id) } } });
    const tracks = await tx.track.findMany({ where: { eventId }, select: { id: true, name: true } });
    for (const [index, prize] of prizes.entries()) {
      const track = prize.trackName
        ? tracks.find((candidate) => candidate.name.toLowerCase() === prize.trackName!.toLowerCase())
        : undefined;
      const data = {
        trackId: track?.id ?? null,
        name: prize.name,
        rank: prize.rank,
        description: prize.description || null,
        amount: prize.amount ?? null,
        order: index,
      };
      if (prize.id && current.prizes.some((p) => p.id === prize.id)) {
        await tx.prize.update({ where: { id: prize.id }, data });
      } else {
        await tx.prize.create({ data: { ...data, eventId } });
      }
    }

    await audit(
      {
        actorId: user.id,
        eventId,
        action: "event.updated",
        entityType: "Event",
        entityId: eventId,
        metadata: { status: input.status, previousStatus: current.status },
      },
      tx,
    );
  }, { timeout: 20_000 });
}

export async function deleteEvent(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  const subs = await db.submission.count({ where: { eventId, status: { not: "DRAFT" } } });
  if (subs > 0 && !event.isDemo) {
    throw new AppError("This event has submissions. Archive it instead of deleting it.", 409);
  }
  await db.event.delete({ where: { id: eventId } });
  await audit({ actorId: user.id, action: "event.deleted", entityType: "Event", entityId: eventId, metadata: { name: event.name } });
}

/** Registration window helper used by participant flows. */
export function registrationState(event: {
  status: string;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
}) {
  const now = new Date();
  if (!["PUBLISHED", "LIVE"].includes(event.status)) return { open: false, reason: "Registration is not open for this event." };
  if (now < event.registrationOpensAt) return { open: false, reason: "Registration has not opened yet." };
  if (now > event.registrationClosesAt) return { open: false, reason: "Registration has closed." };
  return { open: true, reason: null };
}
