import { describe, it, expect } from 'vitest';
import { ctxOf, expectRule } from './helpers.js';
import { fr363 } from '../src/rules/fr363.js';
import { fr364 } from '../src/rules/fr364.js';
import { fr366 } from '../src/rules/fr366.js';
import { ALL_RULES } from '../src/rules/registry.js';

expectRule(fr363, 'FR-363');

describe('FR-363 card inside a card', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const out = fr363.check(ctxOf('a.tsx', 'export default () => <div className="rounded-xl border p-4"><div className="rounded-lg border p-2">x</div></div>;'));
    expect(fr363.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-363');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('card inside a card');
    expect(out[0].hint).toBe('one containment level: let whitespace, not boxes, group content');
    expect(out[0].loc.file).toBe('a.tsx');
    expect(out[0].loc.line).toBe(1);
  });

  it('accepts cardish parents with plain rounded children', () => {
    expect(fr363.check(ctxOf('a.tsx', 'export default () => <div className="rounded-xl border p-4"><p className="rounded-lg p-2">x</p></div>;'))).toEqual([]);
  });

  it('accepts any cardish signal on both levels — shadow or background instead of border', () => {
    expect(fr363.check(ctxOf('a.tsx', 'export default () => <div className="rounded-xl shadow-lg p-4"><div className="rounded-2xl bg-slate-50 p-2">x</div></div>;')).length).toBe(1);
  });

  it('requires both the element and its parent to be cardish', () => {
    expect(fr363.check(ctxOf('a.tsx', 'export default () => <div className="rounded-xl border p-4"><div className="rounded-lg p-2">x</div></div>;'))).toEqual([]);
    expect(fr363.check(ctxOf('a.tsx', 'export default () => <div className="p-4"><div className="rounded-lg border p-2">x</div></div>;'))).toEqual([]);
    expect(fr363.check(ctxOf('a.tsx', 'export default () => <div className="rounded-md border p-4"><div className="rounded-lg border p-2">x</div></div>;'))).toEqual([]);
  });

  it('does not flag a top-level card without a cardish ancestor', () => {
    expect(fr363.check(ctxOf('a.tsx', 'export default () => <div className="rounded-xl border p-4">x</div>;'))).toEqual([]);
  });
});

expectRule(fr364, 'FR-364');

describe('FR-364 icon-tile stack', () => {
  it('flags the fail fixture with exactly one file-level finding at signal severity', () => {
    const source = 'export default () => <>' + Array.from({ length: 3 }, () => '<div className="rounded-xl bg-slate-100 p-4 flex items-center justify-center"></div>').join('') + '</>;';
    const out = fr364.check(ctxOf('a.tsx', source));
    expect(fr364.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-364');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('icon-tile stack (3 tiles)');
    expect(out[0].hint).toBe('rows of icon tiles with verb labels are a landing-page tell');
    expect(out[0].loc.file).toBe('a.tsx');
    expect(out[0].loc.line).toBe(1);
    expect(out[0].loc.col).toBe(0);
  });

  it('stays quiet below the threshold of three empty tiles', () => {
    expect(fr364.check(ctxOf('a.tsx', 'export default () => <div className="rounded-xl bg-slate-100 p-4 flex items-center justify-center"></div>;'))).toEqual([]);
    expect(fr364.check(ctxOf('a.tsx', 'export default () => <><div className="rounded-xl bg-slate-100 p-4 flex"></div><div className="rounded-xl bg-slate-100 p-4 flex"></div></>;'))).toEqual([]);
  });

  it('counts only tiles that are rounded, filled, flex, and empty of text', () => {
    // two empty tiles + one with text -> not a stack of three
    expect(fr364.check(ctxOf('a.tsx', 'export default () => <><div className="rounded-xl bg-slate-100 p-4 flex"></div><div className="rounded-xl bg-slate-100 p-4 flex"></div><div className="rounded-xl bg-slate-100 p-4 flex">Deploy</div></>;'))).toEqual([]);
    // missing bg-, flex, or rounded-lg+ -> not tiles
    expect(fr364.check(ctxOf('a.tsx', 'export default () => <><div className="rounded-xl p-4 flex"></div><div className="rounded-xl bg-slate-100 p-4"></div><div className="rounded bg-slate-100 p-4 flex"></div></>;'))).toEqual([]);
  });
});

expectRule(fr366, 'FR-366');

describe('FR-366 status-chip soup', () => {
  it('flags the fail fixture with exactly one file-level finding at signal severity', () => {
    const source = 'export default () => <>' + Array.from({ length: 5 }, (_, i) => `<span className="rounded-full px-2 text-xs">chip${i}</span>`).join('') + '</>;';
    const out = fr366.check(ctxOf('a.tsx', source));
    expect(fr366.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-366');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('status-chip soup (5 chips)');
    expect(out[0].hint).toBe('chips everywhere dilute meaning; reserve them for state');
    expect(out[0].loc.file).toBe('a.tsx');
    expect(out[0].loc.line).toBe(1);
    expect(out[0].loc.col).toBe(0);
  });

  it('stays quiet below the threshold of five chips', () => {
    const source = 'export default () => <>' + Array.from({ length: 4 }, (_, i) => `<span className="rounded-full px-2 text-xs">chip${i}</span>`).join('') + '</>;';
    expect(fr366.check(ctxOf('a.tsx', source))).toEqual([]);
  });

  it('counts only pills with chip sizing and non-empty text', () => {
    // empty-text pill and unsized pill do not count: only 4 real chips
    const source = 'export default () => <>' + Array.from({ length: 4 }, (_, i) => `<span className="rounded-full px-2 text-xs">chip${i}</span>`).join('') + '<span className="rounded-full px-2 text-xs"></span><span className="rounded-full px-3 py-1">plain pill</span></>;';
    expect(fr366.check(ctxOf('a.tsx', source))).toEqual([]);
  });

  it('accepts px-2.5 and text-xs alone as chip sizing', () => {
    const base = 'export default () => <>' + Array.from({ length: 4 }, () => `<span className="rounded-full px-2.5">x</span>`).join('') + '<span className="rounded-full text-xs">y</span></>;';
    expect(fr366.check(ctxOf('a.tsx', base)).length).toBe(1);
  });
});

describe('FR-363/364/366 registration', () => {
  it('registers all three rules in ALL_RULES at rung 3', () => {
    for (const id of ['FR-363', 'FR-364', 'FR-366']) {
      expect(ALL_RULES.some((r) => r.id === id && r.rung === 3)).toBe(true);
    }
  });
});
