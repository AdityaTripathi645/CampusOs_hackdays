import { Calculator, Download, Globe, EyeOff, Trophy, Medal } from "lucide-react";
import { db } from "@/lib/db";
import { isScoringMethod, type ScoringMethod } from "@/lib/domain";
import { getPrizeSuggestions, getStoredResults, previewResults } from "@/services/results";
import { awardPrizeAction, computeResultsAction, revokePrizeAwardAction, setPublishedAction } from "@/actions/staff";
import { METHOD_LABEL } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, DemoBadge, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { formatDateTime } from "@/lib/utils";
import { eventPageContext } from "../context";

const METHODS: ScoringMethod[] = ["MEAN", "MEDIAN", "TRIMMED_MEAN"];

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ method?: string; trackId?: string }>;
}) {
  const { user, event, eventId } = await eventPageContext(params);
  const sp = await searchParams;
  const requestedMethod = sp.method ?? "";
  const method: ScoringMethod = isScoringMethod(requestedMethod)
    ? requestedMethod
    : isScoringMethod(event.scoringMethod)
      ? event.scoringMethod
      : "MEAN";
  const [preview, stored, openTickets, pendingEvals, tracks, prizes] = await Promise.all([
    previewResults(user, eventId, method),
    getStoredResults(eventId),
    db.reviewTicket.count({ where: { eventId, status: "OPEN" } }),
    db.judgeAssignment.count({ where: { eventId, OR: [{ evaluation: null }, { evaluation: { status: "DRAFT" } }] } }),
    db.track.findMany({ where: { eventId }, orderBy: { name: "asc" } }),
    getPrizeSuggestions(user, eventId),
  ]);
  const trackId = tracks.some((track) => track.id === sp.trackId) ? sp.trackId : null;
  const visiblePreview = trackId ? preview.rows.filter((row) => row.trackId === trackId) : preview.rows;
  const visibleStored = trackId ? stored.filter((row) => row.trackId === trackId) : stored;
  const unawardedPrizeCount = prizes.filter((prize) => !prize.award).length;
  const hasPrizeAwards = prizes.some((prize) => prize.award);
  const hasDemo = preview.rows.some((r) => r.isDemo) || stored.some((r) => r.submission.isDemo);
  const computedAt = stored[0]?.computedAt;

  return (
    <div className="space-y-6">
      {hasDemo && (
        <Callout tone="demo" title="Includes seeded demo evaluations">
          These rankings are computed from demo records and are not real competition results.
        </Callout>
      )}
      {(openTickets > 0 || pendingEvals > 0) && (
        <Callout tone="warning" title="Publishing is blocked">
          {openTickets > 0 && `${openTickets} open FairJudge ticket(s). `}
          {pendingEvals > 0 && `${pendingEvals} assigned evaluation(s) not yet submitted.`}
        </Callout>
      )}
      {unawardedPrizeCount > 0 && (
        <Callout tone="warning" title="Some prizes are unawarded">
          {unawardedPrizeCount} configured prize(s) still need a human award decision. You can still publish results.
        </Callout>
      )}

      <nav aria-label="Result leaderboard" className="flex flex-wrap gap-2">
        <a
          href={`?method=${method}`}
          aria-current={trackId ? undefined : "page"}
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${trackId ? "border-line text-ink-600" : "border-brand-300 bg-brand-50 text-brand-800"}`}
        >
          Overall
        </a>
        {tracks.map((track) => (
          <a
            key={track.id}
            href={`?method=${method}&trackId=${encodeURIComponent(track.id)}`}
            aria-current={trackId === track.id ? "page" : undefined}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${trackId === track.id ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line text-ink-600"}`}
          >
            {track.name}
          </a>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Score calculation</CardTitle>
          <CardDescription>
            Each evaluation is a weighted rubric score normalised to 0–100. Excluded evaluations (FairJudge decisions) never count.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <a
                key={m}
                href={`?method=${m}`}
                className={`rounded-xl border px-4 py-2.5 text-left transition ${
                  m === method ? "border-brand-400 bg-brand-50 ring-brand-soft" : "border-line hover:border-ink-300"
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">{m.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
                <span className="block text-[11px] text-ink-500">{METHOD_LABEL[m]}</span>
              </a>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-line px-5 py-3">
              <p className="text-sm font-semibold text-ink-800">
                Preview <span className="font-normal text-ink-500">— not saved</span>
              </p>
              <ConfirmAction
                action={computeResultsAction}
                hidden={{ eventId, method }}
                title="Compute and save results?"
                description={`Results are calculated with “${METHOD_LABEL[method]}” and replace any previously computed (unpublished) results.${hasPrizeAwards ? " Revoke existing prize awards before recomputing." : ""}`}
                triggerLabel="Compute & save"
                triggerVariant="primary"
                icon={<Calculator />}
                disabled={preview.rows.length === 0 || event.resultsPublished || hasPrizeAwards}
              />
            </div>
            {visiblePreview.length === 0 ? (
              <EmptyState icon={<Calculator />} title="No submitted evaluations yet" />
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>{trackId ? "Track rank" : "Rank"}</TH>
                      <TH>Project</TH>
                      <TH>Track</TH>
                      <TH className="text-right">Judges counted</TH>
                      <TH className="text-right">Score</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {visiblePreview.map((r) => (
                      <TR key={r.submissionId}>
                        <TD className="font-mono text-ink-500">{trackId ? r.trackRank ?? "—" : r.rank}</TD>
                        <TD>
                          <span className="font-semibold text-ink-900">{r.title}</span>{" "}
                          <span className="text-xs text-ink-500">· {r.teamName}</span> {r.isDemo && <DemoBadge />}
                        </TD>
                        <TD className="text-xs">{r.trackName ?? "—"}</TD>
                        <TD className="text-right tabular-nums text-xs">
                          {r.judgeCount}/{r.assigned}
                        </TD>
                        <TD className="text-right font-mono font-semibold text-ink-900">{r.score.toFixed(2)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
            {!trackId && preview.unscored > 0 && (
              <p className="border-t border-dashed border-line px-5 py-3 text-xs text-ink-500">
                {preview.unscored} project(s) have no submitted evaluations and are not ranked.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {prizes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prizes</CardTitle>
            <CardDescription>Suggestions are based on the computed rankings. An organizer must explicitly confirm each award.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {prizes.map((prize) => (
              <div key={prize.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{prize.name}</p>
                  <p className="text-xs text-ink-500">
                    {prize.track?.name ?? "Overall"} · Rank {prize.rank}
                    {prize.amount !== null ? ` · ${prize.amount}` : ""}
                    {prize.description ? ` · ${prize.description}` : ""}
                  </p>
                  {prize.award ? (
                    <p className="mt-1 text-sm text-ink-700">
                      Awarded to <strong>{prize.award.submission.title}</strong> · {prize.award.submission.team.name}
                    </p>
                  ) : prize.suggestion ? (
                    <p className="mt-1 text-sm text-ink-700">
                      Suggested: <strong>{prize.suggestion.submission.title}</strong> · {prize.suggestion.submission.team.name}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-500">No ranked submission is available for this prize yet.</p>
                  )}
                </div>
                {prize.award ? (
                  !event.resultsPublished && (
                    <ConfirmAction
                      action={revokePrizeAwardAction}
                      hidden={{ eventId, awardId: prize.award.id }}
                      title="Revoke this prize award?"
                      description={`Remove the award of “${prize.name}” from ${prize.award.submission.title}?`}
                      triggerLabel="Revoke award"
                      confirmLabel="Revoke"
                      confirmVariant="danger"
                    />
                  )
                ) : prize.suggestion ? (
                  <ConfirmAction
                    action={awardPrizeAction}
                    hidden={{ eventId, prizeId: prize.id, resultId: prize.suggestion.id }}
                    title="Award this prize?"
                    description={`Confirm “${prize.name}” for ${prize.suggestion.submission.title} · ${prize.suggestion.submission.team.name}. This is a human decision; suggestions are never awarded automatically.`}
                    triggerLabel="Award"
                    confirmLabel="Award prize"
                    triggerVariant="brand"
                    confirmVariant="brand"
                    disabled={event.resultsPublished}
                  />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Final results</CardTitle>
              {event.resultsPublished ? <Badge tone="success">Published</Badge> : <Badge>Not published</Badge>}
            </div>
            <CardDescription>
              {computedAt
                ? `Computed ${formatDateTime(computedAt)} · ${METHOD_LABEL[isScoringMethod(stored[0]!.method) ? stored[0]!.method : "MEAN"]}`
                : "Nothing computed yet."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {stored.length > 0 && (
              <Button asChild variant="secondary" size="sm">
                <a href={`/api/events/${eventId}/export/results`}>
                  <Download /> Export CSV
                </a>
              </Button>
            )}
            {event.resultsPublished ? (
              <ConfirmAction
                action={setPublishedAction}
                hidden={{ eventId, publish: "false" }}
                title="Unpublish results?"
                description="Participants will no longer see the leaderboard."
                triggerLabel="Unpublish"
                icon={<EyeOff />}
              />
            ) : (
              <ConfirmAction
                action={setPublishedAction}
                hidden={{ eventId, publish: "true" }}
                title="Publish results?"
                description="The leaderboard becomes visible to every participant of this event. Publishing is recorded in the audit log."
                triggerLabel="Publish"
                triggerVariant="brand"
                confirmVariant="brand"
                icon={<Globe />}
                disabled={stored.length === 0 || openTickets > 0 || pendingEvals > 0}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visibleStored.length === 0 ? (
            <EmptyState icon={<Trophy />} title="No final results" description="Compute results from the preview above." />
          ) : (
            <div className="space-y-2">
              {visibleStored.map((r) => {
                const displayRank = trackId ? r.trackRank : r.rank;
                const isTopThree = displayRank !== null && displayRank <= 3;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${isTopThree ? "border-brand-200 bg-gradient-to-r from-brand-50/70 to-white" : "border-line"}`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl font-bold ${
                        displayRank === 1
                          ? "bg-amber-400 text-white"
                          : displayRank === 2
                            ? "bg-ink-300 text-white"
                            : displayRank === 3
                              ? "bg-orange-400 text-white"
                              : "bg-ink-50 text-ink-500"
                      }`}
                    >
                      {isTopThree ? <Medal className="size-4" /> : displayRank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                        {r.submission.title} {r.submission.isDemo && <DemoBadge />}
                      </p>
                      <p className="text-xs text-ink-500">
                        {r.submission.team.name} · {r.track?.name ?? "No track"} · {r.judgeCount} judge(s)
                      </p>
                      {r.submission.prizeAwards.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {r.submission.prizeAwards.map((award) => (
                            <Badge key={award.id} tone="warning">
                              {award.prize.name}
                            </Badge>
                          ))}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-lg font-bold text-ink-950">{r.finalScore.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
