import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-950">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-500">Use at least 8 characters. Reset links expire after 30 minutes.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          This password reset link is missing its token. Request a new link from{" "}
          <a href="/forgot-password" className="font-semibold underline">Forgot password</a>.
        </p>
      )}
    </>
  );
}
