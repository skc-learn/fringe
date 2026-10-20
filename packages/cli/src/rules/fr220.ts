import type { Rule } from '../types.js';

export const fr220: Rule = {
  id: 'FR-220', rung: 2, severity: 'review',
  check: (ctx) => ctx.elems
    .filter((e) => (e.tag === 'video' || e.tag === 'audio')
      && (e.attrs.autoPlay !== undefined || e.attrs.autoplay !== undefined)
      && e.attrs.muted === undefined)
    .map((e) => ({ rule: 'FR-220', severity: 'review' as const, message: `<${e.tag}> autoplays with sound`, hint: 'start muted (and offer controls), or wait for a user action; browsers block it anyway and it startles screen reader users', loc: e.loc, wcag: '1.4.2' })),
};
