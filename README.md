# CampusOS — One Event. One Intelligence Layer.

AI-powered operating system for hackathons and campus events. One shared data model covers the full lifecycle:
event creation → registration → teams → PPT/PDF submissions → Gemini screening → QR attendance & seating →
judge assignment → private rubric scoring → FairJudge discrepancy review → results & publication → audit trail.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 · shadcn-style UI components (Radix + CVA) · Lucide ·
Recharts · SQLite + Prisma 6 · Zod · JWT session cookies (jose + bcrypt) · Google Gemini (`@google/genai`, server-only).

---

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | **20.9 or newer** (22 LTS recommended) | `node -v` |
| npm | 10+ (ships with Node) | `npm -v` |
| Database | None to install — SQLite is a local file managed by Prisma | Created automatically by `npm run db:setup` |

## 2. Unzip and install

**Windows (PowerShell)**
```powershell
Expand-Archive campusos.zip -DestinationPath .
cd campusos
npm install
copy .env.example .env
```

**macOS / Linux**
```bash
unzip campusos.zip
cd campusos
npm install
cp .env.example .env
```

`npm install` also runs `prisma generate` automatically.

## 3. Configure `.env`

Open `.env` and set:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Defaults to `file:./dev.db`, a local SQLite file at `prisma/dev.db` (relative to `prisma/schema.prisma`). |
| `AUTH_SECRET` | yes | Any random string ≥ 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GEMINI_API_KEY` | no | From <https://aistudio.google.com/apikey>. Leave empty to run AI screening in a **visibly labelled demo mode**. |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash`. |
| `STORAGE_DRIVER` / `STORAGE_DIR` | no | `local` + `./storage/uploads` by default. Use `s3` for S3-compatible storage. |
| `S3_BUCKET`, `S3_REGION` | for S3 | Bucket and region; region defaults to `us-east-1`. |
| `S3_ENDPOINT` | for R2/MinIO/B2 | Optional provider endpoint; omit for AWS S3. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | optional for S3 | Static credentials; both must be set together. AWS can use its default credential chain. |
| `S3_FORCE_PATH_STYLE` | no | Set `true` for compatible endpoints that require path-style bucket URLs. |
| `MAX_UPLOAD_MB` | no | Per-file limit for PPT/PDF uploads (default 20). |
| `EMAIL_DRIVER` / `EMAIL_FROM` | no | `console` is the development default and saves HTML previews in `storage/outbox`. Production must explicitly choose `resend` or `smtp`. |
| `RESEND_API_KEY` | for Resend | Used only when `EMAIL_DRIVER=resend`; delivery uses the Resend HTTP API. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | for SMTP | Used only when `EMAIL_DRIVER=smtp`; `SMTP_SECURE=true` enables TLS. |
| `APP_URL` | production | Public application URL used in verification, password-reset, invitation, and notification links. In development, authentication links use the current request origin so non-default ports work. |

Email delivery is available through `sendTemplatedEmail` in `src/lib/email.ts`; templates live in `src/emails/`.
Attempts are recorded in `EmailLog` and failures do not interrupt the calling business action. Seeded demo users
are only eligible for delivery with the `console` driver. Registration, team, submission, judging, and published-results
notifications are sent from their service-layer actions. Users can disable event notifications in Settings; security
messages are not controlled by that preference. Large notification batches are queued in the background.

The `console` driver writes a local preview; it does not deliver to an inbox. To send real verification and password
reset emails, configure `EMAIL_DRIVER=resend` with a verified `EMAIL_FROM` address and `RESEND_API_KEY`, or configure
`EMAIL_DRIVER=smtp` with a verified `EMAIL_FROM` address and the SMTP settings above. Set `APP_URL` to the public
HTTPS URL in production. A delivery failure is shown on the resend form and does not consume the one-minute resend
cooldown.

### S3-compatible file storage

Set `STORAGE_DRIVER=s3` and configure `S3_BUCKET` and `S3_REGION`. AWS S3 uses the default AWS endpoint and credential
chain when static credentials are omitted. For Cloudflare R2, MinIO, or Backblaze B2, also set `S3_ENDPOINT`,
`S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`; enable `S3_FORCE_PATH_STYLE=true` when the provider requires it.
Downloads remain authorization-checked by the application and use five-minute presigned URLs.

To copy all existing local uploads to the configured S3 bucket without deleting local files, configure the S3 settings
and run:

```bash
npm run storage:migrate
```

The migration preserves each database `storageKey`, skips objects that already exist in the bucket, prints a summary,
and exits with a failure code if any file could not be copied.

## 4. Create the local database and load demo data

```bash
npm run db:setup   # creates dev.db and applies the Prisma schema
npm run db:seed    # optional demo data (all flagged DEMO)
```

The database is a local SQLite file at `prisma/dev.db`; no PostgreSQL service, Docker, or database credentials are needed. Keep `DATABASE_URL` set to `file:./dev.db` when running Prisma commands. Back up `prisma/dev.db` to preserve local accounts and event data.

## 5. Run

```bash
npm run dev
```
Open <http://localhost:3000>.

Development and production use separate Next.js build directories so running `npm run build` does not overwrite the active development server's files.

### Demo accounts (after seeding) — password `Demo@1234`

| Role | Email |
| --- | --- |
| Organizer (owns the demo events) | `organizer@campusos.demo` |
| Admin | `admin@campusos.demo` |
| Judges | `judge1@campusos.demo` … `judge3@campusos.demo` |
| Participants | `participant1@campusos.demo` … `participant16@campusos.demo` |

The sign-in page has one-click buttons that fill these in. `participant14` is approved but not in a team (good for
demoing team creation); `participant15`/`16` are pending approval.

### Suggested 5-minute demo path
1. **Organizer** → *Events → Pink City Hack 2026 → Command center* (live metrics, alerts, timeline).
2. *AI screening* → run screening on a submission → record a human decision.
3. *Operations* → open a participant's *ID card*, copy the `CO-…` code into the check-in box (or scan the QR with a phone camera in Chrome) → see attendance update.
4. **Judge** (`judge1` or `judge2`) → *Judge workspace* → score "Lightrail" (still unscored) and submit.
5. **Organizer** → *FairJudge* → *Open review stage* → "Neer" is flagged for a 45.8-point score difference → open a ticket → record a decision.
6. *Results* → compare Mean / Median / Trimmed mean → *Compute & save* → publishing is blocked until all assigned evaluations are in and tickets are closed.

## 6. Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run db:push` | Apply Prisma schema changes to the local database |
| `npm run db:seed` | Seed demo data (removes previous demo records first) |
| `npm run db:reset` | Reset the local database and re-seed demo data |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `GET /api/health` | Database + Gemini configuration status |

## 7. Architecture

```
prisma/schema.prisma        Shared data model (Events, Users, Registrations, Teams, Submissions, AI Reviews,
                            Judges, Assignments, Evaluations, Review Tickets, Rooms, Seats, Attendance, Results, Audit)
prisma/seed.ts              Demo data (isDemo = true everywhere)
src/lib/                    db, auth (session + role checks), authz (event ownership), validation (Zod),
                            storage adapter, scoring (pure functions), audit log, errors
src/services/               Business logic — every function takes the current user and enforces permissions
  gemini.ts                 Server-only Gemini client, prompts, Zod output schemas, labelled demo fallback
  events / registrations / submissions / screening / operations / judging / fairjudge / results / dashboard
src/actions/                Server actions (thin: auth → validate → service → revalidate)
src/app/api/                Route handlers: file download, CSV exports, AI assistant, health
src/app/(auth)/             Sign in / sign up / forgot & reset password / email verification
src/app/(app)/              Authenticated app: dashboard, events/[id]/{command, participants, submissions,
                            screening, operations, judging, fairjudge, results, edit}, explore, my, judge, settings, audit
src/components/             UI kit (button, card, badge, inputs, table, dialog, status badges, stat cards,
                            empty states, callouts), forms (ActionForm/Field/ConfirmAction), charts, ID card
```

**Security model**
- Middleware only redirects anonymous users; every page, server action and API route re-checks the user's role from the
  database and, for event pages, event ownership (`assertCanManageEvent`). Organizers manage only their own events.
- Judges load assignments only where `eventJudge.userId === currentUser.id` and never see other evaluations.
  Organizers see judging *progress* only; individual scores appear after an audited "Open review stage" action.
- Uploads: type allow-list + magic-byte sniffing, size limit, server-generated storage keys, authorised downloads only.
- CSV exports neutralise spreadsheet formula injection.
- Gemini is called only from the server; the key never reaches the browser.

**AI principles**
- Every Gemini response is parsed and validated with Zod before it is saved; invalid output is rejected, not stored.
- AI output is stored as a *suggestion* (`PENDING_HUMAN_REVIEW`) and never changes a submission status by itself.
  A reviewer accepts, overrides (with a mandatory reason) or dismisses it; the decision is audited.
- Without `GEMINI_API_KEY`, screening produces a keyword heuristic stored with `mode = DEMO` and shown as
  "Demo heuristic · not AI". The organizer assistant refuses to answer rather than fabricate.
- FairJudge flags *score differences* for review; it never labels a judge as biased.

## 8. Security model

- Middleware only redirects anonymous users; each page, server action and API route re-checks the user's role and event ownership. Organizers manage only their own events.
- Judges load only their own assignments. Organizers see judging progress only until an audited review-stage reveal.
- Uploads use an allow-list, content sniffing, size limits, server-generated storage keys and authorized downloads.
- CSV exports neutralize spreadsheet formula injection. Gemini is called server-side only.

### AI principles

- Gemini responses are parsed and validated with Zod before saving; invalid output is rejected.
- AI output is a suggestion and requires a human decision; decisions are audited.
- Without `GEMINI_API_KEY`, screening uses a visibly labelled demo heuristic. The organizer assistant does not fabricate responses.
- FairJudge flags score differences for review; it does not label judges as biased.

## 9. Status — what is verified, mocked, and not verified

**Automated checks verified in this repository:** weighted scoring and aggregation; CSV escaping and formula neutralization; event, authentication and submission validation; Gemini demo output and response schemas; and SQLite event-service behavior for judge access/locking, conflict-aware judge assignment, and idempotent check-in. `npm test` runs these tests plus PPTX extraction and rate-limit tests.

**Browser smoke verified in this pass:** public home, anonymous dashboard redirect, organizer dashboard/events/new event, all nine event tabs, an ID card, explore pages, settings, audit with a filter, and `/api/health` rendered successfully. The first browser pass found a hydration mismatch in the event time-zone suggestions; it was fixed, and the repeated route pass reported no browser errors or hydration warnings.

**Not fully verified:** participant- and judge-specific route coverage and the full seeded-account workflows in the demo guide below. The existing `npm run test:e2e` run did not pass (1 of 7); it overlapped a Next.js dev server and a production build writing the shared `.next` directory. A clean, isolated browser-suite run is still required.

**Demo/local behavior:** seeded records carry a DEMO badge; screening without a Gemini key uses the demo heuristic; local uploads use disk storage by default.

**Not verified in this pass:** browser hydration/console behavior, role-by-role route rendering, all seeded-account workflows, upload and deadline edge cases, responsive layouts, and alternate-organizer isolation. Do not treat the feature list above as an end-to-end test result.

Times in event forms use the server's local time zone (fine for local development; store a per-event time zone before
deploying across regions).
