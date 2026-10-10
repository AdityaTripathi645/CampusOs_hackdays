import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  CalendarRange,
  FileUp,
  Gavel,
  MapPin,
  QrCode,
  Radar,
  Scale,
  Trophy,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { listPublicEvents } from "@/services/events";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIFECYCLE = [
  { icon: CalendarRange, label: "Create" },
  { icon: Users, label: "Register & team" },
  { icon: FileUp, label: "Submit" },
  { icon: Brain, label: "AI screen" },
  { icon: QrCode, label: "Check in" },
  { icon: Gavel, label: "Judge" },
  { icon: Scale, label: "FairJudge" },
  { icon: Trophy, label: "Results" },
];

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Gemini screening, human decisions",
    body: "Summaries, track fit, rubric-aligned observations, missing info and evidence quotes — every output schema-validated and clearly marked as a suggestion until a reviewer accepts or overrides it.",
  },
  {
    icon: QrCode,
    title: "QR check-in & logistics",
    body: "Each approved participant gets an ID card with a unique QR. Scan with a camera or USB scanner, auto-allocate rooms and seats, and export attendance as CSV.",
  },
  {
    icon: Gavel,
    title: "Private, rubric-based judging",
    body: "Balanced auto-assignment with conflict checks. Judges score against weighted criteria and only ever see their own evaluations.",
  },
  {
    icon: Scale,
    title: "FairJudge review",
    body: "After an authorised reveal, large score differences are flagged for review tickets with recorded decisions and a full audit trail — without ever labelling a judge as biased.",
  },
  {
    icon: Radar,
    title: "Live command center",
    body: "Milestones, registrations, submissions, attendance, judging progress and operational alerts in one view — plus a Gemini assistant grounded in your event's live numbers.",
  },
  {
    icon: BadgeCheck,
    title: "Accountable by design",
    body: "Server-side role and ownership checks on every action, configurable scoring methods, publication gates, and an append-only audit log.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  let events: Awaited<ReturnType<typeof listPublicEvents>> = [];
  let dbError = false;
  try {
    events = await listPublicEvents();
  } catch {
    dbError = true;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#capabilities" className="hidden px-3 text-sm font-medium text-ink-600 hover:text-ink-900 sm:block">
              Capabilities
            </a>
            <a href="#events" className="hidden px-3 text-sm font-medium text-ink-600 hover:text-ink-900 sm:block">
              Events
            </a>
            {user ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-200/50 via-violet-200/40 to-fuchsia-100/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:pt-28">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <span className="size-1.5 rounded-full bg-brand-500" />
            Hackathon & campus event operating system
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-ink-950 sm:text-6xl">
            One Event.
            <br />
            <span className="text-gradient">One Intelligence Layer.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
            CampusOS runs the entire event lifecycle — from registration and teams to Gemini-assisted screening, QR
            attendance, private judging, discrepancy review and published results — on one shared, auditable data model.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg">
              <Link href={user ? "/dashboard" : "/sign-up"}>
                {user ? "Go to dashboard" : "Start an event"} <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href="#events">Browse events</a>
            </Button>
          </div>

          {/* Lifecycle rail */}
          <div className="mx-auto mt-16 max-w-5xl rounded-3xl border border-line bg-white/80 p-3 shadow-pop backdrop-blur">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {LIFECYCLE.map(({ icon: Icon, label }, i) => (
                <div
                  key={label}
                  className="group relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 transition hover:bg-brand-50/60"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-ink-950 text-white shadow-sm transition group-hover:bg-brand-600">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-[11px] font-semibold text-ink-700">{label}</span>
                  <span className="absolute left-2 top-2 font-mono text-[10px] text-ink-300">{String(i + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="border-t border-line bg-canvas py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Capabilities</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-ink-950">
            Built for the 36 hours where everything happens at once.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Events */}
      <section id="events" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Event overview</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">Open and upcoming events</h2>
            </div>
            <Button asChild variant="secondary">
              <Link href={user ? "/explore" : "/sign-up"}>
                Register for an event <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dbError && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 md:col-span-3">
                Couldn&apos;t reach the SQLite database. Run <code className="font-mono">npm run db:setup</code> and keep the local Prisma database configured.
              </p>
            )}
            {!dbError && events.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-500 md:col-span-3">
                No published events yet. Organizers can create one from the dashboard.
              </p>
            )}
            {events.map((e) => (
              <div key={e.id} className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.isDemo && <DemoBadge />}
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink-900">{e.name}</h3>
                {e.tagline && <p className="mt-1 text-sm text-ink-500">{e.tagline}</p>}
                <div className="mt-4 space-y-1.5 text-sm text-ink-600">
                  <p className="flex items-center gap-2">
                    <CalendarRange className="size-4 text-ink-400" />
                    {formatDate(e.startsAt, e.timeZone)} – {formatDate(e.endsAt, e.timeZone)}
                  </p>
                  {e.venue && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 text-ink-400" />
                      {e.venue}
                    </p>
                  )}
                </div>
                {e.tracks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {e.tracks.map((t) => (
                      <span key={t.id} className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-line">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-5">
                  <Link
                    href={user ? `/explore/${e.id}` : "/sign-up"}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:gap-2 transition-all"
                  >
                    View event <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-ink-500 sm:flex-row">
          <Logo />
          <p>One Event. One Intelligence Layer.</p>
        </div>
      </footer>
    </div>
  );
}
