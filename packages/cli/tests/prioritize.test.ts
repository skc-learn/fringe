import { describe, it, expect } from 'vitest';
import { prioritize } from '../src/prioritize.js';
import type { Finding } from '../src/types.js';

const f = (rule: string, severity: Finding['severity'], file: string, wcag?: string): Finding =>
  ({ rule, severity, message: 'm', hint: 'h', loc: { file: `/p/${file}`, line: 1, col: 0 }, ...(wcag ? { wcag } : {}) });
const run = (findings: Finding[], sources: Record<string, string> = {}, critical: string[] = []) =>
  prioritize(findings, new Map(Object.entries(sources).map(([k, v]) => [`/p/${k}`, v])), '/p', critical);
const pri = (r: ReturnType<typeof run>, i: number) => r.findings[i].priority!;

describe('prioritize', () => {
  it('tier first: an error outranks a review even when the review is critical, shared and WCAG-tagged', () => {
    const importers = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`u${i}.tsx`, `import X from './review'`]));
    const r = run([f('FR-203', 'error', 'plain.tsx'), f('FR-208', 'review', 'review.tsx', '1.1.1')], importers, ['review.tsx']);
    expect(pri(r, 0)).toBeGreaterThan(pri(r, 1));
  });
  it('WCAG A outranks AA, and a critical path raises priority', () => {
    const r = run([f('FR-201', 'error', 'a.tsx', '1.1.1'), f('FR-205', 'error', 'b.tsx', '2.4.7')]);
    expect(pri(r, 0)).toBeGreaterThan(pri(r, 1));
    const c = run([f('FR-205', 'error', 'checkout/b.tsx', '2.4.7')], {}, ['checkout/**']);
    expect(pri(c, 0)).toBeGreaterThan(pri(run([f('FR-205', 'error', 'checkout/b.tsx', '2.4.7')]), 0));
  });
  it('a file imported by many others ranks higher and its cluster is a shared component', () => {
    const users = Object.fromEntries(['a', 'b', 'c', 'd'].map((n) => [`${n}.tsx`, `import { Input } from './ui/Input'`]));
    const r = run([f('FR-203', 'error', 'ui/Input.tsx', '3.3.2'), f('FR-203', 'error', 'lonely.tsx', '3.3.2')], users);
    expect(pri(r, 0)).toBeGreaterThan(pri(r, 1));
    expect(r.clusters[0]).toMatchObject({ file: 'ui/Input.tsx', rootCause: 'shared component' });
    expect(r.clusters.find((c) => c.file === 'lonely.tsx')!.rootCause).toBe('local');
  });
  it('groups the same rule in the same file into one cluster, sorted by priority', () => {
    const r = run([f('FR-203', 'error', 'a.tsx'), f('FR-203', 'error', 'a.tsx'), f('FR-203', 'error', 'a.tsx'), f('FR-301', 'signal', 'a.tsx')]);
    expect(r.clusters.map((c) => [c.rule, c.count])).toEqual([['FR-203', 3], ['FR-301', 1]]);
    expect(new Set(r.findings.slice(0, 3).map((x) => x.cluster)).size).toBe(1);
  });
  it('repetition lifts a cluster but never across a tier', () => {
    const many = Array.from({ length: 500 }, () => f('FR-301', 'signal', 'a.tsx'));
    const r = run([...many, f('FR-208', 'review', 'b.tsx')]);
    const sig = r.clusters.find((c) => c.rule === 'FR-301')!, rev = r.clusters.find((c) => c.rule === 'FR-208')!;
    expect(rev.priority).toBeGreaterThan(sig.priority);
  });
});
