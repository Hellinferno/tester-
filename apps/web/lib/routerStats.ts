// Local "which model wins for which kind of question" table. Fed by the Router
// Compare bench (your "Best answer" picks) and read by the router's Decide stage
// so a cheap model that keeps winning gets promoted automatically — turning the
// "small models can handle hard questions" hypothesis into measured routing.
//
// Stored in localStorage only. Keyed model -> "subject|difficulty" -> tally.

import { getStored, setStored } from './settings';

export interface StatCell {
  runs: number;
  wins: number;
  totalMs: number;
  totalCost: number;
}

export type StatsTable = Record<string, Record<string, StatCell>>;

const STORAGE_KEY = 'or.router.stats';

// A cheaper model is trusted for a bucket once it clears this win rate over at
// least this many recorded runs.
export const WIN_RATE_THRESHOLD = 0.7;
export const MIN_RUNS = 3;

const bucketKey = (subject: string, difficulty: string) =>
  `${(subject || 'unknown').toLowerCase()}|${(difficulty || 'unknown').toLowerCase()}`;

export function loadStats(): StatsTable {
  return getStored<StatsTable>(STORAGE_KEY, {});
}

export function saveStats(t: StatsTable): void {
  setStored(STORAGE_KEY, t);
}

export function resetStats(): void {
  setStored(STORAGE_KEY, {});
}

/** Record one bench run for a model in a subject×difficulty bucket. `win` marks
 *  it as the user-picked best answer for that item. */
export function recordRun(
  model: string,
  subject: string,
  difficulty: string,
  data: { win: boolean; ms: number; cost: number },
  table?: StatsTable,
): StatsTable {
  const t = table || loadStats();
  const key = bucketKey(subject, difficulty);
  const byBucket = (t[model] = t[model] || {});
  const cell = (byBucket[key] = byBucket[key] || { runs: 0, wins: 0, totalMs: 0, totalCost: 0 });
  cell.runs += 1;
  if (data.win) cell.wins += 1;
  cell.totalMs += data.ms || 0;
  cell.totalCost += data.cost || 0;
  if (!table) saveStats(t);
  return t;
}

export function winRate(
  model: string,
  subject: string,
  difficulty: string,
  table?: StatsTable,
): { rate: number; runs: number; avgMs: number; avgCost: number } | null {
  const cell = (table || loadStats())[model]?.[bucketKey(subject, difficulty)];
  if (!cell || cell.runs === 0) return null;
  return { rate: cell.wins / cell.runs, runs: cell.runs, avgMs: cell.totalMs / cell.runs, avgCost: cell.totalCost / cell.runs };
}

/** Cheapest candidate whose measured win rate clears the threshold for this
 *  bucket, or null if none qualifies (caller falls back to the tier default).
 *  `costOf` returns a comparable price for a candidate (lower = cheaper). */
export function bestModelFor(
  subject: string,
  difficulty: string,
  candidates: string[],
  costOf: (model: string) => number,
  table?: StatsTable,
): { model: string; rate: number; runs: number } | null {
  const t = table || loadStats();
  const qualified = candidates
    .map((m) => ({ model: m, stat: winRate(m, subject, difficulty, t) }))
    .filter((x): x is { model: string; stat: NonNullable<ReturnType<typeof winRate>> } =>
      !!x.stat && x.stat.runs >= MIN_RUNS && x.stat.rate >= WIN_RATE_THRESHOLD,
    )
    .sort((a, b) => costOf(a.model) - costOf(b.model));
  if (!qualified.length) return null;
  const best = qualified[0];
  return { model: best.model, rate: best.stat.rate, runs: best.stat.runs };
}
