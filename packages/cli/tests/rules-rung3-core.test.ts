import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ctxOf } from './helpers.js';
import { parseCss } from '../src/parse/css.js';
import type { Rule, RuleContext } from '../src/types.js';
import { fr304 } from '../src/rules/fr304.js';
import { fr301 } from '../src/rules/fr301.js';
import { ALL_RULES } from '../src/rules/registry.js';

function cssCtxOf(file: string, source: string): RuleContext {
  return { file, source, elems: [], css: parseCss(file, source), tokenColors: [] };
}

function cssFixture(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.css`);
  return { file, source: readFileSync(file, 'utf8') };
}

/** ctxOf with a non-empty token source — token-aware rules read ctx.tokenColors.length. */
function ctxWithTokens(file: string, source: string, tokenColors: string[]): RuleContext {
  return { ...ctxOf(file, source), tokenColors };
}

/** helpers.ts expectRule, adapted to run with a declared token source. */
function expectTokenRule(rule: Rule, id: string) {
  describe(`rule ${id}`, () => {
    it('passes on pass fixture', () => {
      const { file, source } = fixtureOf(id, 'pass');
      expect(rule.check(ctxWithTokens(file, source, ['#0b5fff']))).toEqual([]);
    });
    it('flags fail fixture', () => {
      const { file, source } = fixtureOf(id, 'fail');
      const out = rule.check(ctxWithTokens(file, source, ['#0b5fff']));
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.every((f) => f.rule === id && f.severity === rule.severity)).toBe(true);
      expect(out[0].loc.file).toBe(file);
    });
  });
}

function fixtureOf(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.tsx`);
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

expectTokenRule(fr301, 'FR-301');

describe('FR-301 token adoption', () => {
  it('flags the fail fixture with exactly one file-level finding at signal severity', () => {
    const { file, source } = fixtureOf('FR-301', 'fail');
    const out = fr301.check(ctxWithTokens(file, source, ['#0b5fff']));
    expect(fr301.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-301');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('4 hardcoded colors vs 0 token uses in this file');
    expect(out[0].hint).toBe('use design tokens / Tailwind palette instead of raw hex (tokenSource: 1 colors found)');
    expect(out[0].loc).toEqual({ file, line: 1, col: 0 });
  });

  it('does not trip at exactly 3 hardcoded colors', () => {
    const src = 'export default () => <div className="bg-[#0b5fff] text-[#333333] border-[#e5e7eb]">x</div>;';
    expect(fr301.check(ctxWithTokens('a.tsx', src, []))).toEqual([]);
  });

  it('does not trip when token uses meet or beat hardcoded', () => {
    const src = 'export default () => <div className="bg-[#0b5fff] text-[#333333] border-[#e5e7eb] ring-[#e5e7eb]"><p className="text-slate-900 bg-slate-50 border-slate-200 text-rose-500">ok</p></div>;';
    expect(fr301.check(ctxWithTokens('a.tsx', src, ['#0b5fff']))).toEqual([]);
  });

  it('counts CSS color-ish declarations parseColor accepts', () => {
    const src = 'export default () => <div className="bg-[#111111] text-[#222222] border-[#333333] ring-[#444444]">x</div>;';
    const css = parseCss('a.css', '.a { color: #333333; background: #ffffff; border-color: #eeeeee }');
    const ctx = { ...ctxWithTokens('a.tsx', src, []), css };
    const out = fr301.check(ctx);
    expect(out.length).toBe(1);
    expect(out[0].message).toBe('7 hardcoded colors vs 0 token uses in this file');
  });

  it('ignores CSS decls whose value is not a pure color', () => {
    const src = 'export default () => <div className="bg-[#111111] text-[#222222] border-[#333333]">x</div>;';
    const css = parseCss('a.css', '.a { border: 1px solid #eee; color: gray }');
    const ctx = { ...ctxWithTokens('a.tsx', src, []), css };
    expect(fr301.check(ctx)).toEqual([]);
  });

  it('counts var(--) occurrences as token uses', () => {
    const src = 'export default () => <div className="bg-[#111111] text-[#222222] border-[#333333] ring-[#444444]" style={{ color: "var(--fg)", background: "var(--bg)", borderColor: "var(--bd)", outlineColor: "var(--ol)" }}>x</div>;';
    expect(fr301.check(ctxWithTokens('a.tsx', src, ['#111111']))).toEqual([]);
  });

  it('hint reports the tokenSource count', () => {
    const src = 'export default () => <div className="bg-[#111111] text-[#222222] border-[#333333] ring-[#444444]">x</div>;';
    const out = fr301.check(ctxWithTokens('a.tsx', src, ['#111111', '#222222']));
    expect(out[0].hint).toBe('use design tokens / Tailwind palette instead of raw hex (tokenSource: 2 colors found)');
  });
});

describe('FR-301 registration', () => {
  it('is registered in ALL_RULES at rung 3', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-301' && r.rung === 3)).toBe(true);
  });
});
