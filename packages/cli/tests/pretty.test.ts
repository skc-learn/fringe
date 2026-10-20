import { describe, it, expect } from 'vitest';
import { toPretty } from '../src/report/pretty.js';
import type { CheckResult } from '../src/types.js';

const R: CheckResult = {
  stack: { jsx: true, tailwind: false, vue: false, svelte: false, html: false },
  files: 3, skipped: [],
  findings: [
    { rule: 'FR-208', severity: 'review', message: 'no states', hint: 'add', loc: { file: 'B.tsx', line: 2, col: 0 } },
    { rule: 'FR-201', severity: 'error', message: 'img alt', hint: 'add alt', loc: { file: 'A.tsx', line: 1, col: 0 } },
  ],
  counts: { error: 1, review: 1, signal: 0 }, score: 86,
};
describe('toPretty', () => {
  it('orders errors first and includes ids, loc, score', () => {
    const s = toPretty(R);
    expect(s.indexOf('FR-201')).toBeLessThan(s.indexOf('FR-208'));
    expect(s).toContain('A.tsx:1');
    expect(s).toContain('health 86/100');
    expect(s).toContain('1 errors · 1 review · 0 signals');
  });
});
