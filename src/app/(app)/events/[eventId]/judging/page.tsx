import { Gavel, Lock, Shuffle, UserMinus, UserPlus } from "lucide-react";
import { judgingOverview } from "@/services/judging";
import { addJudgeAction, autoAssignAction, removeAssignmentAction, removeJudgeAction } from "@/actions/staff";
import { createEventJudgeInvitationAction } from "@/actions/invitations";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Callout, DemoBadge, EmptyState, Progress, StatCard } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { InlineAction } from "@/components/forms/inline-action";
import { Input } from "@/components/ui/inputs";
import { pct } from "@/lib/utils";
import { eventPageContext } from "../context";

export default async function JudgingPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { event, eventId } = await eventPageContext(params);
  const [panel, judgeable, availableJudges] = await Promise.all([
    judgingOverview(eventId),
    db.submission.count({ where: { eventId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] } } }),
    db.user.findMany({
      where: { role: "JUDGE", judgeRoles: { none: { eventId } } },
      select: { email: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
  ]);
  const total = panel.reduce((s, j) => s + j.total, 0);
  const done = panel.reduce((s, j) => s + j.submitted, 0);

  return (
    <div className="space-y-6">
      <Callout tone="info" title="Independent scoring">
        <span className="flex items-center gap-1.5">
          <Lock className="size-3.5" /> Organizers see progress here, not scores. Individual scores become visible only when you open
          the review stage in FairJudge.
        </span>
      </Callout>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Judges on panel" value={panel.length} icon={<Gavel />} />
        <StatCard label="Projects to judge" value={judgeable} hint={`${event.judgesPerSubmission} judge(s) per project`} accent="violet" />
        <StatCard label="Evaluations submitted" value={`${done}/${total}`} progress={pct(done, total)} accent="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Panel & assignments</CardTitle>
              <CardDescription>Balanced by current load; judges are never assigned to their own team.</CardDescription>
            </div>
            <ConfirmAction
              action={autoAssignAction}
              hidden={{ eventId }}
              title="Auto-assign judges?"
              description={`Each submitted project will get up to ${event.judgesPerSubmission} judge(s). Existing assignments are kept.`}
              triggerLabel="Auto-assign"
              triggerVariant="primary"
              icon={<Shuffle />}
              disabled={panel.length === 0 || judgeable === 0}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {panel.length === 0 && <EmptyState icon={<Gavel />} title="No judges yet" description="Add judge accounts by email." />}
            {panel.map((j) => (
              <div key={j.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={j.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      {j.name} {j.isDemo && <DemoBadge />}
                    </p>
                    <p className="text-xs text-ink-500">
                      {j.email}
                      {j.expertise ? ` · ${j.expertise}` : ""}
                    </p>
                  </div>
                  <div className="w-36">
                    <p className="mb-1 text-right text-xs tabular-nums text-ink-500">
                      {j.submitted}/{j.total} submitted
                    </p>
                    <Progress value={pct(j.submitted, j.total)} />
                  </div>
                  <ConfirmAction
                    action={removeJudgeAction}
                    hidden={{ eventJudgeId: j.id, eventId }}
                    title={`Remove ${j.name}?`}
                    description="Their unsubmitted assignments are deleted. Judges with submitted evaluations cannot be removed."
                    triggerLabel=""
                    triggerVariant="ghost"
                    triggerSize="icon"
                    confirmVariant="danger"
                    icon={<UserMinus />}
                  />
                </div>
                {j.assignments.length > 0 && (
                  <ul className="mt-3 divide-y divide-line rounded-lg bg-ink-50/50">
                    {j.assignments.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink-700">
                          {a.submissionTitle} <span className="text-xs text-ink-400">· {a.teamName}</span>
                        </span>
                        <StatusBadge status={a.status} />
                        {a.status !== "SUBMITTED" && (
                          <InlineAction action={removeAssignmentAction} hidden={{ assignmentId: a.id, eventId }} variant="ghost">
                            Unassign
                          </InlineAction>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add or invite a judge</CardTitle>
            <CardDescription>Invite someone new or add an existing judge account to this event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-semibold text-ink-800">Invite by email</p>
              <ActionForm action={createEventJudgeInvitationAction} resetOnSuccess className="space-y-3">
                <input type="hidden" name="eventId" value={eventId} />
                <Field label="Judge email" name="email" required>
                  <Input type="email" placeholder="judge@college.edu" required />
                </Field>
                <SubmitButton className="w-full" variant="secondary" pendingText="Sending invitation…">
                  <UserPlus /> Send invitation
                </SubmitButton>
              </ActionForm>
            </div>
            <div className="border-t border-line pt-5">
              <p className="mb-3 text-sm font-semibold text-ink-800">Add an existing account</p>
              <ActionForm action={addJudgeAction} resetOnSuccess className="space-y-3">
                <input type="hidden" name="eventId" value={eventId} />
                <Field label="Judge email" name="email" required>
                  <Input type="email" list="judge-emails" placeholder="judge@college.edu" />
                </Field>
                <datalist id="judge-emails">
                  {availableJudges.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.name}
                    </option>
                  ))}
                </datalist>
                <Field label="Expertise" name="expertise">
                  <Input placeholder="e.g. ML systems, product design" />
                </Field>
                <SubmitButton className="w-full" pendingText="Adding…">
                  <UserPlus /> Add to panel
                </SubmitButton>
              </ActionForm>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
