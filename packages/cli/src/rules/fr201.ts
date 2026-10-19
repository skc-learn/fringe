import type { Rule } from '../types.js';
export const fr201: Rule = {
  id: 'FR-201', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems
    .filter((e) => e.tag === 'img' && e.attrs.alt === undefined)
    .map((e) => ({ rule: 'FR-201', severity: 'error' as const, message: `<img> missing alt text`, hint: `add alt="description" (or alt="" if decorative)`, loc: e.loc })),
};
