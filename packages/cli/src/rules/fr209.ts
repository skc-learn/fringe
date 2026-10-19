import type { Rule } from '../types.js';
const VALID_ARIA = new Set(['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden', 'aria-expanded', 'aria-controls', 'aria-current', 'aria-live', 'aria-disabled', 'aria-invalid', 'aria-required', 'aria-selected', 'aria-checked', 'aria-valuenow', 'aria-orientation', 'aria-placeholder', 'aria-roledescription', 'aria-atomic', 'aria-relevant', 'aria-dropeffect', 'aria-grabbed', 'aria-level', 'aria-multiline', 'aria-multiselectable', 'aria-readonly', 'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuetext', 'aria-busy', 'aria-colcount', 'aria-rowcount', 'aria-details', 'aria-errormessage', 'aria-flowto', 'aria-owns', 'aria-posinset', 'aria-setsize', 'aria-modal', 'aria-active descendant']);
export const fr209: Rule = {
  id: 'FR-209', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems.flatMap((e) =>
    Object.keys(e.attrs)
      .filter((a) => a.startsWith('aria-') && !VALID_ARIA.has(a))
      .map((a) => ({ rule: 'FR-209', severity: 'error' as const, message: `unknown aria attribute '${a}'`, hint: `check spelling against the ARIA spec`, loc: e.loc }))),
};
