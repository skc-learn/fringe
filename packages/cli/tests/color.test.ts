import { describe, it, expect } from 'vitest';
import { parseColor, contrastRatio, relativeLuminance } from '../src/color.js';

describe('color utils', () => {
  it('parses hex and rgb forms', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('rgb(0, 128, 255)')).toEqual({ r: 0, g: 128, b: 255 });
    expect(parseColor('rgba(0,128,255,1)')).toEqual({ r: 0, g: 128, b: 255 });
    expect(parseColor('hsl(240, 100%, 50%)')).toEqual({ r: 0, g: 0, b: 255 });
    expect(parseColor('var(--x)')).toBeNull();
    expect(parseColor('red')).toBeNull(); // v1: named colors unsupported, honestly
  });
  it('WCAG contrast anchors', () => {
    expect(contrastRatio(parseColor('#000000')!, parseColor('#ffffff')!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseColor('#777777')!, parseColor('#ffffff')!)).toBeCloseTo(4.48, 1);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1.0, 5);
  });
});
