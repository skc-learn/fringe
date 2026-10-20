import { describe, it, expect } from 'vitest';
import { parseJsx } from '../src/parse/jsx.js';
import { parseHtml } from '../src/parse/html.js';

describe('parent linkage', () => {
  it('jsx attaches parent tag and class', () => {
    const els = parseJsx('a.tsx', 'const x = <div className="card"><button className="btn">Go</button></div>;');
    const btn = els.find((e) => e.tag === 'button')!;
    expect(btn.parentTag).toBe('div');
    expect(btn.parentClass).toBe('card');
    expect(els.find((e) => e.tag === 'div')!.parentTag).toBeUndefined();
  });
  it('html attaches parent tag and class', () => {
    const els = parseHtml('a.html', '<div class="card"><a href="#">x</a></div>');
    expect(els.find((e) => e.tag === 'a')!.parentClass).toBe('card');
  });
});
