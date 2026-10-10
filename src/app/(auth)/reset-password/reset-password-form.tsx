"use client";

import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { resetPasswordAction } from "../actions";

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" hint="At least 8 characters" required>
        <Input type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password" name="confirmPassword" required>
        <Input type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <SubmitButton variant="brand" size="lg" className="w-full" pendingText="Updating password…">
        Set new password
      </SubmitButton>
      <Link href="/sign-in" className="text-center text-sm font-semibold text-brand-600 hover:underline">
        Back to sign in
      </Link>
    </ActionForm>
  );
}
