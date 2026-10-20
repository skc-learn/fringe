import type { Rule } from '../types.js';

const HOVER = ['onMouseEnter', 'onMouseOver', 'onmouseenter', 'onmouseover'];
const FOCUS = ['onFocus', 'onfocus'];
const PRESS = ['onClick', 'onclick', 'onTouchStart', 'ontouchstart'];

export const fr221: Rule = {
  id: 'FR-221', rung: 2, severity: 'review',
  check: (ctx) => ctx.elems
    .filter((e) => HOVER.some((h) => e.attrs[h] !== undefined) && !FOCUS.some((f) => e.attrs[f] !== undefined) && !PRESS.some((p) => e.attrs[p] !== undefined))
    .map((e) => ({ rule: 'FR-221', severity: 'review' as const, message: `<${e.tag}> reacts to hover only`, hint: 'mirror it on focus (onFocus/onBlur) and tap: keyboard and touch users cannot hover', loc: e.loc, wcag: '1.4.13' })),
};
