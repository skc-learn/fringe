import { describe, it, expect } from 'vitest';
import { ctxOf, fixture, expectRule } from './helpers.js';
import { fr215 } from '../src/rules/fr215.js';
import { ALL_RULES } from '../src/rules/registry.js';

expectRule(fr215, 'FR-215');

describe('FR-215 generic error copy', () => {
  it('flags the fail fixture with exactly one finding at review severity (not signal)', () => {
    const { file, source } = fixture('FR-215', 'fail');
    const out = fr215.check(ctxOf(file, source));
    expect(fr215.severity).toBe('review');
    expect(fr215.rung).toBe(2);
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-215');
    expect(out[0].severity).toBe('review');
    expect(out[0].message).toBe('generic error copy with no recovery action');
    expect(out[0].hint).toBe('tell users what failed and give them a next step (retry, link, contact)');
    expect(out[0].loc.file).toBe(file);
    expect(out[0].loc.line).toBe(1);
    expect(out[0].loc.col).toBe(0);
  });

  it('requires an error-handling marker (isError, error, or catch)', () => {
    expect(fr215.check(ctxOf('a.tsx', 'export default () => <p>Something went wrong</p>;'))).toEqual([]);
    expect(
      fr215.check(ctxOf('a.tsx', 'export default () => { try { run(); } catch (e) { return <p>An error occurred</p>; } return null; }')).length,
    ).toBe(1);
    expect(fr215.check(ctxOf('a.tsx', 'export default () => { const error = useError(); return error ? <p>Whoops</p> : null; }')).length).toBe(1);
  });

  it('stays quiet when a recovery action is present', () => {
    expect(
      fr215.check(ctxOf('a.tsx', 'export default () => { const { isError } = q(); return isError ? <p>Something went wrong. <a href="/help">Contact support</a></p> : null; };')),
    ).toEqual([]);
    expect(fr215.check(ctxOf('a.tsx', 'export default () => { const { isError } = q(); return isError ? <p>Oops. <button>Reload</button></p> : null; };'))).toEqual([]);
    expect(fr215.check(ctxOf('a.tsx', 'export default () => { const { isError } = q(); return isError ? <p>Oops. <button onClick={retry}>Try again</button></p> : null; };'))).toEqual([]);
  });

  it('does not flag specific error copy without the generic phrases', () => {
    expect(fr215.check(ctxOf('a.tsx', "export default () => { const { isError } = q(); return isError ? <p>Couldn't load the list.</p> : null; };"))).toEqual([]);
  });
});

describe('FR-215 registration', () => {
  it('is registered in ALL_RULES after FR-214 at rung 2', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(ids.indexOf('FR-215')).toBeGreaterThan(ids.indexOf('FR-214'));
    expect(ALL_RULES.find((r) => r.id === 'FR-215')?.rung).toBe(2);
  });
});
