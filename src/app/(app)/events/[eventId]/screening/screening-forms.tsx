"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Select, Textarea } from "@/components/ui/inputs";
import { decideAIReviewAction, runScreeningBatchAction } from "@/actions/staff";

export function BatchScreeningForm({
  eventId,
  items,
  live,
}: {
  eventId: string;
  items: { id: string; title: string; team: string; screened: boolean }[];
  live: boolean;
}) {
  const [selected, setSelected] = React.useState<string[]>(items.filter((i) => !i.screened).slice(0, 10).map((i) => i.id));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 10 ? s : [...s, id]));
  return (
    <ActionForm action={runScreeningBatchAction}>
      <input type="hidden" name="eventId" value={eventId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="submissionIds" value={id} />
      ))}
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
        {items.map((i) => (
          <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
            <Checkbox checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
            <span className="min-w-0 flex-1 truncate text-ink-800">{i.title}</span>
            <span className="hidden text-xs text-ink-400 sm:inline">{i.team}</span>
            {i.screened && <span className="text-[10px] font-semibold uppercase text-emerald-600">screened</span>}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500">{selected.length}/10 selected · processed one at a time</p>
        <SubmitButton variant="brand" disabled={selected.length === 0} pendingText="Analysing…">
          <Sparkles /> {live ? "Run Gemini analysis" : "Run demo screening"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DecisionForm({ reviewId, eventId }: { reviewId: string; eventId: string }) {
  const [decision, setDecision] = React.useState("ACCEPTED");
  return (
    <ActionForm action={decideAIReviewAction} className="space-y-3">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: "ACCEPTED", l: "Accept", d: "Suggestion is accurate" },
          { v: "OVERRIDDEN", l: "Override", d: "I disagree — note why" },
          { v: "DISMISSED", l: "Dismiss", d: "Not useful" },
        ].map((o) => (
          <label
            key={o.v}
            className={`cursor-pointer rounded-xl border px-3 py-2 text-left transition ${
              decision === o.v ? "border-brand-400 bg-brand-50 ring-brand-soft" : "border-line hover:border-ink-300"
            }`}
          >
            <input type="radio" name="decision" value={o.v} checked={decision === o.v} onChange={() => setDecision(o.v)} className="sr-only" />
            <span className="block text-sm font-semibold text-ink-900">{o.l}</span>
            <span className="block text-[11px] text-ink-500">{o.d}</span>
          </label>
        ))}
      </div>
      <Field label="Submission status (human decision)" name="submissionStatus">
        <Select defaultValue="UNCHANGED">
          <option value="UNCHANGED">Leave unchanged</option>
          <option value="UNDER_REVIEW">Mark under review</option>
          <option value="SHORTLISTED">Shortlist</option>
          <option value="REJECTED">Reject</option>
        </Select>
      </Field>
      <Field label={decision === "OVERRIDDEN" ? "Reason for override" : "Reviewer note"} name="note" required={decision === "OVERRIDDEN"}>
        <Textarea rows={2} placeholder="Optional context for the audit trail" />
      </Field>
      <SubmitButton size="sm" pendingText="Saving…">
        Record decision
      </SubmitButton>
    </ActionForm>
  );
}
