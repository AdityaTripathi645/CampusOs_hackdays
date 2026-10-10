import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { toDateTimeLocal } from "@/lib/utils";
import { createEventAction } from "@/actions/events";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requirePageUser(["ORGANIZER", "ADMIN"]);
  const day = 864e5;
  const now = Date.now();
  const at = (d: number, hour = 9) => {
    const x = new Date(now + d * day);
    x.setHours(hour, 0, 0, 0);
    return toDateTimeLocal(x, "Asia/Kolkata");
  };
  return (
    <>
      <PageHeader
        title="Create event"
        description="Configure the essentials now — you can change everything later from event settings."
        breadcrumbs={[{ label: "Events", href: "/events" }, { label: "New" }]}
      />
      <EventForm
        action={createEventAction}
        submitLabel="Create event"
        initial={{
          name: "",
          tagline: "",
          description: "",
          venue: "",
          status: "DRAFT",
          timeZone: "Asia/Kolkata",
          registrationOpensAt: at(1),
          registrationClosesAt: at(14, 23),
          startsAt: at(21),
          endsAt: at(22, 21),
          submissionDeadline: at(22, 12),
          eligibility: "",
          maxParticipants: "",
          minTeamSize: 1,
          maxTeamSize: 4,
          scoringMethod: "MEAN",
          discrepancyThreshold: 20,
          judgesPerSubmission: 2,
          tracks: [{ name: "Open Innovation", description: "Any idea that solves a real problem" }],
          criteria: [
            { name: "Innovation", description: "Originality of the idea", weight: 1, maxScore: 10 },
            { name: "Execution", description: "Working prototype and technical depth", weight: 1.5, maxScore: 10 },
            { name: "Impact", description: "Real-world usefulness", weight: 1, maxScore: 10 },
            { name: "Presentation", description: "Clarity of pitch and demo", weight: 0.5, maxScore: 10 },
          ],
          registrationFields: [
            { key: "year_of_study", label: "Year of study", type: "select", required: true, options: ["1st", "2nd", "3rd", "4th", "PG"] },
          ],
          rooms: [{ name: "Main Hall", building: "", capacity: 100 }],
          prizes: [],
        }}
      />
    </>
  );
}
