"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { forgotPasswordAction } from "../actions";

export function ForgotPasswordForm() {
  return (
    <ActionForm action={forgotPasswordAction} className="mt-8 flex flex-col gap-4">
      <Field label="Email" name="email" required>
        <Input type="email" autoComplete="email" required />
      </Field>
      <SubmitButton variant="brand" size="lg" className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </ActionForm>
  );
}
