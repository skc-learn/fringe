import type { Rule, CssDecl } from '../types.js';
import { parseColor, contrastRatio } from '../color.js';

/** True when the raw value encodes alpha < 1 (rgba/hsla 4th arg, slash syntax, #rrggbbaa) — contrast over an unknown backdrop is unknowable. */
function translucent(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{8}$/.test(s)) return parseInt(s.slice(7, 9), 16) < 255;
  const fn = s.match(/^(?:rgba?|hsla?)\(([^)]*)\)$/);
  if (!fn) return false;
  const [colorPart, slashAlpha] = fn[1].split('/');
  const alpha = slashAlpha !== undefined ? slashAlpha.trim() : colorPart.trim().split(/[\s,]+/).filter(Boolean)[3];
  if (alpha === undefined) return false;
  const m = alpha.match(/^([+-]?\d*\.?\d+)(%)?$/);
  if (!m) return false;
  const n = parseFloat(m[1]);
  return (m[2] ? n / 100 : n) < 1;
}

export const fr304: Rule = {
  id: 'FR-304', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    const bySelector = new Map<string, CssDecl[]>();
    for (const d of ctx.css) {
      const group = bySelector.get(d.selector) ?? [];
      group.push(d);
      bySelector.set(d.selector, group);
    }
    for (const [selector, decls] of bySelector) {
      if (!selector) continue;
      const last = (prop: string): CssDecl | undefined => {
        const matches = decls.filter((d) => d.prop === prop);
        return matches[matches.length - 1];
      };
      const colorDecl = last('color');
      const bgDecl = last('background-color') ?? decls.filter((d) => d.prop === 'background' && parseColor(d.value) !== null).pop();
      if (!colorDecl || !bgDecl) continue;
      if (translucent(colorDecl.value) || translucent(bgDecl.value)) continue;
      const fg = parseColor(colorDecl.value);
      const bg = parseColor(bgDecl.value);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5)
        out.push({
          rule: 'FR-304', severity: 'signal' as const,
          message: `contrast ${colorDecl.value.trim()} on ${bgDecl.value.trim()} is ${ratio.toFixed(1)}:1 (< 4.5:1)`,
          hint: `darken the text or lighten the background to reach AA 4.5:1`,
          loc: colorDecl.loc,
        });
    }
    return out;
  },
};
