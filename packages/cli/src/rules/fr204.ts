import type { Rule } from '../types.js';
export const fr204: Rule = {
  id: 'FR-204', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    let prev = 0; let seenH1 = false;
    for (const e of ctx.elems.filter((el) => /^h[1-6]$/.test(el.tag))) {
      const lvl = Number(e.tag[1]);
      if (lvl === 1 && seenH1) out.push({ rule: 'FR-204', severity: 'error' as const, message: `multiple <h1> in file`, hint: `use one h1 per page`, loc: e.loc });
      if (lvl === 1) seenH1 = true;
      if (prev && lvl > prev + 1) out.push({ rule: 'FR-204', severity: 'error' as const, message: `heading skips from h${prev} to h${lvl}`, hint: `don't skip heading levels for visual size`, loc: e.loc });
      if (!prev || lvl <= prev + 1) prev = lvl;
    }
    return out;
  },
};
