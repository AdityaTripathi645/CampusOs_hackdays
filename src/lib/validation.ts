import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert FormData to a plain object (last value wins; use getAll for lists). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), { message: "Must be a valid http(s) URL" });

const jsonArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .default("[]")
    .transform((s, ctx) => {
      try {
        return JSON.parse(s || "[]") as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid list data" });
        return z.NEVER;
      }
    })
    .pipe(z.array(item));

// ─── Auth ────────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  institution: optionalText(120),
});

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["ORGANIZER", "JUDGE", "ADMIN"]),
  eventId: optionalText(64),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1).max(2048),
  name: z.string().trim().min(2, "Enter your full name").max(80).optional(),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(2048),
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// ─── Events ──────────────────────────────────────────────────────────────────

export const registrationFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Keys use lowercase letters, numbers and underscores"),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "textarea", "select", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});
export type RegistrationField = z.infer<typeof registrationFieldSchema>;

export const trackInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
});

export const criterionInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  weight: z.coerce.number().min(0.1).max(10),
  maxScore: z.coerce.number().int().min(1).max(100),
});

export const roomInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  building: z.string().trim().max(80).optional(),
  capacity: z.coerce.number().int().min(1).max(5000),
});

export const prizeInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  trackName: optionalText(60),
  rank: z.coerce.number().int().min(1).max(1000).default(1),
  amount: z.preprocess(
    (value) => (value === "" || value === null ? undefined : Number(value)),
    z.number().positive().optional(),
  ),
});

export const eventSchema = z
  .object({
    name: z.string().trim().min(3, "Name is too short").max(100),
    tagline: optionalText(140),
    description: z.string().trim().min(20, "Describe the event in at least 20 characters").max(5000),
    venue: optionalText(160),
    status: z.enum(["DRAFT", "PUBLISHED", "LIVE", "JUDGING", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
    timeZone: z.string().trim().min(1).default("Asia/Kolkata").refine(isValidTimeZone, "Choose a valid IANA time zone"),
    registrationOpensAt: z.string().min(1, "Required").refine(isValidLocalDateTime, "Enter a valid date and time"),
    registrationClosesAt: z.string().min(1, "Required").refine(isValidLocalDateTime, "Enter a valid date and time"),
    startsAt: z.string().min(1, "Required").refine(isValidLocalDateTime, "Enter a valid date and time"),
    endsAt: z.string().min(1, "Required").refine(isValidLocalDateTime, "Enter a valid date and time"),
    submissionDeadline: z.string().min(1, "Required").refine(isValidLocalDateTime, "Enter a valid date and time"),
    eligibility: optionalText(1000),
    maxParticipants: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(z.number().int().min(1).max(100000).optional()),
    minTeamSize: z.coerce.number().int().min(1).max(10),
    maxTeamSize: z.coerce.number().int().min(1).max(10),
    scoringMethod: z.enum(["MEAN", "MEDIAN", "TRIMMED_MEAN"]).default("MEAN"),
    discrepancyThreshold: z.coerce.number().min(1).max(100).default(20),
    judgesPerSubmission: z.coerce.number().int().min(1).max(10).default(2),
    tracks: jsonArray(trackInputSchema),
    criteria: jsonArray(criterionInputSchema),
    registrationFields: jsonArray(registrationFieldSchema),
    rooms: jsonArray(roomInputSchema),
    prizes: jsonArray(prizeInputSchema),
  })
  .superRefine((v, ctx) => {
    if (!isValidTimeZone(v.timeZone) || ![
      v.startsAt,
      v.endsAt,
      v.registrationOpensAt,
      v.registrationClosesAt,
      v.submissionDeadline,
    ].every(isValidLocalDateTime)) {
      return;
    }
    const startsAt = fromZonedTime(v.startsAt, v.timeZone);
    const endsAt = fromZonedTime(v.endsAt, v.timeZone);
    const registrationOpensAt = fromZonedTime(v.registrationOpensAt, v.timeZone);
    const registrationClosesAt = fromZonedTime(v.registrationClosesAt, v.timeZone);
    const submissionDeadline = fromZonedTime(v.submissionDeadline, v.timeZone);
    if (endsAt <= startsAt)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Must be after the start" });
    if (registrationClosesAt <= registrationOpensAt)
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Must be after registration opens" });
    if (submissionDeadline <= registrationOpensAt)
      ctx.addIssue({ code: "custom", path: ["submissionDeadline"], message: "Must be after registration opens" });
    if (v.maxTeamSize < v.minTeamSize)
      ctx.addIssue({ code: "custom", path: ["maxTeamSize"], message: "Must be ≥ minimum team size" });
    if (v.criteria.length === 0)
      ctx.addIssue({ code: "custom", path: ["criteria"], message: "Add at least one judging criterion" });
    const keys = v.registrationFields.map((f) => f.key);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", path: ["registrationFields"], message: "Field keys must be unique" });
    const tracks = v.tracks.map((t) => t.name.toLowerCase());
    if (new Set(tracks).size !== tracks.length)
      ctx.addIssue({ code: "custom", path: ["tracks"], message: "Track names must be unique" });
    const crit = v.criteria.map((c) => c.name.toLowerCase());
    if (new Set(crit).size !== crit.length)
      ctx.addIssue({ code: "custom", path: ["criteria"], message: "Criterion names must be unique" });
    const rooms = v.rooms.map((r) => r.name.toLowerCase());
    if (new Set(rooms).size !== rooms.length)
      ctx.addIssue({ code: "custom", path: ["rooms"], message: "Room names must be unique" });
    const trackNames = new Set(v.tracks.map((t) => t.name.toLowerCase()));
    const prizeNames = v.prizes.map((p) => `${p.trackName?.toLowerCase() ?? ""}:${p.name.toLowerCase()}`);
    if (new Set(prizeNames).size !== prizeNames.length)
      ctx.addIssue({ code: "custom", path: ["prizes"], message: "Prize names must be unique within each leaderboard" });
    v.prizes.forEach((prize, index) => {
      if (prize.trackName && !trackNames.has(prize.trackName.toLowerCase()))
        ctx.addIssue({ code: "custom", path: ["prizes", index, "trackName"], message: "Choose a track in this event" });
    });
  })
  .transform((v) => ({
    ...v,
    registrationOpensAt: fromZonedTime(v.registrationOpensAt, v.timeZone),
    registrationClosesAt: fromZonedTime(v.registrationClosesAt, v.timeZone),
    startsAt: fromZonedTime(v.startsAt, v.timeZone),
    endsAt: fromZonedTime(v.endsAt, v.timeZone),
    submissionDeadline: fromZonedTime(v.submissionDeadline, v.timeZone),
  }));

function isValidLocalDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  date.setUTCHours(hour!, minute!, 0, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
export type EventInput = Omit<z.infer<typeof eventSchema>, "prizes"> & {
  prizes?: z.infer<typeof prizeInputSchema>[];
};

// ─── Teams ───────────────────────────────────────────────────────────────────

export const createTeamSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "Team name is too short").max(50),
  trackId: optionalText(40),
});

export const joinTeamSchema = z.object({
  eventId: z.string().min(1),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Enter the invite code")
    .max(16),
});

// ─── Submissions ─────────────────────────────────────────────────────────────

export const submissionSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(3, "Title is too short").max(120),
  abstract: z.string().trim().min(30, "Write at least 30 characters").max(4000),
  trackId: optionalText(40),
  technologies: z
    .string()
    .default("")
    .transform((s) =>
      Array.from(
        new Set(
          s
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ).slice(0, 20),
    ),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  intent: z.enum(["draft", "submit"]).default("draft"),
});

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

// ─── Judging & review ────────────────────────────────────────────────────────

export const ticketDecisionSchema = z.object({
  ticketId: z.string().min(1),
  decision: z.enum(["KEEP_SCORES", "REQUEST_RESCORE", "EXCLUDE_EVALUATION", "DISMISS"]),
  targetEvaluationId: optionalText(40),
  decisionNote: z.string().trim().min(10, "Explain the decision in at least 10 characters").max(2000),
});

export const aiDecisionSchema = z.object({
  reviewId: z.string().min(1),
  decision: z.enum(["ACCEPTED", "OVERRIDDEN", "DISMISSED"]),
  note: optionalText(2000),
  submissionStatus: z.enum(["UNCHANGED", "UNDER_REVIEW", "SHORTLISTED", "REJECTED"]).default("UNCHANGED"),
});

export function zodFieldErrors(err: z.ZodError) {
  return err.flatten().fieldErrors as Record<string, string[] | undefined>;
}
