/**
 * Consistent application errors. Services throw these; server actions and
 * API routes translate them into ActionState / HTTP responses.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
    public readonly messageKey?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Resource") {
    super(`${what} not found.`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Optional payload for client components (e.g. created id) */
  data?: Record<string, unknown>;
};

export const initialActionState: ActionState = { ok: false };

export function toActionState(err: unknown): ActionState {
  // Next.js uses thrown errors for redirect()/notFound(); never swallow those.
  if (isNextControlFlow(err)) throw err;
  if (err instanceof AppError) {
    return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  }
  if (err instanceof Error && err.message.startsWith("AUTH_SECRET is missing or shorter than 32 characters")) {
    return { ok: false, error: "Authentication is not configured. Set AUTH_SECRET in .env to a random value of at least 32 characters." };
  }
  const code = prismaErrorCode(err);
  if (code === "P1000") {
    return { ok: false, error: "The local database file could not be opened. Check DATABASE_URL and directory permissions." };
  }
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return { ok: false, error: "The local database could not be opened. Check DATABASE_URL and that its folder is writable, then try again." };
  }
  if (code === "P2021" || code === "P2022") {
    return { ok: false, error: "The database schema is out of date. Run `npm run db:push`, then try again." };
  }
  if (code === "P2024") {
    return { ok: false, error: "The database is busy. Please wait a moment and try again." };
  }
  console.error("[CampusOS] Unexpected error:", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function prismaErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if ("code" in err && typeof err.code === "string") return err.code;
  if (!("name" in err) || err.name !== "PrismaClientInitializationError" || !("message" in err) || typeof err.message !== "string") {
    return undefined;
  }
  if (/authentication failed/i.test(err.message)) return "P1000";
  if (/can't reach database server|timed out fetching a new connection/i.test(err.message)) return "P1001";
  return undefined;
}

function isNextControlFlow(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND")
  );
}
