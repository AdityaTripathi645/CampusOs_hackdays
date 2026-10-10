import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError, csvResponse } from "@/lib/api";
import { attendanceCsv } from "@/services/operations";
import { resultsCsv } from "@/services/results";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string; kind: string }> }) {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const { eventId, kind } = await params;
    if (kind === "attendance") {
      const { csv, filename } = await attendanceCsv(user, eventId);
      return csvResponse(csv, filename);
    }
    if (kind === "results") {
      const { csv, filename } = await resultsCsv(user, eventId);
      return csvResponse(csv, filename);
    }
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  } catch (err) {
    return apiError(err);
  }
}
