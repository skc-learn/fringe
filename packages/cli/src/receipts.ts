import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keyOf } from './baseline.js';
import type { Finding } from './types.js';

export interface History { introduced: Finding[]; fixed: number }
const file = (root: string) => join(root, '.fringe', 'last.json');

/** What changed in the error set since the previous hook run. undefined = nothing to compare with (first run, or unreadable state). The state is rewritten every call; failures to read or write it never fail the check. */
export function receipts(root: string, findings: Finding[]): History | undefined {
  const errs = findings.filter((f) => f.severity === 'error');
  const keys = errs.map((f) => keyOf(root, f));
  let prev: string[] | undefined;
  try { const p = JSON.parse(readFileSync(file(root), 'utf8')); if (Array.isArray(p)) prev = p; } catch { /* no usable state */ }
  try { mkdirSync(join(root, '.fringe'), { recursive: true }); writeFileSync(file(root), JSON.stringify(keys)); } catch { /* best effort */ }
  if (!prev) return undefined;
  const left = new Map<string, number>();
  for (const k of prev) left.set(k, (left.get(k) ?? 0) + 1);
  const introduced = errs.filter((f, i) => { const n = left.get(keys[i]) ?? 0; if (n > 0) { left.set(keys[i], n - 1); return false; } return true; });
  return { introduced, fixed: [...left.values()].reduce((a, b) => a + b, 0) };
}
