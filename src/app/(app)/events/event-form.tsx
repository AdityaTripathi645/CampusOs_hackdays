"use client";

import * as React from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { ActionForm, Field, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { Callout } from "@/components/ui/misc";
import type { ActionState } from "@/lib/errors";

type Track = { id?: string; name: string; description?: string };
type Criterion = { id?: string; name: string; description?: string; weight: number; maxScore: number };
type RegField = { key: string; label: string; type: "text" | "textarea" | "select" | "checkbox"; required: boolean; options?: string[] };
type Room = { id?: string; name: string; building?: string; capacity: number };
type Prize = { id?: string; name: string; description?: string; trackName?: string; rank: number; amount?: number | string };

export type EventFormValues = {
  id?: string;
  name: string;
  tagline: string;
  description: string;
  venue: string;
  status: string;
  timeZone: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
  submissionDeadline: string;
  eligibility: string;
  maxParticipants: string;
  minTeamSize: number;
  maxTeamSize: number;
  scoringMethod: string;
  discrepancyThreshold: number;
  judgesPerSubmission: number;
  tracks: Track[];
  criteria: Criterion[];
  registrationFields: RegField[];
  rooms: Room[];
  prizes: Prize[];
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RowShell({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-ink-50/40 p-3">
      <GripVertical className="mt-2.5 size-4 shrink-0 text-ink-300" />
      <div className="grid min-w-0 flex-1 gap-2">{children}</div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
        <Trash2 className="text-rose-500" />
      </Button>
    </div>
  );
}

const toKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export function EventForm({
  action,
  initial,
  submitLabel,
  judgingStarted = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: EventFormValues;
  submitLabel: string;
  judgingStarted?: boolean;
}) {
  const [tracks, setTracks] = React.useState<Track[]>(initial.tracks);
  const [criteria, setCriteria] = React.useState<Criterion[]>(initial.criteria);
  const [fields, setFields] = React.useState<RegField[]>(initial.registrationFields);
  const [rooms, setRooms] = React.useState<Room[]>(initial.rooms);
  const [prizes, setPrizes] = React.useState<Prize[]>(initial.prizes);
  const [timeZones, setTimeZones] = React.useState<string[]>([]);

  React.useEffect(() => {
    setTimeZones(Intl.supportedValuesOf("timeZone"));
  }, []);

  const update = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number, patch: Partial<T>) =>
    set((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number) => set((xs) => xs.filter((_, j) => j !== i));

  const totalWeight = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const capacity = rooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);

  return (
    <ActionForm action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="eventId" value={initial.id} />}
      <input type="hidden" name="tracks" value={JSON.stringify(tracks)} />
      <input type="hidden" name="criteria" value={JSON.stringify(criteria)} />
      <input type="hidden" name="registrationFields" value={JSON.stringify(fields)} />
      <input type="hidden" name="rooms" value={JSON.stringify(rooms)} />
      <input type="hidden" name="prizes" value={JSON.stringify(prizes)} />

      <Section title="Basics" description="What participants see on the event page.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event name" name="name" required className="md:col-span-2">
            <Input defaultValue={initial.name} placeholder="Pink City Hack 2026" />
          </Field>
          <Field label="Tagline" name="tagline" className="md:col-span-2">
            <Input defaultValue={initial.tagline} placeholder="One line that sells the event" />
          </Field>
          <Field label="Description" name="description" required className="md:col-span-2">
            <Textarea defaultValue={initial.description} rows={5} />
          </Field>
          <Field label="Venue" name="venue">
            <Input defaultValue={initial.venue} placeholder="Innovation Centre, Jaipur" />
          </Field>
          <Field label="Status" name="status" hint="Participants can register only when Published or Live.">
            <Select defaultValue={initial.status}>
              {["DRAFT", "PUBLISHED", "LIVE", "JUDGING", "COMPLETED", "ARCHIVED"].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Schedule" description="Schedule times are interpreted in the event's time zone.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Event time zone" name="timeZone" required className="md:col-span-3">
            <Input
              list="event-time-zones"
              defaultValue={initial.timeZone}
              placeholder="Search IANA time zones"
              autoComplete="off"
            />
          </Field>
          <datalist id="event-time-zones">
            {timeZones.map((timeZone) => (
              <option key={timeZone} value={timeZone} />
            ))}
          </datalist>
          <Field label="Registration opens" name="registrationOpensAt" required>
            <Input type="datetime-local" defaultValue={initial.registrationOpensAt} />
          </Field>
          <Field label="Registration closes" name="registrationClosesAt" required>
            <Input type="datetime-local" defaultValue={initial.registrationClosesAt} />
          </Field>
          <Field label="Submission deadline" name="submissionDeadline" required>
            <Input type="datetime-local" defaultValue={initial.submissionDeadline} />
          </Field>
          <Field label="Event starts" name="startsAt" required>
            <Input type="datetime-local" defaultValue={initial.startsAt} />
          </Field>
          <Field label="Event ends" name="endsAt" required>
            <Input type="datetime-local" defaultValue={initial.endsAt} />
          </Field>
        </div>
      </Section>

      <Section title="Eligibility & teams">
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Eligibility criteria"
            name="eligibility"
            className="md:col-span-3"
            hint="Participants must confirm this when registering. Leave empty for open events."
          >
            <Textarea defaultValue={initial.eligibility} rows={2} />
          </Field>
          <Field label="Max participants" name="maxParticipants" hint="Extra registrations are waitlisted.">
            <Input type="number" min={1} defaultValue={initial.maxParticipants} placeholder="Unlimited" />
          </Field>
          <Field label="Min team size" name="minTeamSize" required>
            <Input type="number" min={1} max={10} defaultValue={initial.minTeamSize} />
          </Field>
          <Field label="Max team size" name="maxTeamSize" required>
            <Input type="number" min={1} max={10} defaultValue={initial.maxTeamSize} />
          </Field>
        </div>
      </Section>

      <Section title="Registration fields" description="Extra questions asked at registration (validated on the server).">
        <div className="space-y-2">
          {fields.map((f, i) => (
            <RowShell key={i} onRemove={() => remove(setFields, i)}>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <Input
                  value={f.label}
                  placeholder="Question label"
                  onChange={(e) => update(setFields, i, { label: e.target.value, key: f.key || toKey(e.target.value) })}
                  onBlur={(e) => !f.key && update(setFields, i, { key: toKey(e.target.value) })}
                />
                <Select value={f.type} onChange={(e) => update(setFields, i, { type: e.target.value as RegField["type"] })}>
                  <option value="text">Short text</option>
                  <option value="textarea">Long text</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                </Select>
                <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
                  <Checkbox checked={f.required} onChange={(e) => update(setFields, i, { required: e.target.checked })} />
                  Required
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                <Input
                  value={f.key}
                  placeholder="field_key"
                  className="font-mono text-xs"
                  onChange={(e) => update(setFields, i, { key: toKey(e.target.value) })}
                />
                {f.type === "select" && (
                  <Input
                    defaultValue={(f.options ?? []).join(", ")}
                    placeholder="Options, comma separated"
                    onChange={(e) =>
                      update(setFields, i, {
                        options: e.target.value
                          .split(",")
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                )}
              </div>
            </RowShell>
          ))}
          <FieldError name="registrationFields" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setFields((xs) => [...xs, { key: "", label: "", type: "text", required: false }])}
          >
            <Plus /> Add question
          </Button>
        </div>
      </Section>

      <Section title="Tracks" description="Themes teams choose from. Used by AI screening for track-fit suggestions.">
        <div className="space-y-2">
          {tracks.map((t, i) => (
            <RowShell key={i} onRemove={() => remove(setTracks, i)}>
              <Input
                value={t.name}
                placeholder="Track name"
                onChange={(e) => {
                  const name = e.target.value;
                  update(setTracks, i, { name });
                  setPrizes((items) =>
                    items.map((prize) =>
                      prize.trackName?.toLowerCase() === t.name.toLowerCase() ? { ...prize, trackName: name } : prize,
                    ),
                  );
                }}
              />
              <Input
                value={t.description ?? ""}
                placeholder="Short description (helps AI classification)"
                onChange={(e) => update(setTracks, i, { description: e.target.value })}
              />
            </RowShell>
          ))}
          <FieldError name="tracks" />
          <Button type="button" variant="secondary" size="sm" onClick={() => setTracks((xs) => [...xs, { name: "", description: "" }])}>
            <Plus /> Add track
          </Button>
        </div>
      </Section>

      <Section title="Prizes" description="Configure overall or track-specific prizes. Winners are only assigned after a human confirms them in Results.">
        <div className="space-y-2">
          {prizes.map((prize, i) => (
            <RowShell key={prize.id ?? `prize-${i}`} onRemove={() => remove(setPrizes, i)}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_8rem]">
                <Input value={prize.name} placeholder="Prize name" onChange={(e) => update(setPrizes, i, { name: e.target.value })} />
                <Select
                  value={prize.trackName ?? ""}
                  onChange={(e) => update(setPrizes, i, { trackName: e.target.value || undefined })}
                >
                  <option value="">Overall</option>
                  {tracks
                    .filter((track) => track.name.trim())
                    .map((track, index) => (
                      <option key={track.id ?? `${track.name}-${index}`} value={track.name}>
                        {track.name}
                      </option>
                    ))}
                </Select>
                <Input
                    type="number"
                    min={1}
                    value={prize.rank}
                    aria-label="Suggested rank"
                    onChange={(e) => update(setPrizes, i, { rank: Number(e.target.value) })}
                />
                <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={prize.amount ?? ""}
                    placeholder="Amount (optional)"
                    aria-label="Prize amount"
                    onChange={(e) => update(setPrizes, i, { amount: e.target.value })}
                />
              </div>
              <Input
                value={prize.description ?? ""}
                placeholder="Description (optional)"
                onChange={(e) => update(setPrizes, i, { description: e.target.value })}
              />
            </RowShell>
          ))}
          <FieldError name="prizes" />
          <Button type="button" variant="secondary" size="sm" onClick={() => setPrizes((xs) => [...xs, { name: "", description: "", rank: 1 }])}>
            <Plus /> Add prize
          </Button>
        </div>
      </Section>

      <Section title="Judging" description="Rubric criteria, weights and how final scores are calculated.">
        {judgingStarted && (
          <Callout tone="warning" className="mb-4" title="Judging has started">
            You can rename criteria and change weights, but not add/remove criteria or change max scores.
          </Callout>
        )}
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <RowShell key={c.id ?? `new-${i}`} onRemove={() => remove(setCriteria, i)}>
              <div className="grid gap-2 sm:grid-cols-[1fr_110px_110px]">
                <Input value={c.name} placeholder="Criterion" onChange={(e) => update(setCriteria, i, { name: e.target.value })} />
                <label className="flex items-center gap-2 text-xs text-ink-500">
                  Weight
                  <Input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={c.weight}
                    onChange={(e) => update(setCriteria, i, { weight: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-500">
                  Max
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={c.maxScore}
                    onChange={(e) => update(setCriteria, i, { maxScore: Number(e.target.value) })}
                  />
                </label>
              </div>
              <Input
                value={c.description ?? ""}
                placeholder="What judges should look for"
                onChange={(e) => update(setCriteria, i, { description: e.target.value })}
              />
              <p className="text-[11px] text-ink-400">
                Counts for {totalWeight ? Math.round(((Number(c.weight) || 0) / totalWeight) * 100) : 0}% of the weighted score
              </p>
            </RowShell>
          ))}
          <FieldError name="criteria" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCriteria((xs) => [...xs, { name: "", description: "", weight: 1, maxScore: 10 }])}
          >
            <Plus /> Add criterion
          </Button>
        </div>
        <div className="mt-6 grid gap-4 border-t border-line pt-6 md:grid-cols-3">
          <Field label="Scoring method" name="scoringMethod">
            <Select defaultValue={initial.scoringMethod}>
              <option value="MEAN">Mean</option>
              <option value="MEDIAN">Median</option>
              <option value="TRIMMED_MEAN">Trimmed mean (≥3 judges)</option>
            </Select>
          </Field>
          <Field label="Judges per project" name="judgesPerSubmission">
            <Input type="number" min={1} max={10} defaultValue={initial.judgesPerSubmission} />
          </Field>
          <Field label="FairJudge review threshold" name="discrepancyThreshold" hint="Spread in points (0–100) that flags a project for review.">
            <Input type="number" min={1} max={100} step="1" defaultValue={initial.discrepancyThreshold} />
          </Field>
        </div>
      </Section>

      <Section title="Rooms & capacity" description={`Used for seat allocation. Total capacity: ${capacity} seats.`}>
        <div className="space-y-2">
          {rooms.map((r, i) => (
            <RowShell key={r.id ?? `room-${i}`} onRemove={() => remove(setRooms, i)}>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
                <Input value={r.name} placeholder="Room name" onChange={(e) => update(setRooms, i, { name: e.target.value })} />
                <Input
                  value={r.building ?? ""}
                  placeholder="Building"
                  onChange={(e) => update(setRooms, i, { building: e.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  value={r.capacity}
                  onChange={(e) => update(setRooms, i, { capacity: Number(e.target.value) })}
                />
              </div>
            </RowShell>
          ))}
          <FieldError name="rooms" />
          <Button type="button" variant="secondary" size="sm" onClick={() => setRooms((xs) => [...xs, { name: "", building: "", capacity: 30 }])}>
            <Plus /> Add room
          </Button>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className="rounded-2xl border border-line bg-white/90 p-2 shadow-pop backdrop-blur">
          <SubmitButton variant="brand" size="lg" pendingText="Saving…">
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
