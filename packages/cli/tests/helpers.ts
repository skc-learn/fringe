import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseJsx } from '../src/parse/jsx.js';
import type { Rule, RuleContext } from '../src/types.js';

export const FIXTURES = fileURLToPath(new URL('../../../fixtures', import.meta.url));

export function ctxOf(file: string, source: string): RuleContext {
  try { return { file, source, elems: parseJsx(file, source), css: [] }; }
  catch { return { file, source, elems: [], css: [] }; }
}

export function fixture(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.tsx`);
  return { file, source: readFileSync(file, 'utf8') };
}

export function expectRule(rule: Rule, id: string) {
  describe(`rule ${id}`, () => {
    it('passes on pass fixture', () => {
      const { file, source } = fixture(id, 'pass');
      expect(rule.check(ctxOf(file, source))).toEqual([]);
    });
    it('flags fail fixture', () => {
      const { file, source } = fixture(id, 'fail');
      const out = rule.check(ctxOf(file, source));
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.every((f) => f.rule === id && f.severity === rule.severity)).toBe(true);
      expect(out[0].loc.file).toBe(file);
    });
  });
}
