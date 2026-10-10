import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocalePreference } from "@/i18n/locale";
import en from "@/i18n/messages/en.json";
import hi from "@/i18n/messages/hi.json";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CampusOS — One Event. One Intelligence Layer.", template: "%s · CampusOS" },
  description:
    "AI-powered operating system for hackathons and campus events: registration, teams, submissions, Gemini screening, QR attendance, judging, FairJudge review and results.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getLocalePreference();
  return (
    <html lang={locale} className={`${jakarta.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider locale={locale} messages={locale === "hi" ? hi : en}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
