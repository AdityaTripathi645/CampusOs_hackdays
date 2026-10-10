import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { AppError, NotFoundError } from "@/lib/errors";
import { toCsv } from "@/lib/utils";

export type CheckInResult =
  | { status: "checked_in"; name: string; email: string; seat: string | null; at: string }
  | { status: "already"; name: string; email: string; seat: string | null; at: string }
  | { status: "not_approved"; name: string; registrationStatus: string }
  | { status: "unknown" };

/** Real attendance only: every record is written by an authenticated operator. */
export async function checkIn(user: CurrentUser, eventId: string, rawCode: string, method: "QR" | "MANUAL"): Promise<CheckInResult> {
  await assertCanManageEvent(user, eventId);
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new AppError("Scan or type a check-in code.");

  const reg = await db.registration.findUnique({
    where: { checkInCode: code },
    include: { user: true, attendance: true, seat: { include: { room: true } } },
  });
  if (!reg || reg.eventId !== eventId) return { status: "unknown" };

  const seat = reg.seat ? `${reg.seat.room.name} · ${reg.seat.seatLabel}` : null;
  if (reg.status !== "APPROVED") {
    return { status: "not_approved", name: reg.user.name, registrationStatus: reg.status };
  }
  if (reg.attendance) {
    return { status: "already", name: reg.user.name, email: reg.user.email, seat, at: reg.attendance.checkedInAt.toISOString() };
  }
  const record = await db.attendanceRecord.create({
    data: { eventId, registrationId: reg.id, method, checkedInById: user.id },
  });
  await audit({
    actorId: user.id,
    eventId,
    action: "attendance.checked_in",
    entityType: "AttendanceRecord",
    entityId: record.id,
    metadata: { registrationId: reg.id, method },
  });
  return { status: "checked_in", name: reg.user.name, email: reg.user.email, seat, at: record.checkedInAt.toISOString() };
}

export async function undoCheckIn(user: CurrentUser, registrationId: string) {
  const reg = await db.registration.findUnique({ where: { id: registrationId }, include: { attendance: true } });
  if (!reg) throw new NotFoundError("Registration");
  await assertCanManageEvent(user, reg.eventId);
  if (!reg.attendance) return;
  await db.attendanceRecord.delete({ where: { id: reg.attendance.id } });
  await audit({
    actorId: user.id,
    eventId: reg.eventId,
    action: "attendance.undone",
    entityType: "AttendanceRecord",
    entityId: reg.attendance.id,
    metadata: { registrationId },
  });
}

/**
 * Fill rooms in order with approved participants who have no seat yet.
 * Team members are kept together where possible by ordering on team.
 */
export async function autoAllocateSeats(user: CurrentUser, eventId: string) {
  await assertCanManageEvent(user, eventId);
  const rooms = await db.room.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: { seats: { select: { seatLabel: true } } },
  });
  if (rooms.length === 0) throw new AppError("Add rooms in event settings before allocating seats.");

  const unseated = await db.registration.findMany({
    where: { eventId, status: "APPROVED", seat: null },
    include: { user: { include: { teamMemberships: { where: { eventId }, select: { teamId: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  unseated.sort((a, b) =>
    (a.user.teamMemberships[0]?.teamId ?? "~").localeCompare(b.user.teamMemberships[0]?.teamId ?? "~"),
  );

  let assigned = 0;
  const queue = [...unseated];
  await db.$transaction(async (tx) => {
    for (const [ri, room] of rooms.entries()) {
      const taken = new Set(room.seats.map((s) => s.seatLabel));
      let n = 1;
      const prefix = room.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || `R${ri + 1}`;
      while (queue.length && taken.size < room.capacity) {
        let label = `${prefix}-${String(n).padStart(3, "0")}`;
        while (taken.has(label)) {
          n++;
          label = `${prefix}-${String(n).padStart(3, "0")}`;
        }
        const reg = queue.shift()!;
        await tx.seatAssignment.create({ data: { roomId: room.id, registrationId: reg.id, seatLabel: label } });
        taken.add(label);
        assigned++;
        n++;
      }
    }
    await audit(
      { actorId: user.id, eventId, action: "seats.auto_allocated", entityType: "SeatAssignment", metadata: { assigned, unplaced: queue.length } },
      tx,
    );
  }, { timeout: 30_000 });
  return { assigned, unplaced: queue.length };
}

export async function clearSeats(user: CurrentUser, eventId: string) {
  await assertCanManageEvent(user, eventId);
  const { count } = await db.seatAssignment.deleteMany({ where: { room: { eventId } } });
  await audit({ actorId: user.id, eventId, action: "seats.cleared", entityType: "SeatAssignment", metadata: { count } });
  return count;
}

export async function attendanceCsv(user: CurrentUser, eventId: string) {
  const event = await assertCanManageEvent(user, eventId);
  const regs = await db.registration.findMany({
    where: { eventId, status: "APPROVED" },
    include: {
      user: true,
      attendance: { include: { checkedInBy: { select: { name: true } } } },
      seat: { include: { room: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const teams = await db.teamMember.findMany({ where: { eventId }, include: { team: true } });
  const teamByUser = new Map(teams.map((t) => [t.userId, t.team.name]));
  const csv = toCsv(
    regs.map((r) => ({
      name: r.user.name,
      email: r.user.email,
      institution: r.user.institution ?? "",
      team: teamByUser.get(r.userId) ?? "",
      room: r.seat?.room.name ?? "",
      seat: r.seat?.seatLabel ?? "",
      checked_in: r.attendance ? "yes" : "no",
      checked_in_at: r.attendance?.checkedInAt.toISOString() ?? "",
      method: r.attendance?.method ?? "",
      operator: r.attendance?.checkedInBy.name ?? "",
      demo_record: r.isDemo ? "yes" : "no",
    })),
  );
  await audit({ actorId: user.id, eventId, action: "attendance.exported", entityType: "Event", entityId: eventId });
  return { csv, filename: `${event.slug}-attendance.csv` };
}
