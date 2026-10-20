import type { Rule } from '../types.js';
const NAME_ATTRS = ['aria-label', 'aria-labelledby', 'title'];
export const fr202: Rule = {
  id: 'FR-202', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems
    .filter((e) => ['button', 'a'].includes(e.tag) && e.attrs['aria-hidden'] !== 'true')
    .filter((e) => !e.text && !NAME_ATTRS.some((a) => e.attrs[a]))
    .map((e) => ({ rule: 'FR-202', severity: 'error' as const, message: `<${e.tag}> has no accessible name`, hint: `add text content or aria-label`, loc: e.loc, wcag: '4.1.2' })),
};
