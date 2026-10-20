import type { Rule } from '../types.js';
export const fr212: Rule = {
  id: 'FR-212', rung: 2, severity: 'review',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/no thanks[^<>\n]{0,50}(hate|don'?t (want|like|need)|prefer paying|pay full|miss out)/gi)) {
        out.push({ rule: 'FR-212', severity: 'review' as const, message: `decline option shames the user ('${m[0]}')`, hint: `make declining a neutral choice — no guilt-tripping copy`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  },
};
