import { describe, it, expect } from 'vitest';
import { expectRule, ctxOf } from './helpers.js';
import { fr206 } from '../src/rules/fr206.js';
import { fr207 } from '../src/rules/fr207.js';
import { ALL_RULES } from '../src/rules/registry.js';
import { parseHtml } from '../src/parse/html.js';

function htmlCtx(file: string, source: string) {
  return { file, source, elems: parseHtml(file, source), css: [] as [], tokenColors: [] };
}

expectRule(fr206, 'FR-206');
expectRule(fr207, 'FR-207');

describe('FR-206 interactive-element cases', () => {
  it('passes when div has onClick plus role', () => {
    const src = 'export default () => <div role="button" onClick={go}>Go</div>;';
    expect(fr206.check(ctxOf('a.tsx', src))).toEqual([]);
  });

  it('passes when div has onClick plus tabIndex', () => {
    const src = 'export default () => <div tabIndex={0} onClick={go}>Go</div>;';
    expect(fr206.check(ctxOf('a.tsx', src))).toEqual([]);
  });

  it('flags span with onClick and no role/tabIndex', () => {
    const out = fr206.check(ctxOf('a.tsx', 'export default () => <span onClick={go}>Go</span>;'));
    expect(out.length).toBe(1);
    expect(out[0].message).toBe('onClick on non-interactive <span>');
  });

  it('ignores other tags with onClick', () => {
    expect(fr206.check(ctxOf('a.tsx', 'export default () => <button onClick={go}>Go</button>;'))).toEqual([]);
  });
});

describe('FR-207 tabIndex cases', () => {
  it('passes tabIndex={0}', () => {
    expect(fr207.check(ctxOf('a.tsx', 'export default () => <div tabIndex={0} />;'))).toEqual([]);
  });

  it('flags tabIndex={3} on its line', () => {
    const src = 'const x = 1;\nexport default () => <div tabIndex={3} />;';
    const out = fr207.check(ctxOf('a.tsx', src));
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-207');
    expect(out[0].loc.line).toBe(2);
    expect(out[0].message).toContain('3');
  });

  it('flags multiple positive tabIndex on separate lines', () => {
    const src = 'export default () => (\n  <>\n    <div tabIndex={1} />\n    <div tabIndex={2} />\n  </>\n);';
    expect(fr207.check(ctxOf('a.tsx', src)).length).toBe(2);
  });
});

describe('FR-206/FR-207 registration', () => {
  it('are registered in ALL_RULES', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-206')).toBe(true);
    expect(ALL_RULES.some((r) => r.id === 'FR-207')).toBe(true);
  });
});

describe('FR-206/FR-207 HTML tier', () => {
  it('FR-206 flags <div onclick="go()">Menu</div> in an .html file', () => {
    const out = fr206.check(htmlCtx('menu.html', '<html><body><div onclick="go()">Menu</div></body></html>'));
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-206');
    expect(out[0].loc.file).toBe('menu.html');
  });
  it('FR-206 does not flag an html div that carries role or tabindex', () => {
    expect(fr206.check(htmlCtx('ok.html', '<html><body><div onclick="go()" role="button" tabindex="0">Menu</div></body></html>'))).toEqual([]);
  });
  it('FR-207 flags tabindex="2" in an .html file', () => {
    const out = fr207.check(htmlCtx('promo.html', '<html><body><div tabindex="2">Featured</div></body></html>'));
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-207');
    expect(out[0].message).toContain('2');
  });
  it('FR-207 leaves tabindex="0" in html alone', () => {
    expect(fr207.check(htmlCtx('ok.html', '<html><body><div tabindex="0">x</div></body></html>'))).toEqual([]);
  });
  it('FR-207 JSX form tolerates inner whitespace: tabIndex={ 2 }', () => {
    const out = fr207.check(ctxOf('a.tsx', 'export default () => <div tabIndex={  2  } />;'));
    expect(out.length).toBe(1);
    expect(out[0].message).toContain('2');
  });
});
