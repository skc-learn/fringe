import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { FringeConfig } from './types.js';
import { parseColor } from './color.js';

/** Matches `--custom-prop: value;` declarations; capture is the raw value. */
const CSS_VAR_RE = /--[\w-]+\s*:\s*([^;}]+)/g;

/**
 * Gather the project's design-token color values, deduped, as written.
 * - css-vars / theme-factory: every `--*` custom-property declaration found in the
 *   provided CSS/SCSS sources whose value parseColor accepts.
 * - design-tokens-json: recursive walk of the JSON at tokenSource.path (relative to
 *   root) collecting `$value` strings that parse as colors.
 * Empty array when no tokenSource is configured or nothing parses.
 */
export function gatherTokenColors(
  root: string,
  cfg: FringeConfig,
  cssSources: Array<{ file: string; source: string }>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string): void => {
    const value = raw.trim();
    if (!value || seen.has(value) || parseColor(value) === null) return;
    seen.add(value);
    out.push(value);
  };

  const kind = cfg.tokenSource?.kind;
  if (kind === 'design-tokens-json') {
    const rel = cfg.tokenSource?.path ?? '';
    const file = isAbsolute(rel) ? rel : join(root, rel);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return out; // unreadable/malformed token file: no tokens, not a crash
    }
    collectJsonColors(json, add);
    return out;
  }

  if (kind !== 'css-vars' && kind !== 'theme-factory') return out;
  for (const { source } of cssSources) {
    for (const m of source.matchAll(CSS_VAR_RE)) add(m[1]);
  }
  return out;
}

function collectJsonColors(node: unknown, add: (value: string) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonColors(item, add);
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === '$value' && typeof value === 'string') add(value);
    else collectJsonColors(value, add);
  }
}
