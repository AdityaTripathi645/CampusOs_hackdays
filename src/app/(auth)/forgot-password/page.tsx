import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-950">Reset your password</h1>
      <p className="mt-1.5 text-sm text-ink-500">Enter your account email and we&apos;ll send a reset link if an account exists.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-ink-500">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
