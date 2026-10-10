import Link from "next/link";
import { ExternalLink, FileText, GitBranch, Paperclip } from "lucide-react";
import { listEventSubmissions } from "@/services/submissions";
import { setSubmissionStatusAction } from "@/actions/events";
import { Card } from "@/components/ui/card";
import { AIBadge, DemoBadge, EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { InlineAction } from "@/components/forms/inline-action";
import { formatDateTime, jsonStringArray } from "@/lib/utils";
import { eventPageContext } from "../context";

export default async function SubmissionsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await eventPageContext(params);
  const subs = await listEventSubmissions(eventId);

  return (
    <Card>
      {subs.length === 0 ? (
        <EmptyState icon={<FileText />} title="No submissions yet" description="Teams submit from the participant event page before the deadline." />
      ) : (
        <TableWrap>
          <Table className="min-w-[960px]">
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Track</TH>
                <TH>Links & files</TH>
                <TH>AI screening</TH>
                <TH>Judges</TH>
                <TH>Status</TH>
                <TH className="text-right">Human decision</TH>
              </tr>
            </THead>
            <TBody>
              {subs.map((s) => {
                const ai = s.aiReviews[0];
                return (
                  <TR key={s.id}>
                    <TD className="max-w-xs">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                        {s.title} {s.isDemo && <DemoBadge />}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {s.team.name} · v{s.version} · {s.submittedAt ? `submitted ${formatDateTime(s.submittedAt)}` : "draft"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {jsonStringArray(s.technologies).slice(0, 4).map((t) => (
                          <span key={t} className="rounded bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-600 ring-1 ring-line">
                            {t}
                          </span>
                        ))}
                      </div>
                    </TD>
                    <TD className="text-xs">{s.track?.name ?? "—"}</TD>
                    <TD>
                      <div className="flex flex-col gap-1 text-xs">
                        {s.repoUrl && (
                          <a href={s.repoUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-brand-600 hover:underline">
                            <GitBranch className="size-3" /> Repository
                          </a>
                        )}
                        {s.demoUrl && (
                          <a href={s.demoUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-brand-600 hover:underline">
                            <ExternalLink className="size-3" /> Demo
                          </a>
                        )}
                        {s.files.map((f) => (
                          <a key={f.id} href={`/api/files/${f.id}`} className="flex items-center gap-1 text-ink-700 hover:text-brand-600">
                            <Paperclip className="size-3" /> <span className="max-w-40 truncate">{f.fileName}</span>
                          </a>
                        ))}
                        {!s.repoUrl && !s.demoUrl && s.files.length === 0 && <span className="text-ink-400">None</span>}
                      </div>
                    </TD>
                    <TD>
                      {ai ? (
                        <div className="flex flex-col items-start gap-1">
                          <AIBadge mode={ai.mode} />
                          <StatusBadge status={ai.status} />
                        </div>
                      ) : s.status === "DRAFT" ? (
                        <span className="text-xs text-ink-400">—</span>
                      ) : (
                        <Link href={`/events/${eventId}/screening`} className="text-xs font-semibold text-brand-600 hover:underline">
                          Not screened
                        </Link>
                      )}
                    </TD>
                    <TD className="tabular-nums text-xs">{s._count.assignments}</TD>
                    <TD>
                      <StatusBadge status={s.status} />
                    </TD>
                    <TD className="text-right">
                      {s.status !== "DRAFT" && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {s.status !== "SHORTLISTED" && (
                            <InlineAction action={setSubmissionStatusAction} hidden={{ submissionId: s.id, status: "SHORTLISTED", eventId }}>
                              Shortlist
                            </InlineAction>
                          )}
                          {s.status !== "UNDER_REVIEW" && (
                            <InlineAction
                              action={setSubmissionStatusAction}
                              hidden={{ submissionId: s.id, status: "UNDER_REVIEW", eventId }}
                              variant="ghost"
                            >
                              Review
                            </InlineAction>
                          )}
                          {s.status !== "REJECTED" && (
                            <InlineAction
                              action={setSubmissionStatusAction}
                              hidden={{ submissionId: s.id, status: "REJECTED", eventId }}
                              variant="ghost"
                            >
                              Reject
                            </InlineAction>
                          )}
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
