import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCanManageEvent } from "@/lib/authz";
import { apiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { askOrganizerAssistant, getGeminiStatus } from "@/services/gemini";
import { commandCenter } from "@/services/dashboard";
import { enforceRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  eventId: z.string().min(1),
  question: z.string().trim().min(3).max(1000),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser(["ORGANIZER", "ADMIN"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Ask a question (3–1000 characters)." }, { status: 400 });
    await assertCanManageEvent(user, parsed.data.eventId);
    await enforceRateLimit(`ai:assistant:user:${user.id}`, 20, 60 * 60 * 1000, "Too many assistant requests.");

    if (!getGeminiStatus().configured) {
      return NextResponse.json(
        { error: "Gemini is not configured. Add GEMINI_API_KEY to .env and restart to use the assistant.", setupRequired: true },
        { status: 503 },
      );
    }

    // Grounding: aggregate numbers only — no personal data or judge scores.
    const cc = await commandCenter(parsed.data.eventId);
    const context = {
      event: {
        name: cc.event.name,
        status: cc.event.status,
        startsAt: cc.event.startsAt,
        endsAt: cc.event.endsAt,
        submissionDeadline: cc.event.submissionDeadline,
        maxParticipants: cc.event.maxParticipants,
      },
      now: new Date().toISOString(),
      metrics: cc.metrics,
      alerts: cc.alerts.map((a) => ({ level: a.level, title: a.title, detail: a.detail })),
      milestones: cc.milestones,
      judgingProgressByJudge: cc.judges.map((j, i) => ({ judge: `Judge ${i + 1}`, done: j.done, total: j.total })),
    };
    const answer = await askOrganizerAssistant(parsed.data.question, context);
    await audit({
      actorId: user.id,
      eventId: parsed.data.eventId,
      action: "ai.assistant_query",
      entityType: "Event",
      entityId: parsed.data.eventId,
      metadata: { question: parsed.data.question.slice(0, 200), model: answer.model },
    });
    return NextResponse.json(answer);
  } catch (err) {
    return apiError(err);
  }
}
