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

import { PATTERNS, patternRuleIds, knownRule } from '../src/patterns.js';
import { runCli } from '../src/index.js';
describe('patterns', () => {
  it('only name rules that exist, and mix verified with judged items', () => {
    for (const id of patternRuleIds()) expect(knownRule(id), id).toBe(true);
    for (const p of Object.values(PATTERNS)) expect(p.items.some((i) => !i.rules), p.title).toBe(true);
  });
  it('explain pattern prints a checklist, lists patterns, rejects unknown names', async () => {
    const out: string[] = [];
    expect(await runCli(['explain', 'pattern', 'form'], { log: (s) => out.push(s) })).toBe(0);
    expect(out.join('\n')).toMatch(/\[verified: FR-203\][\s\S]*\[judged\]/);
    const list: string[] = [];
    await runCli(['explain', 'pattern'], { log: (s) => list.push(s) });
    expect(list.join('\n')).toContain('modal');
    expect(await runCli(['explain', 'pattern', 'nope'], { log: () => {}, err: () => {} })).toBe(2);
  });
});
