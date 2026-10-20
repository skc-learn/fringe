import { describe, it, expect } from 'vitest';
import { expectRule, ctxOf, fixture } from './helpers.js';
import { fr208 } from '../src/rules/fr208.js';
import { ALL_RULES } from '../src/rules/registry.js';

expectRule(fr208, 'FR-208');

describe('FR-208 severity', () => {
  it('flags fail fixture with severity review', () => {
    const { file, source } = fixture('FR-208', 'fail');
    const out = fr208.check(ctxOf(file, source));
    expect(out.length).toBe(1);
    expect(out[0].severity).toBe('review');
  });
});

describe('FR-208 heuristic cases', () => {
  it('passes when no fetch marker is present', () => {
    const src = 'export default () => <List items={items} />;';
    expect(fr208.check(ctxOf('a.tsx', src))).toEqual([]);
  });

  it('passes when fetch is paired with loading and error states', () => {
    const src = "const { data, isPending, isError } = useQuery(['u'], fetchUser);";
    expect(fr208.check(ctxOf('a.tsx', src))).toEqual([]);
  });

  it('flags axios fetch without state handling', () => {
    const out = fr208.check(ctxOf('a.tsx', 'const data = axios.get(url);'));
    expect(out.length).toBe(1);
    expect(out[0].message).toContain('loading/empty/error');
  });

  it('fires at most one finding', () => {
    const src = 'useQuery(a); useQuery(b); fetch(x);';
    expect(fr208.check(ctxOf('a.tsx', src)).length).toBe(1);
  });
});

describe('FR-208 registration', () => {
  it('is registered in ALL_RULES', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-208')).toBe(true);
  });
});
