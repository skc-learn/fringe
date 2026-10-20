import type { Rule } from '../types.js';

/** Italic utility. */
const ITALIC = /\bitalic\b/;

/** Serif font family — font-serif or bare serif. */
const SERIF = /\b(?:font-)?serif\b/;

/** Display sizes big enough to read as a headline. */
const DISPLAY_SIZE = /\btext-(?:3xl|4xl|5xl|6xl)\b/;

/** FR-361 italic serif display type — the AI-tell headline. */
export const fr361: Rule = {
  id: 'FR-361', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!ITALIC.test(cls) || !SERIF.test(cls) || !DISPLAY_SIZE.test(cls)) continue;
      out.push({
        rule: 'FR-361', severity: 'signal' as const,
        message: `italic serif display type — the AI-tell headline`,
        hint: `choose a display treatment that isn't italic serif`,
        loc: e.loc,
      });
    }
    return out;
  },
};
