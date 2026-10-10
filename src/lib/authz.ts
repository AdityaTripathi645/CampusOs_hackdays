import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

/**
 * Server-side ownership check. Admins manage every event; organizers manage
 * only the events they own. Everyone else is rejected.
 */
export async function assertCanManageEvent(user: CurrentUser, eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError("Event");
  if (user.role === "ADMIN") return event;
  if (user.role === "ORGANIZER" && event.ownerId === user.id) return event;
  throw new ForbiddenError("Only the event's organizer can manage it.");
}

/** Page variant: 404 instead of leaking the event's existence. */
export async function loadManagedEvent(user: CurrentUser, eventId: string) {
  try {
    return await assertCanManageEvent(user, eventId);
  } catch {
    notFound();
  }
}

/** Is this user an assigned judge for the event? Returns the EventJudge row. */
export async function getEventJudge(userId: string, eventId: string) {
  return db.eventJudge.findUnique({ where: { eventId_userId: { eventId, userId } } });
}

/** Team membership check for participant actions. */
export async function assertTeamMember(userId: string, teamId: string) {
  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership) throw new ForbiddenError("You are not a member of this team.");
  return membership;
}
