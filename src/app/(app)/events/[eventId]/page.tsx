import Link from "next/link";
import { ArrowRight, Brain, FileText, Gavel, QrCode, Radar, Scale, Trash2, Trophy, Users } from "lucide-react";
import { db } from "@/lib/db";
import { commandCenter } from "@/services/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, StatCard } from "@/components/ui/misc";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { deleteEventAction } from "@/actions/events";
import { formatDateTime } from "@/lib/utils";
import { eventPageContext } from "./context";

export default async function EventOverviewPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { event, eventId } = await eventPageContext(params);
  const cc = await commandCenter(eventId);
  const [tracks, criteria] = await Promise.all([
    db.track.findMany({ where: { eventId }, orderBy: { name: "asc" } }),
    db.rubricCriterion.findMany({ where: { eventId }, orderBy: { order: "asc" } }),
  ]);
  const m = cc.metrics;

  const workflow = [
    { href: "participants", icon: Users, title: "Registrations & teams", stat: `${m.registrations} registered · ${m.pending} pending` },
    { href: "submissions", icon: FileText, title: "Submissions", stat: `${m.submitted} submitted · ${m.drafts} drafts` },
    { href: "screening", icon: Brain, title: "AI screening", stat: `${m.unscreened} unscreened · ${m.pendingAI} awaiting decision` },
    { href: "operations", icon: QrCode, title: "Operations", stat: `${m.attendance} checked in · ${m.seated}/${m.seatCapacity} seated` },
    { href: "judging", icon: Gavel, title: "Judging", stat: `${m.evalsSubmitted}/${m.assignments} evaluations` },
    { href: "fairjudge", icon: Scale, title: "FairJudge", stat: event.scoresRevealed ? `${m.openTickets} open tickets` : "Scores private" },
    { href: "results", icon: Trophy, title: "Results", stat: event.resultsPublished ? "Published" : "Not published" },
    { href: "command", icon: Radar, title: "Command center", stat: `${cc.alerts.length} alert(s)` },
  ];

  return (
    <div className="space-y-6">
      {event.status === "DRAFT" && (
        <Callout tone="info" title="This event is a draft">
          Participants can&apos;t see or register for it yet. Change the status to <b>Published</b> in{" "}
          <Link href={`/events/${eventId}/edit`} className="font-semibold underline">
            Settings
          </Link>
          .
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved participants" value={m.approved} icon={<Users />} hint={event.maxParticipants ? `of ${event.maxParticipants} max` : "No cap"} />
        <StatCard label="Teams" value={m.teams} icon={<Users />} accent="sky" />
        <StatCard label="Submitted projects" value={m.submitted} icon={<FileText />} accent="violet" />
        <StatCard label="Attendance" value={`${m.attendanceRate}%`} icon={<QrCode />} accent="emerald" progress={m.attendanceRate} hint={`${m.attendance} checked in`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workflow.map(({ href, icon: Icon, title, stat }) => (
          <Link
            key={href}
            href={`/events/${eventId}/${href}`}
            className="group rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-ink-950 text-white transition group-hover:bg-brand-600">
                <Icon className="size-4" />
              </span>
              <ArrowRight className="size-4 text-ink-300 transition group-hover:text-brand-500" />
            </div>
            <p className="mt-4 font-semibold text-ink-900">{title}</p>
            <p className="mt-0.5 text-xs text-ink-500">{stat}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-ink-700">
            <p className="whitespace-pre-line">{event.description}</p>
            {event.eligibility && (
              <p>
                <b className="text-ink-900">Eligibility:</b> {event.eligibility}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tracks.map((t) => (
                <span key={t.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                  {t.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-ink-500">
              Participant page:{" "}
              <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono">/explore/{eventId}</code>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rubric</CardTitle>
            <CardDescription>Weighted, normalised to 100.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {criteria.map((c) => {
              const total = criteria.reduce((s, x) => s + x.weight, 0);
              return (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{c.name}</span>
                  <span className="font-mono text-xs text-ink-500">
                    {Math.round((c.weight / total) * 100)}% · /{c.maxScore}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-5">
            {cc.milestones.map((ms) => (
              <li key={ms.label} className={`rounded-xl border p-3 ${ms.done ? "border-emerald-200 bg-emerald-50/50" : "border-line"}`}>
                <p className="text-xs font-semibold text-ink-800">{ms.label}</p>
                <p className="mt-1 text-xs text-ink-500">{formatDateTime(ms.at, event.timeZone)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="text-rose-700">Danger zone</CardTitle>
          <CardDescription>Delete this event and all its registrations, teams, submissions and evaluations.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmAction
            action={deleteEventAction}
            hidden={{ eventId }}
            title={`Delete “${event.name}”?`}
            description="This permanently removes the event and every related record. Events with real submissions must be archived instead."
            triggerLabel="Delete event"
            triggerVariant="danger-soft"
            confirmVariant="danger"
            confirmLabel="Delete permanently"
            icon={<Trash2 />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
