import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, Sparkles, FlaskConical, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Page header with optional breadcrumbs ──────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  breadcrumbLabel = "Breadcrumb",
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  breadcrumbLabel?: string;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label={breadcrumbLabel} className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-500">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.href ? (
                  <Link href={b.href} className="hover:text-ink-900">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-ink-700">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <ChevronRight className="size-3 text-ink-300" />}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "brand",
  progress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "brand" | "emerald" | "amber" | "sky" | "rose" | "violet";
  progress?: number;
}) {
  const accents = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  } as const;
  const bars = {
    brand: "bg-brand-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
  } as const;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        {icon && <span className={cn("grid size-8 place-items-center rounded-lg [&_svg]:size-4", accents[accent])}>{icon}</span>}
      </div>
      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-ink-950 tabular-nums">{value}</p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className={cn("h-full rounded-full transition-all", bars[accent])} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

// ─── Empty / callout states ─────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-b from-brand-50 to-white text-brand-500 ring-1 ring-brand-100 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "demo" | "ai";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: { box: "border-sky-200 bg-sky-50/70 text-sky-900", icon: <Info className="size-4 text-sky-600" /> },
    warning: { box: "border-amber-200 bg-amber-50/70 text-amber-900", icon: <AlertTriangle className="size-4 text-amber-600" /> },
    demo: {
      box: "border-dashed border-orange-300 bg-orange-50/60 text-orange-900",
      icon: <FlaskConical className="size-4 text-orange-600" />,
    },
    ai: { box: "border-violet-200 bg-violet-50/60 text-violet-950", icon: <Sparkles className="size-4 text-violet-600" /> },
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", styles.box, className)}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

// ─── Provenance badges ──────────────────────────────────────────────────────

export function DemoBadge({
  className,
  label = "Demo",
  title = "Seeded demo record — not real data",
}: {
  className?: string;
  label?: React.ReactNode;
  title?: string;
}) {
  return (
    <Badge tone="demo" className={className} title={title}>
      <FlaskConical />
      {label}
    </Badge>
  );
}

export function AIBadge({ mode }: { mode: string }) {
  return mode === "LIVE" ? (
    <Badge tone="violet" title="Generated by Gemini — a suggestion, not a decision">
      <Sparkles />
      AI suggestion
    </Badge>
  ) : mode === "DEMO" ? (
    <Badge tone="demo" title="Keyword heuristic used because GEMINI_API_KEY is not set">
      <FlaskConical />
      Demo heuristic · not AI
    </Badge>
  ) : (
    <Badge tone="warning" title="Unrecognized AI processing mode">
      Unknown mode
    </Badge>
  );
}

export function HumanBadge() {
  return (
    <Badge tone="success" title="Recorded by a human reviewer">
      <UserCheck />
      Human decision
    </Badge>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const hue = [...name].reduce((h, c) => (h + c.charCodeAt(0) * 7) % 360, 0);
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn("grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 58%), hsl(${(hue + 40) % 360} 60% 48%))` }}
      aria-hidden
    >
      {ini}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">{children}</h2>
      {action}
    </div>
  );
}
