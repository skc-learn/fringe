import type { Rule } from '../types.js';

/** Rounded corners big enough to read as a tile. */
const TILE_ROUNDING = /rounded-(lg|xl|2xl)/;

/** A filled, centered tile: rounded, backgrounded, flex, and empty of text. */
const isTile = (cls: string, text: string) =>
  TILE_ROUNDING.test(cls) && /bg-/.test(cls) && /flex/.test(cls) && text === '';

/** FR-364 icon-tile stack — three or more empty flex tiles in one file (file-level signal). */
export const fr364: Rule = {
  id: 'FR-364', rung: 3, severity: 'signal',
  check: (ctx) => {
    let n = 0;
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (isTile(cls, e.text)) n++;
    }
    if (n < 3) return [];
    return [{
      rule: 'FR-364', severity: 'signal' as const,
      message: `icon-tile stack (${n} tiles)`,
      hint: `rows of icon tiles with verb labels are a landing-page tell`,
      loc: { file: ctx.file, line: 1, col: 0 },
    }];
  },
};
