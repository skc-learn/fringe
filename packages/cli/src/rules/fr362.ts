import type { Rule } from '../types.js';

/** All-caps utility. */
const UPPERCASE = /\buppercase\b/;

/** Wide letter spacing. */
const TRACKING = /\btracking-(?:widest|wider)\b/;

/** Pill-shaped radius. */
const PILL = /\brounded-full\b/;

/** Eyebrow chips are short labels; anything longer is body copy. */
const MAX_TEXT_LENGTH = 40;

/** FR-362 hero eyebrow chip — uppercase wide-tracked pill above a heading. */
export const fr362: Rule = {
  id: 'FR-362', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!UPPERCASE.test(cls) || !TRACKING.test(cls) || !PILL.test(cls)) continue;
      if (e.text.trim().length > MAX_TEXT_LENGTH) continue;
      out.push({
        rule: 'FR-362', severity: 'signal' as const,
        message: `hero eyebrow chip`,
        hint: `eyebrow chips above headings are a template tell; integrate context into the heading`,
        loc: e.loc,
      });
    }
    return out;
  },
};
