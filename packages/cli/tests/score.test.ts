import { describe, it, expect } from 'vitest';
import { score } from '../src/score.js';
describe('score', () => {
  it('100 when clean', () => expect(score({ error: 0, review: 0, signal: 0 }, { error: 10, review: 3, signal: 1 })).toBe(100));
  it('weights and floors at 0', () => {
    expect(score({ error: 2, review: 3, signal: 4 }, { error: 10, review: 3, signal: 1 })).toBe(100 - 20 - 9 - 4);
  });
  it('big repos are scaled per 10 files and never pin at 0', () => {
    const w = { error: 10, review: 3, signal: 1 };
    expect(score({ error: 1, review: 0, signal: 0 }, w, 100)).toBe(99);
    const a = score({ error: 282, review: 6, signal: 4 }, w, 279);
    const b = score({ error: 1489, review: 13, signal: 351 }, w, 991);
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(0); expect(a).not.toBe(b);
    expect(score({ error: 20, review: 0, signal: 0 }, w)).toBeLessThan(score({ error: 8, review: 0, signal: 0 }, w));
  });
});
