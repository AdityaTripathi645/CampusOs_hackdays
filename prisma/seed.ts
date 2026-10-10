/**
 * CampusOS demo seed.
 *
 * Every record created here is flagged `isDemo = true` and rendered with a
 * DEMO badge in the UI. The seed deliberately does NOT create:
 *   • attendance / check-in records   (check people in live during the demo)
 *   • AI reviews                      (run screening yourself — live or demo mode)
 *   • results or published rankings   (compute them from evaluations in the app)
 *
 * Re-running the seed removes previous demo data first.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = "Demo@1234";
const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (offsetDays: number) => new Date(now + offsetDays * day);

function code(len = 10) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

const PARTICIPANTS = [
  ["Aarav Sharma", "IIT Jaipur"],
  ["Diya Mehta", "MNIT Jaipur"],
  ["Kabir Singh", "MNIT Jaipur"],
  ["Ananya Iyer", "BITS Pilani"],
  ["Rohan Gupta", "LNMIIT"],
  ["Ishita Verma", "LNMIIT"],
  ["Vihaan Rao", "IIIT Kota"],
  ["Meera Nair", "BITS Pilani"],
  ["Arjun Patel", "Manipal University Jaipur"],
  ["Saanvi Joshi", "Manipal University Jaipur"],
  ["Aditya Kulkarni", "IIT Jaipur"],
  ["Tara Bose", "JECRC University"],
  ["Nikhil Reddy", "JECRC University"],
  ["Zoya Khan", "Poornima University"],
  ["Yash Agarwal", "Poornima University"],
  ["Riya Choudhary", "MNIT Jaipur"],
] as const;

async function clearDemoData() {
  await db.event.deleteMany({ where: { isDemo: true } });
  await db.auditLog.deleteMany({ where: { actor: { isDemo: true } } });
  await db.user.deleteMany({ where: { isDemo: true } });
}

async function main() {
  console.log("→ Clearing previous demo data…");
  await clearDemoData();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const mkUser = (name: string, email: string, role: "ADMIN" | "ORGANIZER" | "PARTICIPANT" | "JUDGE", institution?: string) =>
    db.user.create({ data: { name, email, role, institution, passwordHash, isDemo: true, emailVerifiedAt: new Date() } });

  console.log("→ Creating demo users…");
  const admin = await mkUser("Campus Admin", "admin@campusos.demo", "ADMIN", "CampusOS");
  const organizer = await mkUser("Priya Raman", "organizer@campusos.demo", "ORGANIZER", "Tech Council");
  const judges = await Promise.all([
    mkUser("Dr. Neha Kapoor", "judge1@campusos.demo", "JUDGE", "Faculty, CSE"),
    mkUser("Rahul Desai", "judge2@campusos.demo", "JUDGE", "Industry mentor"),
    mkUser("Sana Qureshi", "judge3@campusos.demo", "JUDGE", "Startup founder"),
  ]);
  const participants: Awaited<ReturnType<typeof mkUser>>[] = [];
  for (const [i, [name, inst]] of PARTICIPANTS.entries()) {
    participants.push(await mkUser(name, `participant${i + 1}@campusos.demo`, "PARTICIPANT", inst));
  }

  console.log("→ Creating demo events…");
  const registrationFields: Prisma.InputJsonValue = [
    { key: "year_of_study", label: "Year of study", type: "select", required: true, options: ["1st", "2nd", "3rd", "4th", "PG"] },
    { key: "github", label: "GitHub profile", type: "text", required: false },
    { key: "tshirt", label: "T-shirt size", type: "select", required: true, options: ["S", "M", "L", "XL"] },
    { key: "code_of_conduct", label: "I agree to the code of conduct", type: "checkbox", required: true },
  ];

  const event = await db.event.create({
    data: {
      name: "Pink City Hack 2026",
      slug: "pink-city-hack-2026",
      tagline: "36 hours to build for Rajasthan's campuses and cities",
      description:
        "A 36-hour inter-college hackathon focused on civic tech, climate resilience and campus life. Teams of 2–4 build working prototypes, submit a deck, and pitch to a panel of faculty and industry judges.",
      venue: "Innovation Centre, Jaipur",
      status: "LIVE",
      registrationOpensAt: at(-14),
      registrationClosesAt: at(3),
      startsAt: at(-1),
      endsAt: at(4),
      submissionDeadline: at(2),
      timeZone: "Asia/Kolkata",
      eligibility: "Currently enrolled undergraduate or postgraduate students. Valid college ID required at check-in.",
      maxParticipants: 120,
      minTeamSize: 2,
      maxTeamSize: 4,
      registrationFields,
      scoringMethod: "MEAN",
      discrepancyThreshold: 20,
      judgesPerSubmission: 2,
      isDemo: true,
      ownerId: organizer.id,
      tracks: {
        create: [
          { name: "Civic Tech", description: "Public services, transport, governance, citizen engagement and city infrastructure." },
          { name: "Climate & Water", description: "Water conservation, heat resilience, agriculture, energy and environmental monitoring." },
          { name: "Campus Life", description: "Student wellbeing, learning tools, accessibility, clubs and campus operations." },
        ],
      },
      criteria: {
        create: [
          { name: "Innovation", description: "Originality of the idea and approach", weight: 1.5, maxScore: 10, order: 0 },
          { name: "Technical execution", description: "Working prototype, code quality, architecture", weight: 2, maxScore: 10, order: 1 },
          { name: "Impact", description: "Clarity of the problem and potential real-world impact", weight: 1.5, maxScore: 10, order: 2 },
          { name: "Presentation", description: "Pitch, deck and demo clarity", weight: 1, maxScore: 10, order: 3 },
        ],
      },
      rooms: {
        create: [
          { name: "Hall A", building: "Innovation Centre", capacity: 8 },
          { name: "Hall B", building: "Innovation Centre", capacity: 8 },
          { name: "Lab 3", building: "CSE Block", capacity: 6 },
        ],
      },
    },
    include: { tracks: true, criteria: true },
  });

  await db.event.create({
    data: {
      name: "Design Sprint Week",
      slug: "design-sprint-week",
      tagline: "A five-day product design sprint for first-years",
      description: "Hands-on UX research, prototyping and critique sessions. Draft event used to demo event configuration.",
      venue: "Design Studio",
      status: "DRAFT",
      registrationOpensAt: at(10),
      registrationClosesAt: at(20),
      startsAt: at(25),
      endsAt: at(30),
      submissionDeadline: at(29),
      timeZone: "Asia/Kolkata",
      minTeamSize: 1,
      maxTeamSize: 3,
      isDemo: true,
      ownerId: organizer.id,
      criteria: { create: [{ name: "Craft", weight: 1, maxScore: 10, order: 0 }] },
    },
  });

  await db.event.create({
    data: {
      name: "AI for Bharat Ideathon",
      slug: "ai-for-bharat-ideathon",
      tagline: "Pitch an AI idea that works in every Indian language",
      description: "An ideation challenge for applied AI in Indian languages, agriculture and public health. Registration is open.",
      venue: "Online + Main Auditorium",
      status: "PUBLISHED",
      registrationOpensAt: at(-2),
      registrationClosesAt: at(12),
      startsAt: at(15),
      endsAt: at(16),
      submissionDeadline: at(16),
      eligibility: "Open to all students.",
      maxParticipants: 200,
      minTeamSize: 1,
      maxTeamSize: 3,
      isDemo: true,
      ownerId: organizer.id,
      tracks: { create: [{ name: "Language AI" }, { name: "Health AI" }, { name: "Agri AI" }] },
      criteria: {
        create: [
          { name: "Problem clarity", weight: 1, maxScore: 10, order: 0 },
          { name: "Feasibility", weight: 1, maxScore: 10, order: 1 },
        ],
      },
    },
  });

  console.log("→ Registrations & teams…");
  const regs: { id: string }[] = [];
  for (const [i, p] of participants.entries()) {
    regs.push(
      await db.registration.create({
        data: {
          eventId: event.id,
          userId: p.id,
          // Last two remain pending so approvals can be demoed.
          status: i >= 14 ? "PENDING" : "APPROVED",
          answers: { year_of_study: ["2nd", "3rd", "4th"][i % 3]!, tshirt: ["M", "L", "S"][i % 3]!, code_of_conduct: true },
          checkInCode: `CO-${code()}`,
          isDemo: true,
        },
      }),
    );
  }

  const track = (name: string) => event.tracks.find((t) => t.name === name)!.id;
  const teamDefs = [
    { name: "Byte Bandits", track: "Civic Tech", members: [0, 1, 2] },
    { name: "Neer Nirman", track: "Climate & Water", members: [3, 4, 5] },
    { name: "Campus Pulse", track: "Campus Life", members: [6, 7] },
    { name: "Lightrail", track: "Civic Tech", members: [8, 9, 10] },
    { name: "Thar Watch", track: "Climate & Water", members: [11, 12] },
  ];
  const teams: { id: string; trackId: string | null; leaderId: string }[] = [];
  for (const t of teamDefs) {
    const leader = participants[t.members[0]!]!;
    teams.push(
      await db.team.create({
        data: {
          eventId: event.id,
          name: t.name,
          trackId: track(t.track),
          inviteCode: code(6),
          leaderId: leader.id,
          isDemo: true,
          members: {
            create: t.members.map((m, idx) => ({
              userId: participants[m]!.id,
              eventId: event.id,
              role: idx === 0 ? ("LEADER" as const) : ("MEMBER" as const),
            })),
          },
        },
      }),
    );
  }

  console.log("→ Submissions (no files attached — upload real decks in the app)…");
  const subDefs = [
    {
      team: 0,
      title: "BusBuddy — live crowding for JCTSL buses",
      abstract:
        "Jaipur commuters have no idea how crowded the next bus is. BusBuddy combines conductor tap-ins and anonymous rider reports to estimate live occupancy for every JCTSL route. Riders see a crowding meter and alternative routes; the transport authority sees a heatmap to rebalance fleet allocation during peak hours. Our prototype covers 12 routes using simulated feeds and a React Native app.",
      tech: ["React Native", "Node.js", "PostgreSQL", "Mapbox"],
      repo: "https://github.com/example/busbuddy",
      demo: "https://example.com/busbuddy-demo",
      status: "SUBMITTED" as const,
    },
    {
      team: 1,
      title: "Neer — stepwell-inspired rainwater ledger",
      abstract:
        "Neer helps housing societies log rooftop rainwater harvesting and groundwater recharge. Residents photograph tank gauges; the app estimates litres captured and recharged per monsoon and benchmarks societies across the ward. Municipal officers get a verified dashboard to target incentives. Built with Flutter and Firebase, with an ML model to read analogue gauges.",
      tech: ["Flutter", "Firebase", "TensorFlow Lite"],
      repo: "https://github.com/example/neer",
      demo: null,
      status: "SUBMITTED" as const,
    },
    {
      team: 2,
      title: "Campus Pulse — anonymous wellbeing check-ins",
      abstract:
        "Campus Pulse lets students do a 20-second weekly mood check-in and surfaces aggregated, anonymised wellbeing trends to the counselling cell. It recommends peer circles and office hours without identifying any individual. The prototype is a Next.js web app with differential-privacy style thresholds before any aggregate is shown.",
      tech: ["Next.js", "Supabase"],
      repo: "https://github.com/example/campus-pulse",
      demo: "https://example.com/pulse",
      status: "SUBMITTED" as const,
    },
    {
      team: 3,
      title: "Lightrail — streetlight fault reporting",
      abstract:
        "Lightrail lets citizens report broken streetlights by scanning the pole number. Reports are deduplicated, geotagged and routed to the right ward engineer with an SLA timer, and residents get notified when it is fixed.",
      tech: ["Kotlin", "Spring Boot"],
      repo: null,
      demo: null,
      status: "SUBMITTED" as const,
    },
    {
      team: 4,
      title: "Thar Watch (draft)",
      abstract: "Early draft: heat-stress alerts for outdoor workers using district weather data. Work in progress.",
      tech: ["Python"],
      repo: null,
      demo: null,
      status: "DRAFT" as const,
    },
  ];
  const submissions: { id: string }[] = [];
  for (const s of subDefs) {
    const team = teams[s.team]!;
    const sub = await db.submission.create({
      data: {
        eventId: event.id,
        teamId: team.id,
        title: s.title,
        abstract: s.abstract,
        trackId: team.trackId,
        technologies: s.tech,
        repoUrl: s.repo,
        demoUrl: s.demo,
        status: s.status,
        submittedAt: s.status === "SUBMITTED" ? at(-0.3) : null,
        isDemo: true,
        revisions: {
          create: {
            version: 1,
            snapshot: { title: s.title, status: s.status, seeded: true },
            note: "Seeded demo record",
            createdById: team.leaderId,
          },
        },
      },
    });
    submissions.push(sub);
  }

  console.log("→ Judge panel, assignments & demo evaluations…");
  const panel: { id: string }[] = [];
  for (const [i, j] of judges.entries()) {
    panel.push(
      await db.eventJudge.create({
        data: { eventId: event.id, userId: j.id, expertise: ["Systems & ML", "Product & UX", "Startups & impact"][i], isDemo: true },
      }),
    );
  }
  const criteria = [...event.criteria].sort((a, b) => a.order - b.order);
  const weighted = (scores: number[]) => {
    let w = 0;
    let t = 0;
    criteria.forEach((c, i) => {
      t += c.weight * (scores[i]! / c.maxScore);
      w += c.weight;
    });
    return Math.round((t / w) * 1000) / 10;
  };

  // [submissionIndex, judgeIndex, scores | null (assigned, not yet scored)]
  // Submission 1 has a deliberately large spread so FairJudge has something to review.
  const plan: [number, number, number[] | null][] = [
    [0, 0, [8, 8, 9, 7]],
    [0, 1, [7, 8, 8, 8]],
    [1, 1, [9, 8, 9, 8]],
    [1, 2, [4, 3, 5, 4]],
    [2, 2, [7, 6, 8, 7]],
    [2, 0, [6, 7, 7, 6]],
    [3, 0, null],
    [3, 1, null],
  ];
  for (const [si, ji, scores] of plan) {
    const assignment = await db.judgeAssignment.create({
      data: {
        eventId: event.id,
        eventJudgeId: panel[ji]!.id,
        submissionId: submissions[si]!.id,
        status: scores ? "SUBMITTED" : "ASSIGNED",
      },
    });
    if (scores) {
      await db.evaluation.create({
        data: {
          assignmentId: assignment.id,
          scores: Object.fromEntries(criteria.map((c, i) => [c.id, scores[i]!])),
          totalScore: weighted(scores),
          feedback: "Seeded demo evaluation — not a real judge's assessment.",
          status: "SUBMITTED",
          submittedAt: at(-0.1),
          isDemo: true,
        },
      });
    }
  }

  await db.auditLog.create({
    data: {
      actorId: admin.id,
      eventId: event.id,
      action: "seed.demo_data_loaded",
      entityType: "Event",
      entityId: event.id,
      metadata: { note: "All records flagged isDemo=true" },
    },
  });

  console.log("\n✓ Demo data ready. Sign in with any of these (password: %s):", PASSWORD);
  console.log("  admin@campusos.demo        (Admin)");
  console.log("  organizer@campusos.demo    (Organizer — owns all demo events)");
  console.log("  judge1@campusos.demo … judge3@campusos.demo   (Judges)");
  console.log("  participant1@campusos.demo … participant16@campusos.demo   (Participants)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
