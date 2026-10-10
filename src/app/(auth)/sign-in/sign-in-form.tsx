"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import Link from "next/link";
import { signInAction } from "../actions";
import { useTranslations } from "next-intl";

export function SignInForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const fill = (email: string) => {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "Demo@1234";
  };
  const demoAccounts = [
    { label: t("organizer"), email: "organizer@campusos.demo" },
    { label: t("participant"), email: "participant14@campusos.demo" },
    { label: t("judge"), email: "judge1@campusos.demo" },
    { label: t("admin"), email: "admin@campusos.demo" },
  ];

  return (
    <>
      <ActionForm action={signInAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t("email")} name="email">
          <Input ref={emailRef} type="email" autoComplete="email" placeholder="you@college.edu" required />
        </Field>
        <Field label={t("password")} name="password">
          <Input ref={passwordRef} type="password" autoComplete="current-password" required />
        </Field>
        <div className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand-600 hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <SubmitButton variant="brand" size="lg" className="mt-2 w-full" pendingText={t("signingIn")}>
          {t("signIn")}
        </SubmitButton>
      </ActionForm>

      <div className="mt-8 rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-700">
          <FlaskConical className="size-3.5" /> {t("seededDemoAccounts")}
        </p>
        <p className="mt-1 text-xs text-orange-900/80">{t("demoAccountsHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {demoAccounts.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => fill(a.email)}
              className="rounded-lg bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-ink-700 ring-1 ring-orange-200 transition hover:ring-orange-400"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
