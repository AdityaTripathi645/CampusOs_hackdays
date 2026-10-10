import type { Metadata } from "next";
import Link from "next/link";
import { completeEmailVerification } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message = "This verification link is missing its token.";
  let verified = false;

  if (token) {
    const result = await completeEmailVerification(token);
    if (result.status === "verified") {
      await audit({
        actorId: result.userId,
        action: "user.email_verified",
        entityType: "User",
        entityId: result.userId,
      });
      message = "Your email address is verified. You can continue using CampusOS.";
      verified = true;
    } else if (result.status === "already-verified") {
      message = "Your email address is already verified.";
      verified = true;
    } else {
      message = "This verification link is invalid, expired, or already used. Sign in to request another one.";
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-950">Email verification</h1>
      <p className={`mt-4 rounded-xl border p-4 text-sm ${verified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-ink-50 text-ink-700"}`}>
        {message}
      </p>
      <p className="mt-6 text-center text-sm text-ink-500">
        <Link href="/sign-in" className="font-semibold text-brand-600 hover:underline">
          Go to sign in
        </Link>
      </p>
    </>
  );
}
