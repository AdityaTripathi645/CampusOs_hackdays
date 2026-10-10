"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { signUpAction } from "../actions";
import { useTranslations } from "next-intl";

export function SignUpForm() {
  const t = useTranslations("auth");
  return (
    <ActionForm action={signUpAction} className="mt-8 flex flex-col gap-4">
      <Field label={t("fullName")} name="name" required>
        <Input autoComplete="name" required />
      </Field>
      <Field label={t("email")} name="email" required>
        <Input type="email" autoComplete="email" required />
      </Field>
      <Field label={t("institution")} name="institution" hint={t("institutionHint")}>
        <Input />
      </Field>
      <Field label={t("password")} name="password" hint={t("passwordHint")} required>
        <Input type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <p className="-mt-1 text-xs text-ink-500">{t("invitationOnly")}</p>
      <SubmitButton variant="brand" size="lg" className="mt-2 w-full" pendingText={t("creatingAccount")}>
        {t("createAccount")}
      </SubmitButton>
    </ActionForm>
  );
}
