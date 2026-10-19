import type { Counts, FringeConfig } from './types.js';
export function score(counts: Counts, weights: FringeConfig['weights']): number {
  return Math.max(0, 100 - counts.error * weights.error - counts.review * weights.review - counts.signal * weights.signal);
}
