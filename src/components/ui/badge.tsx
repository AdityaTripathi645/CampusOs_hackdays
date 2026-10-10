import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-ink-50 text-ink-600 ring-ink-200",
        brand: "bg-brand-50 text-brand-700 ring-brand-200",
        success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        warning: "bg-amber-50 text-amber-800 ring-amber-200",
        danger: "bg-rose-50 text-rose-700 ring-rose-200",
        info: "bg-sky-50 text-sky-700 ring-sky-200",
        violet: "bg-violet-50 text-violet-700 ring-violet-200",
        demo: "bg-orange-50 text-orange-700 ring-orange-300 border border-dashed border-orange-300 ring-0",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
