import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signInTitle") };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-950">{t("welcomeBack")}</h1>
      <p className="mt-1.5 text-sm text-ink-500">{t("signInDescription")}</p>
      <SignInForm next={next ?? "/dashboard"} />
      <p className="mt-6 text-center text-sm text-ink-500">
        {t("newHere")}{" "}
        <Link href="/sign-up" className="font-semibold text-brand-600 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </>
  );
}
