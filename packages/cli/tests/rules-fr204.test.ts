import { describe, it, expect } from 'vitest';
import { expectRule, fixture, ctxOf } from './helpers.js';
import { fr204 } from '../src/rules/fr204.js';

expectRule(fr204, 'FR-204');

// Brief extension: fail fixture must yield exactly 2 findings (h1->h3 skip + second h1).
describe('FR-204 exact findings', () => {
  it('flags exactly the h1->h3 skip and the second h1', () => {
    const { file, source } = fixture('FR-204', 'fail');
    const out = fr204.check(ctxOf(file, source));
    expect(out.length).toBe(2);
    expect(out[0].message).toBe('heading skips from h1 to h3');
    expect(out[1].message).toBe('multiple <h1> in file');
    expect(out.every((f) => f.loc.file === file)).toBe(true);
  });
});
