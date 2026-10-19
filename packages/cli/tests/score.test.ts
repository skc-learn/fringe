import { describe, it, expect } from 'vitest';
import { score } from '../src/score.js';
describe('score', () => {
  it('100 when clean', () => expect(score({ error: 0, review: 0, signal: 0 }, { error: 10, review: 3, signal: 1 })).toBe(100));
  it('weights and floors at 0', () => {
    expect(score({ error: 2, review: 3, signal: 4 }, { error: 10, review: 3, signal: 1 })).toBe(100 - 20 - 9 - 4);
    expect(score({ error: 20, review: 0, signal: 0 }, { error: 10, review: 3, signal: 1 })).toBe(0);
  });
});
