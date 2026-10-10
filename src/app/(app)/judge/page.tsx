import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gavel, Lock } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { listMyAssignments } from "@/services/judging";
import { Card } from "@/components/ui/card";
import { Callout, DemoBadge, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Judge workspace" };

export default async function JudgeWorkspacePage() {
  const user = await requirePageUser(["JUDGE"]);
  const assignments = await listMyAssignments(user);
  const done = assignments.filter((a) => a.evaluation?.status === "SUBMITTED").length;

  const groups = [
    { title: "To score", items: assignments.filter((a) => !a.evaluation) },
    { title: "Drafts", items: assignments.filter((a) => a.evaluation?.status === "DRAFT") },
    { title: "Submitted", items: assignments.filter((a) => a.evaluation?.status === "SUBMITTED") },
  ];

  return (
    <>
      <PageHeader
        title="Judge workspace"
        description="Score each project against the event rubric. Your scores are private until organizers open the review stage."
      />
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink-900">
            {done} of {assignments.length} evaluations submitted
          </p>
          <Progress value={pct(done, assignments.length)} className="mt-2" />
        </div>
        <Callout tone="info" className="sm:max-w-sm">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> You never see other judges&apos; scores.
          </span>
        </Callout>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <EmptyState icon={<Gavel />} title="No assignments yet" description="Organizers will assign projects to you." />
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <section key={g.title}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
                    {g.title} ({g.items.length})
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {g.items.map((a) => (
                      <Link
                        key={a.id}
                        href={`/judge/${a.id}`}
                        className="group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={a.evaluation?.status === "SUBMITTED" ? "SUBMITTED" : a.evaluation ? "IN_PROGRESS" : "ASSIGNED"} />
                          {(a.submission.isDemo || a.evaluation?.isDemo) && <DemoBadge />}
                          <span className="ml-auto text-xs text-ink-400">{a.event.name}</span>
                        </div>
                        <p className="mt-3 font-semibold text-ink-900">{a.submission.title}</p>
                        <p className="text-xs text-ink-500">
                          {a.submission.team.name} · {a.submission.track?.name ?? "No track"}
                        </p>
                        <div className="mt-4 flex items-center justify-between text-xs text-ink-500">
                          <span>
                            {a.evaluation?.submittedAt
                              ? `Submitted ${formatDateTime(a.evaluation.submittedAt)}`
                              : a.evaluation
                                ? `Last saved ${formatDateTime(a.evaluation.updatedAt)}`
                                : "Not started"}
                          </span>
                          <ArrowRight className="size-4 text-ink-300 group-hover:text-brand-500" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </>
  );
}
