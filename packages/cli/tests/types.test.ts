import { describe, it, expect } from 'vitest';
import { SEVERITIES } from '../src/types.js';
import type { Finding } from '../src/types.js';

describe('types', () => {
  it('exports the three severities', () => {
    expect(SEVERITIES).toEqual(['error', 'review', 'signal']);
  });
  it('Finding shape compiles', () => {
    const f: Finding = { rule: 'FR-201', severity: 'error', message: 'm', hint: 'h', loc: { file: 'a.tsx', line: 1, col: 0 } };
    expect(f.rule).toBe('FR-201');
  });
});
