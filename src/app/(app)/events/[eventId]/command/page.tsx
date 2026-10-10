import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, FileText, Gavel, Info, QrCode, Sparkles, Users } from "lucide-react";
import { commandCenter } from "@/services/dashboard";
import { getGeminiStatus } from "@/services/gemini";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Progress, StatCard } from "@/components/ui/misc";
import { TrendArea } from "@/components/charts";
import { ActivityList } from "@/components/activity-list";
import { formatDateTime, pct, relativeTime } from "@/lib/utils";
import { eventPageContext } from "../context";
import { AssistantPanel, AutoRefresh } from "./live-widgets";

const ALERT_STYLE = {
  critical: { box: "border-rose-200 bg-rose-50/60", icon: <AlertOctagon className="size-4 text-rose-600" /> },
  warning: { box: "border-amber-200 bg-amber-50/60", icon: <AlertTriangle className="size-4 text-amber-600" /> },
  info: { box: "border-sky-200 bg-sky-50/60", icon: <Info className="size-4 text-sky-600" /> },
} as const;

export default async function CommandCenterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await eventPageContext(params);
  const cc = await commandCenter(eventId);
  const m = cc.metrics;
  const next = cc.milestones.find((x) => !x.done);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          {next ? (
            <>
              Next milestone: <b className="text-ink-900">{next.label}</b> {relativeTime(next.at)}
            </>
          ) : (
            "All milestones have passed."
          )}
        </p>
        <AutoRefresh />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registrations" value={m.registrations} icon={<Users />} hint={`${m.approved} approved · ${m.pending} pending · ${m.waitlisted} waitlisted`} />
        <StatCard label="Submissions" value={m.submitted} icon={<FileText />} accent="violet" hint={`${m.drafts} drafts · ${m.shortlisted} shortlisted`} />
        <StatCard label="Attendance" value={`${m.attendance}/${m.approved}`} icon={<QrCode />} accent="emerald" progress={m.attendanceRate} hint={`${m.seated} seated of ${m.seatCapacity} capacity`} />
        <StatCard label="Judging" value={`${m.judgingProgress}%`} icon={<Gavel />} accent="amber" progress={m.judgingProgress} hint={`${m.evalsSubmitted}/${m.assignments} evaluations`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Operational alerts & pending tasks</CardTitle>
            <CardDescription>Computed live from the event&apos;s data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {cc.alerts.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="size-4" /> No alerts. Everything is on track.
              </p>
            ) : (
              cc.alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${ALERT_STYLE[a.level].box}`}>
                  <span className="mt-0.5">{ALERT_STYLE[a.level].icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{a.title}</p>
                    <p className="text-xs text-ink-600">{a.detail}</p>
                  </div>
                  {a.href && (
                    <Link href={a.href} className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-600 hover:underline">
                      Resolve <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-600" /> Organizer assistant
            </CardTitle>
            <CardDescription>Gemini answers from this event&apos;s aggregate numbers only.</CardDescription>
          </CardHeader>
          <CardContent>
            <AssistantPanel eventId={eventId} configured={getGeminiStatus().configured} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative grid gap-4 sm:grid-cols-5">
            {cc.milestones.map((ms) => (
              <li key={ms.label} className="relative">
                <div className="flex items-center gap-2">
                  <span className={`size-3 rounded-full ring-4 ${ms.done ? "bg-emerald-500 ring-emerald-100" : "bg-white ring-ink-100 border border-ink-300"}`} />
                  <span className={`h-px flex-1 ${ms.done ? "bg-emerald-300" : "bg-line"}`} />
                </div>
                <p className="mt-3 text-sm font-semibold text-ink-900">{ms.label}</p>
                <p className="text-xs text-ink-500">{formatDateTime(ms.at, cc.event.timeZone)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Check-ins per hour</CardTitle>
            <CardDescription>Real scans only.</CardDescription>
          </CardHeader>
          <CardContent>
            {cc.checkinSeries.length ? (
              <TrendArea data={cc.checkinSeries} xKey="hour" yKey="Check-ins" />
            ) : (
              <EmptyState icon={<QrCode />} title="No check-ins yet" className="py-8" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Judging progress</CardTitle>
            <CardDescription>Counts only — scores stay private.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cc.judges.length === 0 && <p className="text-sm text-ink-400">No judges on the panel.</p>}
            {cc.judges.map((j) => (
              <div key={j.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-700">{j.name}</span>
                  <span className="tabular-nums text-ink-500">
                    {j.done}/{j.total}
                  </span>
                </div>
                <Progress value={pct(j.done, j.total)} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Live activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityList items={cc.recent} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
