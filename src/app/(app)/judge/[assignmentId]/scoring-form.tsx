"use client";

import * as React from "react";
import { Lock, Save, Send } from "lucide-react";
import { ActionForm, Field, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/inputs";
import { saveEvaluationAction } from "@/actions/judge";
import { cn } from "@/lib/utils";

type Criterion = { id: string; name: string; description: string | null; weight: number; maxScore: number };

export function ScoringForm({
  assignmentId,
  criteria,
  initialScores,
  initialFeedback,
  locked,
}: {
  assignmentId: string;
  criteria: Criterion[];
  initialScores: Record<string, number>;
  initialFeedback: string;
  locked: boolean;
}) {
  const [scores, setScores] = React.useState<Record<string, string>>(
    Object.fromEntries(criteria.map((c) => [c.id, initialScores[c.id] !== undefined ? String(initialScores[c.id]) : ""])),
  );
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const complete = criteria.every((c) => scores[c.id] !== "");
  const total = complete
    ? Math.round(
        (criteria.reduce((s, c) => s + c.weight * (Math.min(Number(scores[c.id]), c.maxScore) / c.maxScore), 0) / totalWeight) * 1000,
      ) / 10
    : null;

  return (
    <ActionForm action={saveEvaluationAction} className="space-y-5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <fieldset disabled={locked} className="space-y-4">
        {criteria.map((c) => {
          const v = scores[c.id] ?? "";
          return (
            <div key={c.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">{c.name}</p>
                  {c.description && <p className="text-xs text-ink-500">{c.description}</p>}
                </div>
                <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-line">
                  {Math.round((c.weight / totalWeight) * 100)}% weight
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={c.maxScore}
                  step={0.5}
                  value={v === "" ? 0 : Number(v)}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                  className={cn("h-2 flex-1 cursor-pointer accent-brand-600", v === "" && "opacity-40")}
                  aria-label={`${c.name} score`}
                />
                <input
                  name={`score_${c.id}`}
                  type="number"
                  min={0}
                  max={c.maxScore}
                  step={0.5}
                  value={v}
                  onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                  className="h-10 w-20 rounded-xl border border-line px-2 text-center font-mono text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  placeholder="—"
                />
                <span className="w-10 text-sm text-ink-400">/ {c.maxScore}</span>
              </div>
              <FieldError name={`score_${c.id}`} />
            </div>
          );
        })}
        <Field label="Written feedback" name="feedback" hint="Shared with organizers; may be passed on to the team. Minimum 20 characters to submit.">
          <Textarea defaultValue={initialFeedback} rows={5} placeholder="Strengths, concerns, and suggestions…" />
        </Field>
      </fieldset>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-pop backdrop-blur">
        <div className="px-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Weighted score</p>
          <p className="font-mono text-xl font-bold text-ink-950">{total !== null ? `${total} / 100` : "—"}</p>
        </div>
        {locked ? (
          <p className="flex items-center gap-1.5 text-sm text-ink-500">
            <Lock className="size-4" /> Submitted and locked
          </p>
        ) : (
          <div className="flex gap-2">
            <SubmitButton name="intent" value="draft" variant="secondary" pendingText="Saving…">
              <Save /> Save draft
            </SubmitButton>
            <SubmitButton name="intent" value="submit" variant="brand" pendingText="Submitting…" disabled={!complete}>
              <Send /> Submit evaluation
            </SubmitButton>
          </div>
        )}
      </div>
    </ActionForm>
  );
}
