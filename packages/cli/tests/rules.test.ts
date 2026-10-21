import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';
import { appendRecord } from '../src/ledger.js';

const dirs: string[] = [];
function mk(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'fringe-rules-')); dirs.push(d);
  for (const [n, c] of Object.entries(files)) { mkdirSync(join(d, n, '..'), { recursive: true }); writeFileSync(join(d, n), c); }
  return d;
}
const run = async (args: string[]) => { const out: string[] = []; const code = await runCli(args, { log: (s) => out.push(s), err: () => {} }); return { code, out: out.join('\n') }; };

describe('fringe rules', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('separates open, baselined and silenced findings per rule', async () => {
    const imgs = Array.from({ length: 6 }, (_, i) => [`s${i}.html`, '<!-- fringe-ignore FR-201 -->\n<img src="x.png">']);
    const d = mk({ 'package.json': '{}', ...Object.fromEntries(imgs), 'open.html': '<img src="o.png">', 'in.html': '<input id="a">' });
    await run(['check', d, '--update-baseline']);                       // baselines the open img and the input
    writeFileSync(join(d, 'new.html'), '<img src="n.png">');            // one fresh FR-201 after the baseline
    const j = JSON.parse((await run(['rules', d, '--json'])).out);
    const r201 = j.rules.find((r: any) => r.rule === 'FR-201');
    expect(r201).toMatchObject({ silenced: 6, baselined: 1, open: 1 });
    expect(j.rules.find((r: any) => r.rule === 'FR-203')).toMatchObject({ baselined: 1, open: 0 });
    expect(j.schema).toBe('fringe/rules.v1');
  });
  it('flags a rule that is mostly overridden, and shows the ledger trend', async () => {
    const files = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`s${i}.html`, '<!-- fringe-ignore FR-201 -->\n<img src="x.png">']));
    const d = mk({ 'package.json': '{}', ...files });
    const rec = (n: number) => ({ id: 'x', ts: 't', stack: {} as never, files: 1, counts: { error: n, review: 0, signal: 0 }, score: 90, byRule: { 'FR-201': n } });
    appendRecord(d, rec(9)); appendRecord(d, rec(2));
    const out = (await run(['rules', d])).out;
    expect(out).toMatch(/FR-201\s+error\s+0\s+0\s+6\s+9 -> 2/);
    expect(out).toContain('Mostly overridden here (FR-201)');
  });
  it('says so when there is nothing to report', async () => {
    expect((await run(['rules', mk({ 'package.json': '{}', 'ok.html': '<p>ok</p>' })])).out).toContain('nothing to report');
  });
});
