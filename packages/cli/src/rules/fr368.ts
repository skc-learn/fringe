import type { Rule } from '../types.js';

/** Tailwind gradient utility of any direction (bg-gradient-to-r, -br, …). */
const GRADIENT_UTILITY = /\bbg-gradient-to-\w+/;

/** Gradient stop from the LLM-default purple family. */
const PURPLE_STOP = /\bfrom-(?:violet|purple|indigo|fuchsia)-\d{3,4}\b/;

/** Hexes of the canonical violet/indigo/purple AI gradient, in any case. */
const PURPLE_HEX = /#(?:8b5cf6|a78bfa|7c3aed|818cf8|6366f1|9333ea|c084fc)/i;

/** Declarations that can carry a gradient value. */
const BACKGROUND_PROP = /^background(?:-image)?$/;

/** FR-368 purple AI gradient — the violet→indigo Tailwind gradient or its CSS hex equivalent. */
export const fr368: Rule = {
  id: 'FR-368', rung: 3, severity: 'signal',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (!GRADIENT_UTILITY.test(cls) || !PURPLE_STOP.test(cls)) continue;
      out.push({
        rule: 'FR-368', severity: 'signal' as const,
        message: `the purple AI gradient`,
        hint: `pick a palette that isn't the LLM default`,
        loc: e.loc,
      });
    }
    for (const d of ctx.css) {
      if (!BACKGROUND_PROP.test(d.prop) || !/linear-gradient/i.test(d.value) || !PURPLE_HEX.test(d.value)) continue;
      out.push({
        rule: 'FR-368', severity: 'signal' as const,
        message: `the purple AI gradient`,
        hint: `pick a palette that isn't the LLM default`,
        loc: d.loc,
      });
    }
    return out;
  },
};
