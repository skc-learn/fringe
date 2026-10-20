import { describe, it, expect } from 'vitest';
import { ctxOf, expectRule } from './helpers.js';
import { fr361 } from '../src/rules/fr361.js';
import { fr362 } from '../src/rules/fr362.js';
import { fr365 } from '../src/rules/fr365.js';
import { ALL_RULES } from '../src/rules/registry.js';

expectRule(fr361, 'FR-361');

describe('FR-361 italic serif display type', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const out = fr361.check(ctxOf('a.tsx', 'export default () => <h1 className="text-4xl italic font-serif">Title</h1>;'));
    expect(fr361.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-361');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('italic serif display type — the AI-tell headline');
    expect(out[0].hint).toBe('choose a display treatment that isn\'t italic serif');
    expect(out[0].loc.file).toBe('a.tsx');
    expect(out[0].loc.line).toBe(1);
  });

  it('flags every display size with italic serif', () => {
    for (const size of ['text-3xl', 'text-4xl', 'text-5xl', 'text-6xl']) {
      expect(fr361.check(ctxOf('a.tsx', `export default () => <h1 className="${size} italic font-serif">T</h1>;`)).length).toBe(1);
    }
  });

  it('requires italic, serif, and display size together', () => {
    expect(fr361.check(ctxOf('a.tsx', 'export default () => <h1 className="text-4xl font-serif">T</h1>;'))).toEqual([]);
    expect(fr361.check(ctxOf('a.tsx', 'export default () => <h1 className="text-4xl italic font-sans">T</h1>;'))).toEqual([]);
    expect(fr361.check(ctxOf('a.tsx', 'export default () => <h1 className="text-lg italic font-serif">T</h1>;'))).toEqual([]);
  });
});

expectRule(fr362, 'FR-362');

describe('FR-362 hero eyebrow chip', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const out = fr362.check(ctxOf('a.tsx', 'export default () => <span className="text-xs uppercase tracking-widest rounded-full bg-slate-100 px-3">Introducing v2</span>;'));
    expect(fr362.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-362');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('hero eyebrow chip');
    expect(out[0].hint).toBe('eyebrow chips above headings are a template tell; integrate context into the heading');
    expect(out[0].loc.file).toBe('a.tsx');
    expect(out[0].loc.line).toBe(1);
  });

  it('accepts wider tracking and honors plain class attributes', () => {
    expect(fr362.check(ctxOf('a.tsx', 'export default () => <span className="text-xs uppercase tracking-wider rounded-full">New</span>;')).length).toBe(1);
    expect(fr362.check(ctxOf('a.tsx', 'export default () => <span class="uppercase tracking-widest rounded-full">New</span>;')).length).toBe(1);
  });

  it('requires uppercase, tracking, and pill shape together on short text', () => {
    expect(fr362.check(ctxOf('a.tsx', 'export default () => <span className="text-xs uppercase">Docs</span>;'))).toEqual([]);
    expect(fr362.check(ctxOf('a.tsx', 'export default () => <span className="uppercase tracking-widest rounded-none">Introducing v2</span>;'))).toEqual([]);
    expect(fr362.check(ctxOf('a.tsx', 'export default () => <span className="uppercase rounded-full">Introducing v2</span>;'))).toEqual([]);
    expect(fr362.check(ctxOf('a.tsx', `export default () => <span className="uppercase tracking-widest rounded-full">${'x'.repeat(41)}</span>;`))).toEqual([]);
  });
});

expectRule(fr365, 'FR-365');

describe('FR-365 thin border with wide shadow', () => {
  it('flags the fail fixture with exactly one finding at signal severity', () => {
    const out = fr365.check(ctxOf('a.tsx', 'export default () => <div className="border shadow-2xl p-6 rounded-xl">x</div>;'));
    expect(fr365.severity).toBe('signal');
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-365');
    expect(out[0].severity).toBe('signal');
    expect(out[0].message).toBe('thin border with wide shadow');
    expect(out[0].hint).toBe('pair elevation with weight: heavier border or tighter shadow');
    expect(out[0].loc.file).toBe('a.tsx');
    expect(out[0].loc.line).toBe(1);
  });

  it('accepts border-2/border-4 weights and shadow-xl', () => {
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="border-2 shadow-2xl">x</div>;')).length).toBe(1);
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="border-4 shadow-xl">x</div>;')).length).toBe(1);
  });

  it('does not flag border-0 — it removes the border rather than thinning it', () => {
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="border-0 shadow-xl">x</div>;'))).toEqual([]);
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="shadow-2xl border-0">x</div>;'))).toEqual([]);
  });

  it('requires the border utility as its own token and a wide shadow', () => {
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="border shadow-sm">x</div>;'))).toEqual([]);
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="shadow-2xl">x</div>;'))).toEqual([]);
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="divide-y shadow-2xl">x</div>;'))).toEqual([]);
    expect(fr365.check(ctxOf('a.tsx', 'export default () => <div className="borderless shadow-2xl">x</div>;'))).toEqual([]);
  });
});

describe('FR-361/362/365 registration', () => {
  it('registers all three rules in ALL_RULES at rung 3', () => {
    for (const id of ['FR-361', 'FR-362', 'FR-365']) {
      expect(ALL_RULES.some((r) => r.id === id && r.rung === 3)).toBe(true);
    }
  });
});
