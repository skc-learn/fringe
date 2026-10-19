import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FringeConfig } from './types.js';

const EXTS = ['.jsx', '.tsx', '.js', '.ts', '.html', '.css', '.vue', '.svelte', '.astro', '.scss'];

export function globToRegex(g: string): RegExp {
  const esc = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp('^' + esc + '$');
}

export function walk(root: string, cfg: FringeConfig): string[] {
  const ignores = cfg.ignore.map(globToRegex);
  const out: string[] = [];
  const rec = (dir: string, depth: number) => {
    if (depth > 12) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      const rel = relative(root, p);
      if (e.isDirectory()) rec(p, depth + 1);
      else if (EXTS.some((x) => e.name.endsWith(x)) && !ignores.some((r) => r.test(rel))) out.push(p);
    }
  };
  rec(root, 0);
  return out;
}
