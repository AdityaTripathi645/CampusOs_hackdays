/**
 * Pure scoring helpers (no DB access) so they can be unit-tested and reused
 * by judging, FairJudge and results.
 */

export type Criterion = { id: string; name: string; weight: number; maxScore: number };
export type ScoreMap = Record<string, number>;

/** Weighted score normalised to 0–100. Returns null if any criterion is missing. */
export function weightedTotal(criteria: Criterion[], scores: ScoreMap): number | null {
  if (criteria.length === 0) return null;
  let weighted = 0;
  let weights = 0;
  for (const c of criteria) {
    const s = scores[c.id];
    if (typeof s !== "number" || Number.isNaN(s)) return null;
    weighted += c.weight * (s / c.maxScore);
    weights += c.weight;
  }
  return weights === 0 ? null : Math.round((weighted / weights) * 1000) / 10;
}

export type Method = "MEAN" | "MEDIAN" | "TRIMMED_MEAN";

export function aggregate(values: number[], method: Method): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  let out: number;
  switch (method) {
    case "MEDIAN": {
      const mid = Math.floor(sorted.length / 2);
      out = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
      break;
    }
    case "TRIMMED_MEAN":
      // Drop the single highest and lowest score when at least 3 judges scored.
      out = sorted.length >= 3 ? mean(sorted.slice(1, -1)) : mean(sorted);
      break;
    default:
      out = mean(sorted);
  }
  return Math.round(out * 100) / 100;
}

export function spread(values: number[]): number {
  if (values.length < 2) return 0;
  return Math.round((Math.max(...values) - Math.min(...values)) * 10) / 10;
}

export const METHOD_LABEL: Record<Method, string> = {
  MEAN: "Mean of judge scores",
  MEDIAN: "Median of judge scores",
  TRIMMED_MEAN: "Trimmed mean (drops highest & lowest when ≥3 judges)",
};

/** Standard competition ranking (1, 2, 2, 4). */
export function rank<T extends { score: number }>(items: T[]): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((item, i) => {
    const r = lastScore !== null && item.score === lastScore ? lastRank : i + 1;
    lastScore = item.score;
    lastRank = r;
    return { ...item, rank: r };
  });
}
