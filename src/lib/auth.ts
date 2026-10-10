import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { isRole, type Role } from "@/lib/domain";

export type AuthTokenType = "PASSWORD_RESET" | "EMAIL_VERIFY";

export type CurrentUser = Omit<
  Pick<User, "id" | "name" | "email" | "role" | "institution" | "isDemo" | "emailNotifications" | "emailVerifiedAt" | "locale">,
  "role"
> & {
  role: Role;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: Pick<User, "id" | "name" | "sessionVersion"> & { role: Role }) {
  const token = await signSession({
    sub: user.id,
    role: user.role,
    name: user.name,
    sessionVersion: user.sessionVersion,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Loads the signed-in user from the database on every request (cached per
 * render). The role is always read from the DB, never trusted from the cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      institution: true,
      isDemo: true,
      emailNotifications: true,
      emailVerifiedAt: true,
      locale: true,
      sessionVersion: true,
    },
  });
  if (!user || !isRole(user.role) || session.sessionVersion !== user.sessionVersion) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    institution: user.institution,
    isDemo: user.isDemo,
    emailNotifications: user.emailNotifications,
    emailVerifiedAt: user.emailVerifiedAt,
    locale: user.locale,
  };
});

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(
  userId: string,
  type: AuthTokenType,
  lifetimeMs: number,
  minimumIntervalMs = 0,
): Promise<string | null> {
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const token = await db.$transaction(async (tx) => {
    if (minimumIntervalMs > 0) {
      const recentToken = await tx.authToken.findFirst({
        where: {
          userId,
          type,
          createdAt: { gt: new Date(now.getTime() - minimumIntervalMs) },
          expiresAt: { gt: now },
          usedAt: null,
        },
        select: { id: true },
      });
      if (recentToken) return null;
    }

    await tx.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { expiresAt: now },
    });
    await tx.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashAuthToken(rawToken),
        expiresAt: new Date(now.getTime() + lifetimeMs),
      },
    });
    return rawToken;
  });
  return token;
}

export async function expireAuthToken(rawToken: string, type: AuthTokenType): Promise<void> {
  await db.authToken.updateMany({
    where: { tokenHash: hashAuthToken(rawToken), type, usedAt: null },
    data: { expiresAt: new Date() },
  });
}

export async function completePasswordReset(rawToken: string, password: string): Promise<string | null> {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const token = await tx.authToken.findUnique({
      where: { tokenHash: hashAuthToken(rawToken) },
    });
    if (!token || token.type !== "PASSWORD_RESET" || token.usedAt || token.expiresAt <= now) return null;

    const claimed = await tx.authToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
    });
    await tx.authToken.updateMany({
      where: { userId: token.userId, type: "PASSWORD_RESET", usedAt: null },
      data: { expiresAt: now },
    });
    return token.userId;
  });
}

export async function completeEmailVerification(
  rawToken: string,
): Promise<{ status: "verified" | "already-verified" | "invalid"; userId?: string }> {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const token = await tx.authToken.findUnique({
      where: { tokenHash: hashAuthToken(rawToken) },
      include: { user: { select: { emailVerifiedAt: true } } },
    });
    if (!token || token.type !== "EMAIL_VERIFY" || token.usedAt || token.expiresAt <= now) {
      return { status: "invalid" };
    }

    const claimed = await tx.authToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return { status: "invalid" };

    if (!token.user.emailVerifiedAt) {
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now } });
    }
    await tx.authToken.updateMany({
      where: { userId: token.userId, type: "EMAIL_VERIFY", usedAt: null },
      data: { expiresAt: now },
    });
    return { status: token.user.emailVerifiedAt ? "already-verified" : "verified", userId: token.userId };
  });
}

/** For pages: redirect to sign-in when there is no session. */
export async function requirePageUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

/** For actions / API routes: throw typed errors instead of redirecting. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (roles && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export const isStaff = (role: Role) => role === "ADMIN" || role === "ORGANIZER";
