import type { Rule } from '../types.js';

/** text-xs as a whole utility token (not text-xsl or similar look-alikes). */
const TINY_TEXT = /\btext-xs\b/;

/** p-2..p-9, p-10 and their py- variants — padding that gives a text-xs control an adequate hit area. */
const ADEQUATE_PADDING = /(?:^|\s)(?:p|py)-([2-9]|10)\b/;

/** FR-305 hit areas — text-xs on button/a without py-2+ padding makes a tiny click target. */
export const fr305: Rule = {
  id: 'FR-305', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      if (e.tag !== 'button' && e.tag !== 'a') continue;
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!TINY_TEXT.test(cls) || ADEQUATE_PADDING.test(cls)) continue;
      out.push({
        rule: 'FR-305', severity: 'signal' as const,
        message: `tiny hit area: text-xs interactive element without adequate padding`,
        hint: `add py-2+ padding or a larger text size (WCAG 2.5.8 target size)`,
        loc: e.loc,
        wcag: '2.5.8',
      });
    }
    return out;
  },
};
