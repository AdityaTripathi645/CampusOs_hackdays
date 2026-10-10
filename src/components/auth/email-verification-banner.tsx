"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { resendVerificationEmailAction } from "@/app/(auth)/actions";

export function EmailVerificationBanner() {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Verify your email address</p>
          <p className="mt-0.5 text-sm text-amber-900">Verify your email before registering for events.</p>
          <ActionForm action={resendVerificationEmailAction} className="mt-2 flex flex-wrap items-center gap-3">
            <SubmitButton size="sm" variant="secondary" pendingText="Sending…">
              Resend email
            </SubmitButton>
          </ActionForm>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-amber-800 hover:bg-amber-100"
          aria-label="Dismiss email verification notice"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
