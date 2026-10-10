import { db } from "@/lib/db";
import { getEventWithConfig, parseRegistrationFields } from "@/services/events";
import { updateEventAction } from "@/actions/events";
import { toDateTimeLocal } from "@/lib/utils";
import { EventForm } from "../../event-form";
import { eventPageContext } from "../context";

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await eventPageContext(params);
  const e = (await getEventWithConfig(eventId))!;
  const evaluationCount = await db.evaluation.count({ where: { assignment: { eventId } } });
  return (
    <EventForm
      action={updateEventAction}
      submitLabel="Save changes"
      judgingStarted={evaluationCount > 0}
      initial={{
        id: e.id,
        name: e.name,
        tagline: e.tagline ?? "",
        description: e.description,
        venue: e.venue ?? "",
        status: e.status,
        timeZone: e.timeZone,
        registrationOpensAt: toDateTimeLocal(e.registrationOpensAt, e.timeZone),
        registrationClosesAt: toDateTimeLocal(e.registrationClosesAt, e.timeZone),
        startsAt: toDateTimeLocal(e.startsAt, e.timeZone),
        endsAt: toDateTimeLocal(e.endsAt, e.timeZone),
        submissionDeadline: toDateTimeLocal(e.submissionDeadline, e.timeZone),
        eligibility: e.eligibility ?? "",
        maxParticipants: e.maxParticipants ? String(e.maxParticipants) : "",
        minTeamSize: e.minTeamSize,
        maxTeamSize: e.maxTeamSize,
        scoringMethod: e.scoringMethod,
        discrepancyThreshold: e.discrepancyThreshold,
        judgesPerSubmission: e.judgesPerSubmission,
        tracks: e.tracks.map((t) => ({ id: t.id, name: t.name, description: t.description ?? "" })),
        criteria: e.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? "",
          weight: c.weight,
          maxScore: c.maxScore,
        })),
        registrationFields: parseRegistrationFields(e.registrationFields),
        rooms: e.rooms.map((r) => ({ id: r.id, name: r.name, building: r.building ?? "", capacity: r.capacity })),
        prizes: e.prizes.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          trackName: p.track?.name ?? "",
          rank: p.rank,
          amount: p.amount ?? undefined,
        })),
      }}
    />
  );
}
