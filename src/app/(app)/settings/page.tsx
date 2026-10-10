import type { Metadata } from "next";
import { Check, Minus, Sparkles, FlaskConical, HardDrive, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { activeEmailDriver } from "@/lib/email";
import { requirePageUser } from "@/lib/auth";
import { getGeminiStatus } from "@/services/gemini";
import { setUserRoleAction } from "@/actions/staff";
import { setEmailNotificationsAction, setLocaleAction } from "@/actions/participant";
import { createAdminInvitationAction, revokeInvitationAction } from "@/actions/invitations";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, DemoBadge, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/inputs";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { InlineAction } from "@/components/forms/inline-action";
import { formatDate } from "@/lib/utils";
import { listPendingInvitations } from "@/services/invitations";

export const metadata: Metadata = { title: "Settings" };

const PERMISSIONS: { capability: string; roles: Record<string, boolean | string> }[] = [
  { capability: "Create & configure events", roles: { ADMIN: true, ORGANIZER: "own events", PARTICIPANT: false, JUDGE: false } },
  { capability: "Approve registrations, check in", roles: { ADMIN: true, ORGANIZER: "own events", PARTICIPANT: false, JUDGE: false } },
  { capability: "Run AI screening & decide", roles: { ADMIN: true, ORGANIZER: "own events", PARTICIPANT: false, JUDGE: false } },
  { capability: "Register, form teams, submit", roles: { ADMIN: false, ORGANIZER: false, PARTICIPANT: true, JUDGE: false } },
  { capability: "Score assigned projects", roles: { ADMIN: false, ORGANIZER: false, PARTICIPANT: false, JUDGE: "assigned only" } },
  { capability: "See individual judge scores", roles: { ADMIN: "after reveal", ORGANIZER: "after reveal", PARTICIPANT: false, JUDGE: "own only" } },
  { capability: "Publish results", roles: { ADMIN: true, ORGANIZER: "own events", PARTICIPANT: false, JUDGE: false } },
  { capability: "Change user roles", roles: { ADMIN: true, ORGANIZER: false, PARTICIPANT: false, JUDGE: false } },
];

export default async function SettingsPage() {
  const user = await requirePageUser();
  const gemini = getGeminiStatus();
  const emailDriver = activeEmailDriver();
  const emailLogs =
    user.role === "ADMIN"
      ? await db.emailLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, to: true, template: true, subject: true, status: true, error: true, createdAt: true },
        })
      : [];
  const users =
    user.role === "ADMIN"
      ? await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], take: 200 })
      : [];
  const [invitations, events] =
    user.role === "ADMIN"
      ? await Promise.all([
          listPendingInvitations(),
          db.event.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        ])
      : [[], []] as const;

  return (
    <>
      <PageHeader title="Settings" description="Your profile, platform configuration and permissions." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar name={user.name} className="size-14 text-base" />
            <div>
              <p className="flex items-center gap-2 font-semibold text-ink-900">
                {user.name} {user.isDemo && <DemoBadge />}
              </p>
              <p className="text-sm text-ink-500">{user.email}</p>
              <div className="mt-1.5 flex gap-2">
                <Badge tone="brand">{user.role.toLowerCase()}</Badge>
                {user.institution && <Badge>{user.institution}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email notifications</CardTitle>
            <CardDescription>Control event updates sent to your account email.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={setEmailNotificationsAction} className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name="emailNotifications"
                  defaultChecked={user.emailNotifications}
                  className="size-4 rounded border-line text-brand-600 focus:ring-brand-500"
                />
                Receive event and submission updates
              </label>
              <SubmitButton size="sm">Save preference</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language</CardTitle>
            <CardDescription>Choose the language used for the CampusOS interface.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={setLocaleAction} className="flex flex-wrap items-end justify-between gap-4">
              <Field label="Interface language" name="locale">
                <Select defaultValue={user.locale === "hi" ? "hi" : "en"}>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </Select>
              </Field>
              <SubmitButton size="sm">Save language</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <Card id="ai">
          <CardHeader>
            <CardTitle>Platform configuration</CardTitle>
            <CardDescription>Read from server environment variables — secrets are never sent to the browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-xl border border-line p-3">
              {gemini.configured ? <Sparkles className="mt-0.5 size-4 text-violet-600" /> : <FlaskConical className="mt-0.5 size-4 text-orange-600" />}
              <div>
                <p className="font-semibold text-ink-900">Google Gemini {gemini.configured ? "· configured" : "· demo mode"}</p>
                <p className="text-ink-500">
                  {gemini.configured
                    ? `Model ${gemini.model}. The server will call Gemini using GEMINI_API_KEY; this confirms a key is set, not that it is valid.`
                    : "GEMINI_API_KEY is not set. Screening uses a labelled non-AI heuristic; the assistant is disabled. Add the key to .env and restart."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-line p-3">
              <HardDrive className="mt-0.5 size-4 text-ink-500" />
              <div>
                {process.env.STORAGE_DRIVER === "s3" ? (
                  <>
                    <p className="font-semibold text-ink-900">File storage · S3-compatible</p>
                    <p className="text-ink-500">
                      Bucket <code className="font-mono">{process.env.S3_BUCKET || "not configured"}</code> in{" "}
                      <code className="font-mono">{process.env.S3_REGION || "us-east-1"}</code>
                      {process.env.S3_ENDPOINT && (
                        <> at <code className="font-mono">{process.env.S3_ENDPOINT}</code></>
                      )}
                      . Upload limit: {process.env.MAX_UPLOAD_MB ?? 20} MB per file.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-ink-900">File storage · local</p>
                    <p className="text-ink-500">
                      Uploads are written to <code className="font-mono">{process.env.STORAGE_DIR ?? "./storage/uploads"}</code>. Upload limit:{" "}
                      {process.env.MAX_UPLOAD_MB ?? 20} MB per file.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Email delivery</CardTitle>
          <CardDescription>Provider credentials are read from the server environment and are never displayed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
            <Mail className="mt-0.5 size-4 text-ink-500" />
            <div>
              <p className="font-semibold text-ink-900">Active driver · {emailDriver}</p>
              <p className="text-ink-500">
                {emailDriver === "console"
                  ? "Emails are written to the local outbox as HTML previews."
                  : emailDriver === "not configured"
                    ? "Set EMAIL_DRIVER to console, resend, or smtp to enable delivery."
                    : "Email delivery is configured on the server."}
              </p>
            </div>
          </div>
          {user.role === "ADMIN" && (
            <>
              <p className="text-sm font-semibold text-ink-800">20 most recent delivery attempts</p>
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Recipient</TH>
                      <TH>Template</TH>
                      <TH>Subject</TH>
                      <TH>Status</TH>
                      <TH>Created</TH>
                      <TH>Error</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {emailLogs.length ? (
                      emailLogs.map((log) => (
                        <TR key={log.id}>
                          <TD className="text-xs">{log.to}</TD>
                          <TD className="text-xs">{log.template}</TD>
                          <TD className="text-xs">{log.subject}</TD>
                          <TD>
                            <Badge tone={log.status === "SENT" ? "success" : "danger"}>{log.status}</Badge>
                          </TD>
                          <TD className="whitespace-nowrap text-xs">{formatDate(log.createdAt)}</TD>
                          <TD className="max-w-xs text-xs text-rose-700">{log.error ?? "—"}</TD>
                        </TR>
                      ))
                    ) : (
                      <TR>
                        <TD colSpan={6} className="py-6 text-center text-sm text-ink-500">
                          No email delivery attempts yet.
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>
              </TableWrap>
            </>
          )}
        </CardContent>
      </Card>

      {user.role === "ADMIN" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Invite organizers, judges, or administrators. Links expire after seven days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ActionForm action={createAdminInvitationAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Email" name="email" required>
                <Input type="email" autoComplete="email" placeholder="name@college.edu" required />
              </Field>
              <Field label="Role" name="role" required>
                <Select name="role" defaultValue="ORGANIZER" required>
                  <option value="ORGANIZER">Organizer</option>
                  <option value="JUDGE">Judge</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </Field>
              <Field label="Event (optional; judges only)" name="eventId">
                <Select name="eventId" defaultValue="">
                  <option value="">No event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <SubmitButton className="w-full" pendingText="Sending invitation…">
                  Send invitation
                </SubmitButton>
              </div>
            </ActionForm>

            <div>
              <p className="mb-3 text-sm font-semibold text-ink-800">Pending invitations</p>
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Email</TH>
                      <TH>Role</TH>
                      <TH>Event</TH>
                      <TH>Invited by</TH>
                      <TH>Expires</TH>
                      <TH>Action</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {invitations.length ? invitations.map((invitation) => (
                      <TR key={invitation.id}>
                        <TD className="text-sm">{invitation.email}</TD>
                        <TD><Badge tone="brand">{invitation.role}</Badge></TD>
                        <TD className="text-sm">{invitation.event?.name ?? "—"}</TD>
                        <TD className="text-sm">{invitation.invitedBy.name}</TD>
                        <TD className="whitespace-nowrap text-xs">{formatDate(invitation.expiresAt)}</TD>
                        <TD>
                          <InlineAction
                            action={revokeInvitationAction}
                            hidden={{ invitationId: invitation.id }}
                            variant="danger"
                            size="sm"
                          >
                            Revoke
                          </InlineAction>
                        </TD>
                      </TR>
                    )) : (
                      <TR><TD colSpan={6} className="py-6 text-center text-sm text-ink-500">No pending invitations.</TD></TR>
                    )}
                  </TBody>
                </Table>
              </TableWrap>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Role permissions</CardTitle>
          <CardDescription>Enforced on the server for every page, action and API route.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-0">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Capability</TH>
                  {["ADMIN", "ORGANIZER", "PARTICIPANT", "JUDGE"].map((r) => (
                    <TH key={r} className="text-center">
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </TH>
                  ))}
                </tr>
              </THead>
              <TBody>
                {PERMISSIONS.map((p) => (
                  <TR key={p.capability}>
                    <TD className="font-medium text-ink-800">{p.capability}</TD>
                    {["ADMIN", "ORGANIZER", "PARTICIPANT", "JUDGE"].map((r) => {
                      const v = p.roles[r];
                      return (
                        <TD key={r} className="text-center">
                          {v === true ? (
                            <Check className="mx-auto size-4 text-emerald-600" />
                          ) : v ? (
                            <span className="text-xs text-ink-600">{v}</span>
                          ) : (
                            <Minus className="mx-auto size-4 text-ink-300" />
                          )}
                        </TD>
                      );
                    })}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      {user.role === "ADMIN" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Users & roles</CardTitle>
            <CardDescription>Role changes take effect on the user&apos;s next request and are audited.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-0">
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>User</TH>
                    <TH>Joined</TH>
                    <TH>Role</TH>
                  </tr>
                </THead>
                <TBody>
                  {users.map((u) => (
                    <TR key={u.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div>
                            <p className="flex items-center gap-2 font-semibold text-ink-900">
                              {u.name} {u.isDemo && <DemoBadge />}
                            </p>
                            <p className="text-xs text-ink-500">{u.email}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-xs">{formatDate(u.createdAt)}</TD>
                      <TD>
                        <ActionForm action={setUserRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <Select name="role" defaultValue={u.role} className="w-40" disabled={u.id === user.id}>
                            <option value="ADMIN">Admin</option>
                            <option value="ORGANIZER">Organizer</option>
                            <option value="PARTICIPANT">Participant</option>
                            <option value="JUDGE">Judge</option>
                          </Select>
                          {u.id !== user.id && (
                            <SubmitButton size="sm" variant="secondary">
                              Save
                            </SubmitButton>
                          )}
                        </ActionForm>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      )}
    </>
  );
}
