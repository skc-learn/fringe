import type { Rule } from '../types.js';
export const fr207: Rule = {
  id: 'FR-207', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/tabIndex=\{(\d+)\}/g)) {
        if (Number(m[1]) > 0)
          out.push({ rule: 'FR-207', severity: 'error' as const, message: `tabIndex=${m[1]} > 0 disrupts natural tab order`, hint: `use tabIndex={0} and place in DOM order`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  },
};
