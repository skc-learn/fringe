import type { Rule } from '../types.js';
// JSX form (whitespace-tolerant) and HTML attribute form (positive integers only).
const JSX_FORM = /tabIndex=\{\s*(\d+)\s*\}/g;
const HTML_FORM = /tabindex=["']([1-9]\d*)["']/gi;
export const fr207: Rule = {
  id: 'FR-207', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(JSX_FORM)) {
        if (Number(m[1]) > 0)
          out.push({ rule: 'FR-207', severity: 'error' as const, message: `tabIndex=${m[1]} > 0 disrupts natural tab order`, hint: `use tabIndex={0} and place in DOM order`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
      for (const m of line.matchAll(HTML_FORM)) {
        out.push({ rule: 'FR-207', severity: 'error' as const, message: `tabIndex=${m[1]} > 0 disrupts natural tab order`, hint: `use tabIndex={0} and place in DOM order`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  },
};
