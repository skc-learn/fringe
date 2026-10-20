import type { Rule } from '../types.js';

/** Thin border utility as its own token — border or border-<1-9>. border-0 removes the
 *  border entirely, so it is excluded. The (?!-0\b) guard is required: \b alone still
 *  matches between "border" and "-0", which would let the bare-border path re-admit it. */
const THIN_BORDER = /(?:^|\s)border(?!-0\b)(?:-[1-9])?\b/;

/** Wide shadow utilities. */
const WIDE_SHADOW = /\bshadow-(?:xl|2xl)\b/;

/** FR-365 thin border with wide shadow — elevation not matched to weight. */
export const fr365: Rule = {
  id: 'FR-365', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!THIN_BORDER.test(cls) || !WIDE_SHADOW.test(cls)) continue;
      out.push({
        rule: 'FR-365', severity: 'signal' as const,
        message: `thin border with wide shadow`,
        hint: `pair elevation with weight: heavier border or tighter shadow`,
        loc: e.loc,
      });
    }
    return out;
  },
};
