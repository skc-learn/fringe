import type { Rule } from '../types.js';

const VAGUE = /^(click here|here|read more|more|link|this link)$/i;

export const fr217: Rule = {
  id: 'FR-217', rung: 2, severity: 'review',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      if (e.tag !== 'a') continue;
      const href = e.attrs.href ?? '';
      if (VAGUE.test(e.text) && !e.attrs['aria-label'] && !e.attrs['aria-labelledby'])
        out.push({ rule: 'FR-217', severity: 'review' as const, message: `link text "${e.text}" says nothing out of context`, hint: 'name the destination or action ("Read the pricing guide"); screen reader users list links on their own', loc: e.loc });
      if (href === '#' || /^javascript:/i.test(href))
        out.push({ rule: 'FR-217', severity: 'review' as const, message: `link with href="${href.slice(0, 11)}" goes nowhere`, hint: 'use a <button> for an action, or a real URL for navigation', loc: e.loc });
    }
    return out;
  },
};
