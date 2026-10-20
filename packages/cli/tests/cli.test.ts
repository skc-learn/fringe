import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runCli } from '../src/index.js';
import { ALL_RULES } from '../src/rules/registry.js';

const FAILING_HTML = '<html lang="en"><head><title>t</title></head><body><img src="hero.png"></body></html>';

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

  it('check on a nonexistent root exits 2 with a one-line internal-error message on stderr', async () => {
    const missing = join(tmpdir(), 'fringe-nonexistent-' + randomUUID());
    const logs: string[] = [];
    const errs: string[] = [];
    const code = await runCli(['check', missing], { log: (s) => logs.push(s), err: (s) => errs.push(s) });
    expect(code).toBe(2);
    expect(logs).toEqual([]); // no report is printed when the run itself failed
    const lines = errs.join('').split('\n').filter((l) => l.trim() !== '');
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/internal error/i);
    expect(lines[0]).toContain(missing);
  });
  it('check with an unreadable config exits 2 instead of crashing the CLI', async () => {
    const dir = makeDir({ 'fringe.config.json': '{not json' });
    const errs: string[] = [];
    const code = await runCli(['check', dir], { log: () => {}, err: (s) => errs.push(s) });
    expect(code).toBe(2);
    expect(errs.join('')).toMatch(/internal error.*fringe\.config\.json/s);
  });
});

describe('explain and single-file check', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('explain prints why/fix/avoid for a rule, lists all with no id, exits 2 for an unknown id', async () => {
    const out: string[] = [];
    expect(await runCli(['explain', 'fr-203'], { log: (s) => out.push(s) })).toBe(0);
    expect(out.join('\n')).toMatch(/Why:[\s\S]*Fix:[\s\S]*Avoid:/);
    const all: string[] = [];
    await runCli(['explain'], { log: (s) => all.push(s) });
    expect(all.join('\n').split('\n').length).toBe(ALL_RULES.length);
    expect(await runCli(['explain', 'FR-999'], { log: () => {}, err: () => {} })).toBe(2);
  });
  it('checks one file but still finds the project root', async () => {
    const dir = makeDir({ 'package.json': '{}', 'a.html': FAILING_HTML, 'b.html': FAILING_HTML });
    const logs: string[] = [];
    const code = await runCli(['check', join(dir, 'a.html'), '--json'], { log: (s) => logs.push(s) });
    const r = JSON.parse(logs.join('\n'));
    expect(code).toBe(1);
    expect(r.findings.map((f: any) => f.loc.file)).toEqual([join(dir, 'a.html')]);
    expect(r.files).toBe(1);
  });
});
