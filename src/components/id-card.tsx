import "server-only";
import Image from "next/image";
import QRCode from "qrcode";
import { LogoMark } from "@/components/brand";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export async function IdCard({
  eventName,
  startsAt,
  timeZone,
  venue,
  name,
  institution,
  team,
  seat,
  code,
  isDemo,
}: {
  eventName: string;
  startsAt: Date;
  timeZone: string;
  venue: string | null;
  name: string;
  institution: string | null;
  team: string | null;
  seat: string | null;
  code: string;
  isDemo: boolean;
}) {
  const t = await getTranslations("idCard");
  const qr = await QRCode.toDataURL(code, { margin: 1, width: 360, color: { dark: "#0b1230", light: "#ffffff" } });
  return (
    <div className="mx-auto w-[340px] overflow-hidden rounded-3xl border border-line bg-white shadow-pop print:shadow-none">
      <div className="relative bg-ink-950 px-6 pb-14 pt-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-500/40 blur-2xl" />
        <div className="relative flex items-center gap-2">
          <LogoMark className="size-7" />
          <span className="text-sm font-bold">CampusOS</span>
          {isDemo && (
            <span className="ml-auto rounded-full border border-dashed border-orange-300 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-200">
              {t("demo")}
            </span>
          )}
        </div>
        <p className="relative mt-5 text-lg font-bold leading-tight">{eventName}</p>
        <p className="relative mt-1 text-xs text-ink-300">
          {formatDate(startsAt, timeZone)}
          {venue ? ` · ${venue}` : ""}
        </p>
      </div>
      <div className="-mt-10 px-6 pb-6">
        <div className="mx-auto w-fit rounded-2xl bg-white p-2 shadow-card ring-1 ring-line">
          <Image src={qr} alt={t("qrAlt", { code })} width={160} height={160} className="size-40" />
        </div>
        <p className="mt-2 text-center font-mono text-xs tracking-widest text-ink-500">{code}</p>
        <p className="mt-4 text-center text-xl font-bold text-ink-950">{name}</p>
        {institution && <p className="text-center text-sm text-ink-500">{institution}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-ink-50 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{t("team")}</p>
            <p className="truncate text-sm font-semibold text-ink-800">{team ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-ink-50 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{t("seat")}</p>
            <p className="truncate text-sm font-semibold text-ink-800">{seat ?? t("toBeAnnounced")}</p>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">{t("participant")}</p>
      </div>
    </div>
  );
}
