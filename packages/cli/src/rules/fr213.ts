import type { Rule } from '../types.js';

const TRIGGER = /(infinite[- ]?scroll|load[- ]?more.{0,40}scroll|IntersectionObserver)/i;
const OPT_OUT = /load more|loadMore|show more/i;

export const fr213: Rule = {
  id: 'FR-213', rung: 2, severity: 'review',
  check: (ctx) => {
    if (OPT_OUT.test(ctx.source)) return [];
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      const m = line.match(TRIGGER);
      if (m && out.length === 0)
        out.push({ rule: 'FR-213', severity: 'review' as const, message: `infinite scroll with no visible 'load more'/'show more' opt-out`, hint: `offer pagination or an explicit load-more control so users can stop`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
    });
    return out;
  },
};
