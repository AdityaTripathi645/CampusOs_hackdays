import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { pct } from "@/lib/utils";

export async function organizerOverview(user: CurrentUser) {
  const where = user.role === "ADMIN" ? {} : { ownerId: user.id };
  const events = await db.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      _count: { select: { registrations: true, submissions: true, attendance: true, assignments: true, teams: true } },
    },
  });
  const ids = events.map((e) => e.id);
  const [approved, submitted, evalsSubmitted, openTickets, pendingAI, pendingRegs, recent] = await Promise.all([
    db.registration.count({ where: { eventId: { in: ids }, status: "APPROVED" } }),
    db.submission.count({ where: { eventId: { in: ids }, status: { not: "DRAFT" } } }),
    db.evaluation.count({ where: { assignment: { eventId: { in: ids } }, status: "SUBMITTED" } }),
    db.reviewTicket.count({ where: { eventId: { in: ids }, status: "OPEN" } }),
    db.aIReview.count({ where: { submission: { eventId: { in: ids } }, status: "PENDING_HUMAN_REVIEW" } }),
    db.registration.count({ where: { eventId: { in: ids }, status: "PENDING" } }),
    db.auditLog.findMany({
      where: { eventId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } }, event: { select: { name: true } } },
    }),
  ]);
  const totalAssignments = events.reduce((s, e) => s + e._count.assignments, 0);
  const attendance = events.reduce((s, e) => s + e._count.attendance, 0);
  return {
    events,
    activeEvents: events.filter((e) => ["PUBLISHED", "LIVE", "JUDGING"].includes(e.status)),
    totals: {
      registrations: events.reduce((s, e) => s + e._count.registrations, 0),
      approved,
      pendingRegs,
      submitted,
      attendance,
      attendanceRate: pct(attendance, approved),
      judgingProgress: pct(evalsSubmitted, totalAssignments),
      evalsSubmitted,
      totalAssignments,
      openTickets,
      pendingAI,
    },
    recent,
    chart: events.slice(0, 6).map((e) => ({
      name: e.name.length > 18 ? `${e.name.slice(0, 16)}…` : e.name,
      Registrations: e._count.registrations,
      Submissions: e._count.submissions,
      "Checked in": e._count.attendance,
    })),
  };
}

export type Alert = { level: "critical" | "warning" | "info"; title: string; detail: string; href?: string };

export async function commandCenter(eventId: string) {
  const event = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { rooms: { include: { _count: { select: { seats: true } } } } },
  });
  const now = new Date();
  const [regsByStatus, subsByStatus, attendance, teams, teamsWithoutSub, assignments, evalsSubmitted, openTickets, unscreened, pendingAI, recent, judges, checkinsTimeline] =
    await Promise.all([
      db.registration.groupBy({ by: ["status"], where: { eventId }, _count: true }),
      db.submission.groupBy({ by: ["status"], where: { eventId }, _count: true }),
      db.attendanceRecord.count({ where: { eventId } }),
      db.team.count({ where: { eventId } }),
      db.team.count({ where: { eventId, submission: null } }),
      db.judgeAssignment.count({ where: { eventId } }),
      db.evaluation.count({ where: { assignment: { eventId }, status: "SUBMITTED" } }),
      db.reviewTicket.count({ where: { eventId, status: "OPEN" } }),
      db.submission.count({ where: { eventId, status: { not: "DRAFT" }, aiReviews: { none: {} } } }),
      db.aIReview.count({ where: { submission: { eventId }, status: "PENDING_HUMAN_REVIEW" } }),
      db.auditLog.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { actor: { select: { name: true } } },
      }),
      db.eventJudge.findMany({
        where: { eventId },
        include: { user: { select: { name: true } }, assignments: { include: { evaluation: { select: { status: true } } } } },
      }),
      db.attendanceRecord.findMany({ where: { eventId }, select: { checkedInAt: true }, orderBy: { checkedInAt: "asc" } }),
    ]);

  const regCount = (s: string) => regsByStatus.find((r) => r.status === s)?._count ?? 0;
  const subCount = (s: string) => subsByStatus.find((r) => r.status === s)?._count ?? 0;
  const approved = regCount("APPROVED");
  const submitted = subsByStatus.filter((s) => s.status !== "DRAFT").reduce((a, s) => a + s._count, 0);
  const seatCapacity = event.rooms.reduce((s, r) => s + r.capacity, 0);
  const seated = event.rooms.reduce((s, r) => s + r._count.seats, 0);

  const alerts: Alert[] = [];
  const hoursToDeadline = (event.submissionDeadline.getTime() - now.getTime()) / 36e5;
  if (hoursToDeadline > 0 && hoursToDeadline < 24 && teamsWithoutSub > 0)
    alerts.push({
      level: "warning",
      title: "Submission deadline in under 24h",
      detail: `${teamsWithoutSub} team(s) have not started a submission.`,
      href: `/events/${eventId}/participants`,
    });
  if (regCount("PENDING") > 0)
    alerts.push({
      level: "info",
      title: `${regCount("PENDING")} registration(s) awaiting approval`,
      detail: "Only approved participants can check in.",
      href: `/events/${eventId}/participants`,
    });
  if (event.maxParticipants && approved >= event.maxParticipants * 0.9)
    alerts.push({
      level: "warning",
      title: "Capacity nearly reached",
      detail: `${approved}/${event.maxParticipants} approved participants.`,
    });
  if (seatCapacity > 0 && approved > seatCapacity)
    alerts.push({
      level: "critical",
      title: "Not enough seats",
      detail: `${approved} approved participants but only ${seatCapacity} seats configured.`,
      href: `/events/${eventId}/edit`,
    });
  if (unscreened > 0)
    alerts.push({
      level: "info",
      title: `${unscreened} submission(s) not yet screened`,
      detail: "Run AI screening, then confirm each suggestion.",
      href: `/events/${eventId}/screening`,
    });
  if (pendingAI > 0)
    alerts.push({
      level: "info",
      title: `${pendingAI} AI suggestion(s) need a human decision`,
      detail: "AI output is advisory until a reviewer accepts or overrides it.",
      href: `/events/${eventId}/screening`,
    });
  if (submitted > 0 && assignments === 0)
    alerts.push({
      level: "warning",
      title: "No judges assigned",
      detail: "Submitted projects have no judge assignments yet.",
      href: `/events/${eventId}/judging`,
    });
  if (openTickets > 0)
    alerts.push({
      level: "critical",
      title: `${openTickets} open FairJudge ticket(s)`,
      detail: "Results cannot be published until tickets are resolved.",
      href: `/events/${eventId}/fairjudge`,
    });

  const milestones = [
    { label: "Registration opens", at: event.registrationOpensAt },
    { label: "Registration closes", at: event.registrationClosesAt },
    { label: "Event starts", at: event.startsAt },
    { label: "Submission deadline", at: event.submissionDeadline },
    { label: "Event ends", at: event.endsAt },
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((m) => ({ ...m, done: m.at <= now }));

  // Hourly check-in buckets for the chart (real records only).
  const buckets = new Map<string, number>();
  for (const r of checkinsTimeline) {
    const d = new Date(r.checkedInAt);
    d.setMinutes(0, 0, 0);
    const key = d.toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const checkinSeries = [...buckets.entries()].map(([k, v]) => ({
    hour: new Date(k).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    "Check-ins": v,
  }));

  return {
    event,
    metrics: {
      registrations: regsByStatus.reduce((a, r) => a + r._count, 0),
      approved,
      pending: regCount("PENDING"),
      waitlisted: regCount("WAITLISTED"),
      teams,
      submitted,
      drafts: subCount("DRAFT"),
      shortlisted: subCount("SHORTLISTED"),
      attendance,
      attendanceRate: pct(attendance, approved),
      seated,
      seatCapacity,
      assignments,
      evalsSubmitted,
      judgingProgress: pct(evalsSubmitted, assignments),
      openTickets,
      unscreened,
      pendingAI,
    },
    alerts,
    milestones,
    recent,
    judges: judges.map((j) => ({
      name: j.user.name,
      done: j.assignments.filter((a) => a.evaluation?.status === "SUBMITTED").length,
      total: j.assignments.length,
    })),
    checkinSeries,
  };
}

export async function participantOverview(user: CurrentUser) {
  const registrations = await db.registration.findMany({
    where: { userId: user.id },
    include: {
      event: { include: { tracks: true } },
      seat: { include: { room: true } },
      attendance: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const memberships = await db.teamMember.findMany({
    where: { userId: user.id },
    include: {
      team: {
        include: {
          members: { include: { user: { select: { name: true, email: true } } } },
          submission: { include: { files: true, revisions: { orderBy: { createdAt: "desc" }, take: 5 } } },
          track: true,
        },
      },
    },
  });
  return { registrations, memberships };
}
