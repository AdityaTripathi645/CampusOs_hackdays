import Link from "next/link";
import { Armchair, Download, IdCard, QrCode, Trash2, Users, Wand } from "lucide-react";
import { db } from "@/lib/db";
import { listEventRegistrations, listEventTeams } from "@/services/registrations";
import { autoAllocateSeatsAction, clearSeatsAction, undoCheckInAction } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, DemoBadge, EmptyState, Progress, StatCard } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { InlineAction } from "@/components/forms/inline-action";
import { formatDateTime, pct } from "@/lib/utils";
import { eventPageContext } from "../context";
import { CheckInConsole } from "./check-in-console";

export default async function OperationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId, event } = await eventPageContext(params);
  const [regs, teams, rooms] = await Promise.all([
    listEventRegistrations(eventId),
    listEventTeams(eventId),
    db.room.findMany({ where: { eventId }, orderBy: { name: "asc" }, include: { _count: { select: { seats: true } } } }),
  ]);
  const approved = regs.filter((r) => r.status === "APPROVED");
  const checkedIn = approved.filter((r) => r.attendance);
  const seated = approved.filter((r) => r.seat);
  const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const teamByUser = new Map<string, string>();
  teams.forEach((t) => t.members.forEach((m) => teamByUser.set(m.user.id, t.name)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved participants" value={approved.length} icon={<Users />} />
        <StatCard
          label="Checked in"
          value={checkedIn.length}
          icon={<QrCode />}
          accent="emerald"
          progress={pct(checkedIn.length, approved.length)}
          hint="Real scans only — nothing is pre-filled"
        />
        <StatCard label="Seated" value={`${seated.length}/${approved.length}`} icon={<Armchair />} accent="sky" />
        <StatCard label="Room capacity" value={capacity} icon={<Armchair />} accent="violet" hint={`${rooms.length} room(s)`} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>QR check-in</CardTitle>
            <CardDescription>Every check-in is recorded with the operator and time, and appears in the audit log.</CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/events/${eventId}/export/attendance`}>
              <Download /> Export attendance CSV
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <CheckInConsole eventId={eventId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Rooms & seats</CardTitle>
            <CardDescription>Auto-allocation fills rooms in order and keeps teammates together where possible.</CardDescription>
          </div>
          <div className="flex gap-2">
            <ConfirmAction
              action={autoAllocateSeatsAction}
              hidden={{ eventId }}
              title="Auto-allocate seats?"
              description="Approved participants without a seat are assigned to rooms in order. Existing seats are kept."
              triggerLabel="Auto-allocate"
              triggerVariant="primary"
              icon={<Wand />}
              disabled={rooms.length === 0}
            />
            <ConfirmAction
              action={clearSeatsAction}
              hidden={{ eventId }}
              title="Clear all seat assignments?"
              description="Every participant loses their seat. Check-ins are not affected."
              triggerLabel="Clear"
              triggerVariant="ghost"
              confirmVariant="danger"
              icon={<Trash2 />}
              disabled={seated.length === 0}
            />
          </div>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <EmptyState icon={<Armchair />} title="No rooms configured" description="Add rooms with capacities in event settings." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <div key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink-900">{r.name}</p>
                    <span className="text-xs tabular-nums text-ink-500">
                      {r._count.seats}/{r.capacity}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-ink-500">{r.building ?? "—"}</p>
                  <Progress value={pct(r._count.seats, r.capacity)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant directory</CardTitle>
          <CardDescription>Approved participants with team, seat, ID card and check-in status.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0">
          {approved.length === 0 ? (
            <EmptyState icon={<Users />} title="No approved participants" description="Approve registrations first." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Participant</TH>
                    <TH>Team</TH>
                    <TH>Seat</TH>
                    <TH>Check-in</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {approved.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.user.name} />
                          <div>
                            <p className="flex items-center gap-2 font-semibold text-ink-900">
                              {r.user.name} {r.isDemo && <DemoBadge />}
                            </p>
                            <p className="font-mono text-[11px] text-ink-400">{r.checkInCode}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-xs">{teamByUser.get(r.user.id) ?? "—"}</TD>
                      <TD className="text-xs">{r.seat ? `${r.seat.room.name} · ${r.seat.seatLabel}` : <span className="text-ink-400">Unassigned</span>}</TD>
                      <TD>
                        {r.attendance ? (
                          <div>
                            <Badge tone="success">{r.attendance.method === "QR" ? "QR" : "Manual"}</Badge>
                            <p className="mt-0.5 text-[11px] text-ink-500">{formatDateTime(r.attendance.checkedInAt, event.timeZone)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">Not checked in</span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/events/${eventId}/operations/id-card/${r.id}`}>
                              <IdCard /> ID card
                            </Link>
                          </Button>
                          {r.attendance && (
                            <InlineAction action={undoCheckInAction} hidden={{ registrationId: r.id, eventId }} variant="ghost">
                              Undo
                            </InlineAction>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
