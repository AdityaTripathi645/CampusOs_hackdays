"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Send, Sparkles, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/inputs";

/** Re-fetches server data every 30 s while the tab is visible. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [last, setLast] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setLast(new Date());
      }
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <button
      type="button"
      onClick={() => {
        router.refresh();
        setLast(new Date());
      }}
      className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-line hover:ring-ink-300"
    >
      <span className="size-2 rounded-full bg-emerald-500 animate-pulse-dot" />
      Live · updated{" "}
      <span suppressHydrationWarning>{last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <RefreshCw className="size-3" />
    </button>
  );
}

type Answer = { answer: string; suggestedActions: string[]; model: string };

export function AssistantPanel({ eventId, configured }: { eventId: string; configured: boolean }) {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const ask = async (q: string) => {
    if (q.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, question: q }),
      });
      const data = (await res.json()) as Answer & { error?: string };
      if (!res.ok) setError(data.error ?? "Request failed");
      else setAnswer(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!configured)
    return (
      <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50/50 p-4 text-sm text-orange-900">
        <p className="flex items-center gap-2 font-semibold">
          <FlaskConical className="size-4" /> Assistant needs Gemini
        </p>
        <p className="mt-1 text-orange-900/80">
          Set <code className="font-mono">GEMINI_API_KEY</code> in <code className="font-mono">.env</code> and restart the server. The
          assistant does not run in demo mode — it won&apos;t invent answers.
        </p>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {["What should I focus on in the next hour?", "Are we ready to publish results?", "Summarise check-in status"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              void ask(s);
            }}
            className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Ask about this event's live operations…"
          className="min-h-0"
        />
        <Button type="submit" size="icon" variant="brand" disabled={loading || question.trim().length < 3} aria-label="Ask">
          {loading ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {answer && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-sm">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            <Sparkles className="size-3.5" /> AI suggestion · {answer.model}
          </p>
          <p className="whitespace-pre-line leading-relaxed text-ink-800">{answer.answer}</p>
          {answer.suggestedActions.length > 0 && (
            <ul className="mt-3 space-y-1">
              {answer.suggestedActions.map((a, i) => (
                <li key={i} className="flex gap-2 text-ink-700">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-violet-500" /> {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
