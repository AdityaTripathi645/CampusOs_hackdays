import { Brain, QrCode, Scale } from "lucide-react";
import { Logo } from "@/components/brand";
import { getLocalePreference } from "@/i18n/locale";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, userLocaleSet }, t, nav] = await Promise.all([
    getLocalePreference(),
    getTranslations("authLayout"),
    getTranslations("navigation"),
  ]);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 -top-32 size-[480px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-[420px] rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white p-2 pr-4">
            <Logo />
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300">{nav("tagline")}</p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            {t("headline")}
          </h2>
          <ul className="mt-10 space-y-5 text-sm text-ink-200">
            {[
              { icon: Brain, text: t("gemini") },
              { icon: QrCode, text: t("checkin") },
              { icon: Scale, text: t("fairjudge") },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4 text-brand-200" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-400">© {new Date().getFullYear()} CampusOS</p>
      </aside>
      <main className="relative flex items-center justify-center bg-white px-5 py-12 sm:px-10">
        <div className="absolute right-5 top-5 z-10">
          <LocaleSwitcher locale={locale} enabled={!userLocaleSet} />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
