import type { Rule } from '../types.js';
export const fr210: Rule = {
  id: 'FR-210', rung: 2, severity: 'review',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(hurry|expires?|offer ends|ending soon)[^<>\n]{0,60}\d{1,2}:\d{2}/gi)) {
        out.push({ rule: 'FR-210', severity: 'review' as const, message: `urgency wording paired with a countdown ('${m[0]}') pressures rushed decisions`, hint: `avoid manufactured urgency — state the plain expiry instead of a ticking clock`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  },
};
