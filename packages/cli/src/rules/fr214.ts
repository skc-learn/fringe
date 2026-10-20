import type { Rule } from '../types.js';
export const fr214: Rule = {
  id: 'FR-214', rung: 2, severity: 'review',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(free|\$0)[^<>\n]{0,30}(then|after|later)[^<>\n]{0,30}\$\d+/gi)) {
        out.push({ rule: 'FR-214', severity: 'review' as const, message: `price framed as free but a cost follows ('${m[0]}')`, hint: `show the full price up front — drip pricing erodes trust`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  },
};
