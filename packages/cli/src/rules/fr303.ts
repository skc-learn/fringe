import type { Rule } from '../types.js';

/** Tailwind arbitrary spacing/dimension utilities, e.g. p-[13px], w-[111px] — values off the scale. */
const ARBITRARY_SPACE = /\b(?:p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|gap|w|h)-\[[^\]]+\]/g;

/** FR-303 off-scale spacing/dimensions — one signal per arbitrary value on an element. */
export const fr303: Rule = {
  id: 'FR-303', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      for (const m of cls.matchAll(ARBITRARY_SPACE))
        out.push({
          rule: 'FR-303', severity: 'signal' as const,
          message: `spacing/dimension off the scale: ${m[0]}`,
          hint: `use spacing scale utilities (1 unit = 0.25rem) or extend the theme`,
          loc: e.loc,
        });
    }
    return out;
  },
};
