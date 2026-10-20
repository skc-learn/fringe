import type { Rule } from '../types.js';
export const fr206: Rule = {
  id: 'FR-206', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems.filter((el) =>
      ['div', 'span'].includes(el.tag)
      && (el.attrs.onClick ?? el.attrs.onclick) !== undefined // JSX attrs keep their case; HTML attrs are lowercase
      && el.attrs.role === undefined
      && (el.attrs.tabIndex ?? el.attrs.tabindex) === undefined)) {
      out.push({ rule: 'FR-206', severity: 'error' as const, message: `onClick on non-interactive <${e.tag}>`, hint: `use a <button>/<a> or add role and tabIndex`, loc: e.loc, wcag: '2.1.1' });
    }
    return out;
  },
};
