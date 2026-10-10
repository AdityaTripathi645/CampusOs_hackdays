"use client";

import * as React from "react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Select, Textarea } from "@/components/ui/inputs";
import { decideTicketAction } from "@/actions/staff";

const OPTIONS = [
  { v: "KEEP_SCORES", l: "Keep scores", d: "Difference reflects a legitimate judgement" },
  { v: "REQUEST_RESCORE", l: "Request re-score", d: "Reopen one evaluation for the judge" },
  { v: "EXCLUDE_EVALUATION", l: "Exclude evaluation", d: "Leave one evaluation out of results" },
  { v: "DISMISS", l: "Dismiss ticket", d: "Opened in error" },
];

export function TicketDecisionForm({
  ticketId,
  eventId,
  evaluations,
}: {
  ticketId: string;
  eventId: string;
  evaluations: { id: string; label: string }[];
}) {
  const [decision, setDecision] = React.useState("KEEP_SCORES");
  const needsTarget = decision === "REQUEST_RESCORE" || decision === "EXCLUDE_EVALUATION";
  return (
    <ActionForm action={decideTicketAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="eventId" value={eventId} />
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <label
            key={o.v}
            className={`cursor-pointer rounded-xl border px-3 py-2 transition ${
              decision === o.v ? "border-brand-400 bg-brand-50 ring-brand-soft" : "border-line bg-white hover:border-ink-300"
            }`}
          >
            <input type="radio" name="decision" value={o.v} checked={decision === o.v} onChange={() => setDecision(o.v)} className="sr-only" />
            <span className="block text-sm font-semibold text-ink-900">{o.l}</span>
            <span className="block text-[11px] text-ink-500">{o.d}</span>
          </label>
        ))}
      </div>
      {needsTarget && (
        <Field label="Applies to evaluation" name="targetEvaluationId" required>
          <Select defaultValue="">
            <option value="" disabled>
              Choose an evaluation
            </option>
            {evaluations.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Decision rationale" name="decisionNote" required hint="Recorded in the audit trail. Describe the evidence, not the person.">
        <Textarea rows={3} />
      </Field>
      <SubmitButton size="sm" pendingText="Recording…">
        Record decision
      </SubmitButton>
    </ActionForm>
  );
}
