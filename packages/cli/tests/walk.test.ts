import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walk } from '../src/walk.js';
import { DEFAULT_CONFIG } from '../src/config.js';

function seed() {
  const d = mkdtempSync(join(tmpdir(), 'fringe-walk-'));
  writeFileSync(join(d, 'App.tsx'), '');
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'a.css'), '');
  mkdirSync(join(d, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(d, 'node_modules', 'x', 'y.tsx'), '');
  mkdirSync(join(d, 'gen'));
  writeFileSync(join(d, 'gen', 'b.tsx'), '');
  for (const dir of ['build', 'out', 'coverage']) {
    mkdirSync(join(d, dir));
    writeFileSync(join(d, dir, `${dir}.tsx`), '');
  }
  return d;
}

describe('walk', () => {
  it('finds files, skips node_modules', () => {
    const files = walk(seed(), DEFAULT_CONFIG).map((f) => f.split('/').pop()!).sort();
    expect(files).toEqual(['App.tsx', 'a.css', 'b.tsx']);
  });
  it('skips build/, out/, and coverage/ by default', () => {
    const files = walk(seed(), DEFAULT_CONFIG);
    expect(files.some((f) => f.includes('/build/'))).toBe(false);
    expect(files.some((f) => f.includes('/out/'))).toBe(false);
    expect(files.some((f) => f.includes('/coverage/'))).toBe(false);
  });
  it('honors ignore globs', () => {
    const d = seed();
    const files = walk(d, { ...DEFAULT_CONFIG, ignore: [...DEFAULT_CONFIG.ignore, 'gen/**'] });
    expect(files.some((f) => f.endsWith('b.tsx'))).toBe(false);
  });
});

import { rmSync } from 'node:fs';
describe('default ignores', () => {
  it('skip nested build output (frontend/dist) as well as root dist', () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-walk-'));
    mkdirSync(join(d, 'frontend/dist/assets'), { recursive: true }); mkdirSync(join(d, 'dist'), { recursive: true }); mkdirSync(join(d, 'src'));
    for (const f of ['frontend/dist/assets/x.js', 'dist/y.js', 'src/ok.tsx']) writeFileSync(join(d, f), 'x');
    const found = walk(d, DEFAULT_CONFIG).map((p) => p.slice(d.length + 1));
    rmSync(d, { recursive: true, force: true });
    expect(found).toEqual(['src/ok.tsx']);
  });
});
