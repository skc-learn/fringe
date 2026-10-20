import type { Rule } from '../types.js';
import { parseColor } from '../color.js';

/** Tailwind arbitrary color utilities, e.g. bg-[#0b5fff] — raw hex inline in markup. */
const ARBITRARY_TW = /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;

/** Tailwind palette utilities, e.g. bg-slate-900 — the sanctioned color scale. */
const PALETTE_TW = /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/** CSS properties that set a color; values must still parse as a pure color.
 *  Custom properties (--color-*, etc.) are token DEFINITIONS, not hardcoded uses — excluded. */
const COLOR_PROP = /color|^background$|border/;

const count = (source: string, re: RegExp): number => (source.match(re) ?? []).length;

/**
 * FR-301 token adoption — one file-level signal when raw hex dominates the file's
 * color usage: more than 3 hardcoded colors AND strictly more than token uses.
 */
export const fr301: Rule = {
  id: 'FR-301', rung: 3, severity: 'signal',
  check: (ctx) => {
    const hardcoded =
      count(ctx.source, ARBITRARY_TW) +
      ctx.css.filter((d) => !d.prop.startsWith('--') && COLOR_PROP.test(d.prop) && parseColor(d.value) !== null).length;
    const tokenUses =
      count(ctx.source, /var\(--/g) +
      count(ctx.source, PALETTE_TW);
    if (!(hardcoded > 3 && hardcoded > tokenUses)) return [];
    return [{
      rule: 'FR-301', severity: 'signal' as const,
      message: `${hardcoded} hardcoded colors vs ${tokenUses} token uses in this file`,
      hint: `use design tokens / Tailwind palette instead of raw hex (tokenSource: ${ctx.tokenColors.length} colors found)`,
      loc: { file: ctx.file, line: 1, col: 0 },
    }];
  },
};
