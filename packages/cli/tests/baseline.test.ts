import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';

const dirs: string[] = [];
const mk = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), 'fringe-bl-')); dirs.push(d);
  for (const [n, c] of Object.entries(files)) { mkdirSync(join(d, n, '..'), { recursive: true }); writeFileSync(join(d, n), c); }
  return d;
};
const run = async (args: string[]) => { const out: string[] = []; const err: string[] = []; const code = await runCli(args, { log: (s) => out.push(s), err: (s) => err.push(s) }); return { code, out: out.join('\n'), err: err.join('') }; };
const IMG = '<html><body><img src="a.png"></body></html>';

describe('baseline', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('gates only on findings added after the baseline', async () => {
    const d = mk({ 'a.html': IMG });
    expect((await run(['check', d])).code).toBe(1);
    expect((await run(['check', d, '--update-baseline'])).code).toBe(0);
    const after = await run(['check', d]);
    expect(after.code).toBe(0);
    expect(after.out).toContain('1 baselined');
    writeFileSync(join(d, 'b.html'), IMG);                     // a new file with the same problem
    expect((await run(['check', d])).code).toBe(1);
    writeFileSync(join(d, 'a.html'), '\n\n' + IMG);            // moved lines must not resurrect the old finding
    rmSync(join(d, 'b.html'));
    expect((await run(['check', d])).code).toBe(0);
  });
  it('a corrupt baseline fails loudly (exit 2), not silently green', async () => {
    const d = mk({ 'a.html': IMG, 'fringe.baseline.json': '{nope' });
    const r = await run(['check', d]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('baseline');
  });
});

describe('init', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('adds the hook once and keeps existing settings', async () => {
    const d = mk({ '.claude/settings.json': JSON.stringify({ permissions: { allow: ['x'] } }) });
    expect((await run(['init', d])).code).toBe(0);
    await run(['init', d]);
    const s = JSON.parse(readFileSync(join(d, '.claude/settings.json'), 'utf8'));
    expect(s.permissions.allow).toEqual(['x']);
    expect(s.hooks.PostToolUse).toHaveLength(1);
    expect(existsSync(join(d, '.claude/skills/fringe/SKILL.md'))).toBe(true);
  });
  it('refuses to overwrite invalid settings.json', async () => {
    const d = mk({ '.claude/settings.json': '{bad' });
    expect((await run(['init', d])).code).toBe(2);
    expect(readFileSync(join(d, '.claude/settings.json'), 'utf8')).toBe('{bad');
  });
});
