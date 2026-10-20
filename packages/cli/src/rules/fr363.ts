import type { Rule } from '../types.js';

/** Rounded corners big enough to read as a card. */
const CARD_ROUNDING = /rounded-(lg|xl|2xl)/;

/** Bare border utility as its own token (start of string or after whitespace). */
const BORDER_TOKEN = /(?:^|\s)border/;

/** Any shadow or background utility — the other two cardish signals. */
const SURFACE = /shadow-|bg-/;

/** An element reads as a card when it has card rounding plus a surface treatment. */
const cardish = (cls: string) => CARD_ROUNDING.test(cls) && (BORDER_TOKEN.test(cls) || SURFACE.test(cls));

/** FR-363 card inside a card — a cardish element nested in another cardish element. */
export const fr363: Rule = {
  id: 'FR-363', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!cardish(cls) || !e.parentClass || !cardish(e.parentClass)) continue;
      out.push({
        rule: 'FR-363', severity: 'signal' as const,
        message: `card inside a card`,
        hint: `one containment level: let whitespace, not boxes, group content`,
        loc: e.loc,
      });
    }
    return out;
  },
};
