import type { Rule } from '../types.js';

const FILLER = /\blorem ipsum\b|\b(TODO|FIXME|TBD)\b|\[(insert|your)[^\]]*\]/i;

export const fr222: Rule = {
  id: 'FR-222', rung: 3, severity: 'signal',
  check: (ctx) => ctx.elems
    .filter((e) => FILLER.test(e.text) || FILLER.test(e.attrs.placeholder ?? '') || FILLER.test(e.attrs['aria-label'] ?? ''))
    .map((e) => ({ rule: 'FR-222', severity: 'signal' as const, message: 'placeholder or unfinished text in the UI', hint: 'replace lorem ipsum / TODO / [insert ...] with real copy before shipping', loc: e.loc })),
};
