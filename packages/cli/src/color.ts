export interface RGB {
  r: number;
  g: number;
  b: number;
}

const clamp255 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));

// Split "r g b / a" or "r, g, b, a" argument lists into numeric channels (alpha dropped).
function splitArgs(argStr: string): { values: string[] } | null {
  const [colorPart] = argStr.split('/');
  const values = colorPart.trim().split(/[\s,]+/).filter(Boolean);
  if (values.length < 3 || values.length > 4) return null;
  return { values: values.slice(0, 3) };
}

function numericChannel(v: string): number | null {
  const m = v.match(/^([+-]?\d*\.?\d+)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] ? (n / 100) * 255 : n;
}

function hslChannel(v: string, isHue: boolean): number | null {
  const m = v.match(/^([+-]?\d*\.?\d+)(deg|%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isHue ? n : n / 100;
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] : [c, 0, x];
  return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) };
}

/**
 * Parse a CSS color into 8-bit RGB channels. Accepts #rgb, #rrggbb, #rrggbbaa,
 * rgb()/rgba() and hsl()/hsla() (comma or modern space syntax). Case-insensitive,
 * trims whitespace. Alpha is accepted but ignored (no compositing in v1).
 * Named colors and var() references return null — deliberately, honestly.
 */
export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    // 8-digit form: alpha nibbles (positions 6-7) dropped
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }

  const rgb = s.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const args = splitArgs(rgb[1]);
    if (!args) return null;
    const nums = args.values.map(numericChannel);
    if (nums.some((n) => n === null)) return null;
    const [r, g, b] = nums as number[];
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }

  const hsl = s.match(/^hsla?\(([^)]*)\)$/);
  if (hsl) {
    const args = splitArgs(hsl[1]);
    if (!args) return null;
    const hue = hslChannel(args.values[0], true);
    const sat = hslChannel(args.values[1], false);
    const lig = hslChannel(args.values[2], false);
    if (hue === null || sat === null || lig === null) return null;
    return hslToRgb(hue, Math.min(1, Math.max(0, sat)), Math.min(1, Math.max(0, lig)));
  }

  return null;
}

/** WCAG 2.x relative luminance: sRGB linearization then 0.2126R + 0.7152G + 0.0722B. */
export function relativeLuminance({ r, g, b }: RGB): number {
  const lin = (c: number): number => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (L1 + 0.05) / (L2 + 0.05) with L1 >= L2. Range 1..21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [l1, l2] = la >= lb ? [la, lb] : [lb, la];
  return (l1 + 0.05) / (l2 + 0.05);
}
