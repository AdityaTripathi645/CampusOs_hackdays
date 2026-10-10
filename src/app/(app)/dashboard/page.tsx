import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gavel,
  QrCode,
  Scale,
  Users,
} from "lucide-react";
import { requirePageUser, type CurrentUser } from "@/lib/auth";
import { organizerOverview, participantOverview } from "@/services/dashboard";
import { listMyAssignments } from "@/services/judging";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, DemoBadge, EmptyState, PageHeader, Progress, StatCard } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { GroupedBarChart } from "@/components/charts";
import { formatDate, pct, relativeTime } from "@/lib/utils";
import { ActivityList } from "@/components/activity-list";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("pageTitle") };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const t = await getTranslations("dashboard");
  const user = await requirePageUser();
  const { denied } = await searchParams;
  return (
    <>
      {denied && (
        <Callout tone="warning" className="mb-6" title={t("accessDenied")}>
          {t("roleDenied")}
        </Callout>
      )}
      {user.role === "ORGANIZER" || user.role === "ADMIN" ? (
        <OrganizerDashboard user={user} />
      ) : user.role === "JUDGE" ? (
        <JudgeDashboard user={user} />
      ) : (
        <ParticipantDashboard user={user} />
      )}
    </>
  );
}

async function OrganizerDashboard({ user }: { user: CurrentUser }) {
  const [t, common] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
  ]);
  const o = await organizerOverview(user);
  return (
    <>
      <PageHeader
        title={t("goodToSeeYou", { name: user.name.split(" ")[0] })}
        description={t("organizerDescription")}
        actions={
          <Button asChild variant="brand">
            <Link href="/events/new">
              <CalendarPlus /> {t("newEvent")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("registrations")}
          value={o.totals.registrations}
          icon={<Users />}
          hint={t("approvedPending", { approved: o.totals.approved, pending: o.totals.pendingRegs })}
        />
        <StatCard label={t("submissions")} value={o.totals.submitted} icon={<FileText />} accent="violet" hint={t("excludingDrafts")} />
        <StatCard
          label={t("checkedIn")}
          value={o.totals.attendance}
          icon={<QrCode />}
          accent="emerald"
          progress={o.totals.attendanceRate}
          hint={t("approvedParticipantsPercent", { percent: o.totals.attendanceRate })}
        />
        <StatCard
          label={t("judgingProgress")}
          value={`${o.totals.judgingProgress}%`}
          icon={<Gavel />}
          accent="amber"
          progress={o.totals.judgingProgress}
          hint={t("evaluationsSubmitted", { submitted: o.totals.evalsSubmitted, total: o.totals.totalAssignments })}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("activityByEvent")}</CardTitle>
            <CardDescription>{t("eventActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {o.chart.length ? (
              <GroupedBarChart
                data={o.chart}
                xKey="name"
                keys={["Registrations", "Submissions", "Checked in"]}
                labels={[t("selectedRegistrations"), t("selectedSubmissions"), t("selectedCheckins")]}
              />
            ) : (
              <EmptyState icon={<CalendarPlus />} title={t("noEvents")} description={t("createFirstEvent")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("needsAttention")}</CardTitle>
            <CardDescription>{t("humanDecisionsWaiting")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: ClipboardCheck, label: t("pendingRegistrations"), n: o.totals.pendingRegs },
              { icon: Brain, label: t("aiSuggestions"), n: o.totals.pendingAI },
              { icon: Scale, label: t("fairjudgeTickets"), n: o.totals.openTickets },
            ].map(({ icon: Icon, label, n }) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
                <span className="flex items-center gap-2.5 text-sm text-ink-700">
                  <Icon className="size-4 text-ink-400" /> {label}
                </span>
                <span className={n > 0 ? "text-sm font-bold text-ink-950" : "text-sm text-ink-400"}>{n}</span>
              </div>
            ))}
            {o.totals.pendingRegs + o.totals.pendingAI + o.totals.openTickets === 0 && (
              <p className="flex items-center gap-2 pt-1 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" /> {t("allCaughtUp")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("activeEvents")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {o.activeEvents.length === 0 && (
              <EmptyState
                icon={<CalendarPlus />}
                title={t("noActiveEvents")}
                description={t("publishEvent")}
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/events">{t("goToEvents")}</Link>
                  </Button>
                }
              />
            )}
            {o.activeEvents.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-line p-4 transition hover:border-brand-200 hover:bg-brand-50/30 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink-900">{e.name}</p>
                    <StatusBadge status={e.status} />
                    {e.isDemo && <DemoBadge label={common("demo")} title={common("demoRecordTitle")} />}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {formatDate(e.startsAt, e.timeZone)} – {formatDate(e.endsAt, e.timeZone)} · {e._count.teams} teams
                  </p>
                </div>
                <div className="flex gap-6 text-center text-xs text-ink-500">
                  <div>
                    <p className="text-lg font-bold text-ink-900">{e._count.registrations}</p>{t("registered")}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink-900">{e._count.submissions}</p>{t("projects")}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink-900">{e._count.attendance}</p>{t("checkedIn")}
                  </div>
                </div>
                <ArrowRight className="hidden size-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 sm:block" />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityList items={o.recent} showEvent />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function JudgeDashboard({ user }: { user: CurrentUser }) {
  const t = await getTranslations("dashboard");
  const assignments = await listMyAssignments(user);
  const done = assignments.filter((a) => a.evaluation?.status === "SUBMITTED").length;
  const drafts = assignments.filter((a) => a.evaluation?.status === "DRAFT").length;
  return (
    <>
      <PageHeader
        title={t("welcome", { name: user.name.split(" ")[0] })}
        description={t("judgeDescription")}
        actions={
          <Button asChild variant="brand">
            <Link href="/judge">
              {t("judgeWorkspace")} <ArrowRight />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("assignedProjects")} value={assignments.length} icon={<Gavel />} />
        <StatCard label={t("draftsInProgress")} value={drafts} icon={<FileText />} accent="amber" />
        <StatCard
          label={t("submitted")}
          value={done}
          icon={<CheckCircle2 />}
          accent="emerald"
          progress={pct(done, assignments.length)}
        />
      </div>
      {assignments.length === 0 && (
        <Card className="mt-6">
          <EmptyState icon={<Gavel />} title={t("noAssignments")} description={t("assignmentsHint")} />
        </Card>
      )}
    </>
  );
}

async function ParticipantDashboard({ user }: { user: CurrentUser }) {
  const [t, common] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
  ]);
  const { registrations, memberships } = await participantOverview(user);
  const active = registrations.filter((r) => r.status !== "WITHDRAWN");
  return (
    <>
      <PageHeader
        title={t("hi", { name: user.name.split(" ")[0] })}
        description={t("participantDescription")}
        actions={
          <Button asChild variant="brand">
            <Link href="/explore">
              {t("exploreEvents")} <ArrowRight />
            </Link>
          </Button>
        }
      />
      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarPlus />}
            title={t("noRegistrations")}
            description={t("findHackathon")}
            action={
              <Button asChild variant="secondary">
                <Link href="/explore">{t("browseEvents")}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((r) => {
            const m = memberships.find((x) => x.team.eventId === r.eventId);
            const sub = m?.team.submission;
            const steps = [
              { label: t("registeredStep"), done: true },
              { label: t("approvedStep"), done: r.status === "APPROVED" },
              { label: t("inTeamStep"), done: Boolean(m) },
              { label: t("submittedStep"), done: Boolean(sub && sub.status !== "DRAFT") },
              { label: t("checkedInStep"), done: Boolean(r.attendance) },
            ];
            const progress = pct(steps.filter((s) => s.done).length, steps.length);
            return (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{r.event.name}</CardTitle>
                    <StatusBadge status={r.status} />
                    {r.isDemo && <DemoBadge label={common("demo")} title={common("demoRecordTitle")} />}
                  </div>
                  <CardDescription>
                    {t("submissionDeadline", { date: formatDate(r.event.submissionDeadline, r.event.timeZone), relative: relativeTime(r.event.submissionDeadline) })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={progress} />
                  <ol className="mt-4 grid grid-cols-5 gap-2 text-center">
                    {steps.map((s) => (
                      <li key={s.label} className="flex flex-col items-center gap-1">
                        <span
                          className={
                            s.done
                              ? "grid size-6 place-items-center rounded-full bg-emerald-500 text-white"
                              : "grid size-6 place-items-center rounded-full border border-dashed border-ink-300 text-ink-300"
                          }
                        >
                          <CheckCircle2 className="size-3.5" />
                        </span>
                        <span className="text-[11px] font-medium leading-tight text-ink-600">{s.label}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/explore/${r.eventId}`}>{t("eventAndTeam")}</Link>
                    </Button>
                    {m && (
                      <Button asChild size="sm">
                        <Link href={`/explore/${r.eventId}/submit`}>{sub ? t("editSubmission") : t("startSubmission")}</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
