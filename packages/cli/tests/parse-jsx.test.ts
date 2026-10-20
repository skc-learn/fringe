import { describe, it, expect } from 'vitest';
import { parseJsx } from '../src/parse/jsx.js';

describe('parseJsx', () => {
  it('flattens elements with attrs and text', () => {
    const els = parseJsx('a.tsx', `export default () => <button className="btn" onClick={go}>Save</button>;`);
    const btn = els.find((e) => e.tag === 'button')!;
    expect(btn.attrs.className).toBe('btn');
    expect(btn.attrs.onClick).toBe('{…}');
    expect(btn.text).toBe('Save');
    expect(btn.loc.line).toBe(1);
  });
  it('nests and reports all elements', () => {
    const els = parseJsx('a.tsx', `const x = <div><img src="a.png" alt="logo" /></div>;`);
    expect(els.map((e) => e.tag).sort()).toEqual(['div', 'img']);
    expect(els.find((e) => e.tag === 'img')!.attrs.alt).toBe('logo');
  });
  it('throws parse-skip on garbage', () => {
    expect(() => parseJsx('a.tsx', 'export ~~ broken')).toThrow('parse-skip');
  });
});
