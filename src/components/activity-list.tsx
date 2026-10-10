import { Activity } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Item = {
  id: string;
  action: string;
  createdAt: Date;
  actor: { name: string } | null;
  event?: { name: string } | null;
};

const ENGLISH_ACTION_LABELS: Record<string, string> = {
  "event.created": "created the event",
  "event.updated": "updated event settings",
  "registration.created": "registered",
  "registration.withdrawn": "withdrew a registration",
  "registration.status_changed": "changed a registration status",
  "registration.bulk_approved": "bulk-approved registrations",
  "team.created": "created a team",
  "team.joined": "joined a team",
  "team.left": "left a team",
  "submission.submitted": "submitted a project",
  "submission.draft_saved": "saved a submission draft",
  "submission.status_changed": "changed a submission status",
  "submission.file_removed": "removed a submission file",
  "ai.screening_completed": "ran Gemini screening",
  "ai.screening_demo_generated": "ran demo screening (no AI)",
  "ai.review_decided": "recorded a decision on an AI suggestion",
  "ai.assistant_query": "asked the AI assistant",
  "attendance.checked_in": "checked in a participant",
  "attendance.undone": "undid a check-in",
  "attendance.exported": "exported attendance",
  "seats.auto_allocated": "auto-allocated seats",
  "seats.cleared": "cleared seat assignments",
  "judge.added": "added a judge",
  "judge.removed": "removed a judge",
  "judging.auto_assigned": "auto-assigned judges",
  "judging.unassigned": "removed a judge assignment",
  "evaluation.submitted": "submitted an evaluation",
  "evaluation.draft_saved": "saved an evaluation draft",
  "fairjudge.review_stage_opened": "opened the FairJudge review stage",
  "fairjudge.ticket_opened": "opened a review ticket",
  "fairjudge.ticket_decided": "decided a review ticket",
  "results.computed": "computed results",
  "results.published": "published results",
  "results.unpublished": "unpublished results",
  "results.exported": "exported results",
  "seed.demo_data_loaded": "loaded demo data",
  "user.role_changed": "changed a user's role",
};

export function describeAction(action: string) {
  return ENGLISH_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

export function ActivityList({ items, showEvent = false }: { items: Item[]; showEvent?: boolean }) {
  const t = useTranslations("activity");
  const labels: Record<string, string> = {
    "event.created": t("createdEvent"),
    "event.updated": t("updatedEvent"),
    "registration.created": t("registered"),
    "registration.withdrawn": t("withdrew"),
    "registration.status_changed": t("registrationStatus"),
    "registration.bulk_approved": t("bulkApproved"),
    "team.created": t("createdTeam"),
    "team.joined": t("joinedTeam"),
    "team.left": t("leftTeam"),
    "submission.submitted": t("submittedProject"),
    "submission.draft_saved": t("savedDraft"),
    "submission.status_changed": t("submissionStatus"),
    "submission.file_removed": t("removedFile"),
    "ai.screening_completed": t("geminiScreening"),
    "ai.screening_demo_generated": t("demoScreening"),
    "ai.review_decided": t("aiDecision"),
    "ai.assistant_query": t("aiQuery"),
    "attendance.checked_in": t("checkedIn"),
    "attendance.undone": t("undidCheckin"),
    "attendance.exported": t("exportedAttendance"),
    "seats.auto_allocated": t("allocatedSeats"),
    "seats.cleared": t("clearedSeats"),
    "judge.added": t("addedJudge"),
    "judge.removed": t("removedJudge"),
    "judging.auto_assigned": t("autoAssignedJudges"),
    "judging.unassigned": t("unassignedJudge"),
    "evaluation.submitted": t("submittedEvaluation"),
    "evaluation.draft_saved": t("savedEvaluationDraft"),
    "fairjudge.review_stage_opened": t("openedReviewStage"),
    "fairjudge.ticket_opened": t("openedTicket"),
    "fairjudge.ticket_decided": t("decidedTicket"),
    "results.computed": t("computedResults"),
    "results.published": t("publishedResults"),
    "results.unpublished": t("unpublishedResults"),
    "results.exported": t("exportedResults"),
    "seed.demo_data_loaded": t("loadedDemoData"),
    "user.role_changed": t("changedRole"),
  };
  const describeAction = (action: string) => labels[action] ?? action.replace(/[._]/g, " ");
  if (items.length === 0)
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-ink-400">
        <Activity className="size-4" /> {t("noActivity")}
      </p>
    );
  return (
    <ol className="relative space-y-4 border-l border-line pl-4">
      {items.map((i) => (
        <li key={i.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-brand-400 ring-4 ring-white" />
          <p className="text-sm text-ink-700">
            <span className="font-semibold text-ink-900">{i.actor?.name ?? t("system")}</span> {describeAction(i.action)}
          </p>
          <p className="text-xs text-ink-400">
            {relativeTime(i.createdAt)}
            {showEvent && i.event ? ` · ${i.event.name}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
