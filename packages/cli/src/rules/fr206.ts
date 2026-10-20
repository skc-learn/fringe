import type { Rule } from '../types.js';
export const fr206: Rule = {
  id: 'FR-206', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    // A modal backdrop (`<div onClick={close}>` wrapping a role=dialog / aria-modal child) is exempt: keyboard users close via the dialog's own controls.
    // shortcut: only the first child is checked (pre-order next element); a backdrop whose dialog isn't its first child still flags. Upgrade with a parent link if that shows up.
    const isBackdrop = (i: number) => {
      const next = ctx.elems[i + 1], me = ctx.elems[i];
      return !!next && next.parentTag === me.tag && next.loc.line >= me.loc.line
        && (/^(alert)?dialog$/.test(next.attrs.role ?? '') || next.attrs['aria-modal'] === 'true');
    };
    for (const e of ctx.elems.filter((el, i) =>
      ['div', 'span'].includes(el.tag)
      && (el.attrs.onClick ?? el.attrs.onclick) !== undefined // JSX attrs keep their case; HTML attrs are lowercase
      && el.attrs.role === undefined
      && (el.attrs.tabIndex ?? el.attrs.tabindex) === undefined
      && !isBackdrop(i))) {
      out.push({ rule: 'FR-206', severity: 'error' as const, message: `onClick on non-interactive <${e.tag}>`, hint: `use a <button>/<a> or add role and tabIndex`, loc: e.loc, wcag: '2.1.1' });
    }
    return out;
  },
};
