import type { Rule } from '../types.js';
export const fr203: Rule = {
  id: 'FR-203', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems
    .filter((e) => e.tag === 'input' && e.attrs.type !== 'hidden')
    .filter((e) => {
      const labeled = e.attrs['aria-label'] || e.attrs['aria-labelledby'] ||
        (e.attrs.id && new RegExp(`(htmlFor|for)=["'\`{]${e.attrs.id}`).test(ctx.source));
      return !labeled;
    })
    .map((e) => ({ rule: 'FR-203', severity: 'error' as const, message: `input not associated with a label`, hint: `add id + <label htmlFor>, or aria-label`, loc: e.loc })),
};
