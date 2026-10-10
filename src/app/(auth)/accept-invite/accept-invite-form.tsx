"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { acceptInvitationAction } from "@/actions/invitations";

export function AcceptInviteForm({
  token,
  email,
  existingUser,
}: {
  token: string;
  email: string;
  existingUser: boolean;
}) {
  return (
    <ActionForm action={acceptInvitationAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={existingUser ? "existing" : "new"} />
      <Field label="Invited email" name="invitedEmail">
        <Input type="email" value={email} readOnly />
      </Field>
      {!existingUser && (
        <Field label="Full name" name="name" required>
          <Input autoComplete="name" required />
        </Field>
      )}
      <Field
        label={existingUser ? "Account password" : "Create a password"}
        name="password"
        hint={existingUser ? "Sign in to accept this invitation." : "At least 8 characters"}
        required
      >
        <Input type="password" autoComplete={existingUser ? "current-password" : "new-password"} minLength={existingUser ? undefined : 8} required />
      </Field>
      <SubmitButton variant="brand" size="lg" className="w-full" pendingText="Accepting invitation…">
        {existingUser ? "Sign in and accept" : "Create account and accept"}
      </SubmitButton>
    </ActionForm>
  );
}
