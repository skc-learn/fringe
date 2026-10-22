import { describe, it, expect } from 'vitest';
import { GUIDANCE, knownRule } from '../src/guidance.js';
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

import { PATTERNS, patternRuleIds } from '../src/patterns.js';
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

describe('more playbooks', () => {
  it('lists twenty-two, and marks runtime-checked items as verified by scan', async () => {
    const list: string[] = [];
    await runCli(['explain', 'pattern'], { log: (s) => list.push(s) });
    expect(list.join('\n').split('\n').map((l) => l.split(/\s+/)[0]).sort()).toEqual(['accordion', 'auth', 'carousel', 'chat', 'checkout', 'dashboard', 'data-view', 'datepicker', 'drag-and-drop', 'empty-state', 'form', 'modal', 'navigation', 'onboarding', 'pricing', 'rich-text', 'search', 'settings', 'table', 'tabs', 'toast', 'upload']);
    const table: string[] = [];
    await runCli(['explain', 'pattern', 'table'], { log: (s) => table.push(s) });
    expect(table.join('\n')).toContain('[verified by scan: FR-404]');
    expect(table.join('\n')).toContain('[verified: FR-208, FR-215]');
    const checkout: string[] = [];
    await runCli(['explain', 'pattern', 'checkout'], { log: (s) => checkout.push(s) });
    expect(checkout.join('\n')).toMatch(/\[verified: FR-214\]/);
  });
});

import { sourcesOf } from '../src/patterns.js';
describe('playbook sources', () => {
  it('cite standards pages (https, w3.org or whatwg.org) and print them', async () => {
    for (const name of Object.keys(PATTERNS)) for (const u of sourcesOf(name)) expect(u, name).toMatch(/^https:\/\/(www\.w3\.org|html\.spec\.whatwg\.org)\//);
    expect(sourcesOf('tabs')[0]).toContain('/patterns/tabs/');
    const out: string[] = [];
    await runCli(['explain', 'pattern', 'datepicker'], { log: (s) => out.push(s) });
    expect(out.join('\n')).toMatch(/Based on: https:\/\/www\.w3\.org\/WAI\/ARIA\/apg\/patterns\/dialog-modal\/examples\/datepicker-dialog\//);
    expect(out.join('\n')).toContain('returns focus to the button that opened it');
  });
});
