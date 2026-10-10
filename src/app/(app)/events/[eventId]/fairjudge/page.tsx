import { AlertTriangle, Eye, Lock, Scale, TicketPlus } from "lucide-react";
import { getDiscrepancyReport } from "@/services/fairjudge";
import { openReviewStageAction, openTicketAction } from "@/actions/staff";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, DemoBadge, EmptyState, HumanBadge, Progress } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/inputs";
import { formatDateTime, pct } from "@/lib/utils";
import { eventPageContext } from "../context";
import { TicketDecisionForm } from "./ticket-decision-form";

const DECISION_LABEL: Record<string, string> = {
  KEEP_SCORES: "Scores kept",
  REQUEST_RESCORE: "Re-score requested",
  EXCLUDE_EVALUATION: "Evaluation excluded",
};

export default async function FairJudgePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { user, eventId } = await eventPageContext(params);
  const report = await getDiscrepancyReport(user, eventId);

  const principle = (
    <Callout tone="info" title="How FairJudge works">
      FairJudge highlights projects where judges&apos; scores differ by at least <b>{report.threshold} points</b> (on a 0–100 scale). A
      difference can reflect legitimate expertise or perspective — it is a prompt for human review, never a finding that a judge
      is biased.
    </Callout>
  );

  if (!report.revealed) {
    const done = report.progress.reduce((s, p) => s + p.submitted, 0);
    const total = report.progress.reduce((s, p) => s + p.assigned, 0);
    return (
      <div className="space-y-6">
        {principle}
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-ink-950 text-white">
              <Lock className="size-6" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-ink-900">Scores are private during independent judging</h2>
            <p className="mt-1 max-w-md text-sm text-ink-500">
              {done} of {total} evaluations submitted. Open the review stage once judging is complete (or when you need to review
              early). This is recorded in the audit log.
            </p>
            <div className="mt-4 w-64">
              <Progress value={pct(done, total)} />
            </div>
            <div className="mt-6">
              <ConfirmAction
                action={openReviewStageAction}
                hidden={{ eventId }}
                title="Open the review stage?"
                description="Individual judge scores become visible to authorised organizers for this event. Judges still can't see each other's scores. This can't be undone and is audited."
                triggerLabel="Open review stage"
                triggerVariant="brand"
                triggerSize="md"
                icon={<Eye />}
                disabled={done === 0}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const flagged = report.rows.filter((r) => r.flagged);
  return (
    <div className="space-y-6">
      {principle}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-[13px] text-ink-500">Projects with ≥2 evaluations</p>
          <p className="mt-2 text-[28px] font-bold text-ink-950">{report.rows.filter((r) => r.evaluations.length >= 2).length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-[13px] text-amber-800">Above review threshold</p>
          <p className="mt-2 text-[28px] font-bold text-amber-900">{flagged.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-[13px] text-ink-500">Open tickets</p>
          <p className="mt-2 text-[28px] font-bold text-ink-950">{report.rows.filter((r) => r.openTicket).length}</p>
        </div>
      </div>

      {report.rows.length === 0 && (
        <Card>
          <EmptyState icon={<Scale />} title="No projects to compare" description="Submitted evaluations appear here." />
        </Card>
      )}

      {[...report.rows]
        .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.spread - a.spread)
        .map((row) => (
          <Card key={row.submissionId} className={row.flagged ? "border-amber-300" : undefined}>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{row.title}</CardTitle>
                  {row.flagged && (
                    <Badge tone="warning">
                      <AlertTriangle /> Score difference {row.spread} pts
                    </Badge>
                  )}
                  {row.evaluations.some((e) => e.isDemo) && <DemoBadge />}
                </div>
                <CardDescription>
                  {row.teamName} · {row.evaluations.length} submitted evaluation(s) · spread {row.spread} pts
                </CardDescription>
              </div>
              {!row.openTicket && row.evaluations.length >= 2 && (
                <ConfirmAction
                  action={openTicketAction}
                  hidden={{ eventId, submissionId: row.submissionId }}
                  title="Open a review ticket"
                  description="A ticket asks an authorised reviewer to look at this project's evaluations and record a decision."
                  triggerLabel="Open ticket"
                  triggerVariant={row.flagged ? "primary" : "secondary"}
                  icon={<TicketPlus />}
                >
                  <Field label="Reason" name="reason">
                    <Textarea rows={3} defaultValue={row.flagged ? `Score difference of ${row.spread} points exceeds the ${report.threshold}-point threshold.` : ""} />
                  </Field>
                </ConfirmAction>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {row.evaluations.length === 0 ? (
                <p className="text-sm text-ink-500">No submitted evaluations yet.</p>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Weighted totals (0–100)</p>
                    <div className="space-y-2.5">
                      {row.evaluations.map((e, i) => (
                        <div key={e.evaluationId} className={e.excluded ? "opacity-50" : undefined}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-ink-700">
                              Evaluation {String.fromCharCode(65 + i)} · {e.judgeName}
                              {e.excluded && <span className="ml-2 text-xs font-semibold text-rose-600">excluded</span>}
                            </span>
                            <span className="font-mono text-ink-900">{e.total}</span>
                          </div>
                          <Progress value={e.total} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Per-criterion spread (normalised)</p>
                    <div className="space-y-1.5">
                      {row.criterionSpreads.map((c) => (
                        <div key={c.criterionId} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-1.5 text-sm">
                          <span className="text-ink-700">{c.name}</span>
                          <span className={`font-mono text-xs ${c.spread >= report.threshold ? "font-bold text-amber-700" : "text-ink-500"}`}>
                            {c.spread} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {row.openTicket && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status="OPEN" />
                    <span className="text-sm font-semibold text-ink-900">Review ticket</span>
                    <span className="text-xs text-ink-500">opened {formatDateTime(row.openTicket.createdAt)}</span>
                  </div>
                  <p className="mb-4 text-sm text-ink-700">{row.openTicket.reason}</p>
                  <TicketDecisionForm
                    ticketId={row.openTicket.id}
                    eventId={eventId}
                    evaluations={row.evaluations
                      .map((e, i) => ({ e, label: `Evaluation ${String.fromCharCode(65 + i)} · ${e.judgeName} (${e.total})` }))
                      .filter(({ e }) => !e.excluded)
                      .map(({ e, label }) => ({ id: e.evaluationId, label }))}
                  />
                </div>
              )}

              {row.tickets.filter((t) => t.status !== "OPEN").length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Decision history</p>
                  <ul className="space-y-2">
                    {row.tickets
                      .filter((t) => t.status !== "OPEN")
                      .map((t) => (
                        <li key={t.id} className="rounded-xl border border-line p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <HumanBadge />
                            <StatusBadge status={t.status} />
                            {t.decision && <span className="font-semibold text-ink-800">{DECISION_LABEL[t.decision]}</span>}
                            <span className="text-xs text-ink-400">{formatDateTime(t.resolvedAt)}</span>
                          </div>
                          {t.decisionNote && <p className="mt-1.5 text-ink-600">{t.decisionNote}</p>}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
