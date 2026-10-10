import { describe, expect, it } from "vitest";
import {
  eventSchema,
  formToObject,
  resetPasswordSchema,
  signUpSchema,
  submissionSchema,
  zodFieldErrors,
} from "../src/lib/validation";

function validEventForm() {
  return {
    name: "Campus Hackathon",
    description: "A multi-day event for building and presenting new projects.",
    registrationOpensAt: "2030-01-01T09:00",
    registrationClosesAt: "2030-01-02T09:00",
    startsAt: "2030-02-01T09:00",
    endsAt: "2030-02-02T09:00",
    submissionDeadline: "2030-01-20T09:00",
    timeZone: "Asia/Kolkata",
    minTeamSize: "1",
    maxTeamSize: "4",
    tracks: JSON.stringify([{ name: "Climate" }]),
    criteria: JSON.stringify([{ name: "Impact", weight: "2", maxScore: "10" }]),
    registrationFields: "[]",
    rooms: "[]",
  };
}

describe("authentication schemas", () => {
  it("normalises sign-up name, email and optional fields", () => {
    expect(signUpSchema.parse({ name: "  Ada Lovelace ", email: " ADA@EXAMPLE.COM ", password: "longsecret", institution: " " }))
      .toMatchObject({ name: "Ada Lovelace", email: "ada@example.com", institution: undefined });
  });

  it("rejects invalid sign-up and mismatched reset credentials", () => {
    expect(signUpSchema.safeParse({ name: "A", email: "not-an-email", password: "short" }).success).toBe(false);
    const reset = resetPasswordSchema.safeParse({ token: "token", password: "longsecret", confirmPassword: "different" });
    expect(reset.success).toBe(false);
    if (!reset.success) expect(zodFieldErrors(reset.error).confirmPassword).toContain("Passwords do not match");
  });
});

describe("event and submission schemas", () => {
  it("parses valid event form JSON, coercing numeric values and applying defaults", () => {
    const parsed = eventSchema.parse(validEventForm());
    expect(parsed.name).toBe("Campus Hackathon");
    expect(parsed.minTeamSize).toBe(1);
    expect(parsed.scoringMethod).toBe("MEAN");
    expect(parsed.criteria[0]).toMatchObject({ name: "Impact", weight: 2, maxScore: 10 });
  });

  it("rejects reversed dates and case-insensitive duplicate tracks", () => {
    const reversedDates = validEventForm();
    reversedDates.endsAt = "2030-01-01T00:00";
    const invalidDates = eventSchema.safeParse(reversedDates);
    expect(invalidDates.success).toBe(false);
    if (!invalidDates.success) expect(zodFieldErrors(invalidDates.error).endsAt).toContain("Must be after the start");

    const duplicateTracks = validEventForm();
    duplicateTracks.tracks = JSON.stringify([{ name: "Climate" }, { name: "climate" }]);
    expect(eventSchema.safeParse(duplicateTracks).success).toBe(false);
  });

  it("interprets datetime-local fields in the selected event time zone", () => {
    const parsed = eventSchema.parse(validEventForm());
    expect(parsed.startsAt.toISOString()).toBe("2030-02-01T03:30:00.000Z");
    expect(parsed.timeZone).toBe("Asia/Kolkata");
  });

  it("deduplicates technologies and rejects unsafe or malformed URLs", () => {
    const input = {
      eventId: "event-1",
      title: "Resilient City",
      abstract: "A sufficiently detailed overview of this project and the problems it intends to solve.",
      technologies: " TypeScript, React, TypeScript, , React ",
      repoUrl: "https://example.com/project",
      intent: "submit",
    };
    const result = submissionSchema.parse(input);
    expect(result.technologies).toEqual(["TypeScript", "React"]);
    expect(submissionSchema.safeParse({ ...input, repoUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

it("converts string-valued FormData entries and ignores file values", () => {
  const formData = new FormData();
  formData.append("email", "first@example.com");
  formData.append("email", "last@example.com");
  formData.append("attachment", new File(["data"], "data.txt"));
  expect(formToObject(formData)).toEqual({ email: "last@example.com" });
});
