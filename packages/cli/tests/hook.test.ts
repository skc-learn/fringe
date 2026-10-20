import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toHook } from '../src/report/hook.js';
import { runCli } from '../src/index.js';
import type { CheckResult, Finding } from '../src/types.js';

const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

function finding(rule: string, severity: Finding['severity'], line: number): Finding {
  return { rule, severity, message: `msg ${rule}`, hint: 'fix it', loc: { file: 'app.tsx', line, col: 1 } };
}

/** CheckResult with the given findings interleaved; counts derived. */
function result(findings: Finding[]): CheckResult {
  const counts = { error: 0, review: 0, signal: 0 };
  for (const f of findings) counts[f.severity]++;
  return {
    stack: { jsx: true, tailwind: false, vue: false, svelte: false, html: false },
    files: 1,
    skipped: [],
    findings,
    counts,
    score: 50,
  };
}

describe('toHook', () => {
  it('blocks on 2 errors / 1 review with one-line hook JSON', () => {
    // review first in the array: top finding must still be the first error
    const r = result([finding('FR-301', 'review', 1), finding('FR-202', 'error', 2), finding('FR-204', 'error', 3)]);
    const out = toHook(r);
    expect(out.split('\n')).toHaveLength(1);
    const j = JSON.parse(out);
    expect(j.schema).toBe('fringe/hook.v1');
    expect(j.errors).toBe(2);
    expect(j.review).toBe(1);
    expect(j.signals).toBe(0);
    expect(j.block).toBe(true);
    expect(j.reason).toContain('FR-202');
  });

  it('does not block when errors = 0', () => {
    const out = toHook(result([finding('FR-301', 'review', 1), finding('FR-302', 'signal', 2)]));
    expect(out.split('\n')).toHaveLength(1);
    const j = JSON.parse(out);
    expect(j.errors).toBe(0);
    expect(j.block).toBe(false);
    expect(j.reason).toContain('FR-301');
  });

  it('does not block on an empty result', () => {
    const j = JSON.parse(toHook(result([])));
    expect(j.block).toBe(false);
    expect(j.errors).toBe(0);
    expect(j.review).toBe(0);
    expect(j.signals).toBe(0);
  });
});

describe('runCli --hook', () => {
  it('prints only hook JSON and exits 1 when errors exist', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-hook-'));
    tmpDirs.push(dir);
    writeFileSync(join(dir, 'app.tsx'), 'export default () => <button onClick={save} />;\n');
    const logs: string[] = [];
    const code = await runCli(['check', '--hook'], { cwd: dir, log: (s) => logs.push(s) });
    expect(code).toBe(1);
    expect(logs).toHaveLength(1);
    const j = JSON.parse(logs[0]);
    expect(j.schema).toBe('fringe/hook.v1');
    expect(j.errors).toBeGreaterThan(0);
    expect(j.block).toBe(true);
  });

  it('prints block=false and exits 0 when clean', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-hook-'));
    tmpDirs.push(dir);
    writeFileSync(join(dir, 'app.tsx'), 'export default () => <button>Save</button>;\n');
    const logs: string[] = [];
    const code = await runCli(['check', '--hook'], { cwd: dir, log: (s) => logs.push(s) });
    expect(code).toBe(0);
    expect(logs).toHaveLength(1);
    const j = JSON.parse(logs[0]);
    expect(j.block).toBe(false);
    expect(j.errors).toBe(0);
  });
});
