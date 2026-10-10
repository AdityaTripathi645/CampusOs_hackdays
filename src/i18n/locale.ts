import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

export const LOCALE_COOKIE = "campusos_locale";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "hi"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "hi" || normalized.startsWith("hi-")) return "hi";
  return null;
}

export async function getLocalePreference(): Promise<{ locale: Locale; userLocaleSet: boolean }> {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const userLocale = normalizeLocale(user?.locale);
  if (userLocale) return { locale: userLocale, userLocaleSet: true };
  const cookieLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  return { locale: cookieLocale ?? DEFAULT_LOCALE, userLocaleSet: false };
}
