import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGeminiStatus } from "@/services/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }
  const gemini = getGeminiStatus();
  return NextResponse.json(
    { status: database === "ok" ? "ok" : "degraded", database, gemini: gemini.configured ? "configured" : "demo-mode" },
    { status: database === "ok" ? 200 : 503 },
  );
}
