import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";

/** Consistent JSON error responses for route handlers. */
export function apiError(err: unknown) {
  if (err instanceof AppError) {
    const response = NextResponse.json({ error: err.message, fieldErrors: err.fieldErrors }, { status: err.status });
    if (err.status === 429 && err.retryAfterSeconds !== undefined) {
      response.headers.set("Retry-After", String(err.retryAfterSeconds));
    }
    return response;
  }
  console.error("[CampusOS] API error", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
