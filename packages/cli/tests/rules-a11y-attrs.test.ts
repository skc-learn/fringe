import { describe, it, expect } from 'vitest';
import { expectRule, ctxOf } from './helpers.js';
import { fr201 } from '../src/rules/fr201.js';
import { fr202 } from '../src/rules/fr202.js';
import { fr203 } from '../src/rules/fr203.js';
import { fr209 } from '../src/rules/fr209.js';
expectRule(fr201, 'FR-201');
expectRule(fr202, 'FR-202');
expectRule(fr203, 'FR-203');
expectRule(fr209, 'FR-209');

describe('review fixes', () => {
  it('FR-209 accepts aria-activedescendant', () => {
    expect(fr209.check(ctxOf('inline.tsx', 'export default () => <div aria-activedescendant="x" />;'))).toEqual([]);
  });
  it('FR-203 does not treat htmlFor="email2" as a label for id="email"', () => {
    const src = 'export default () => (<><label htmlFor="email2">Email</label><input id="email" type="text" /></>);';
    const out = fr203.check(ctxOf('inline.tsx', src));
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].rule).toBe('FR-203');
  });
});
