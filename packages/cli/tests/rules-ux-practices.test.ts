import { describe, it, expect } from 'vitest';
import { expectRule, ctxOf } from './helpers.js';
import { parseHtml } from '../src/parse/html.js';
import { parseCss } from '../src/parse/css.js';
import { fr216 } from '../src/rules/fr216.js';
import { fr217 } from '../src/rules/fr217.js';
import { fr218 } from '../src/rules/fr218.js';
import { fr219 } from '../src/rules/fr219.js';
import { fr220 } from '../src/rules/fr220.js';
import { fr221 } from '../src/rules/fr221.js';
import { fr222 } from '../src/rules/fr222.js';

expectRule(fr216, 'FR-216'); expectRule(fr217, 'FR-217'); expectRule(fr220, 'FR-220'); expectRule(fr221, 'FR-221'); expectRule(fr222, 'FR-222');

const html = (file: string, source: string) => ({ file, source, elems: parseHtml(file, source), css: [], tokenColors: [] });
const css = (source: string) => ({ file: 'a.css', source, elems: [], css: parseCss('a.css', source), tokenColors: [] });
const tsx = (jsx: string) => ctxOf('a.tsx', `export default () => ${jsx};`);

describe('FR-216 forms', () => {
  it('flags phone typed as text, but not checkboxes or dynamic types', () => {
    expect(fr216.check(tsx('<input type="text" name="phone" />')).length).toBe(1);
    expect(fr216.check(tsx('<input type="checkbox" name="email-me" />'))).toEqual([]);
    expect(fr216.check(tsx('<input type={kind} name="email" />'))).toEqual([]);
    // found on real code: a search box whose placeholder mentions phone
    expect(fr216.check(tsx('<input placeholder="Search customer, GST, phone or address" />'))).toEqual([]);
    expect(fr216.check(tsx('<input name="customerSearch" placeholder="phone" />'))).toEqual([]);
  });
});
describe('FR-217 links', () => {
  it('ignores a vague link that has an aria-label', () => {
    expect(fr217.check(tsx('<a href="/x" aria-label="Pricing guide">here</a>'))).toEqual([]);
  });
});
describe('FR-218 page basics (full documents only)', () => {
  it('flags a document with no lang, no title, and a zoom-blocking viewport', () => {
    const out = fr218.check(html('i.html', '<html><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body></body></html>'));
    expect(out.map((f) => f.wcag).sort()).toEqual(['1.4.4', '2.4.2', '3.1.1']);
  });
  it('is silent for a complete document and for HTML fragments', () => {
    expect(fr218.check(html('ok.html', '<html lang="en"><head><title>Home</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'))).toEqual([]);
    expect(fr218.check(html('frag.html', '<div class="art">partial template</div>'))).toEqual([]);
  });
  it('checks a JSX root layout too', () => {
    expect(fr218.check(tsx('<html><body>x</body></html>')).length).toBe(1);
  });
});
describe('FR-219 reduced motion', () => {
  it('flags keyframes with no reduced-motion handling, passes with it', () => {
    expect(fr219.check(css('@keyframes spin { to { transform: rotate(1turn) } } .s { animation: spin 1s infinite }')).length).toBe(1);
    expect(fr219.check(css('@keyframes spin { to { transform: rotate(1turn) } } .s { animation: spin 1s } @media (prefers-reduced-motion: reduce) { .s { animation: none } }'))).toEqual([]);
    expect(fr219.check(css('.s { transition: color .2s }'))).toEqual([]);
  });
});
describe('FR-222 filler text', () => {
  it('flags TODO in a placeholder attribute, ignores code comments', () => {
    expect(fr222.check(tsx('<input placeholder="TODO name" />')).length).toBe(1);
    expect(fr222.check(ctxOf('a.tsx', '// TODO: wire up\nexport default () => <p>Hi</p>;'))).toEqual([]);
  });
});
