import { describe, it, expect } from 'vitest';
import { parseCss } from '../src/parse/css.js';

describe('parseCss', () => {
  it('collects declarations with selectors', () => {
    const decls = parseCss('s.css', `.btn:focus { outline: none; color: red }`);
    expect(decls).toHaveLength(2);
    expect(decls[0]).toMatchObject({ prop: 'outline', value: 'none', selector: '.btn:focus' });
    expect(decls[0].loc.line).toBe(1);
  });
});
