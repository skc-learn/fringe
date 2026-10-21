import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';

const dirs: string[] = [];
function mk(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'fringe-handoff-')); dirs.push(d);
  for (const [n, c] of Object.entries(files)) { mkdirSync(join(d, n, '..'), { recursive: true }); writeFileSync(join(d, n), c); }
  return d;
}
const run = async (args: string[], cwd?: string) => { const out: string[] = [], err: string[] = []; const code = await runCli(args, { log: (s) => out.push(s), err: (s) => err.push(s), cwd }); return { code, out: out.join('\n'), err: err.join('') }; };
const OK = '<html lang="en"><head><title>t</title></head><body><img src="a.png" alt="A"></body></html>';
const BAD = (n: string) => `<html lang="en"><head><title>t</title></head><body><img src="${n}.png"></body></html>`;

describe('handoff and verify', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('hands off a self-contained work order and saves it', async () => {
    const d = mk({ 'package.json': '{}', 'a.html': BAD('a'), 'b.html': BAD('b') });
    const h = await run(['handoff', d]);
    expect(h.code).toBe(0);
    expect(h.out).toMatch(/# Fix the UX problems Fringe found[\s\S]*## Rules[\s\S]*Do not silence a rule[\s\S]*## Definition of done[\s\S]*status: complete[\s\S]*## The work[\s\S]*FR-201/);
    const saved = JSON.parse(readFileSync(join(d, '.fringe/handoff.json'), 'utf8'));
    expect(saved).toMatchObject({ schema: 'fringe/handoff.v1', counts: { error: 2 }, root: d });
    expect(h.err).toContain('fringe verify');
  });
  it('verify walks partial -> complete as the receiving agent fixes things', async () => {
    const d = mk({ 'package.json': '{}', 'a.html': BAD('a'), 'b.html': BAD('b') });
    await run(['handoff', d]);
    const none = await run(['verify', '--handoff', join(d, '.fringe/handoff.json')]);
    expect(none.code).toBe(1);
    expect(none.out).toContain('status: partial');
    writeFileSync(join(d, 'a.html'), OK);
    const half = await run(['verify', '--handoff', join(d, '.fringe/handoff.json')]);
    expect(half.out).toMatch(/1 of 2 fixed, 1 remaining/);
    writeFileSync(join(d, 'b.html'), OK);
    const done = await run(['verify', '--handoff', join(d, '.fringe/handoff.json')]);
    expect(done.code).toBe(0);
    expect(done.out).toContain('status: complete');
  });
  it('verify says regressed when the agent breaks something new, and flags new suppressions', async () => {
    const d = mk({ 'package.json': '{}', 'a.html': BAD('a') });
    await run(['handoff', d]);
    writeFileSync(join(d, 'a.html'), OK);
    writeFileSync(join(d, 'c.html'), BAD('c'));                       // introduced
    const reg = await run(['verify', '--handoff', join(d, '.fringe/handoff.json')]);
    expect(reg.code).toBe(1);
    expect(reg.out).toContain('status: regressed');
    expect(reg.out).toMatch(/Introduced since the hand-off[\s\S]*c\.html/);
    writeFileSync(join(d, 'c.html'), '<!-- fringe-ignore FR-201 -->\n<img src="c.png">');  // silenced instead of fixed
    const sup = await run(['verify', '--handoff', join(d, '.fringe/handoff.json')]);
    expect(sup.out).toMatch(/Needs human review: \d+ finding\(s\) were silenced/);
  });
  it('verify without a hand-off file exits 2 with a hint', async () => {
    const d = mk({});
    const r = await run(['verify'], d);
    expect(r.code).toBe(2);
    expect(r.err).toContain("run 'fringe handoff' first");
  });
  it('--json gives machine output for an orchestrating agent', async () => {
    const d = mk({ 'package.json': '{}', 'a.html': BAD('a') });
    await run(['handoff', d]);
    const v = JSON.parse((await run(['verify', '--handoff', join(d, '.fringe/handoff.json'), '--json'])).out);
    expect(v).toMatchObject({ schema: 'fringe/verify.v1', status: 'partial', errors: { before: 1, remaining: 1 } });
    expect(existsSync(join(d, '.fringe/handoff.json'))).toBe(true);
  });
});
