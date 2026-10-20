import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gatherTokenColors } from '../src/tokens.js';
import type { FringeConfig } from '../src/types.js';

function dir() { return mkdtempSync(join(tmpdir(), 'fringe-tok-')); }

function cfgWith(tokenSource: FringeConfig['tokenSource']): FringeConfig {
  return { ignore: [], disable: [], weights: { error: 10, review: 3, signal: 1 }, tokenSource };
}

describe('gatherTokenColors', () => {
  it('css-vars: keeps only custom-property values that parse as colors', () => {
    const d = dir();
    const file = join(d, 'styles.css');
    writeFileSync(file, ':root { --brand: #0b5fff; --pad: 16px; }');
    const out = gatherTokenColors(d, cfgWith({ kind: 'css-vars' }), [
      { file, source: readFileSync(file, 'utf8') },
    ]);
    expect(out).toEqual(['#0b5fff']);
  });

  it('theme-factory: gathers from provided css sources too', () => {
    const out = gatherTokenColors(dir(), cfgWith({ kind: 'theme-factory' }), [
      { file: 'a.css', source: ':root { --ink: rgb(11 95 255); --w: 4px; }' },
    ]);
    expect(out).toEqual(['rgb(11 95 255)']);
  });

  it('collects the value as written and dedupes across sources', () => {
    const out = gatherTokenColors(dir(), cfgWith({ kind: 'css-vars' }), [
      { file: 'a.css', source: '--x: #FFF;' },
      { file: 'b.css', source: '--y: #FFF;' },
    ]);
    expect(out).toEqual(['#FFF']);
  });

  it('design-tokens-json: recursive walk collects $value colors only', () => {
    const d = dir();
    writeFileSync(
      join(d, 'tokens.json'),
      JSON.stringify({ color: { brand: { $value: '#ff0000' } }, space: { 1: { $value: '4px' } } })
    );
    const out = gatherTokenColors(d, cfgWith({ kind: 'design-tokens-json', path: 'tokens.json' }), []);
    expect(out).toEqual(['#ff0000']);
  });

  it('dir with no color tokens → []', () => {
    const d = dir();
    const file = join(d, 'styles.css');
    writeFileSync(file, '.a { color: red; margin: 0; }');
    expect(gatherTokenColors(d, cfgWith({ kind: 'css-vars' }), [
      { file, source: readFileSync(file, 'utf8') },
    ])).toEqual([]);
  });

  it('no tokenSource configured → []', () => {
    expect(gatherTokenColors(dir(), cfgWith(undefined), [])).toEqual([]);
  });
});
