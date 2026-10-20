import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';
import { parseCss } from '../src/parse/css.js';
import type { Rule, RuleContext } from '../src/types.js';
import { fr304 } from '../src/rules/fr304.js';
import { ALL_RULES } from '../src/rules/registry.js';

function cssCtxOf(file: string, source: string): RuleContext {
  return { file, source, elems: [], css: parseCss(file, source), tokenColors: [] };
}

function cssFixture(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.css`);
  return { file, source: readFileSync(file, 'utf8') };
}

/** helpers.ts expectRule, adapted for .css fixtures — CSS-only rules parse no JSX. */
function expectCssRule(rule: Rule, id: string) {
  describe(`rule ${id}`, () => {
    it('passes on pass fixture', () => {
      const { file, source } = cssFixture(id, 'pass');
      expect(rule.check(cssCtxOf(file, source))).toEqual([]);
    });
    it('flags fail fixture', () => {
      const { file, source } = cssFixture(id, 'fail');
      const out = rule.check(cssCtxOf(file, source));
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.every((f) => f.rule === id && f.severity === rule.severity)).toBe(true);
      expect(out[0].loc.file).toBe(file);
    });
  });
}

expectCssRule(fr304, 'FR-304');

describe('FR-304 contrast', () => {
  it('flags the fail pair with the computed ratio at signal severity', () => {
    const { file, source } = cssFixture('FR-304', 'fail');
    const out = fr304.check(cssCtxOf(file, source));
    expect(fr304.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('contrast #999999 on #ffffff is 2.8:1 (< 4.5:1)');
    expect(out[0].hint).toBe('darken the text or lighten the background to reach AA 4.5:1');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('keeps the AA edge #767676 on white (4.54:1) passing', () => {
    const src = '.b { color: #767676; background-color: #ffffff }';
    expect(fr304.check(cssCtxOf('a.css', src))).toEqual([]);
  });

  it('reads background shorthand when the whole value is a color', () => {
    expect(fr304.check(cssCtxOf('a.css', '.a { color: #999999; background: #ffffff }')).length).toBe(1);
  });

  it('ignores background shorthand that is not purely a color', () => {
    const src = '.a { color: #999999; background: url(img.png) no-repeat #ffffff }';
    expect(fr304.check(cssCtxOf('a.css', src))).toEqual([]);
  });

  it('skips translucent text or backdrop (alpha < 1)', () => {
    expect(fr304.check(cssCtxOf('a.css', '.a { color: rgba(153,153,153,0.9); background-color: #ffffff }'))).toEqual([]);
    expect(fr304.check(cssCtxOf('a.css', '.a { color: #999999; background-color: rgba(255,255,255,0.8) }'))).toEqual([]);
    expect(fr304.check(cssCtxOf('a.css', '.a { color: #999999dd; background-color: #ffffff }'))).toEqual([]);
    expect(fr304.check(cssCtxOf('a.css', '.a { color: rgb(153 153 153 / 55%); background-color: #ffffff }'))).toEqual([]);
  });

  it('checks fully opaque alpha forms', () => {
    expect(fr304.check(cssCtxOf('a.css', '.a { color: rgba(153,153,153,1); background-color: #ffffff }')).length).toBe(1);
    expect(fr304.check(cssCtxOf('a.css', '.a { color: #999999ff; background-color: #ffffff }')).length).toBe(1);
  });

  it('pairs only within one selector, one finding per selector', () => {
    expect(fr304.check(cssCtxOf('a.css', '.a { color: #999999 }\n.b { background-color: #ffffff }'))).toEqual([]);
    const src = '.a { color: #999999; background-color: #ffffff; background: #ffffff }';
    expect(fr304.check(cssCtxOf('a.css', src)).length).toBe(1);
  });

  it('skips named colors and var() it cannot parse', () => {
    const src = '.a { color: gray; background-color: white }';
    expect(fr304.check(cssCtxOf('a.css', src))).toEqual([]);
  });

  it('loc points at the color declaration', () => {
    const src = '.a {\n  background-color: #ffffff;\n  color: #999999;\n}';
    const out = fr304.check(cssCtxOf('a.css', src));
    expect(out.length).toBe(1);
    expect(out[0].loc.line).toBe(3);
  });
});

describe('FR-304 registration', () => {
  it('is registered in ALL_RULES at rung 3', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-304' && r.rung === 3)).toBe(true);
  });
});
