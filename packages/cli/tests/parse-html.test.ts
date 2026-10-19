import { describe, it, expect } from 'vitest';
import { parseHtml } from '../src/parse/html.js';

describe('parseHtml', () => {
  it('flattens elements', () => {
    const els = parseHtml('i.html', `<body><a href="/x" class="link">Home</a><img src="a.png"></body>`);
    expect(els.find((e) => e.tag === 'a')!.attrs.class).toBe('link');
    expect(els.find((e) => e.tag === 'a')!.text).toBe('Home');
    expect(els.find((e) => e.tag === 'img')!.attrs.src).toBe('a.png');
  });
});
