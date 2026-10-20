import { describe, it, expect } from 'vitest';
import { expectRule, ctxOf } from './helpers.js';
import { fr201 } from '../src/rules/fr201.js';
import { fr202 } from '../src/rules/fr202.js';
import { fr203 } from '../src/rules/fr203.js';
import { fr209 } from '../src/rules/fr209.js';
expectRule(fr201, 'FR-201');
expectRule(fr202, 'FR-202');
expectRule(fr203, 'FR-203');
expectRule(fr209, 'FR-209');

describe('review fixes', () => {
  it('real-repo regressions: label-wrapped input and nested-text link are fine', () => {
    expect(fr203.check(ctxOf('r.tsx', 'export default () => <label>Name<input /></label>;'))).toEqual([]);
    expect(fr203.check(ctxOf('r.tsx', 'export default () => <label><div><input type="checkbox" /></div>Has</label>;'))).toEqual([]);
    expect(fr203.check(ctxOf('r.tsx', 'export default () => <input type="file" hidden />;'))).toEqual([]);
    expect(fr203.check(ctxOf('r.tsx', 'export default () => <div><input /></div>;')).length).toBe(1);
    expect(fr202.check(ctxOf('r.html', '<a href="/x"><div>Read more</div></a>'))).toEqual([]);
  });
  it('real-repo regressions: aria-pressed valid; dynamic children/title count as a name', () => {
    expect(fr209.check(ctxOf('r.tsx', 'export default () => <button aria-pressed="true">x</button>;'))).toEqual([]);
    expect(fr202.check(ctxOf('r.tsx', 'export default () => <button>{label || doc}</button>;'))).toEqual([]);
    expect(fr202.check(ctxOf('r.tsx', 'export default () => <button title={`Open ${id}`} />;'))).toEqual([]);
    expect(fr202.check(ctxOf('r.tsx', 'export default () => <button>{/* c */}</button>;')).length).toBe(1);
  });
  it('FR-209 accepts aria-activedescendant', () => {
    expect(fr209.check(ctxOf('inline.tsx', 'export default () => <div aria-activedescendant="x" />;'))).toEqual([]);
  });
  it('FR-209 accepts aria-haspopup on a button', () => {
    expect(fr209.check(ctxOf('inline.tsx', 'export default () => <button aria-haspopup="true" />;'))).toEqual([]);
  });
  it('FR-209 accepts the remaining standard aria attributes', () => {
    const attrs = ['aria-autocomplete', 'aria-keyshortcuts', 'aria-colspan', 'aria-colindex', 'aria-rowspan', 'aria-rowindex', 'aria-description', 'aria-braillelabel', 'aria-brailleroledescription'];
    for (const a of attrs) {
      expect(fr209.check(ctxOf('inline.tsx', `export default () => <button ${a}="x" />;`))).toEqual([]);
    }
  });
  it('FR-209 still flags misspelled aria attributes', () => {
    const out = fr209.check(ctxOf('inline.tsx', 'export default () => <button aria-labeledby="x" />;'));
    expect(out.length).toBe(1);
    expect(out[0].message).toContain('aria-labeledby');
  });
  it('FR-203 does not treat htmlFor="email2" as a label for id="email"', () => {
    const src = 'export default () => (<><label htmlFor="email2">Email</label><input id="email" type="text" /></>);';
    const out = fr203.check(ctxOf('inline.tsx', src));
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].rule).toBe('FR-203');
  });
});

describe('FR-202 nested text', () => {
  it('passes when the button label is wrapped in a child element', () => {
    const src = 'export default () => <button onClick={save}><span>Save</span></button>;';
    expect(fr202.check(ctxOf('a.tsx', src))).toEqual([]);
  });
  it('passes when the label is nested several elements deep', () => {
    const src = 'export default () => <a href="/x"><span><b>Home</b></span></a>;';
    expect(fr202.check(ctxOf('a.tsx', src))).toEqual([]);
  });
  it('still flags a button with a handler and no text of any kind', () => {
    const src = 'export default () => <button onClick={save} />;';
    const out = fr202.check(ctxOf('a.tsx', src));
    expect(out.length).toBe(1);
    expect(out[0].rule).toBe('FR-202');
  });
  it('still flags a button whose nested children hold no literal text', () => {
    const src = 'export default () => <button onClick={save}><Icon name="save" /></button>;';
    expect(fr202.check(ctxOf('a.tsx', src)).length).toBe(1);
  });
});
