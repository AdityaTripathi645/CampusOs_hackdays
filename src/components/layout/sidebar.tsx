"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  ClipboardList,
  Compass,
  Gavel,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const ICONS = {
  dashboard: LayoutDashboard,
  events: CalendarRange,
  explore: Compass,
  my: ClipboardList,
  judge: Gavel,
  settings: Settings,
  audit: ScrollText,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "bg-white text-ink-950 shadow-card ring-1 ring-line" : "text-ink-600 hover:bg-white/70 hover:text-ink-900",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const t = useTranslations("navigation");
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-ink-50/60 px-4 py-5 lg:flex">
      <Logo href="/dashboard" className="px-2" />
      <p className="mt-1 px-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">{t("tagline")}</p>
      <div className="mt-8 flex-1 overflow-y-auto">
        <NavLinks items={items} />
      </div>
      {footer}
    </aside>
  );
}

export function MobileNav({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const t = useTranslations("navigation");
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-xl text-ink-600 hover:bg-ink-100 lg:hidden"
        aria-label={t("open")}
      >
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-canvas px-4 py-5 shadow-pop">
            <div className="flex items-center justify-between">
              <Logo href="/dashboard" className="px-2" />
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label={t("close")}>
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-8 flex-1 overflow-y-auto">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
