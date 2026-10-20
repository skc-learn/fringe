import type { Rule } from '../types.js';

const NOT_TEXT = new Set(['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'range', 'color', 'image', 'reset']);
// A long placeholder is prose ("Search by name, area or phone"), not a field name, so only short ones count.
const short = (s = '') => (s.length <= 24 ? s : '');
const cat = (a: Record<string, string>) => `${a.name ?? ''} ${a.id ?? ''} ${short(a.placeholder)} ${short(a['aria-label'])}`.toLowerCase();

export const fr216: Rule = {
  id: 'FR-216', rung: 2, severity: 'review',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      if (e.tag !== 'input' || e.attrs.type === '{…}') continue; // dynamic type: unknowable
      const type = (e.attrs.type ?? 'text').toLowerCase();
      if (NOT_TEXT.has(type)) continue;
      const hint = cat(e.attrs);
      if (/search|filter|find/.test(hint)) continue; // a search box that mentions phone or email is not a phone or email field
      const flag = (message: string, h: string) => out.push({ rule: 'FR-216', severity: 'review' as const, message, hint: h, loc: e.loc });
      if (/e-?mail/.test(hint) && type !== 'email') flag(`email field is type="${type}"`, 'use type="email" so phones show the right keyboard and the browser validates');
      else if (/\b(tel|phone|mobile)\b/.test(hint) && type !== 'tel') flag(`phone field is type="${type}"`, 'use type="tel" for the numeric keypad');
      if (type === 'password' && e.attrs.autocomplete === undefined && e.attrs.autoComplete === undefined) flag('password field without autocomplete', 'add autoComplete="current-password" or "new-password" so password managers work');
    }
    return out;
  },
};
