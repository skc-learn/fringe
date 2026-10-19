import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectRule, ctxOf, FIXTURES } from './helpers.js';
import { parseCss } from '../src/parse/css.js';
import type { RuleContext } from '../src/types.js';
import { fr205 } from '../src/rules/fr205.js';
import { ALL_RULES } from '../src/rules/registry.js';

expectRule(fr205, 'FR-205');

function cssCtxOf(file: string, source: string): RuleContext {
  return { file, source, elems: [], css: parseCss(file, source) };
}

function cssFixture(kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', 'FR-205', `${kind}.css`);
  return { file, source: readFileSync(file, 'utf8') };
}

describe('FR-205 CSS cases', () => {
  it('passes css fixture with :focus-visible', () => {
    const { file, source } = cssFixture('pass');
    expect(fr205.check(cssCtxOf(file, source))).toEqual([]);
  });

  it('flags css fixture outline: none', () => {
    const { file, source } = cssFixture('fail');
    const out = fr205.check(cssCtxOf(file, source));
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-205');
    expect(out[0].severity).toBe('error');
    expect(out[0].loc.file).toBe(file);
  });

  it('is satisfied when :focus-visible appears elsewhere in the file', () => {
    const src = '.x { outline: none }\n.x:focus-visible { outline: 2px solid blue }';
    expect(fr205.check(cssCtxOf('a.css', src))).toEqual([]);
  });

  it('flags css outline: 0', () => {
    expect(fr205.check(cssCtxOf('a.css', '.y { outline: 0 }')).length).toBe(1);
  });
});

describe('FR-205 JSX cases', () => {
  it('flags outline-0 without focus-visible', () => {
    const out = fr205.check(ctxOf('a.tsx', 'export default () => <a className="outline-0">x</a>;'));
    expect(out.length).toBe(1);
    expect(out[0].message).toBe('outline removed without focus-visible alternative');
  });

  it('passes when focus-visible variant is present', () => {
    const src = 'export default () => <a className="outline-none focus-visible:outline-2">x</a>;';
    expect(fr205.check(ctxOf('a.tsx', src))).toEqual([]);
  });
});

describe('FR-205 registration', () => {
  it('is registered in ALL_RULES', () => {
    expect(ALL_RULES.some((r) => r.id === 'FR-205')).toBe(true);
  });
});
