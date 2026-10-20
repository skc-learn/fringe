import type { Rule } from '../types.js';

/** Pill shape. */
const PILL = /rounded-full/;

/** Chip sizing — tight horizontal padding or tiny text. */
const CHIP_SIZE = /(?:px-2|px-2\.5|text-xs)/;

/** A status chip: pill-shaped, chip-sized, carrying a label. */
const isChip = (cls: string, text: string) => PILL.test(cls) && CHIP_SIZE.test(cls) && text !== '';

/** FR-366 status-chip soup — five or more labeled pills in one file (file-level signal). */
export const fr366: Rule = {
  id: 'FR-366', rung: 3, severity: 'signal',
  check: (ctx) => {
    let n = 0;
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (isChip(cls, e.text)) n++;
    }
    if (n < 5) return [];
    return [{
      rule: 'FR-366', severity: 'signal' as const,
      message: `status-chip soup (${n} chips)`,
      hint: `chips everywhere dilute meaning; reserve them for state`,
      loc: { file: ctx.file, line: 1, col: 0 },
    }];
  },
};
