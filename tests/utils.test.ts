import { describe, expect, it } from "vitest";
import { jsonObject, jsonStringArray, randomCode, slugify, toCsv } from "../src/lib/utils";

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and correctly quotes CSV values", () => {
    expect(
      toCsv([
        { name: "Ada, Lovelace", note: 'line one\nsaid "hello"', formula: "=1+1", plus: "+cmd", minus: "-cmd", at: "@cmd" },
      ]),
    ).toBe('name,note,formula,plus,minus,at\n"Ada, Lovelace","line one\nsaid ""hello""",\'=1+1,\'+cmd,\'-cmd,\'@cmd');
  });

  it("handles empty rows and null values", () => {
    expect(toCsv([])).toBe("");
    expect(toCsv([{ present: null, missing: undefined, zero: 0 }])).toBe("present,missing,zero\n,,0");
  });
});

describe("slugify", () => {
  it("normalises case, diacritics, separators and surrounding punctuation", () => {
    expect(slugify("  Café & AI — 2026!  ")).toBe("cafe-ai-2026");
    expect(slugify("Already---slugged")).toBe("already-slugged");
  });

  it("limits output to 60 characters and returns an empty string for non-ASCII-only input", () => {
    expect(slugify("a".repeat(80))).toHaveLength(60);
    expect(slugify("東京")).toBe("");
  });
});

describe("randomCode", () => {
  it("returns the requested number of characters from the unambiguous alphabet", () => {
    const alphabet = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]*$/;
    expect(randomCode()).toMatch(alphabet);
    expect(randomCode()).toHaveLength(8);
    expect(randomCode(24)).toHaveLength(24);
    expect(randomCode(24)).toMatch(alphabet);
    expect(randomCode(0)).toBe("");
  });
});

it("filters JSON array values to strings", () => {
  expect(jsonStringArray(["a", 1, null, "b"])).toEqual(["a", "b"]);
  expect(jsonStringArray({ key: "value" })).toEqual([]);
});

it("accepts JSON objects and safely rejects non-object JSON values", () => {
  expect(jsonObject({ answer: "yes", optedIn: true })).toEqual({ answer: "yes", optedIn: true });
  expect(jsonObject(null)).toEqual({});
  expect(jsonObject(["not", "an", "object"])).toEqual({});
  expect(jsonObject("not an object")).toEqual({});
});
