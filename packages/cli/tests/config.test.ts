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
  it('parses a valid tokenSource through', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ tokenSource: { kind: 'css-vars' } }));
    expect(loadConfig(d).tokenSource).toEqual({ kind: 'css-vars' });
  });
  it('rejects unknown tokenSource kind, mentioning fringe.config.json', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ tokenSource: { kind: 'nope' } }));
    expect(() => loadConfig(d)).toThrow(/fringe\.config\.json/);
  });
  it('requires a path for design-tokens-json', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ tokenSource: { kind: 'design-tokens-json' } }));
    expect(() => loadConfig(d)).toThrow(/fringe\.config\.json/);
  });
  it('accepts design-tokens-json with a path', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ tokenSource: { kind: 'design-tokens-json', path: 'tokens.json' } }));
    expect(loadConfig(d).tokenSource).toEqual({ kind: 'design-tokens-json', path: 'tokens.json' });
  });
});
