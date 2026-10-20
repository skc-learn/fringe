import type { Rule } from '../types.js';

// Only full documents are judged: parse5 invents <html>/<head> for fragments, so the source must really contain them.
export const fr218: Rule = {
  id: 'FR-218', rung: 2, severity: 'review',
  check: (ctx) => {
    if (!/<html[\s>]/i.test(ctx.source)) return [];
    const out: ReturnType<Rule['check']> = [];
    const html = ctx.elems.find((e) => e.tag === 'html');
    if (html && html.attrs.lang === undefined)
      out.push({ rule: 'FR-218', severity: 'review' as const, message: '<html> has no lang attribute', hint: 'add lang="en" (or the page language) so screen readers pick the right voice', loc: html.loc, wcag: '3.1.1' });
    if (!/<title[\s>]/i.test(ctx.source) && html && /<head[\s>]/i.test(ctx.source))
      out.push({ rule: 'FR-218', severity: 'review' as const, message: 'page has no <title>', hint: 'add a unique, descriptive <title>: it is the first thing a screen reader announces and the browser tab label', loc: html.loc, wcag: '2.4.2' });
    for (const m of ctx.elems.filter((e) => e.tag === 'meta' && e.attrs.name === 'viewport')) {
      if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(m.attrs.content ?? ''))
        out.push({ rule: 'FR-218', severity: 'review' as const, message: 'viewport meta blocks pinch-zoom', hint: 'remove user-scalable=no / maximum-scale=1: low-vision users rely on zoom', loc: m.loc, wcag: '1.4.4' });
    }
    return out;
  },
};
