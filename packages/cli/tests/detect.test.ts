import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack } from '../src/detect.js';

function dir() { return mkdtempSync(join(tmpdir(), 'fringe-det-')); }

describe('detectStack', () => {
  it('detects react+tailwind from package.json', () => {
    const d = dir();
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { react: '*', tailwindcss: '*' } }));
    expect(detectStack(d)).toEqual({ jsx: true, tailwind: true, vue: false, svelte: false, html: false });
  });
  it('detects jsx from files when package.json is silent', () => {
    const d = dir(); mkdirSync(join(d, 'src'));
    writeFileSync(join(d, 'src', 'App.jsx'), '<div/>');
    expect(detectStack(d).jsx).toBe(true);
  });
  it('no stack in empty dir', () => {
    const d = dir();
    expect(detectStack(d)).toEqual({ jsx: false, tailwind: false, vue: false, svelte: false, html: false });
  });
});
