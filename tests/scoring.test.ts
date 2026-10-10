import { describe, expect, it } from "vitest";
import { aggregate, rank, spread, weightedTotal } from "../src/lib/scoring";

const criteria = [
  { id: "idea", name: "Idea", weight: 2, maxScore: 10 },
  { id: "delivery", name: "Delivery", weight: 1, maxScore: 5 },
];

describe("weightedTotal", () => {
  it("normalises weighted criterion scores to 0–100", () => {
    expect(weightedTotal(criteria, { idea: 8, delivery: 3 })).toBe(73.3);
  });

  it("returns null for empty criteria, missing scores, NaN, or zero total weight", () => {
    expect(weightedTotal([], {})).toBeNull();
    expect(weightedTotal(criteria, { idea: 8 })).toBeNull();
    expect(weightedTotal(criteria, { idea: Number.NaN, delivery: 3 })).toBeNull();
    expect(weightedTotal([{ ...criteria[0]!, weight: 0 }], { idea: 7 })).toBeNull();
  });
});

describe("aggregate and spread", () => {
  it("supports mean, median, and trimmed mean without mutating its input", () => {
    const scores = [10, 30, 20, 100];
    expect(aggregate(scores, "MEAN")).toBe(40);
    expect(aggregate(scores, "MEDIAN")).toBe(25);
    expect(aggregate(scores, "TRIMMED_MEAN")).toBe(25);
    expect(aggregate([3, 9], "TRIMMED_MEAN")).toBe(6);
    expect(scores).toEqual([10, 30, 20, 100]);
  });

  it("returns null for empty aggregates and zero spread for fewer than two values", () => {
    expect(aggregate([], "MEAN")).toBeNull();
    expect(spread([])).toBe(0);
    expect(spread([4])).toBe(0);
    expect(spread([2.12, 7.36])).toBe(5.2);
  });
});

it("assigns standard competition ranks and preserves item data", () => {
  const items = [{ id: "a", score: 90 }, { id: "b", score: 90 }, { id: "c", score: 70 }];
  expect(rank(items)).toEqual([
    { id: "a", score: 90, rank: 1 },
    { id: "b", score: 90, rank: 1 },
    { id: "c", score: 70, rank: 3 },
  ]);
  expect(items[0]).toEqual({ id: "a", score: 90 });
});
