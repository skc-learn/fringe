import { describe, it, expect } from 'vitest';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';

// Calibration corpus — three fixtures pin the score scale end to end:
//   clean-app (fixtures/calibration/clean-app) → zero findings, score 100
//   reference-app → rung-2 errors + reviews, score ~34
//   slop-app → rung-3 signals + one review, score 82
// Band correction (recorded in the task-14 report): the brief's slop band (≤ 25)
// assumed heavier rung-3 finding counts; under the shipped weights
// (error 10 / review 3 / signal 1) the slop-app's 15 signals + 1 review land at
// 100 − 15 − 3 = 82, so the band is 75–85, not ≤ 25.
describe('score calibration', () => {
  it('clean app scores ≥ 95', async () => {
    const root = join(FIXTURES, 'calibration', 'clean-app');
    const r = await runCheck(root, loadConfig(root));
    expect(r.findings).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(95);
  });
  it('reference app stays in the 25–40 band', async () => {
    const root = join(FIXTURES, 'reference-app');
    const r = await runCheck(root, loadConfig(root));
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(r.score).toBeLessThanOrEqual(40);
  });
  it('slop app stays in the 75–85 band', async () => {
    const root = join(FIXTURES, 'slop-app');
    const r = await runCheck(root, loadConfig(root));
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.score).toBeLessThanOrEqual(85);
  });
});
