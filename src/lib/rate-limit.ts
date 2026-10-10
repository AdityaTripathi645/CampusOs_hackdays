import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { AppError } from "@/lib/errors";

export type RateLimitResult = {
  success: boolean;
  retryAfterSeconds: number;
};

type MemoryRateLimiter = {
  limit: (key: string, max: number, windowMs: number) => RateLimitResult;
  reset: (key: string, max: number, windowMs: number) => void;
};

export function createMemoryRateLimiter(now: () => number = Date.now): MemoryRateLimiter {
  const windows = new Map<string, { hits: number[]; windowMs: number }>();
  let checks = 0;

  return {
    limit(key, max, windowMs) {
      const timestamp = now();
      const scopedKey = `${max}:${windowMs}:${key}`;
      if (++checks % 256 === 0) {
        for (const [storedKey, bucket] of windows) {
          bucket.hits = bucket.hits.filter((hit) => hit > timestamp - bucket.windowMs);
          if (bucket.hits.length === 0) windows.delete(storedKey);
        }
      }
      const bucket = windows.get(scopedKey);
      const recent = (bucket?.hits ?? []).filter((hit) => hit > timestamp - windowMs);
      if (recent.length >= max) {
        windows.set(scopedKey, { hits: recent, windowMs });
        return {
          success: false,
          retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + windowMs - timestamp) / 1000)),
        };
      }
      recent.push(timestamp);
      windows.set(scopedKey, { hits: recent, windowMs });
      return { success: true, retryAfterSeconds: 0 };
    },
    reset(key, max, windowMs) {
      windows.delete(`${max}:${windowMs}:${key}`);
    },
  };
}

// In-memory limits are per process and are not shared across server instances.
const memoryLimiter = createMemoryRateLimiter();
let redis: Redis | undefined;
const upstashLimiters = new Map<string, Ratelimit>();

function getRateLimitDriver(): "memory" | "upstash" {
  const driver = process.env.RATE_LIMIT_DRIVER ?? "memory";
  if (driver === "memory" || driver === "upstash") return driver;
  throw new Error(`Unsupported RATE_LIMIT_DRIVER "${driver}". Choose "memory" or "upstash".`);
}

function getUpstashLimiter(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = upstashLimiters.get(cacheKey);
  if (!limiter) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("RATE_LIMIT_DRIVER=upstash requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
    redis ??= new Redis({ url, token });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: "campusos:rate-limit",
    });
    upstashLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  if (getRateLimitDriver() === "memory") {
    return memoryLimiter.limit(key, max, windowMs);
  }
  const result = await getUpstashLimiter(max, windowMs).limit(key);
  return {
    success: result.success,
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const result = await checkRateLimit(key, limit, windowSeconds * 1000);
  return { ok: result.success, retryAfter: result.retryAfterSeconds };
}

export async function enforceRateLimit(
  key: string,
  max: number,
  windowMs: number,
  message: string,
): Promise<void> {
  const result = await checkRateLimit(key, max, windowMs);
  if (!result.success) {
    const retryAfterSeconds = result.retryAfterSeconds;
    throw new AppError(`${message} Please try again in ${retryAfterSeconds} seconds.`, 429, undefined, undefined, retryAfterSeconds);
  }
}

export async function resetRateLimit(key: string, max: number, windowMs: number): Promise<void> {
  if (getRateLimitDriver() === "memory") {
    memoryLimiter.reset(key, max, windowMs);
    return;
  }
  await getUpstashLimiter(max, windowMs).resetUsedTokens(key);
}

export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  return requestHeaders.get("x-real-ip")?.trim() || "unknown";
}
