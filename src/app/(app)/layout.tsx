import Link from "next/link";
import { LogOut, Sparkles, FlaskConical } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { getGeminiStatus } from "@/services/gemini";
import { MobileNav, Sidebar, type NavItem } from "@/components/layout/sidebar";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/app/(auth)/actions";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { getLocalePreference } from "@/i18n/locale";
import { getTranslations } from "next-intl/server";

async function navFor(role: string): Promise<NavItem[]> {
  const t = await getTranslations("navigation");
  const items: NavItem[] = [{ href: "/dashboard", label: t("dashboard"), icon: "dashboard" }];
  if (role === "ORGANIZER" || role === "ADMIN") {
    items.push({ href: "/events", label: t("events"), icon: "events" });
  }
  if (role === "PARTICIPANT") {
    items.push({ href: "/explore", label: t("explore"), icon: "explore" });
    items.push({ href: "/my", label: t("myEvents"), icon: "my" });
  }
  if (role === "JUDGE") items.push({ href: "/judge", label: t("judge"), icon: "judge" });
  if (role === "ORGANIZER" || role === "ADMIN") {
    items.push({ href: "/audit", label: t("audit"), icon: "audit" });
  }
  items.push({ href: "/settings", label: t("settings"), icon: "settings" });
  return items;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [{ locale, userLocaleSet }, t] = await Promise.all([
    getLocalePreference(),
    getTranslations("navigation"),
  ]);
  const items = await navFor(user.role);
  const gemini = getGeminiStatus();

  const footer = (
    <div className="mt-4 rounded-2xl border border-line bg-white p-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-ink-500">
            {t(user.role === "ADMIN" ? "admin" : user.role === "ORGANIZER" ? "organizer" : user.role === "JUDGE" ? "judgeRole" : "participant")}
          </p>
        </div>
        <form action={signOutAction}>
          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" title={t("signOut")} aria-label={t("signOut")}>
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} footer={footer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/80 px-4 backdrop-blur sm:px-6">
          <MobileNav items={items} footer={footer} />
          <div className="flex-1" />
          <LocaleSwitcher locale={locale} enabled={!userLocaleSet} />
          {user.role !== "PARTICIPANT" &&
            (gemini.configured ? (
              <Badge tone="violet" title={t("geminiModelTitle", { model: gemini.model })}>
                <Sparkles /> {t("geminiConnected")}
              </Badge>
            ) : (
              <Link href="/settings#ai">
                <Badge tone="demo" title={t("aiDemoTitle")}>
                  <FlaskConical /> {t("aiDemoMode")}
                </Badge>
              </Link>
            ))}
          {user.isDemo && (
            <Badge tone="demo" title={t("demoAccount")}>
              {t("demoAccount")}
            </Badge>
          )}
          <span className="hidden text-sm text-ink-500 sm:inline">{user.email}</span>
        </header>
        {!user.emailVerifiedAt && <EmailVerificationBanner />}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
