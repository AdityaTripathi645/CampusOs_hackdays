import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, CalendarRange } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { listManagedEvents } from "@/services/events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBadge, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const user = await requirePageUser(["ORGANIZER", "ADMIN"]);
  const events = await listManagedEvents(user);
  return (
    <>
      <PageHeader
        title="Events"
        description={user.role === "ADMIN" ? "All events across the platform." : "Events you organise."}
        actions={
          <Button asChild variant="brand">
            <Link href="/events/new">
              <CalendarPlus /> New event
            </Link>
          </Button>
        }
      />
      <Card>
        {events.length === 0 ? (
          <EmptyState
            icon={<CalendarRange />}
            title="No events yet"
            description="Create an event to configure tracks, rubric, rooms and registration."
            action={
              <Button asChild variant="brand">
                <Link href="/events/new">Create event</Link>
              </Button>
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Event</TH>
                  <TH>Status</TH>
                  <TH>Dates</TH>
                  <TH className="text-right">Registered</TH>
                  <TH className="text-right">Teams</TH>
                  <TH className="text-right">Submissions</TH>
                  <TH className="text-right">Checked in</TH>
                </tr>
              </THead>
              <TBody>
                {events.map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <Link href={`/events/${e.id}`} className="font-semibold text-ink-900 hover:text-brand-600">
                        {e.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-ink-500">{e.venue ?? "No venue set"}</span>
                        {e.isDemo && <DemoBadge />}
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge status={e.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-xs">
                      {formatDate(e.startsAt, e.timeZone)} – {formatDate(e.endsAt, e.timeZone)}
                    </TD>
                    <TD className="text-right tabular-nums">{e._count.registrations}</TD>
                    <TD className="text-right tabular-nums">{e._count.teams}</TD>
                    <TD className="text-right tabular-nums">{e._count.submissions}</TD>
                    <TD className="text-right tabular-nums">{e._count.attendance}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
