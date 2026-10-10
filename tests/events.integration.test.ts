import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "../src/lib/errors";
import { assertCanManageEvent } from "../src/lib/authz";
import { createEvent, listPublicEvents } from "../src/services/events";
import { getAssignmentForJudge, saveEvaluation, autoAssign } from "../src/services/judging";
import { checkIn } from "../src/services/operations";
import { setResultsPublished } from "../src/services/results";
import type { CurrentUser } from "../src/lib/auth";
import type { EventInput } from "../src/lib/validation";

const ownerId = "vitest-event-owner";
const owner: CurrentUser = {
  id: ownerId,
  name: "Test Organizer",
  email: "organizer@campusos.test",
  role: "ORGANIZER",
  institution: "Test University",
  isDemo: false,
  emailNotifications: true,
  emailVerifiedAt: null,
  locale: "en",
};
const otherOwnerId = "vitest-other-event-owner";
const participantId = "vitest-event-participant";
const pendingParticipantId = "vitest-pending-participant";
const judgeAId = "vitest-judge-a";
const judgeBId = "vitest-judge-b";
const judgeCId = "vitest-judge-c";

function userData(id: string, email: string, role: string) {
  return { id, name: id, email, passwordHash: "not-used-by-tests", role, emailNotifications: false };
}

const otherOwner: CurrentUser = {
  ...owner,
  id: otherOwnerId,
  email: "other-organizer@campusos.test",
};
const participant: CurrentUser = {
  ...owner,
  id: participantId,
  email: "participant@campusos.test",
  role: "PARTICIPANT",
};
const judgeA: CurrentUser = {
  ...owner,
  id: judgeAId,
  email: "judge-a@campusos.test",
  role: "JUDGE",
};
const judgeB: CurrentUser = {
  ...owner,
  id: judgeBId,
  email: "judge-b@campusos.test",
  role: "JUDGE",
};
const judgeC: CurrentUser = {
  ...owner,
  id: judgeCId,
  email: "judge-c@campusos.test",
  role: "JUDGE",
};

function eventInput(name = "Test Campus Hackathon"): EventInput {
  const registrationOpensAt = new Date("2030-01-01T09:00:00.000Z");
  return {
    name,
    tagline: "Build for campus",
    description: "A realistic test event for creating and validating event records.",
    venue: "Campus Hall",
    status: "DRAFT",
    timeZone: "Asia/Kolkata",
    registrationOpensAt,
    registrationClosesAt: new Date("2030-01-10T09:00:00.000Z"),
    startsAt: new Date("2030-02-01T09:00:00.000Z"),
    endsAt: new Date("2030-02-02T09:00:00.000Z"),
    submissionDeadline: new Date("2030-01-20T09:00:00.000Z"),
    eligibility: undefined,
    maxParticipants: undefined,
    minTeamSize: 1,
    maxTeamSize: 4,
    scoringMethod: "MEAN",
    discrepancyThreshold: 20,
    judgesPerSubmission: 2,
    tracks: [{ name: "Climate Action", description: "Climate and sustainability" }],
    criteria: [{ name: "Impact", description: "Expected positive impact", weight: 2, maxScore: 10 }],
    registrationFields: [],
    rooms: [{ name: "Main Hall", building: "Engineering", capacity: 100 }],
  };
}

describe("event service with SQLite", () => {
  beforeAll(async () => {
    await db.user.createMany({
      data: [
        userData(ownerId, owner.email, owner.role),
        userData(otherOwnerId, otherOwner.email, otherOwner.role),
        userData(participantId, participant.email, participant.role),
        userData(pendingParticipantId, "pending-participant@campusos.test", "PARTICIPANT"),
        userData(judgeAId, judgeA.email, judgeA.role),
        userData(judgeBId, judgeB.email, judgeB.role),
        userData(judgeCId, judgeC.email, judgeC.role),
      ],
    });
  });

  beforeEach(async () => {
    await db.event.deleteMany({});
  });

  afterAll(async () => {
    await db.event.deleteMany({});
    await db.user.deleteMany({ where: { id: { in: [ownerId, otherOwnerId, participantId, pendingParticipantId, judgeAId, judgeBId, judgeCId] } } });
    await db.$disconnect();
  });

  it("persists event configuration, nested relations and its audit record", async () => {
    const created = await createEvent(owner, eventInput());

    expect(created.slug).toBe("test-campus-hackathon");
    expect(created.ownerId).toBe(ownerId);
    const persisted = await db.event.findUniqueOrThrow({
      where: { id: created.id },
      include: { tracks: true, criteria: true, rooms: true },
    });
    expect(persisted.tracks).toMatchObject([{ name: "Climate Action" }]);
    expect(persisted.criteria).toMatchObject([{ name: "Impact", weight: 2, maxScore: 10, order: 0 }]);
    expect(persisted.rooms).toMatchObject([{ name: "Main Hall", capacity: 100 }]);
    expect(await db.auditLog.count({ where: { action: "event.created", entityId: created.id } })).toBe(1);
  });

  it("avoids slug collisions and lists only published public events", async () => {
    await createEvent(owner, eventInput());
    const second = await createEvent(owner, eventInput());
    await db.event.update({ where: { id: second.id }, data: { status: "PUBLISHED" } });

    expect(second.slug).not.toBe("test-campus-hackathon");
    const visible = await listPublicEvents();
    expect(visible.map(({ id }) => id)).toEqual([second.id]);
  });

  it("rejects event creation by participants", async () => {
    const participant = { ...owner, id: "participant-1", role: "PARTICIPANT" as const };
    await expect(createEvent(participant, eventInput())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("prevents one organizer from managing another organizer's event", async () => {
    const foreignEvent = await createEvent(otherOwner, eventInput("Other Organizer Event"));
    await expect(assertCanManageEvent(owner, foreignEvent.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not expose another judge's assignment and locks a submitted evaluation", async () => {
    const fixture = await createJudgingFixture("Judging Access Event");
    const assignment = await db.judgeAssignment.create({
      data: { eventId: fixture.event.id, eventJudgeId: fixture.judgeB.id, submissionId: fixture.submission.id },
    });
    await expect(getAssignmentForJudge(judgeC, assignment.id)).rejects.toBeInstanceOf(NotFoundError);

    const criterion = await db.rubricCriterion.findFirstOrThrow({ where: { eventId: fixture.event.id } });
    const form = new FormData();
    form.set("intent", "submit");
    form.set(`score_${criterion.id}`, "8");
    form.set("feedback", "Clear problem framing and a convincing prototype for the target users.");
    await saveEvaluation(judgeB, assignment.id, form);
    await expect(saveEvaluation(judgeB, assignment.id, form)).rejects.toBeInstanceOf(ConflictError);
  });

  it("skips judges who are members of the submission team during auto-assignment", async () => {
    const fixture = await createJudgingFixture("Conflict Avoidance Event");
    const assigned = await autoAssign(owner, fixture.event.id);
    expect(assigned.created).toBe(2);
    const assignments = await db.judgeAssignment.findMany({
      where: { submissionId: fixture.submission.id },
      include: { eventJudge: true },
    });
    expect(assignments).toHaveLength(2);
    expect(assignments.map(({ eventJudge }) => eventJudge.userId)).not.toContain(judgeAId);
  });

  it("makes check-in idempotent and rejects non-approved registrations", async () => {
    const event = await createEvent(owner, eventInput("Check-in Event"));
    const approved = await db.registration.create({
      data: { eventId: event.id, userId: participantId, status: "APPROVED", checkInCode: "CO-APPROVED" },
    });
    const pending = await db.registration.create({
      data: { eventId: event.id, userId: pendingParticipantId, status: "PENDING", checkInCode: "CO-PENDING" },
    });
    expect((await checkIn(owner, event.id, approved.checkInCode, "MANUAL")).status).toBe("checked_in");
    expect((await checkIn(owner, event.id, approved.checkInCode, "MANUAL")).status).toBe("already");
    expect((await checkIn(owner, event.id, pending.checkInCode, "MANUAL")).status).toBe("not_approved");
  });

  it("blocks publishing with open tickets and pending evaluations", async () => {
    const fixture = await createJudgingFixture("Publishing Gates Event");
    await db.result.create({
      data: {
        eventId: fixture.event.id,
        submissionId: fixture.submission.id,
        trackId: fixture.trackId,
        rank: 1,
        trackRank: 1,
        finalScore: 80,
        judgeCount: 0,
        method: "MEAN",
      },
    });
    await db.judgeAssignment.create({
      data: { eventId: fixture.event.id, eventJudgeId: fixture.judgeB.id, submissionId: fixture.submission.id },
    });
    await db.reviewTicket.create({
      data: {
        eventId: fixture.event.id,
        submissionId: fixture.submission.id,
        reason: "Score spread requires review.",
        spread: 25,
        openedById: ownerId,
      },
    });
    await expect(setResultsPublished(owner, fixture.event.id, true)).rejects.toThrow(/Resolve .* open FairJudge ticket/);
    await db.reviewTicket.deleteMany({ where: { eventId: fixture.event.id } });
    await expect(setResultsPublished(owner, fixture.event.id, true)).rejects.toThrow(/assigned evaluation.*not submitted/);
  });
});

async function createJudgingFixture(name: string) {
  const event = await createEvent(owner, eventInput(name));
  await db.event.update({ where: { id: event.id }, data: { status: "LIVE" } });
  const track = await db.track.findFirstOrThrow({ where: { eventId: event.id } });
  const team = await db.team.create({
    data: {
      eventId: event.id,
      name: `${name} team`,
      inviteCode: `INV-${name.replace(/\W/g, "").slice(0, 10)}`,
      leaderId: judgeAId,
      members: { create: [{ userId: judgeAId, eventId: event.id, role: "LEADER" }] },
    },
  });
  const submission = await db.submission.create({
    data: {
      eventId: event.id,
      teamId: team.id,
      title: `${name} project`,
      abstract: "A complete sample project description for integration testing.",
      trackId: track.id,
      technologies: ["TypeScript"],
      status: "SUBMITTED",
    },
  });
  const [judgeARecord, judgeBRecord, judgeCRecord] = await Promise.all(
    [judgeAId, judgeBId, judgeCId].map((userId) => db.eventJudge.create({ data: { eventId: event.id, userId } })),
  );
  return { event, trackId: track.id, submission, judgeA: judgeARecord, judgeB: judgeBRecord, judgeC: judgeCRecord };
}
