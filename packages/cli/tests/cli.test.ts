import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';

const FAILING_HTML = '<html><body><img src="hero.png"></body></html>';

const dirs: string[] = [];
/** Temp dir with the given relative-path -> content files. */
function makeDir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'fringe-cli-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

describe('runCli', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

  it('prints version for --version and exits 0', async () => {
    const logs: string[] = [];
    const code = await runCli(['--version'], { log: (s) => logs.push(s) });
    expect(code).toBe(0);
    expect(logs.join('\n')).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('exits 2 for unknown command', async () => {
    expect(await runCli(['nope'], { log: () => {} })).toBe(2);
  });

  it('check on a failing dir exits 1 and --json prints parseable fringe/check.v1', async () => {
    const dir = makeDir({ 'index.html': FAILING_HTML });
    const logs: string[] = [];
    const code = await runCli(['check', '--json', dir], { log: (s) => logs.push(s) });
    expect(code).toBe(1);
    const parsed = JSON.parse(logs.join('')) as { schema: string; counts: { error: number } };
    expect(parsed.schema).toBe('fringe/check.v1');
    expect(parsed.counts.error).toBeGreaterThanOrEqual(1);
  });
  it('check on a clean dir exits 0', async () => {
    const dir = makeDir();
    expect(await runCli(['check', dir], { log: () => {} })).toBe(0);
  });
  it('default human output is the pretty formatter', async () => {
    const dir = makeDir({ 'index.html': FAILING_HTML });
    const logs: string[] = [];
    await runCli(['check', dir], { log: (s) => logs.push(s) });
    const out = logs.join('\n');
    expect(out).toContain('fringe · stack');
    expect(out).toContain('health ');
    expect(out).toContain('FR-201');
  });
  it('first path argument is the root (cwd-independent)', async () => {
    const failing = makeDir({ 'index.html': FAILING_HTML });
    const clean = makeDir();
    // Explicit path args win over opts.cwd and process.cwd.
    expect(await runCli(['check', failing], { cwd: clean, log: () => {} })).toBe(1);
    expect(await runCli(['check', clean], { cwd: failing, log: () => {} })).toBe(0);
  });
  it('no path argument defaults to cwd', async () => {
    const dir = makeDir({ 'index.html': FAILING_HTML });
    expect(await runCli(['check'], { cwd: dir, log: () => {} })).toBe(1);
  });
  it('--record creates .fringe/ledger.jsonl with one line', async () => {
    const dir = makeDir({ 'index.html': FAILING_HTML });
    const code = await runCli(['check', '--record', dir], { log: () => {} });
    expect(code).toBe(1);
    const ledger = join(dir, '.fringe', 'ledger.jsonl');
    expect(existsSync(ledger)).toBe(true);
    const lines = readFileSync(ledger, 'utf8').split('\n').filter((l) => l.trim() !== '');
    expect(lines.length).toBe(1);
    const rec = JSON.parse(lines[0]) as { ts: string; counts: { error: number }; score: number };
    expect(rec.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(rec.counts.error).toBeGreaterThanOrEqual(1);
    expect(typeof rec.score).toBe('number');
  });
  it('unknown flag --wat warns on stderr but still exits 0 on a clean dir', async () => {
    const dir = makeDir();
    const errs: string[] = [];
    const code = await runCli(['check', '--wat', dir], { log: () => {}, err: (s) => errs.push(s) });
    expect(code).toBe(0);
    expect(errs.join('')).toContain('warning');
    expect(errs.join('')).toContain('--wat');
  });
});
