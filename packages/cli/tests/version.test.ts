import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/version.js';

describe('version', () => {
  it('is semver', () => expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/));
});

import { readFileSync } from 'node:fs';
import { VERSION as V } from '../src/version.js';
describe('version', () => {
  it('matches package.json so --version never lies after a release bump', () => {
    expect(V).toBe(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  });
});
