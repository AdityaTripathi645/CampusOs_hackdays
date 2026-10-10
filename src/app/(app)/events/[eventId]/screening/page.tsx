import { Brain, CircleAlert, FileSearch, Quote, Sparkles, ThumbsDown, ThumbsUp, Minus } from "lucide-react";
import { z } from "zod";
import { listScreeningQueue } from "@/services/screening";
import { getGeminiStatus } from "@/services/gemini";
import { runScreeningAction } from "@/actions/staff";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AIBadge, Callout, DemoBadge, EmptyState, HumanBadge, Progress } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineAction } from "@/components/forms/inline-action";
import { formatDateTime } from "@/lib/utils";
import { eventPageContext } from "../context";
import { BatchScreeningForm, DecisionForm } from "./screening-forms";

const observationsSchema = z.array(z.object({ criterion: z.string(), observation: z.string(), signal: z.string() }));
const stringsSchema = z.array(z.string());
const evidenceSchema = z.array(z.object({ source: z.string(), quote: z.string() }));
const safe = <T,>(schema: z.ZodType<T>, v: unknown, fallback: T): T => {
  const r = schema.safeParse(v);
  return r.success ? r.data : fallback;
};

export default async function ScreeningPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await eventPageContext(params);
  const queue = await listScreeningQueue(eventId);
  const gemini = getGeminiStatus();

  return (
    <div className="space-y-6">
      {gemini.configured ? (
        <Callout tone="ai" title={`Gemini connected · ${gemini.model}`}>
          Analyses are generated server-side, validated against a schema, and saved as <b>suggestions</b>. Nothing changes a
          submission&apos;s status until a person records a decision.
        </Callout>
      ) : (
        <Callout tone="demo" title="Demo mode — Gemini is not configured">
          Set <code className="font-mono">GEMINI_API_KEY</code> in <code className="font-mono">.env</code> and restart to run real
          analysis. Until then, screening produces a simple keyword heuristic that is stored and displayed as{" "}
          <b>&ldquo;Demo heuristic · not AI&rdquo;</b>.
        </Callout>
      )}

      {queue.length === 0 ? (
        <Card>
          <EmptyState icon={<Brain />} title="Nothing to screen yet" description="Submitted projects appear here. Drafts are not screened." />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Batch screening</CardTitle>
              <CardDescription>Select up to 10 submitted projects. PDFs are sent to Gemini; PPT/PPTX files are referenced by name.</CardDescription>
            </CardHeader>
            <CardContent>
              <BatchScreeningForm
                eventId={eventId}
                live={gemini.configured}
                items={queue.map((s) => ({ id: s.id, title: s.title, team: s.team.name, screened: s.aiReviews.length > 0 }))}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {queue.map((s) => {
              const review = s.aiReviews[0];
              const observations = review ? safe(observationsSchema, review.observations, []) : [];
              const missing = review ? safe(stringsSchema, review.missingInfo, []) : [];
              const evidence = review ? safe(evidenceSchema, review.evidence, []) : [];
              return (
                <Card key={s.id}>
                  <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{s.title}</CardTitle>
                        <StatusBadge status={s.status} />
                        {s.isDemo && <DemoBadge />}
                      </div>
                      <CardDescription>
                        {s.team.name} · declared track: {s.track?.name ?? "none"} · {s.files.length} file(s)
                        {s.aiReviews.length > 1 && ` · ${s.aiReviews.length} analyses on record`}
                      </CardDescription>
                      {s.files.some((file) => file.slideCount !== null) && (
                        <p className="mt-1 text-xs text-ink-500">
                          {s.files
                            .filter((file) => file.slideCount !== null)
                            .map((file) => `${file.fileName} · ${file.slideCount} slides read`)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <InlineAction action={runScreeningAction} hidden={{ submissionId: s.id, eventId }} variant={review ? "ghost" : "brand"}>
                      <Sparkles /> {review ? "Re-run" : gemini.configured ? "Analyse" : "Run demo"}
                    </InlineAction>
                  </CardHeader>

                  {!review ? (
                    <CardContent>
                      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-500">
                        Not screened yet.
                      </p>
                    </CardContent>
                  ) : (
                    <CardContent className="grid gap-6 lg:grid-cols-[1fr_320px]">
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <AIBadge mode={review.mode} />
                          <span className="text-xs text-ink-500">
                            {review.model} · {formatDateTime(review.createdAt)} · run by {review.createdBy.name}
                          </span>
                        </div>
                        <div className={`rounded-xl border p-4 ${review.mode === "LIVE" ? "border-violet-200 bg-violet-50/40" : "border-dashed border-orange-300 bg-orange-50/40"}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Summary</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-800">{review.summary}</p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-line p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Track fit</p>
                            <p className="mt-1 text-sm font-semibold text-ink-900">
                              {review.suggestedTrack ?? "No suggestion"}
                              {review.suggestedTrack && s.track && review.suggestedTrack !== s.track.name && (
                                <span className="ml-2 text-xs font-medium text-amber-700">(differs from declared)</span>
                              )}
                            </p>
                            {typeof review.trackFitScore === "number" && <Progress value={review.trackFitScore} className="mt-2" />}
                            <p className="mt-2 text-xs leading-relaxed text-ink-600">{review.trackFitRationale}</p>
                          </div>
                          <div className="rounded-xl border border-line p-4">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                              <CircleAlert className="size-3.5" /> Missing information
                            </p>
                            {missing.length ? (
                              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                                {missing.map((m, i) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="mt-2 size-1 shrink-0 rounded-full bg-amber-500" />
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-ink-500">Nothing flagged.</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Rubric-aligned observations</p>
                          <div className="divide-y divide-line rounded-xl border border-line">
                            {observations.map((o, i) => (
                              <div key={i} className="flex gap-3 p-3 text-sm">
                                <span
                                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg ${
                                    o.signal === "strength"
                                      ? "bg-emerald-50 text-emerald-600"
                                      : o.signal === "concern"
                                        ? "bg-rose-50 text-rose-600"
                                        : "bg-ink-50 text-ink-400"
                                  }`}
                                >
                                  {o.signal === "strength" ? (
                                    <ThumbsUp className="size-3.5" />
                                  ) : o.signal === "concern" ? (
                                    <ThumbsDown className="size-3.5" />
                                  ) : (
                                    <Minus className="size-3.5" />
                                  )}
                                </span>
                                <div>
                                  <p className="font-semibold text-ink-900">{o.criterion}</p>
                                  <p className="text-ink-600">{o.observation}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {evidence.length > 0 && (
                          <div>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                              <FileSearch className="size-3.5" /> Evidence references
                            </p>
                            <div className="space-y-2">
                              {evidence.map((e, i) => (
                                <blockquote key={i} className="flex gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                                  <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
                                  <span>
                                    {e.quote} <span className="font-mono text-[11px] text-ink-400">— {e.source}</span>
                                  </span>
                                </blockquote>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-line bg-ink-50/40 p-4">
                        <p className="text-sm font-semibold text-ink-900">Human review</p>
                        {review.status === "PENDING_HUMAN_REVIEW" ? (
                          <>
                            <p className="mb-4 mt-1 text-xs text-ink-500">Record your decision. The AI output never changes status on its own.</p>
                            <DecisionForm reviewId={review.id} eventId={eventId} />
                          </>
                        ) : (
                          <div className="mt-3 space-y-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <HumanBadge />
                              <StatusBadge status={review.status} />
                            </div>
                            <p className="text-xs text-ink-500">
                              by {review.reviewedBy?.name ?? "—"} · {formatDateTime(review.reviewedAt)}
                            </p>
                            {review.humanDecisionNote && <p className="rounded-lg bg-white p-3 text-ink-700 ring-1 ring-line">{review.humanDecisionNote}</p>}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
