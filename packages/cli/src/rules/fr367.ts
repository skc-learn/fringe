import type { Rule } from '../types.js';

/** Small text utilities (whole tokens — not text-xsl or text-small variants). */
const SMALL_TEXT = /\btext-(?:xs|sm)\b/;

/** "01 Discover" / "2 Approach" — one- or two-digit index followed by a word. */
const NUMBERED_LABEL = /^\d{1,2}\s+\S+/;

/** FR-367 numbered section labels — tiny text leading with an index number. */
export const fr367: Rule = {
  id: 'FR-367', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!SMALL_TEXT.test(cls) || !NUMBERED_LABEL.test(e.text)) continue;
      out.push({
        rule: 'FR-367', severity: 'signal' as const,
        message: `numbered section label ("01 Discover" style)`,
        hint: `let hierarchy come from typography, not index numbers`,
        loc: e.loc,
      });
    }
    return out;
  },
};
