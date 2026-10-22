import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { keyOf } from './baseline.js';
import { fringeDir } from './state.js';
import type { Finding } from './types.js';

export interface History { introduced: Finding[]; fixed: number }
const file = (root: string) => join(root, '.fringe', 'last.json');
type State = Record<string, string[]>; // project-relative file -> error fingerprints from the previous hook run

function readState(root: string): State | undefined {
  try { const p = JSON.parse(readFileSync(file(root), 'utf8')); return p && typeof p === 'object' && !Array.isArray(p) ? p : undefined; } catch { return undefined; } // old array format or unreadable: no comparison
}

/** What changed in the error set since the previous hook run. With `scope` (the files this run judged), only those files are compared and rewritten, so a run for one file never marks other files as fixed. undefined = nothing to compare with. The state is replaced atomically and every failure to read or write it is swallowed. */
export function receipts(root: string, findings: Finding[], scope?: string[]): History | undefined {
  const errs = findings.filter((f) => f.severity === 'error');
  const cur: State = {};
  for (const f of errs) (cur[relative(root, f.loc.file)] ??= []).push(keyOf(root, f));
  const scoped = scope ? new Set(scope.map((s) => relative(root, s))) : undefined;
  const prevState = readState(root);
  try {
    const next: State = { ...(scoped ? prevState : undefined) }; // unscoped runs rewrite everything; scoped runs keep other files' entries
    for (const k of scoped ?? Object.keys({ ...prevState, ...cur })) { if (cur[k]?.length) next[k] = cur[k]; else delete next[k]; }
    const tmp = `${file(root)}.${process.pid}.tmp`;
    fringeDir(root); writeFileSync(tmp, JSON.stringify(next)); renameSync(tmp, file(root));
  } catch { /* best effort */ }
  if (!prevState) return undefined;
  const left = new Map<string, number>();
  for (const [f, keys] of Object.entries(prevState)) if (!scoped || scoped.has(f)) for (const k of keys) left.set(k, (left.get(k) ?? 0) + 1);
  const inScope = errs.filter((f) => !scoped || scoped.has(relative(root, f.loc.file)));
  const introduced = inScope.filter((f) => { const k = keyOf(root, f), n = left.get(k) ?? 0; if (n > 0) { left.set(k, n - 1); return false; } return true; });
  return { introduced, fixed: [...left.values()].reduce((a, b) => a + b, 0) };
}
