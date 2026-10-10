import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarRange, Compass, MapPin, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { listPublicEvents, registrationState } from "@/services/events";
import { Card } from "@/components/ui/card";
import { DemoBadge, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title") };
}

export default async function ExplorePage() {
  const [t, statusT, common] = await Promise.all([
    getTranslations("explore"),
    getTranslations("common.status"),
    getTranslations("common"),
  ]);
  const user = await requirePageUser();
  const [events, mine] = await Promise.all([
    listPublicEvents(),
    db.registration.findMany({ where: { userId: user.id }, select: { eventId: true, status: true } }),
  ]);
  const myStatus = new Map(mine.map((r) => [r.eventId, r.status]));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {events.length === 0 ? (
        <Card>
          <EmptyState icon={<Compass />} title={t("noneOpen")} description={t("checkBack")} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => {
            const reg = registrationState(e);
            const status = myStatus.get(e.id);
            const registrationReason =
              reg.reason === "Registration has not opened yet."
                ? t("registrationNotStarted")
                : reg.reason === "Registration has closed."
                  ? t("registrationClosed")
                  : reg.reason === "Registration is not open for this event."
                    ? t("registrationNotOpen")
                    : reg.reason;
            return (
              <Link
                key={e.id}
                href={`/explore/${e.id}`}
                className="group flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.isDemo && <DemoBadge label={common("demo")} title={common("demoRecordTitle")} />}
                  {status && status !== "WITHDRAWN" && (
                    <Badge tone="brand">
                      {t("yourStatus", { status: statusT.has(status) ? statusT(status) : status.toLowerCase() })}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink-900">{e.name}</h3>
                {e.tagline && <p className="mt-1 text-sm text-ink-500">{e.tagline}</p>}
                <div className="mt-4 space-y-1.5 text-sm text-ink-600">
                  <p className="flex items-center gap-2">
                    <CalendarRange className="size-4 text-ink-400" /> {formatDate(e.startsAt, e.timeZone)} – {formatDate(e.endsAt, e.timeZone)}
                  </p>
                  {e.venue && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 text-ink-400" /> {e.venue}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Users className="size-4 text-ink-400" /> {t("registeredCount", { count: e._count.registrations, min: e.minTeamSize, max: e.maxTeamSize })}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-5 text-sm">
                  <span className={reg.open ? "font-semibold text-emerald-700" : "text-ink-500"}>
                    {reg.open ? t("registrationOpenUntil", { date: formatDate(e.registrationClosesAt, e.timeZone) }) : registrationReason}
                  </span>
                  <ArrowRight className="size-4 text-ink-300 transition group-hover:text-brand-500" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
