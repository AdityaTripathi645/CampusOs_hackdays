"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  completePasswordReset,
  createAuthToken,
  createSession,
  destroySession,
  expireAuthToken,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { passwordResetEmail, emailVerificationEmail } from "@/emails";
import { activeEmailDriver, sendTemplatedEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { AppError, toActionState, type ActionState } from "@/lib/errors";
import { checkRateLimit, enforceRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";
import { isRole } from "@/lib/domain";
import {
  forgotPasswordSchema,
  formToObject,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  zodFieldErrors,
} from "@/lib/validation";

const PASSWORD_RESET_LIFETIME = 30 * 60 * 1000;
const EMAIL_VERIFY_LIFETIME = 24 * 60 * 60 * 1000;
const EMAIL_VERIFY_RATE_LIMIT = 60 * 1000;
const genericResetMessage = "If an account exists, we sent a link.";
const SIGN_IN_EMAIL_LIMIT = 5;
const SIGN_IN_IP_LIMIT = 20;
const SIGN_IN_WINDOW = 15 * 60 * 1000;

async function authLink(path: string, token: string) {
  let baseUrl = process.env.APP_URL;
  if (process.env.NODE_ENV !== "production") {
    baseUrl = (await headers()).get("origin") ?? baseUrl;
  }
  if (!baseUrl) throw new Error("APP_URL is required to send authentication email links in production.");
  const url = new URL(path, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendVerificationEmail(
  user: { id: string; name: string; email: string },
  rateLimited = false,
): Promise<"sent" | "rate-limited" | "failed"> {
  const token = await createAuthToken(
    user.id,
    "EMAIL_VERIFY",
    EMAIL_VERIFY_LIFETIME,
    rateLimited ? EMAIL_VERIFY_RATE_LIMIT : 0,
  );
  if (!token) return "rate-limited";
  try {
    const sent = await sendTemplatedEmail({
      to: user.email,
      template: "email-verification",
      ...emailVerificationEmail({ name: user.name, url: await authLink("/verify-email", token) }),
    });
    if (sent) return "sent";
    await expireAuthToken(token, "EMAIL_VERIFY");
    return "failed";
  } catch (error) {
    await expireAuthToken(token, "EMAIL_VERIFY");
    throw error;
  }
}

function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  const { name, email, password, institution } = parsed.data;

  try {
    const ip = await getClientIp();
    await enforceRateLimit(`auth:sign-up:ip:${ip}`, 5, 60 * 60 * 1000, "Too many sign-up attempts.");
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return duplicateEmailState();

    const user = await db.user.create({
      data: { name, email, role: "PARTICIPANT", institution: institution ?? null, passwordHash: await hashPassword(password) },
    });
    await audit({ actorId: user.id, action: "user.signed_up", entityType: "User", entityId: user.id, metadata: { role: "PARTICIPANT" } });
    try {
      await sendVerificationEmail(user);
    } catch (error) {
      console.error("[CampusOS auth] Failed to prepare email verification:", error);
    }
    await createSession({ ...user, role: "PARTICIPANT" });
    redirect("/dashboard");
  } catch (err) {
    if (isPrismaCode(err, "P2002")) return duplicateEmailState();
    return toActionState(err);
  }
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  try {
    const ip = await getClientIp();
    const encodedIp = encodeURIComponent(ip);
    const encodedEmail = encodeURIComponent(parsed.data.email);
    const emailKey = `auth:sign-in:ip-email:${encodedIp}:${encodedEmail}`;
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(emailKey, SIGN_IN_EMAIL_LIMIT, SIGN_IN_WINDOW),
      checkRateLimit(`auth:sign-in:ip:${encodedIp}`, SIGN_IN_IP_LIMIT, SIGN_IN_WINDOW),
    ]);
    if (!emailLimit.success) {
      throw new AppError(
        `Too many sign-in attempts for this email. Please try again in ${emailLimit.retryAfterSeconds} seconds.`,
        429,
        undefined,
        undefined,
        emailLimit.retryAfterSeconds,
      );
    }
    if (!ipLimit.success) {
      throw new AppError(
        `Too many sign-in attempts from this network. Please try again in ${ipLimit.retryAfterSeconds} seconds.`,
        429,
        undefined,
        undefined,
        ipLimit.retryAfterSeconds,
      );
    }
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    // Same message for unknown email and wrong password.
    if (!user || !isRole(user.role) || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return { ok: false, error: "Incorrect email or password." };
    }
    await createSession({ ...user, role: user.role });
    await audit({ actorId: user.id, action: "user.signed_in", entityType: "User", entityId: user.id });
    await resetRateLimit(emailKey, SIGN_IN_EMAIL_LIMIT, SIGN_IN_WINDOW);
    redirect(safeNext(formData.get("next")));
  } catch (err) {
    return toActionState(err);
  }
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (parsed.success) {
    try {
      await enforceRateLimit(`auth:forgot-password:email:${parsed.data.email}`, 3, 60 * 60 * 1000, "Too many password reset requests.");
      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (user) {
        await audit({ actorId: user.id, action: "user.password_reset_requested", entityType: "User", entityId: user.id });
        const token = await createAuthToken(user.id, "PASSWORD_RESET", PASSWORD_RESET_LIFETIME);
        if (token) {
          await sendTemplatedEmail({
            to: user.email,
            template: "password-reset",
            ...passwordResetEmail({ name: user.name, url: await authLink("/reset-password", token) }),
          });
        }
      }
    } catch (error) {
      if (error instanceof AppError && error.status === 429) return toActionState(error);
      console.error("[CampusOS auth] Password reset request failed:", error);
    }
  }
  return { ok: true, message: genericResetMessage };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  try {
    const userId = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (!userId) return { ok: false, error: "This password reset link is invalid or has expired." };
    await destroySession();
    await audit({ actorId: userId, action: "user.password_reset", entityType: "User", entityId: userId });
    return { ok: true, message: "Password reset. You can now sign in with your new password." };
  } catch (err) {
    return toActionState(err);
  }
}

export async function resendVerificationEmailAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const sessionUser = await requireUser();
    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, emailVerifiedAt: true },
    });
    if (!user) return { ok: false, error: "Your account could not be found." };
    if (user.emailVerifiedAt) return { ok: true, message: "Your email address is already verified." };

    await enforceRateLimit(`auth:resend-verification:email:${user.email.toLowerCase()}`, 3, 60 * 60 * 1000, "Too many verification email requests.");
    const sent = await sendVerificationEmail(user, true);
    if (sent === "rate-limited") {
      return { ok: false, error: "Please wait a minute before requesting another verification email." };
    }
    if (sent === "failed") {
      return { ok: false, error: "We couldn't send the verification email. Check the email delivery settings and try again." };
    }
    return {
      ok: true,
      message:
        activeEmailDriver() === "console"
          ? "A verification preview was saved locally; no email reached your inbox. Configure SMTP or Resend for real delivery."
          : "Verification email sent. Check your inbox.",
    };
  } catch (err) {
    return toActionState(err);
  }
}

function duplicateEmailState(): ActionState {
  return {
    ok: false,
    error: "An account with this email already exists.",
    fieldErrors: { email: ["Already registered"] },
  };
}

function isPrismaCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === code;
}
