/**
 * Edge-safe session token helpers (used by middleware and server code).
 * Only depends on `jose`, so it runs in the Edge runtime.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/domain";

export type { Role } from "@/lib/domain";

export const SESSION_COOKIE = "campusos_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
  sessionVersion: number;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Copy .env.example to .env and set it.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, sessionVersion: payload.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      (payload.sessionVersion !== undefined && typeof payload.sessionVersion !== "number")
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role as Role,
      name: String(payload.name ?? ""),
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
    };
  } catch {
    return null;
  }
}
