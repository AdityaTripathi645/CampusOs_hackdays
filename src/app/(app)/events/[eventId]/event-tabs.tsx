"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/command", label: "Command center" },
  { href: "/participants", label: "Registrations & teams" },
  { href: "/submissions", label: "Submissions" },
  { href: "/screening", label: "AI screening" },
  { href: "/operations", label: "Operations" },
  { href: "/judging", label: "Judging" },
  { href: "/fairjudge", label: "FairJudge" },
  { href: "/results", label: "Results" },
  { href: "/edit", label: "Settings" },
];

export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  return (
    <div className="no-print -mx-4 mb-8 overflow-x-auto border-b border-line px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <nav className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const href = base + t.href;
          const active = t.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={t.href}
              href={href}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition",
                active ? "text-ink-950" : "text-ink-500 hover:text-ink-800",
              )}
            >
              {t.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
