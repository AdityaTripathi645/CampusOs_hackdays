import { clsx, type ClassValue } from "clsx";
import type { Prisma } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function jsonObject(value: Prisma.JsonValue): Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function formatDate(d: Date | string | null | undefined, timeZone?: string, locale = "en-IN") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined, timeZone?: string, locale = "en-IN") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
  }).format(new Date(d));
}

export function relativeTime(d: Date | string, locale = "en") {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** <input type="datetime-local"> value in local time */
export function toDateTimeLocal(d: Date | string | null | undefined, timeZone?: string) {
  if (!d) return "";
  const date = timeZone ? toZonedTime(new Date(d), timeZone) : new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(length = 8) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}
