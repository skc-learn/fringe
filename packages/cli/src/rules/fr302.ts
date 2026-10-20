import type { Rule } from '../types.js';

/** Tailwind arbitrary font-size utilities, e.g. text-[17px] — sizes off the type scale. */
const ARBITRARY_SIZE = /\btext-\[[^\]]+\]/g;

/** FR-302 off-scale font sizes — one signal per arbitrary text size on an element. */
export const fr302: Rule = {
  id: 'FR-302', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      for (const m of cls.matchAll(ARBITRARY_SIZE))
        out.push({
          rule: 'FR-302', severity: 'signal' as const,
          message: `font size off the type scale: ${m[0]}`,
          hint: `use the type scale (text-xs..text-6xl) or extend the theme`,
          loc: e.loc,
        });
    }
    return out;
  },
};
