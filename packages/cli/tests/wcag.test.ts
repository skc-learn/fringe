import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ctxOf, fixture } from './helpers.js';
import { parseCss } from '../src/parse/css.js';
import type { Rule, RuleContext } from '../src/types.js';
import { fr201 } from '../src/rules/fr201.js';
import { fr202 } from '../src/rules/fr202.js';
import { fr203 } from '../src/rules/fr203.js';
import { fr204 } from '../src/rules/fr204.js';
import { fr205 } from '../src/rules/fr205.js';
import { fr206 } from '../src/rules/fr206.js';
import { fr207 } from '../src/rules/fr207.js';
import { fr208 } from '../src/rules/fr208.js';
import { fr209 } from '../src/rules/fr209.js';
import { fr304 } from '../src/rules/fr304.js';
import { fr305 } from '../src/rules/fr305.js';
import { fr369 } from '../src/rules/fr369.js';

/** WCAG 2.1 criterion tags — the exact map from the task brief. */
const TAGGED: Array<[Rule, string]> = [
  [fr201, '1.1.1'],
  [fr202, '4.1.2'],
  [fr203, '3.3.2'],
  [fr204, '1.3.1'],
  [fr205, '2.4.7'],
  [fr206, '2.1.1'],
  [fr207, '2.4.3'],
  [fr209, '4.1.2'],
  [fr304, '1.4.3'],
  [fr305, '2.5.8'],
];

function cssCtxOf(file: string, source: string): RuleContext {
  return { file, source, elems: [], css: parseCss(file, source), tokenColors: [] };
}

describe('WCAG criterion tags', () => {
  for (const [rule, criterion] of TAGGED) {
    it(`${rule.id} findings are tagged '${criterion}'`, () => {
      const isCss = rule.id === 'FR-304';
      const file = join(FIXTURES, 'rules', rule.id, `fail.${isCss ? 'css' : 'tsx'}`);
      const source = readFileSync(file, 'utf8');
      const ctx = isCss ? cssCtxOf(file, source) : ctxOf(file, source);
      const out = rule.check(ctx);
      expect(out.length).toBeGreaterThanOrEqual(1);
      for (const f of out) expect(f.wcag).toBe(criterion);
    });
  }

  for (const rule of [fr208, fr369]) {
    it(`${rule.id} findings leave wcag undefined`, () => {
      const { file, source } = fixture(rule.id, 'fail');
      const out = rule.check(ctxOf(file, source));
      expect(out.length).toBeGreaterThanOrEqual(1);
      for (const f of out) expect(f.wcag).toBeUndefined();
    });
  }
});
