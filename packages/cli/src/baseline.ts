import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Finding } from './types.js';

const path = (root: string) => join(root, 'fringe.baseline.json');
// Line numbers are left out of the key so edits above a known finding don't resurrect it.
export const keyOf = (root: string, f: Finding) => `${f.rule}|${relative(root, f.loc.file)}|${f.message}`;

export function writeBaseline(root: string, findings: Finding[]): void {
  writeFileSync(path(root), JSON.stringify(findings.map((f) => keyOf(root, f)).sort(), null, 2) + '\n');
}

/** Splits findings into new ones and already-known ones; a known key covers one finding, so added duplicates still surface. */
export function applyBaseline(root: string, findings: Finding[]): { fresh: Finding[]; known: number } {
  if (!existsSync(path(root))) return { fresh: findings, known: 0 };
  let keys: string[];
  try { keys = JSON.parse(readFileSync(path(root), 'utf8')); if (!Array.isArray(keys)) throw 0; }
  catch { throw new Error('fringe.baseline.json is not a JSON array — rerun with --update-baseline'); }
  const left = new Map<string, number>();
  for (const k of keys) left.set(k, (left.get(k) ?? 0) + 1);
  const fresh = findings.filter((f) => {
    const k = keyOf(root, f), n = left.get(k) ?? 0;
    if (n > 0) { left.set(k, n - 1); return false; }
    return true;
  });
  return { fresh, known: findings.length - fresh.length };
}
