import { describe, it, expect } from 'vitest';
import { GUIDANCE } from '../src/guidance.js';
import { ALL_RULES } from '../src/rules/registry.js';

describe('guidance table', () => {
  it('has an entry for every rule and no entry for a rule that does not exist (drift guard)', () => {
    expect(Object.keys(GUIDANCE).sort()).toEqual(ALL_RULES.map((r) => r.id).sort());
  });
  it('error-tier rules carry a fix recipe with something to avoid or an example', () => {
    for (const r of ALL_RULES.filter((x) => x.severity === 'error')) {
      const g = GUIDANCE[r.id];
      expect(g.recipe.length, r.id).toBeGreaterThan(20);
      expect(g.avoid || g.example, r.id).toBeTruthy();
    }
  });
});
