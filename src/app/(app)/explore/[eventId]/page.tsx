import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, Clock, Copy, FileUp, LogOut, MapPin, ShieldCheck, Trophy, UserPlus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { parseRegistrationFields, registrationState } from "@/services/events";
import { getStoredResults } from "@/services/results";
import { createTeamAction, joinTeamAction, leaveTeamAction, registerAction, withdrawAction } from "@/actions/participant";
import { ActionForm, Field, FieldError, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/inputs";
import { Avatar, Callout, DemoBadge, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { IdCard } from "@/components/id-card";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export default async function ExploreEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ resultsTrack?: string }>;
}) {
  const [t, common] = await Promise.all([
    getTranslations("participant"),
    getTranslations("common"),
  ]);
  const user = await requirePageUser();
  const [{ eventId }, sp] = await Promise.all([params, searchParams]);
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { tracks: { orderBy: { name: "asc" } } },
  });
  const canManage = event && (user.role === "ADMIN" || event.ownerId === user.id);
  if (!event || (event.status === "DRAFT" && !canManage) || event.status === "ARCHIVED") notFound();

  const [registration, membership] = await Promise.all([
    db.registration.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
      include: { seat: { include: { room: true } }, attendance: true },
    }),
    db.teamMember.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
      include: {
        team: {
          include: {
            track: true,
            members: { include: { user: { select: { name: true, email: true } } }, orderBy: { joinedAt: "asc" } },
            submission: { select: { id: true, title: true, status: true, version: true, updatedAt: true } },
          },
        },
      },
    }),
  ]);
  const results = event.resultsPublished ? await getStoredResults(eventId) : [];
  const resultsTrackId = event.tracks.some((track) => track.id === sp.resultsTrack) ? sp.resultsTrack : null;
  const visibleResults = resultsTrackId ? results.filter((result) => result.trackId === resultsTrackId) : results;
  const fields = parseRegistrationFields(event.registrationFields);
  const regWindow = registrationState(event);
  const activeReg = registration && registration.status !== "WITHDRAWN" ? registration : null;
  const isParticipant = user.role === "PARTICIPANT";
  const submissionsOpen = new Date() <= event.submissionDeadline && ["PUBLISHED", "LIVE"].includes(event.status);
  const registrationUnavailableReason =
    regWindow.reason === "Registration has not opened yet."
      ? t("registrationNotStarted")
      : regWindow.reason === "Registration has closed."
        ? t("registrationClosed")
        : regWindow.reason === "Registration is not open for this event."
          ? t("registrationNotOpen")
          : regWindow.reason;

  return (
    <>
      <PageHeader
        breadcrumbLabel={common("breadcrumb")}
        breadcrumbs={[{ label: t("exploreBreadcrumb"), href: "/explore" }, { label: event.name }]}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            {event.isDemo && <DemoBadge label={common("demo")} title={t("demoRecordTitle")} />}
          </div>
        }
        title={event.name}
        description={event.tagline ?? undefined}
        actions={
          canManage ? (
            <Button asChild variant="secondary">
              <Link href={`/events/${eventId}`}>{t("manageEvent")}</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-2 text-ink-700">
                  <CalendarRange className="size-4 text-ink-400" /> {formatDateTime(event.startsAt, event.timeZone)} – {formatDateTime(event.endsAt, event.timeZone)}
                </p>
                {event.venue && (
                  <p className="flex items-center gap-2 text-ink-700">
                    <MapPin className="size-4 text-ink-400" /> {event.venue}
                  </p>
                )}
                <p className="flex items-center gap-2 text-ink-700">
                  <Clock className="size-4 text-ink-400" /> {t("submissionsDue", {
                    date: formatDateTime(event.submissionDeadline, event.timeZone),
                    relative: relativeTime(event.submissionDeadline),
                  })}
                </p>
                <p className="flex items-center gap-2 text-ink-700">
                  <Users className="size-4 text-ink-400" /> {t("teamsOf", { min: event.minTeamSize, max: event.maxTeamSize })}
                </p>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{event.description}</p>
              {event.tracks.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t("tracks")}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {event.tracks.map((t) => (
                      <div key={t.id} className="rounded-xl border border-line p-3">
                        <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                        {t.description && <p className="mt-0.5 text-xs text-ink-500">{t.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {event.eligibility && (
                <Callout tone="info" title={t("eligibility")}>
                  {event.eligibility}
                </Callout>
              )}
            </CardContent>
          </Card>

          {event.resultsPublished && results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-4 text-amber-500" /> Published leaderboard
                </CardTitle>
                <CardDescription>
                  {resultsTrackId ? `By track · ${event.tracks.find((track) => track.id === resultsTrackId)?.name}` : "Overall standings"} · Published by the organizers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <nav aria-label="Published leaderboard views" className="mb-4 flex flex-wrap gap-2">
                  <Link
                    href={`/explore/${eventId}`}
                    aria-current={resultsTrackId ? undefined : "page"}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium ${resultsTrackId ? "border-line text-ink-600" : "border-brand-300 bg-brand-50 text-brand-800"}`}
                  >
                    Overall
                  </Link>
                  {event.tracks.map((track) => (
                    <Link
                      key={track.id}
                      href={`/explore/${eventId}?resultsTrack=${encodeURIComponent(track.id)}`}
                      aria-current={resultsTrackId === track.id ? "page" : undefined}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium ${resultsTrackId === track.id ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line text-ink-600"}`}
                    >
                      {track.name}
                    </Link>
                  ))}
                </nav>
                {visibleResults.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5">
                    <span className="w-6 font-mono font-bold text-ink-500">{resultsTrackId ? r.trackRank : r.rank}</span>
                    <div className="flex-1 text-sm font-semibold text-ink-900">
                      {r.submission.title} <span className="font-normal text-ink-500">· {r.submission.team.name}</span>{" "}
                      {r.submission.isDemo && <DemoBadge />}
                      {r.submission.prizeAwards.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.submission.prizeAwards.map((award) => (
                            <Badge key={award.id} tone="warning">
                              {award.prize.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-sm text-ink-700">{r.finalScore.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Team */}
          {isParticipant && activeReg && (
            <Card>
              <CardHeader>
                <CardTitle>{t("yourTeam")}</CardTitle>
                <CardDescription>{t("teamDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                {membership ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-brand-50 to-violet-50 p-4 ring-1 ring-brand-100">
                      <div>
                        <p className="text-lg font-bold text-ink-950">{membership.team.name}</p>
                        <p className="text-xs text-ink-600">
                          {membership.team.track?.name ?? t("noTrack")} · {t("membersCount", {
                            current: membership.team.members.length,
                            maximum: event.maxTeamSize,
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-center ring-1 ring-line">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                          <Copy className="mr-1 inline size-3" />
                          {t("inviteCode")}
                        </p>
                        <p className="font-mono text-lg font-bold tracking-widest text-ink-900">{membership.team.inviteCode}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {membership.team.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 text-sm">
                          <Avatar name={m.user.name} />
                          <div className="flex-1">
                            <p className="font-medium text-ink-900">{m.user.name}</p>
                            <p className="text-xs text-ink-500">{m.user.email}</p>
                          </div>
                          {m.role === "LEADER" && <Badge tone="brand">{t("lead")}</Badge>}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                      {membership.team.submission ? (
                        <div className="flex flex-1 items-center gap-2 text-sm">
                          <StatusBadge status={membership.team.submission.status} />
                          <span className="truncate text-ink-700">{membership.team.submission.title}</span>
                          <span className="text-xs text-ink-400">v{membership.team.submission.version}</span>
                        </div>
                      ) : (
                        <p className="flex-1 text-sm text-ink-500">{t("noSubmission")}</p>
                      )}
                      <Button asChild size="sm" variant={membership.team.submission ? "secondary" : "brand"}>
                        <Link href={`/explore/${eventId}/submit`}>
                          <FileUp /> {membership.team.submission ? t("viewEditSubmission") : t("startSubmission")}
                        </Link>
                      </Button>
                      {(!membership.team.submission || membership.team.submission.status === "DRAFT") && (
                        <ConfirmAction
                          action={leaveTeamAction}
                          hidden={{ teamId: membership.teamId, eventId }}
                          title={t("leaveTeamTitle")}
                          description={
                            membership.team.members.length === 1
                              ? t("leaveTeamOnlyMember")
                              : t("leaveTeamLeader")
                          }
                          triggerLabel={t("leaveTeam")}
                          confirmLabel={common("confirm")}
                          cancelLabel={common("cancel")}
                          triggerVariant="ghost"
                          confirmVariant="danger"
                          icon={<LogOut />}
                        />
                      )}
                    </div>
                  </div>
                ) : activeReg.status === "REJECTED" ? (
                  <p className="text-sm text-ink-500">{t("registrationRejected")}</p>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    <ActionForm action={createTeamAction} className="space-y-3">
                      <p className="text-sm font-semibold text-ink-900">{t("createTeam")}</p>
                      <input type="hidden" name="eventId" value={eventId} />
                      <Field label={t("teamName")} name="name" required>
                        <Input placeholder={t("teamNamePlaceholder")} />
                      </Field>
                      {event.tracks.length > 0 && (
                        <Field label={t("track")} name="trackId">
                          <Select defaultValue="">
                            <option value="">{t("decideLater")}</option>
                            {event.tracks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}
                      <SubmitButton size="sm" pendingText={t("creating")}>
                        <Users /> {t("createTeamButton")}
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={joinTeamAction} className="space-y-3 md:border-l md:border-line md:pl-6">
                      <p className="text-sm font-semibold text-ink-900">{t("joinWithCode")}</p>
                      <input type="hidden" name="eventId" value={eventId} />
                      <Field label={t("inviteCode")} name="inviteCode" required>
                        <Input placeholder="ABC234" className="font-mono uppercase tracking-widest" />
                      </Field>
                      <SubmitButton size="sm" variant="secondary" pendingText={t("joining")}>
                        <UserPlus /> {t("joinTeam")}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                )}
                {!submissionsOpen && membership && (
                  <p className="mt-4 text-xs text-amber-700">{t("submissionsClosed")}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: registration & badge */}
        <div className="space-y-6">
          {!isParticipant ? (
            <Callout tone="info" title={t("viewingAsStaff")}>
              {t("staffCannotRegister")}
            </Callout>
          ) : activeReg ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{t("yourRegistration")}</CardTitle>
                  <StatusBadge status={activeReg.status} />
                </div>
                <CardDescription>
                  {activeReg.status === "PENDING" && t("pendingDescription")}
                  {activeReg.status === "APPROVED" && t("approvedDescription")}
                  {activeReg.status === "WAITLISTED" && t("waitlistedDescription")}
                  {activeReg.status === "REJECTED" && t("registrationRejected")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeReg.attendance && (
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
                    <ShieldCheck className="size-4" /> {t("checkedInAt", { date: formatDateTime(activeReg.attendance.checkedInAt, event.timeZone) })}
                  </p>
                )}
                {activeReg.status === "APPROVED" && (
                  <IdCard
                    eventName={event.name}
                    startsAt={event.startsAt}
                    timeZone={event.timeZone}
                    venue={event.venue}
                    name={user.name}
                    institution={user.institution}
                    team={membership?.team.name ?? null}
                    seat={activeReg.seat ? `${activeReg.seat.room.name} · ${activeReg.seat.seatLabel}` : null}
                    code={activeReg.checkInCode}
                    isDemo={activeReg.isDemo}
                  />
                )}
                {!membership && (
                  <ConfirmAction
                    action={withdrawAction}
                    hidden={{ eventId }}
                    title={t("withdrawTitle")}
                    description={t("withdrawDescription")}
                    triggerLabel={t("withdraw")}
                    confirmLabel={common("confirm")}
                    cancelLabel={common("cancel")}
                    triggerVariant="ghost"
                    confirmVariant="danger"
                  />
                )}
              </CardContent>
            </Card>
          ) : !regWindow.open ? (
            <Callout tone="warning" title={t("registrationUnavailable")}>
              {registrationUnavailableReason}
            </Callout>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("register")}</CardTitle>
                <CardDescription>{t("closes", { date: formatDateTime(event.registrationClosesAt, event.timeZone) })}</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm action={registerAction} className="space-y-4">
                  <input type="hidden" name="eventId" value={eventId} />
                  {fields.map((f) =>
                    f.type === "checkbox" ? (
                      <label key={f.key} className="flex items-start gap-2.5 text-sm text-ink-700">
                        <Checkbox name={`field_${f.key}`} className="mt-0.5" required={f.required} />
                        <span>
                          {f.label}
                          {f.required && <span className="text-rose-500"> *</span>}
                        </span>
                      </label>
                    ) : f.type === "select" ? (
                      <div key={f.key} className="flex flex-col gap-1.5">
                        <Label htmlFor={`f-field_${f.key}`}>
                          {f.label}
                          {f.required && <span className="ml-0.5 text-rose-500">*</span>}
                        </Label>
                        <Select id={`f-field_${f.key}`} name={`field_${f.key}`} defaultValue="" required={f.required}>
                          <option value="" disabled>
                            {t("choose")}
                          </option>
                          {(f.options ?? []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </Select>
                        <FieldError name={`field_${f.key}`} />
                      </div>
                    ) : (
                      <Field key={f.key} label={f.label} name={`field_${f.key}`} required={f.required}>
                        {f.type === "textarea" ? (
                          <Textarea rows={3} required={f.required} />
                        ) : (
                          <Input required={f.required} />
                        )}
                      </Field>
                    ),
                  )}
                  {event.eligibility && (
                    <label className="flex items-start gap-2.5 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
                      <Checkbox name="eligibilityConfirmed" className="mt-0.5" required />
                      <span>{t("eligibilityConfirmed")}</span>
                    </label>
                  )}
                  <SubmitButton variant="brand" className="w-full" pendingText={t("registering")}>
                    {t("registerForEvent", { event: event.name })}
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
