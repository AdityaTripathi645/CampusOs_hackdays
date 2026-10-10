import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { IdCard } from "@/components/id-card";
import { PrintButton } from "@/components/print-button";
import { eventPageContext } from "../../../context";
import { getTranslations } from "next-intl/server";

export default async function IdCardPage({ params }: { params: Promise<{ eventId: string; registrationId: string }> }) {
  const [t, statusT] = await Promise.all([
    getTranslations("idCard"),
    getTranslations("common.status"),
  ]);
  const { event, eventId } = await eventPageContext(params);
  const { registrationId } = await params;
  const reg = await db.registration.findFirst({
    where: { id: registrationId, eventId },
    include: { user: true, seat: { include: { room: true } } },
  });
  if (!reg) notFound();
  const membership = await db.teamMember.findUnique({
    where: { eventId_userId: { eventId, userId: reg.userId } },
    include: { team: true },
  });
  return (
    <div>
      <div className="no-print mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/events/${eventId}/operations`}>
            <ArrowLeft />             {t("backToOperations")}
          </Link>
        </Button>
        <PrintButton label={t("print")} />
      </div>
      <IdCard
        eventName={event.name}
        startsAt={event.startsAt}
        timeZone={event.timeZone}
        venue={event.venue}
        name={reg.user.name}
        institution={reg.user.institution}
        team={membership?.team.name ?? null}
        seat={reg.seat ? `${reg.seat.room.name} · ${reg.seat.seatLabel}` : null}
        code={reg.checkInCode}
        isDemo={reg.isDemo}
      />
      {reg.status !== "APPROVED" && (
        <p className="no-print mt-4 text-center text-sm text-amber-700">
          {t("unapproved", { status: statusT.has(reg.status) ? statusT(reg.status) : reg.status.toLowerCase() })}
        </p>
      )}
    </div>
  );
}
