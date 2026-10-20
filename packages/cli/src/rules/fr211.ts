import type { Rule } from '../types.js';

const CHECKED_INPUT = /<input[^>]*type=["']checkbox["'][^>]*defaultChecked[^>]*>/;
const CONSENT_ID = /id=["'][^"']*(?:consent|agree|terms|subscribe|opt[- ]?in)/i;
const CONSENT_ANY = /consent|agree|terms|subscribe|opt[- ]?in/i;

export const fr211: Rule = {
  id: 'FR-211', rung: 2, severity: 'review',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    ctx.source.split('\n').forEach((line, i) => {
      const m = line.match(CHECKED_INPUT);
      const hit = m
        ? CONSENT_ID.test(m[0]) || CONSENT_ANY.test(ctx.source)
        : /defaultChecked/.test(line) && CONSENT_ANY.test(ctx.source);
      if (!hit) return;
      const col = m?.index ?? Math.max(line.indexOf('defaultChecked'), 0);
      out.push({ rule: 'FR-211', severity: 'review' as const, message: `pre-checked checkbox near consent/agreement wording may trick users into opting in`, hint: `leave consent checkboxes unchecked by default`, loc: { file: ctx.file, line: i + 1, col } });
    });
    return out;
  },
};
