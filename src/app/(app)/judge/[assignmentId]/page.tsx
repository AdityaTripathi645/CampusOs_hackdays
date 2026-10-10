import { notFound } from "next/navigation";
import { ExternalLink, FileText, GitBranch } from "lucide-react";
import { z } from "zod";
import { requirePageUser } from "@/lib/auth";
import { getAssignmentForJudge } from "@/services/judging";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, DemoBadge, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { jsonStringArray } from "@/lib/utils";
import { ScoringForm } from "./scoring-form";

export default async function JudgeAssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const user = await requirePageUser(["JUDGE"]);
  const { assignmentId } = await params;
  const a = await getAssignmentForJudge(user, assignmentId).catch(() => null);
  if (!a) notFound();
  const s = a.submission;
  const technologies = jsonStringArray(s.technologies);
  const scores = z.record(z.string(), z.number()).safeParse(a.evaluation?.scores ?? {});
  const locked = a.evaluation?.status === "SUBMITTED";
  const judgingOpen = ["LIVE", "JUDGING"].includes(a.event.status);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Judge workspace", href: "/judge" }, { label: s.title }]}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={locked ? "SUBMITTED" : a.evaluation ? "IN_PROGRESS" : "ASSIGNED"} />
            {(s.isDemo || a.evaluation?.isDemo) && <DemoBadge />}
          </div>
        }
        title={s.title}
        description={`${s.team.name} · ${s.track?.name ?? "No track"} · ${a.event.name}`}
      />
      {a.evaluation?.isDemo && (
        <Callout tone="demo" className="mb-6" title="Seeded demo evaluation">
          This evaluation was created by the seed script, not by a real judge.
        </Callout>
      )}
      {!judgingOpen && !locked && (
        <Callout tone="warning" className="mb-6" title="Judging is not open">
          The event must be Live or in Judging for evaluations to be saved.
        </Callout>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Project details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-0">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{s.abstract}</p>
            {technologies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {technologies.map((t) => (
                  <span key={t} className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-line">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2 text-sm">
              {s.repoUrl && (
                <a href={s.repoUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-brand-600 hover:underline">
                  <GitBranch className="size-4" /> {s.repoUrl}
                </a>
              )}
              {s.demoUrl && (
                <a href={s.demoUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-brand-600 hover:underline">
                  <ExternalLink className="size-4" /> {s.demoUrl}
                </a>
              )}
              {s.files.map((f) => (
                <a key={f.id} href={`/api/files/${f.id}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
                  <FileText className="size-4 text-ink-400" /> {f.fileName}
                </a>
              ))}
              {!s.repoUrl && !s.demoUrl && s.files.length === 0 && <p className="text-ink-400">No links or files provided.</p>}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Team</p>
              <p className="text-sm text-ink-700">{s.team.members.map((m) => m.user.name).join(", ")}</p>
            </div>
          </CardContent>
        </Card>
        <ScoringForm
          assignmentId={a.id}
          criteria={a.event.criteria.map((c) => ({ id: c.id, name: c.name, description: c.description, weight: c.weight, maxScore: c.maxScore }))}
          initialScores={scores.success ? scores.data : {}}
          initialFeedback={a.evaluation?.feedback ?? ""}
          locked={locked || !judgingOpen}
        />
      </div>
    </>
  );
}
