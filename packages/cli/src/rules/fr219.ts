import type { Rule } from '../types.js';

// shortcut: judged per file. A global stylesheet elsewhere may already honour prefers-reduced-motion; that case is not visible from here, so this stays `review`.
export const fr219: Rule = {
  id: 'FR-219', rung: 3, severity: 'review',
  check: (ctx) => {
    if (!/@keyframes/.test(ctx.source) || /prefers-reduced-motion/.test(ctx.source)) return [];
    const d = ctx.css.find((x) => x.prop === 'animation' || x.prop === 'animation-name');
    if (!d) return [];
    return [{ rule: 'FR-219', severity: 'review' as const, message: 'animation defined with no prefers-reduced-motion handling', hint: 'wrap it in @media (prefers-reduced-motion: no-preference), or turn it off under (prefers-reduced-motion: reduce)', loc: d.loc }];
  },
};
