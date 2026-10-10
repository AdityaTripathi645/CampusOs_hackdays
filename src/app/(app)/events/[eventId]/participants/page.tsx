import { CheckCheck, Users } from "lucide-react";
import { listEventRegistrations, listEventTeams } from "@/services/registrations";
import { parseRegistrationFields } from "@/services/events";
import { approveAllPendingAction, setRegistrationStatusAction } from "@/actions/events";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, DemoBadge, EmptyState, SectionTitle, StatCard } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { InlineAction } from "@/components/forms/inline-action";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { formatDateTime, jsonObject } from "@/lib/utils";
import { eventPageContext } from "../context";

export default async function ParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { event, eventId } = await eventPageContext(params);
  const { status } = await searchParams;
  const [regs, teams] = await Promise.all([listEventRegistrations(eventId), listEventTeams(eventId)]);
  const fields = parseRegistrationFields(event.registrationFields);
  const teamByUser = new Map<string, string>();
  teams.forEach((t) => t.members.forEach((m) => teamByUser.set(m.user.id, t.name)));
  const counts = (s: string) => regs.filter((r) => r.status === s).length;
  const filtered = status ? regs.filter((r) => r.status === status) : regs;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total registrations" value={regs.length} icon={<Users />} />
        <StatCard label="Approved" value={counts("APPROVED")} accent="emerald" />
        <StatCard label="Pending" value={counts("PENDING")} accent="amber" />
        <StatCard label="Teams" value={teams.length} accent="sky" hint={`${teams.filter((t) => t.submission).length} with a submission`} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>Approve participants so they can check in. Waitlisted entries are over capacity.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["", "PENDING", "APPROVED", "WAITLISTED", "REJECTED", "WITHDRAWN"].map((s) => (
              <a
                key={s || "all"}
                href={s ? `?status=${s}` : "?"}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                  (status ?? "") === s ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-line hover:ring-ink-300"
                }`}
              >
                {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All"}
              </a>
            ))}
            <ConfirmAction
              action={approveAllPendingAction}
              hidden={{ eventId }}
              title="Approve all pending registrations?"
              description={
                event.maxParticipants
                  ? `Pending registrations are approved in sign-up order until the cap of ${event.maxParticipants} is reached.`
                  : "Every pending registration will be approved."
              }
              triggerLabel="Approve all pending"
              icon={<CheckCheck />}
              disabled={counts("PENDING") === 0}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0">
          {filtered.length === 0 ? (
            <EmptyState icon={<Users />} title="No registrations here" description="Share the event page once it is published." />
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Participant</TH>
                    <TH>Team</TH>
                    {fields.slice(0, 2).map((f) => (
                      <TH key={f.key}>{f.label}</TH>
                    ))}
                    <TH>Registered</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((r) => {
                    const answers = jsonObject(r.answers);
                    return (
                      <TR key={r.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Avatar name={r.user.name} />
                            <div>
                              <p className="flex items-center gap-2 font-semibold text-ink-900">
                                {r.user.name} {r.isDemo && <DemoBadge />}
                              </p>
                              <p className="text-xs text-ink-500">
                                {r.user.email}
                                {r.user.institution ? ` · ${r.user.institution}` : ""}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD className="text-xs">{teamByUser.get(r.user.id) ?? <span className="text-ink-400">—</span>}</TD>
                        {fields.slice(0, 2).map((f) => (
                          <TD key={f.key} className="text-xs">
                            {typeof answers[f.key] === "boolean" ? (answers[f.key] ? "Yes" : "No") : String(answers[f.key] ?? "—")}
                          </TD>
                        ))}
                        <TD className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</TD>
                        <TD>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={r.status} />
                            {r.attendance && <Badge tone="success">Checked in</Badge>}
                          </div>
                        </TD>
                        <TD className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {r.status !== "APPROVED" && r.status !== "WITHDRAWN" && (
                              <InlineAction
                                action={setRegistrationStatusAction}
                                hidden={{ registrationId: r.id, status: "APPROVED", eventId }}
                                variant="secondary"
                              >
                                Approve
                              </InlineAction>
                            )}
                            {r.status !== "REJECTED" && r.status !== "WITHDRAWN" && !r.attendance && (
                              <InlineAction
                                action={setRegistrationStatusAction}
                                hidden={{ registrationId: r.id, status: "REJECTED", eventId }}
                                variant="ghost"
                              >
                                Reject
                              </InlineAction>
                            )}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <div>
        <SectionTitle>Teams ({teams.length})</SectionTitle>
        {teams.length === 0 ? (
          <Card>
            <EmptyState icon={<Users />} title="No teams yet" description="Participants create teams from the event page and share an invite code." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{t.name}</CardTitle>
                    {t.isDemo && <DemoBadge />}
                  </div>
                  <CardDescription>
                    {t.track?.name ?? "No track"} · {t.members.length}/{event.maxTeamSize} members · code{" "}
                    <span className="font-mono">{t.inviteCode}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {t.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 text-sm">
                      <Avatar name={m.user.name} className="size-7 text-[10px]" />
                      <span className="text-ink-800">{m.user.name}</span>
                      {m.role === "LEADER" && <Badge tone="brand">Lead</Badge>}
                    </div>
                  ))}
                  <div className="border-t border-line pt-3 text-xs text-ink-500">
                    {t.submission ? (
                      <span className="flex items-center gap-2">
                        <StatusBadge status={t.submission.status} /> {t.submission.title}
                      </span>
                    ) : (
                      "No submission yet"
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
