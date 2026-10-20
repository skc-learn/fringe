import type { Counts, FringeConfig } from './types.js';

const BASELINE_FILES = 10; // repos under this size are scored as-is; bigger ones are scaled down to it
const KNEE = 75;           // past this penalty the score decays smoothly instead of hitting 0

/** Health 0–100. Penalty is per-10-files so size doesn't flatten big repos; past the knee it decays, never pins at 0. */
export function score(counts: Counts, weights: FringeConfig['weights'], files = BASELINE_FILES): number {
  const raw = counts.error * weights.error + counts.review * weights.review + counts.signal * weights.signal;
  const penalty = raw * BASELINE_FILES / Math.max(files, BASELINE_FILES);
  return Math.round(penalty <= KNEE ? 100 - penalty : (100 - KNEE) * KNEE / penalty);
}
