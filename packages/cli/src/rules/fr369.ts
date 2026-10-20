import type { Rule } from '../types.js';

const HEADING = /^h[1-6]$/;

/** Any emoji/pictograph, per Unicode Extended_Pictographic. */
const EMOJI = /\p{Extended_Pictographic}/u;

/** FR-369 emoji in headings — the classic LLM-generated-heading tell. */
export const fr369: Rule = {
  id: 'FR-369', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      if (!HEADING.test(e.tag) || !EMOJI.test(e.text)) continue;
      out.push({
        rule: 'FR-369', severity: 'signal' as const,
        message: `emoji in heading`,
        hint: `emoji in headings read as template output; use typography instead`,
        loc: e.loc,
      });
    }
    return out;
  },
};
