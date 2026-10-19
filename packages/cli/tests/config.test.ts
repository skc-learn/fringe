import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

function dir() { return mkdtempSync(join(tmpdir(), 'fringe-cfg-')); }

describe('loadConfig', () => {
  it('returns defaults when no config file', () => {
    const c = loadConfig(dir());
    expect(c.weights).toEqual({ error: 10, review: 3, signal: 1 });
    expect(c.ignore).toContain('node_modules/**');
  });
  it('merges user config', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ disable: ['FR-208'] }));
    const c = loadConfig(d);
    expect(c.disable).toEqual(['FR-208']);
    expect(c.weights.error).toBe(10);
  });
  it('throws on bad weights', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ weights: { error: 'x' } }));
    expect(() => loadConfig(d)).toThrow(/fringe\.config\.json/);
  });
  it('returns a fresh object each call (defaults not shared)', () => {
    const a = loadConfig(dir());
    a.ignore.push('mutated/**');
    const b = loadConfig(dir());
    expect(b.ignore).not.toContain('mutated/**');
  });
});
