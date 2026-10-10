import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUpTitle") };
}

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-950">{t("createYourAccount")}</h1>
      <p className="mt-1.5 text-sm text-ink-500">{t("createAccountDescription")}</p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-ink-500">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/sign-in" className="font-semibold text-brand-600 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </>
  );
}
