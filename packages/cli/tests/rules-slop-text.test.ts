import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES, ctxOf, expectRule } from './helpers.js';
import { parseCss } from '../src/parse/css.js';
import type { Rule, RuleContext } from '../src/types.js';
import { fr367 } from '../src/rules/fr367.js';
import { fr368 } from '../src/rules/fr368.js';
import { fr369 } from '../src/rules/fr369.js';
import { ALL_RULES } from '../src/rules/registry.js';

function cssCtxOf(file: string, source: string): RuleContext {
  return { file, source, elems: [], css: parseCss(file, source), tokenColors: [] };
}

function cssFixture(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.css`);
  return { file, source: readFileSync(file, 'utf8') };
}

function fixtureOf(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.tsx`);
  return { file, source: readFileSync(file, 'utf8') };
}

expectRule(fr367, 'FR-367');

describe('FR-367 numbered section labels', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const { file, source } = fixtureOf('FR-367', 'fail');
    const out = fr367.check(ctxOf(file, source));
    expect(fr367.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-367');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('numbered section label ("01 Discover" style)');
    expect(out[0].hint).toBe('let hierarchy come from typography, not index numbers');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('also flags text-sm labels and honors plain class attributes', () => {
    expect(fr367.check(ctxOf('a.tsx', 'export default () => <span className="text-sm">2 Approach</span>;')).length).toBe(1);
    expect(fr367.check(ctxOf('a.tsx', 'export default () => <span class="text-xs">03 Process</span>;')).length).toBe(1);
  });

  it('leaves larger text sizes and bare ordinals alone', () => {
    expect(fr367.check(ctxOf('a.tsx', 'export default () => <span className="text-base">01 Discover</span>;'))).toEqual([]);
    expect(fr367.check(ctxOf('a.tsx', 'export default () => <span className="text-xs">01</span>;'))).toEqual([]);
    expect(fr367.check(ctxOf('a.tsx', 'export default () => <span className="text-xs">Section 01</span>;'))).toEqual([]);
  });
});

expectRule(fr368, 'FR-368');

describe('FR-368 purple AI gradient (className leg)', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const { file, source } = fixtureOf('FR-368', 'fail');
    const out = fr368.check(ctxOf(file, source));
    expect(fr368.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-368');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('the purple AI gradient');
    expect(out[0].hint).toBe("pick a palette that isn't the LLM default");
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('requires both the gradient utility and a purple from- stop', () => {
    expect(fr368.check(ctxOf('a.tsx', 'export default () => <div className="from-violet-600">x</div>;'))).toEqual([]);
    expect(fr368.check(ctxOf('a.tsx', 'export default () => <div className="bg-gradient-to-r from-emerald-500 to-indigo-500">x</div>;'))).toEqual([]);
  });

  it('flags every purple family and direction', () => {
    for (const cls of [
      'bg-gradient-to-r from-violet-600 to-indigo-500',
      'bg-gradient-to-b from-purple-500',
      'bg-gradient-to-br from-indigo-400',
      'bg-gradient-to-l from-fuchsia-700',
    ]) {
      expect(fr368.check(ctxOf('a.tsx', `export default () => <div className="${cls}">x</div>;`)).length).toBe(1);
    }
  });
});

describe('FR-368 purple AI gradient (CSS leg)', () => {
  it('passes on pass fixture', () => {
    const { file, source } = cssFixture('FR-368', 'pass');
    expect(fr368.check(cssCtxOf(file, source))).toEqual([]);
  });

  it('flags the fail fixture at the gradient declaration', () => {
    const { file, source } = cssFixture('FR-368', 'fail');
    const out = fr368.check(cssCtxOf(file, source));
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-368');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('the purple AI gradient');
    expect(out[0].hint).toBe("pick a palette that isn't the LLM default");
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('flags background-image gradients and any of the purple hexes, case-insensitively', () => {
    expect(fr368.check(cssCtxOf('a.css', '.a { background-image: linear-gradient(90deg, #A78BFA, #C084FC) }')).length).toBe(1);
    expect(fr368.check(cssCtxOf('a.css', '.a { background: linear-gradient(90deg, #7c3aed, #9333ea, #818cf8) }')).length).toBe(1);
  });

  it('leaves non-gradient backgrounds and non-background props alone', () => {
    expect(fr368.check(cssCtxOf('a.css', '.a { background: #8b5cf6 }'))).toEqual([]);
    expect(fr368.check(cssCtxOf('a.css', '.a { color: #8b5cf6 }'))).toEqual([]);
    expect(fr368.check(cssCtxOf('a.css', '.a { background: linear-gradient(90deg, #10b981, #14b8a6) }'))).toEqual([]);
  });
});

expectRule(fr369, 'FR-369');

describe('FR-369 emoji in headings', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const { file, source } = fixtureOf('FR-369', 'fail');
    const out = fr369.check(ctxOf(file, source));
    expect(fr369.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-369');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('emoji in heading');
    expect(out[0].hint).toBe('emoji in headings read as template output; use typography instead');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
  });

  it('flags emoji anywhere in any h1–h6', () => {
    expect(fr369.check(ctxOf('a.tsx', 'export default () => <h1>⚡ Fast</h1>;')).length).toBe(1);
    expect(fr369.check(ctxOf('a.tsx', 'export default () => <h6>Ship it 🚀 now</h6>;')).length).toBe(1);
  });

  it('leaves non-headings and emoji-free headings alone', () => {
    expect(fr369.check(ctxOf('a.tsx', 'export default () => <p>🚀 Shipping</p>;'))).toEqual([]);
    expect(fr369.check(ctxOf('a.tsx', 'export default () => <h2>Shipping</h2>;'))).toEqual([]);
  });
});

describe('FR-367/368/369 registration', () => {
  it('registers all three rules in ALL_RULES at rung 3', () => {
    for (const id of ['FR-367', 'FR-368', 'FR-369']) {
      expect(ALL_RULES.some((r) => r.id === id && r.rung === 3)).toBe(true);
    }
  });
});
