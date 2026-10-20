import { describe, it, expect } from 'vitest';
import { expectRule, ctxOf, fixture } from './helpers.js';
import { fr210 } from '../src/rules/fr210.js';
import { fr211 } from '../src/rules/fr211.js';
import { fr212 } from '../src/rules/fr212.js';
import { fr213 } from '../src/rules/fr213.js';
import { fr214 } from '../src/rules/fr214.js';
import { ALL_RULES } from '../src/rules/registry.js';

expectRule(fr210, 'FR-210');
expectRule(fr211, 'FR-211');
expectRule(fr212, 'FR-212');
expectRule(fr213, 'FR-213');
expectRule(fr214, 'FR-214');

describe('dark-pattern rules use severity review', () => {
  it.each([
    [fr210, 'FR-210'],
    [fr211, 'FR-211'],
    [fr212, 'FR-212'],
    [fr213, 'FR-213'],
    [fr214, 'FR-214'],
  ])('%s flags fail fixture with severity review', (rule, id) => {
    const { file, source } = fixture(id, 'fail');
    const out = rule.check(ctxOf(file, source));
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.every((f) => f.severity === 'review')).toBe(true);
  });
});

describe('FR-210 countdown urgency', () => {
  it('flags urgency wording followed by mm:ss countdown', () => {
    const out = fr210.check(ctxOf('a.tsx', 'const s = <p>Offer ends soon — 09:59 left</p>;'));
    expect(out.length).toBe(1);
    expect(out[0].loc.line).toBe(1);
  });
  it('passes when no clock-like time follows', () => {
    expect(fr210.check(ctxOf('a.tsx', 'const s = <p>Hurry, limited seats</p>;'))).toEqual([]);
  });
  it('reports the matching line', () => {
    const src = 'const a = 1;\nconst s = <b>ending soon in 00:10</b>;\nconst c = 3;';
    const out = fr210.check(ctxOf('a.tsx', src));
    expect(out.length).toBe(1);
    expect(out[0].loc.line).toBe(2);
  });
});

describe('FR-211 prechecked consent', () => {
  it('flags defaultChecked with consent keyword elsewhere in source', () => {
    const src = 'const label = "I agree to the terms";\nconst box = <input type="checkbox" defaultChecked id="mk" />;';
    const out = fr211.check(ctxOf('a.tsx', src));
    expect(out.length).toBe(1);
    expect(out[0].loc.line).toBe(2);
  });
  it('passes when checkbox is unchecked', () => {
    expect(fr211.check(ctxOf('a.tsx', 'const box = <input type="checkbox" id="consent-email" />;'))).toEqual([]);
  });
  it('passes when defaultChecked has no consent context', () => {
    expect(fr211.check(ctxOf('a.tsx', 'const box = <input type="checkbox" defaultChecked id="remember" />;'))).toEqual([]);
  });
});

describe('FR-212 confirm-shaming', () => {
  it('flags guilt-tripping decline copy', () => {
    const out = fr212.check(ctxOf('a.tsx', 'const d = <button>No thanks, I prefer paying full price</button>;'));
    expect(out.length).toBe(1);
  });
  it('passes on a plain decline button', () => {
    expect(fr212.check(ctxOf('a.tsx', 'const d = <button>No thanks</button>;'))).toEqual([]);
  });
});

describe('FR-213 infinite scroll without opt-out', () => {
  it('flags IntersectionObserver with no load-more control', () => {
    const out = fr213.check(ctxOf('a.tsx', 'const io = new IntersectionObserver(loadNext);'));
    expect(out.length).toBe(1);
    expect(out[0].loc.line).toBe(1);
  });
  it('passes when a load-more opt-out exists elsewhere', () => {
    const src = 'const io = new IntersectionObserver(loadNext);\nconst b = <button onClick={x}>Show more</button>;';
    expect(fr213.check(ctxOf('a.tsx', src))).toEqual([]);
  });
  it('passes on plain load-more button', () => {
    expect(fr213.check(ctxOf('a.tsx', 'const b = <button>Load more</button>;'))).toEqual([]);
  });
});

describe('FR-214 drip pricing', () => {
  it('flags $0 now then paid later', () => {
    const out = fr214.check(ctxOf('a.tsx', 'const s = <p>$0 for 30 days, later $5/mo</p>;'));
    expect(out.length).toBe(1);
  });
  it('passes on an honest price', () => {
    expect(fr214.check(ctxOf('a.tsx', 'const s = <p>$9/mo</p>;'))).toEqual([]);
  });
});

describe('dark-pattern registration', () => {
  it('registers all five rules in ID order', () => {
    const ids = ALL_RULES.map((r) => r.id);
    for (const id of ['FR-210', 'FR-211', 'FR-212', 'FR-213', 'FR-214']) {
      expect(ids).toContain(id);
    }
    // relative order, not registry position — rung 3 rules are appended after these
    const rel = ['FR-210', 'FR-211', 'FR-212', 'FR-213', 'FR-214'].map((id) => ids.indexOf(id));
    expect(rel.every((i) => i >= 0)).toBe(true);
    expect([...rel].sort((a, b) => a - b)).toEqual(rel);
  });
});
