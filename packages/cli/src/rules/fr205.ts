import type { Rule } from '../types.js';
export const fr205: Rule = {
  id: 'FR-205', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (/\boutline-(none|0)\b/.test(cls) && !cls.includes('focus-visible:'))
        out.push({ rule: 'FR-205', severity: 'error' as const, message: `outline removed without focus-visible alternative`, hint: `add focus-visible:outline-* or a custom focus ring`, loc: e.loc, wcag: '2.4.7' });
    }
    for (const d of ctx.css) {
      if (d.prop === 'outline' && /^(none|0)/.test(d.value) && !d.selector.includes(':focus-visible') && !ctx.source.includes(':focus-visible'))
        out.push({ rule: 'FR-205', severity: 'error' as const, message: `outline: none without :focus-visible alternative`, hint: `add a :focus-visible rule with visible outline`, loc: d.loc, wcag: '2.4.7' });
    }
    return out;
  },
};
