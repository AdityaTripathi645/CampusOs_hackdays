import Link from "next/link";
import { CalendarRange, MapPin } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { loadManagedEvent } from "@/lib/authz";
import { DemoBadge } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { EventTabs } from "./event-tabs";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const user = await requirePageUser(["ORGANIZER", "ADMIN"]);
  const { eventId } = await params;
  const event = await loadManagedEvent(user, eventId);
  return (
    <>
      <div className="mb-5">
        <nav className="mb-2 text-xs text-ink-500">
          <Link href="/events" className="hover:text-ink-900">
            Events
          </Link>{" "}
          / <span className="text-ink-700">{event.name}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-[28px]">{event.name}</h1>
          <StatusBadge status={event.status} />
          {event.isDemo && <DemoBadge />}
          {event.resultsPublished && <StatusBadge status="PUBLISHED" />}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-500">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="size-4" /> {formatDate(event.startsAt, event.timeZone)} – {formatDate(event.endsAt, event.timeZone)}
          </span>
          {event.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {event.venue}
            </span>
          )}
        </div>
      </div>
      <EventTabs eventId={eventId} />
      {children}
    </>
  );
}
