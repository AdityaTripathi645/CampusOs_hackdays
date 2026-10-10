"use client";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Tone = NonNullable<BadgeProps["tone"]>;

const MAP: Record<string, { tone: Tone; label?: string; dot?: boolean }> = {
  // Event
  DRAFT: { tone: "neutral" },
  PUBLISHED: { tone: "info" },
  LIVE: { tone: "success", dot: true },
  JUDGING: { tone: "violet" },
  COMPLETED: { tone: "brand" },
  ARCHIVED: { tone: "neutral" },
  // Registration
  PENDING: { tone: "warning" },
  APPROVED: { tone: "success" },
  WAITLISTED: { tone: "info" },
  REJECTED: { tone: "danger" },
  WITHDRAWN: { tone: "neutral" },
  // Submission
  SUBMITTED: { tone: "info" },
  UNDER_REVIEW: { tone: "violet", label: "Under review" },
  SHORTLISTED: { tone: "success" },
  // AI review
  PENDING_HUMAN_REVIEW: { tone: "warning", label: "Needs human review" },
  ACCEPTED: { tone: "success", label: "Accepted" },
  OVERRIDDEN: { tone: "brand", label: "Overridden" },
  DISMISSED: { tone: "neutral", label: "Dismissed" },
  // Assignments
  ASSIGNED: { tone: "neutral" },
  IN_PROGRESS: { tone: "warning", label: "In progress" },
  // Tickets
  OPEN: { tone: "danger" },
  RESOLVED: { tone: "success" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useTranslations("common.status");
  const cfg = MAP[status] ?? { tone: "neutral" as Tone };
  const label = t.has(status)
    ? t(status)
    : cfg.label ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge tone={cfg.tone} className={className}>
      {cfg.dot && <span className="size-1.5 rounded-full bg-current animate-pulse-dot" />}
      {label}
    </Badge>
  );
}
