import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, FileText, Users } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { participantOverview } from "@/services/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoBadge, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myEvents");
  return { title: t("title") };
}

export default async function MyEventsPage() {
  const [t, common] = await Promise.all([
    getTranslations("myEvents"),
    getTranslations("common"),
  ]);
  const user = await requirePageUser(["PARTICIPANT"]);
  const { registrations, memberships } = await participantOverview(user);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {registrations.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title={t("none")}
            action={
              <Button asChild variant="brand">
                <Link href="/explore">{t("explore")}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {registrations.map((r) => {
            const m = memberships.find((x) => x.team.eventId === r.eventId);
            const sub = m?.team.submission;
            return (
              <Card key={r.id}>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{r.event.name}</CardTitle>
                    <StatusBadge status={r.status} />
                    {r.isDemo && <DemoBadge label={common("demo")} title={common("demoRecordTitle")} />}
                    {r.attendance && <Badge tone="success">{common("checkedIn")}</Badge>}
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/explore/${r.eventId}`}>{t("open")}</Link>
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-line p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      <Users className="size-3.5" /> {t("team")}
                    </p>
                    {m ? (
                      <>
                        <p className="mt-1.5 font-semibold text-ink-900">{m.team.name}</p>
                        <p className="text-xs text-ink-500">{m.team.members.map((x) => x.user.name).join(", ")}</p>
                      </>
                    ) : (
                      <p className="mt-1.5 text-sm text-ink-400">{t("notInTeam")}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      <FileText className="size-3.5" /> {t("submission")}
                    </p>
                    {sub ? (
                      <>
                        <p className="mt-1.5 truncate font-semibold text-ink-900">{sub.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={sub.status} />
                          <span className="text-xs text-ink-500">
                            v{sub.version} · {common("filesCount", { count: sub.files.length })}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="mt-1.5 text-sm text-ink-400">{t("nothingSubmitted")}</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t("recentVersions")}</p>
                    {sub && sub.revisions.length > 0 ? (
                      <ul className="mt-1.5 space-y-1 text-xs text-ink-600">
                        {sub.revisions.map((rv) => (
                          <li key={rv.id}>
                            v{rv.version} · {rv.note} · {formatDateTime(rv.createdAt)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-sm text-ink-400">—</p>
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
