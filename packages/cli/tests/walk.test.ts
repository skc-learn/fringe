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
  return d;
}

describe('walk', () => {
  it('finds files, skips node_modules', () => {
    const files = walk(seed(), DEFAULT_CONFIG).map((f) => f.split('/').pop()!).sort();
    expect(files).toEqual(['App.tsx', 'a.css', 'b.tsx']);
  });
  it('honors ignore globs', () => {
    const d = seed();
    const files = walk(d, { ...DEFAULT_CONFIG, ignore: [...DEFAULT_CONFIG.ignore, 'gen/**'] });
    expect(files.some((f) => f.endsWith('b.tsx'))).toBe(false);
  });
});
