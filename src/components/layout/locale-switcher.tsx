"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";

export function LocaleSwitcher({ locale, enabled = true }: { locale: Locale; enabled?: boolean }) {
  const t = useTranslations("locale");
  const router = useRouter();

  if (!enabled) return null;

  function changeLocale(value: string) {
    document.cookie = `campusos_locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    router.refresh();
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-500">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        onChange={(event) => changeLocale(event.target.value)}
        className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink-700 outline-none focus:border-brand-400"
      >
        <option value="en">{t("english")}</option>
        <option value="hi">{t("hindi")}</option>
      </select>
    </label>
  );
}
