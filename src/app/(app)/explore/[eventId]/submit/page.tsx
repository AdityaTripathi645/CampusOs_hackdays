import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Clock, FileText, History, Paperclip, Send, Save, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { deleteFileAction, saveSubmissionAction } from "@/actions/participant";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Callout, DemoBadge, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, jsonStringArray, relativeTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export default async function SubmitPage({ params }: { params: Promise<{ eventId: string }> }) {
  const [t, nav, common] = await Promise.all([
    getTranslations("submit"),
    getTranslations("participant"),
    getTranslations("common"),
  ]);
  const user = await requirePageUser(["PARTICIPANT"]);
  const { eventId } = await params;
  const event = await db.event.findUnique({ where: { id: eventId }, include: { tracks: { orderBy: { name: "asc" } } } });
  if (!event) notFound();
  const membership = await db.teamMember.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: {
      team: {
        include: {
          _count: { select: { members: true } },
          submission: {
            include: {
              files: { orderBy: { createdAt: "asc" } },
              revisions: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!membership) redirect(`/explore/${eventId}`);
  const team = membership.team;
  const sub = team.submission;
  const deadlinePassed = new Date() > event.submissionDeadline;
  const locked = deadlinePassed || !["PUBLISHED", "LIVE"].includes(event.status) || (sub && ["SHORTLISTED", "REJECTED"].includes(sub.status));
  const maxMb = process.env.MAX_UPLOAD_MB ?? "20";

  return (
    <>
      <PageHeader
        breadcrumbLabel={common("breadcrumb")}
        breadcrumbs={[
          { label: nav("exploreBreadcrumb"), href: "/explore" },
          { label: event.name, href: `/explore/${eventId}` },
          { label: t("breadcrumb") },
        ]}
        title={t("title")}
        description={t("description", { team: team.name })}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {sub ? <StatusBadge status={sub.status} /> : <StatusBadge status="DRAFT" />}
            {sub?.isDemo && <DemoBadge label={common("demo")} title={common("demoRecordTitle")} />}
            <span className={`flex items-center gap-1 text-xs ${deadlinePassed ? "text-rose-600" : "text-ink-500"}`}>
              <Clock className="size-3.5" /> {t("deadline", {
                date: formatDateTime(event.submissionDeadline, event.timeZone),
                relative: relativeTime(event.submissionDeadline),
              })}
            </span>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="pt-6">
            {locked && (
              <Callout tone="warning" className="mb-5" title={t("editingClosed")}>
                {deadlinePassed ? t("deadlinePassed") : t("cannotEdit")}
              </Callout>
            )}
            {team._count.members < event.minTeamSize && (
              <Callout tone="info" className="mb-5" title={t("minimumMembers", { count: event.minTeamSize })}>
                {t("addTeammates")}
              </Callout>
            )}
            <ActionForm action={saveSubmissionAction} className="space-y-5">
              <input type="hidden" name="eventId" value={eventId} />
              <fieldset disabled={Boolean(locked)} className="space-y-5 disabled:opacity-70">
                <Field label={t("projectTitle")} name="title" required>
                  <Input defaultValue={sub?.title ?? ""} placeholder={t("projectTitlePlaceholder")} />
                </Field>
                <Field
                  label={t("abstract")}
                  name="abstract"
                  required
                  hint={t("abstractHint")}
                >
                  <Textarea defaultValue={sub?.abstract ?? ""} rows={8} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("track")} name="trackId">
                    <Select defaultValue={sub?.trackId ?? team.trackId ?? ""}>
                      <option value="">{t("noTrack")}</option>
                      {event.tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("technologies")} name="technologies" hint={t("commaSeparated")}>
                    <Input defaultValue={sub ? jsonStringArray(sub.technologies).join(", ") : ""} placeholder="Next.js, PostgreSQL, Gemini" />
                  </Field>
                  <Field label={t("repositoryUrl")} name="repoUrl">
                    <Input type="url" defaultValue={sub?.repoUrl ?? ""} placeholder="https://github.com/…" />
                  </Field>
                  <Field label={t("demoUrl")} name="demoUrl">
                    <Input type="url" defaultValue={sub?.demoUrl ?? ""} placeholder="https://…" />
                  </Field>
                </div>
                <Field label={t("presentation")} name="files" hint={t("fileLimit", { size: maxMb })}>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="block w-full cursor-pointer rounded-xl border border-dashed border-ink-300 bg-ink-50/50 p-4 text-sm text-ink-600 file:mr-4 file:rounded-lg file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:border-brand-400"
                  />
                </Field>
                <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
                  <SubmitButton name="intent" value="draft" variant="secondary" pendingText={t("saving")}>
                    <Save /> {t("saveDraft")}
                  </SubmitButton>
                  <SubmitButton name="intent" value="submit" variant="brand" pendingText={t("submitting")}>
                    <Send /> {sub && sub.status !== "DRAFT" ? t("saveKeepSubmitted") : t("submitProject")}
                  </SubmitButton>
                </div>
              </fieldset>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="size-4" /> {t("files")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {!sub || sub.files.length === 0 ? (
                <p className="text-sm text-ink-400">{t("noFiles")}</p>
              ) : (
                sub.files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                    <FileText className="size-4 shrink-0 text-ink-400" />
                    <a href={`/api/files/${f.id}`} className="min-w-0 flex-1 truncate text-sm text-ink-800 hover:text-brand-600">
                      {f.fileName}
                    </a>
                    <span className="text-[11px] text-ink-400">{Math.ceil(f.size / 1024)} KB</span>
                    {!locked && (
                      <ConfirmAction
                        action={deleteFileAction}
                        hidden={{ fileId: f.id, eventId }}
                        title={t("removeFile")}
                        description={f.fileName}
                        triggerLabel=""
                        triggerVariant="ghost"
                        triggerSize="icon"
                        confirmVariant="danger"
                        confirmLabel={t("remove")}
                        cancelLabel={common("cancel")}
                        icon={<Trash2 />}
                      />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> {t("versionHistory")}
              </CardTitle>
              <CardDescription>{t("versionHistoryDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {!sub || sub.revisions.length === 0 ? (
                <EmptyState title={t("noVersions")} className="py-6" />
              ) : (
                <ol className="space-y-3 border-l border-line pl-4">
                  {sub.revisions.map((r) => (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-brand-400 ring-4 ring-white" />
                      <p className="text-sm font-semibold text-ink-900">
                        v{r.version} · {r.note}
                      </p>
                      <p className="text-xs text-ink-500">
                        {r.createdBy.name} · {formatDateTime(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Button asChild variant="ghost" className="w-full">
            <Link href={`/explore/${eventId}`}>{t("backToEvent")}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
