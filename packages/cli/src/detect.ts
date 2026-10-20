import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StackInfo } from './types.js';

/** Directory names never descended into during stack marker detection. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage']);

function findFile(dir: string, match: (name: string) => boolean, depth: number): boolean {
  if (depth > 6) return false;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    if (e.isDirectory()) { if (findFile(join(dir, e.name), match, depth + 1)) return true; }
    else if (match(e.name)) return true;
  }
  return false;
}

export function detectStack(root: string): StackInfo {
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch { /* no package.json */ }
  const has = (...names: string[]) => names.some((n) => deps[n]);
  return {
    jsx: has('react', 'react-dom', 'preact', 'solid-js') || findFile(root, (n) => n.endsWith('.jsx') || n.endsWith('.tsx'), 0),
    tailwind: has('tailwindcss'),
    vue: has('vue', 'nuxt'),
    svelte: has('svelte'),
    html: findFile(root, (n) => n.endsWith('.html'), 0),
  };
}
