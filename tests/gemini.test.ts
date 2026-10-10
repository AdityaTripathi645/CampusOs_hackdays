import { afterEach, describe, expect, it } from "vitest";
import {
  assistantOutputSchema,
  demoScreen,
  geminiRequestErrorMessage,
  getGeminiStatus,
  screenSubmission,
  screeningOutputSchema,
  type ScreeningInput,
} from "../src/services/gemini";

const screeningInput: ScreeningInput = {
  eventName: "Campus Hackathon",
  title: "Urban Heat Map",
  abstract: "We build a climate dashboard that combines local temperature readings with urban tree cover.",
  technologies: ["TypeScript", "mapping"],
  declaredTrack: null,
  repoUrl: null,
  demoUrl: null,
  tracks: [{ name: "Climate Action", description: "Climate and sustainability projects" }],
  criteria: [{ name: "Impact", description: "Expected environmental impact" }],
  files: [{ fileName: "pitch.pdf", mimeType: "application/pdf", slides: [{ slide: 1, text: "A city climate map", notes: "Tree cover" }] }],
};

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

describe("Gemini status and demo mode", () => {
  it("uses the default model when no key is configured and trims configured values", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    expect(getGeminiStatus()).toEqual({ configured: false, model: "gemini-3.8-flash" });
    process.env.GEMINI_API_KEY = " key ";
    process.env.GEMINI_MODEL = " model ";
    expect(getGeminiStatus()).toEqual({ configured: true, model: "model" });
  });

  it("returns a labeled deterministic heuristic result with evidence and missing-info markers", () => {
    const result = demoScreen(screeningInput);
    expect(result.summary).toContain("[Demo heuristic — not an AI summary]");
    expect(result.suggestedTrack).toBe("Climate Action");
    expect(result.observations).toMatchObject([{ criterion: "Impact", signal: "neutral" }]);
    expect(result.evidence).toContainEqual({ source: "file:pitch.pdf#slide-1", quote: "A city climate map" });
    expect(result.missingInfo).toContain("Repository link not provided");
    expect(result.missingInfo).toContain("Demo link not provided");
    expect(result.missingInfo).toContain("Abstract is short; problem, solution and impact may be under-specified");
  });

  it("uses demo mode rather than making a model request when no key is configured", async () => {
    process.env.GEMINI_API_KEY = "";
    const result = await screenSubmission(screeningInput);
    expect(result.mode).toBe("DEMO");
    expect(result.model).toBe("demo-heuristic");
    expect(result.raw).toBeNull();
  });

  it("turns provider status codes into actionable errors without exposing provider details", () => {
    expect(geminiRequestErrorMessage({ status: 401 }, "gemini-2.5-flash")).toContain("valid Google AI Studio Gemini API key");
    expect(geminiRequestErrorMessage({ status: 400 }, "gemini-2.5-flash")).toContain("valid Google AI Studio key");
    expect(geminiRequestErrorMessage({ status: 404 }, "bad-model")).toContain('Gemini model "bad-model" is unavailable');
    expect(geminiRequestErrorMessage({ status: 429 }, "gemini-2.5-flash")).toContain("quota or rate limit");
    expect(geminiRequestErrorMessage({ status: 503 }, "gemini-2.5-flash")).toContain("temporarily unavailable");
    expect(geminiRequestErrorMessage(new TypeError("fetch failed"), "gemini-2.5-flash")).toContain("network access");
  });
});

describe("Gemini response schemas", () => {
  it("accepts bounded screening data and rejects out-of-range or malformed fields", () => {
    const valid = {
      summary: "A concise, neutral project summary.",
      suggestedTrack: "Climate Action",
      trackFitScore: 75,
      trackFitRationale: "The project focuses on urban climate data.",
      observations: [{ criterion: "Impact", observation: "Tree cover is measured.", signal: "strength" }],
      missingInfo: [],
      evidence: [{ source: "abstract", quote: "local temperature readings" }],
      extracted: { problem: null, solution: "A climate dashboard", targetUsers: null, technologies: ["TypeScript"] },
    };
    expect(screeningOutputSchema.safeParse(valid).success).toBe(true);
    expect(screeningOutputSchema.safeParse({ ...valid, trackFitScore: 101 }).success).toBe(false);
    expect(screeningOutputSchema.safeParse({ ...valid, observations: [{ ...valid.observations[0], signal: "guess" }] }).success).toBe(false);
  });

  it("defaults assistant actions and enforces answer bounds", () => {
    expect(assistantOutputSchema.parse({ answer: "Review the event schedule." })).toEqual({
      answer: "Review the event schedule.",
      suggestedActions: [],
    });
    expect(assistantOutputSchema.safeParse({ answer: "" }).success).toBe(false);
  });
});
