import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ctxOf, expectRule } from './helpers.js';
import { parseCss } from '../src/parse/css.js';
import type { Rule, RuleContext } from '../src/types.js';
import { fr304 } from '../src/rules/fr304.js';
import { fr301 } from '../src/rules/fr301.js';
import { fr302 } from '../src/rules/fr302.js';
import { fr303 } from '../src/rules/fr303.js';
import { fr305 } from '../src/rules/fr305.js';
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

expectRule(fr302, 'FR-302');

describe('FR-302 off-scale font size', () => {
  it('flags the fail fixture naming the matched utility at signal severity', () => {
    const { file, source } = fixtureOf('FR-302', 'fail');
    const out = fr302.check(ctxOf(file, source));
    expect(fr302.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-302');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('font size off the type scale: text-[17px]');
    expect(out[0].hint).toBe('use the type scale (text-xs..text-6xl) or extend the theme');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('passes on type-scale sizes', () => {
    const src = 'export default () => <p className="text-xs sm:text-lg xl:text-2xl">Hi</p>;';
    expect(fr302.check(ctxOf('a.tsx', src))).toEqual([]);
  });

  it('emits one finding per arbitrary size on the element', () => {
    const src = 'export default () => <p className="text-[17px] md:text-[1.5rem]">Hi</p>;';
    const out = fr302.check(ctxOf('a.tsx', src));
    expect(out.length).toBe(2);
    expect(out[0].message).toBe('font size off the type scale: text-[17px]');
    expect(out[1].message).toBe('font size off the type scale: text-[1.5rem]');
  });

  it('honors plain class attributes too', () => {
    const out = fr302.check(ctxOf('a.tsx', 'export default () => <p class="text-[17px]">Hi</p>;'));
    expect(out.length).toBe(1);
    expect(out[0].message).toBe('font size off the type scale: text-[17px]');
  });
});

expectRule(fr303, 'FR-303');

describe('FR-303 off-scale spacing/dimensions', () => {
  it('flags each matched utility on the fail fixture at signal severity', () => {
    const { file, source } = fixtureOf('FR-303', 'fail');
    const out = fr303.check(ctxOf(file, source));
    expect(fr303.severity).toBe('signal');
    expect(out.length).toBe(2);
    expect(out.every((f) => f.rule === 'FR-303' && f.severity === 'signal')).toBe(true);
    expect(out[0].message).toBe('spacing/dimension off the scale: p-[13px]');
    expect(out[1].message).toBe('spacing/dimension off the scale: gap-[9px]');
    expect(out[0].hint).toBe('use spacing scale utilities (1 unit = 0.25rem) or extend the theme');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('passes on scale utilities', () => {
    const src = 'export default () => <div className="p-4 px-2 pt-1 mt-8 mx-auto gap-2 w-full h-screen">x</div>;';
    expect(fr303.check(ctxOf('a.tsx', src))).toEqual([]);
  });

  it('reports the longest utility name, not a prefix (px-[5px] stays px-[5px])', () => {
    const src = 'export default () => <div className="px-[5px] mt-[3px] w-[111px] h-[42px]">x</div>;';
    const out = fr303.check(ctxOf('a.tsx', src));
    expect(out.map((f) => f.message)).toEqual([
      'spacing/dimension off the scale: px-[5px]',
      'spacing/dimension off the scale: mt-[3px]',
      'spacing/dimension off the scale: w-[111px]',
      'spacing/dimension off the scale: h-[42px]',
    ]);
  });

  it('leaves arbitrary font sizes to FR-302', () => {
    expect(fr303.check(ctxOf('a.tsx', 'export default () => <p className="text-[17px]">Hi</p>;'))).toEqual([]);
  });
});

describe('FR-302/303 registration', () => {
  it('registers both rules in ALL_RULES at rung 3', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-302' && r.rung === 3)).toBe(true);
    expect(ALL_RULES.some((r) => r.id === 'FR-303' && r.rung === 3)).toBe(true);
  });
});

expectRule(fr305, 'FR-305');

describe('FR-305 hit areas', () => {
  it('flags the fail fixture with one finding at signal severity', () => {
    const { file, source } = fixtureOf('FR-305', 'fail');
    const out = fr305.check(ctxOf(file, source));
    expect(fr305.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-305');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('tiny hit area: text-xs interactive element without adequate padding');
    expect(out[0].hint).toBe('add py-2+ padding or a larger text size (WCAG 2.5.8 target size)');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('accepts py-2, p-10 and plain class attributes', () => {
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <button className="text-xs py-2">ok</button>;'))).toEqual([]);
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <a className="text-xs p-10" href="/x">x</a>;'))).toEqual([]);
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <a class="text-xs py-3" href="/x">x</a>;'))).toEqual([]);
  });

  it('still flags padding below the threshold (p-1, py-0)', () => {
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <button className="text-xs p-1">a</button>;')).length).toBe(1);
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <button className="text-xs py-0">a</button>;')).length).toBe(1);
  });

  it('ignores text-xs on non-interactive elements and larger text sizes on links', () => {
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <p className="text-xs">fine</p>;'))).toEqual([]);
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <a className="text-sm" href="/x">x</a>;'))).toEqual([]);
  });

  it('does not confuse px-2 or unrelated prefixes with vertical padding', () => {
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <a className="text-xs px-2" href="/x">x</a>;')).length).toBe(1);
  });

  it('does not treat text-xsl or similar as text-xs', () => {
    expect(fr305.check(ctxOf('a.tsx', 'export default () => <a className="text-xsl" href="/x">x</a>;'))).toEqual([]);
  });
});

describe('FR-305 registration', () => {
  it('is registered in ALL_RULES at rung 3', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-305' && r.rung === 3)).toBe(true);
  });
});
