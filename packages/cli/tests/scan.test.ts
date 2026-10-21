import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { axeToFindings, tabWalkFindings, scan, SCAN_HELP } from '../src/scan.js';
import { runCli } from '../src/index.js';

const v = (id: string, impact: string, tags: string[], targets: string[][]) =>
  ({ id, impact, help: `${id} help`, helpUrl: `https://x/${id}`, tags, nodes: targets.map((target) => ({ target, failureSummary: 'Fix any of the following:\n  Do the thing' })) });

describe('axeToFindings', () => {
  it('gates serious/critical, advises moderate, tags WCAG, one finding per element', () => {
    const f = axeToFindings('http://x', [v('color-contrast', 'serious', ['wcag2aa', 'wcag143'], [['p'], ['h2']]), v('region', 'moderate', ['best-practice'], [['div']])]);
    expect(f.map((x) => [x.rule, x.severity, x.wcag])).toEqual([['FR-400', 'error', '1.4.3'], ['FR-400', 'error', '1.4.3'], ['FR-400', 'review', undefined]]);
    expect(f[0].message).toContain('color-contrast at p: Do the thing');
    expect(f[0].hint).toContain('color-contrast help');
  });
});

describe('tabWalkFindings', () => {
  it('reports a keyboard trap after 4 identical stops, and controls never reached', () => {
    const f = tabWalkFindings('u', ['button[0]', 'input[1]', 'a[2]'], ['button[0]', 'input[1]', 'input[1]', 'input[1]', 'input[1]']);
    expect(f.filter((x) => x.severity === 'error')).toHaveLength(1);
    expect(f.find((x) => x.severity === 'review')!.message).toContain('a[2]');
  });
  it('is silent when every control is reached once', () => {
    expect(tabWalkFindings('u', ['a[0]', 'b[1]'], ['a[0]', 'b[1]', null])).toEqual([]);
  });
});

describe('scan CLI', () => {
  it('rejects non-http(s)/file URLs and a missing URL with exit 2', async () => {
    expect(await runCli(['scan'], { log: () => {}, err: () => {} })).toBe(2);
    const errs: string[] = [];
    expect(await runCli(['scan', 'javascript:alert(1)'], { log: () => {}, err: (s) => errs.push(s) })).toBe(2);
    expect(errs.join('')).toContain('http(s)');
  });
  it('the missing-dependency message tells the user the install command', () => {
    expect(SCAN_HELP).toContain('npm i -D playwright-core axe-core');
  });
  // Real browser end to end; skipped on machines without Chrome.
  it.skipIf(!existsSync('/Applications/Google Chrome.app') && !existsSync('/usr/bin/google-chrome'))('finds real contrast and a keyboard trap in a live page', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-scan-'));
    const page = join(dir, 'p.html');
    writeFileSync(page, '<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1><p style="color:#bbb;background:#fff">faint text</p><input aria-label="stuck" onblur="setTimeout(()=>this.focus(),0)"><button>after</button></main></body></html>');
    const r = await scan(pathToFileURL(page).href, join(__dirname, '..'));
    rmSync(dir, { recursive: true, force: true });
    expect(r.findings.some((f) => f.message.startsWith('color-contrast'))).toBe(true);
    expect(r.findings.some((f) => f.rule === 'FR-401' && f.severity === 'error')).toBe(true);
  }, 60000);
});

import { rankScan, mergeScan } from '../src/scan.js';
import { buildPlan, toPlanMarkdown } from '../src/report/plan.js';
import type { CheckResult } from '../src/types.js';

const empty: CheckResult = { stack: { jsx: true, tailwind: false, vue: false, svelte: false, html: false }, files: 3, skipped: [], findings: [], counts: { error: 0, review: 0, signal: 0 }, score: 100 };

describe('scan results join the plan', () => {
  const runtime = rankScan('http://x/', axeToFindings('http://x/', [v('color-contrast', 'serious', ['wcag143'], [['p'], ['h2'], ['li']]), v('region', 'moderate', ['best-practice'], [['div']])]));
  const scanned: CheckResult = { ...empty, files: 1, findings: runtime.findings, clusters: runtime.clusters, counts: { error: 3, review: 1, signal: 0 } };
  it('one cluster per axe rule with element selectors; errors before review', () => {
    const merged = mergeScan({ ...empty, clusters: [] }, scanned, { error: 10, review: 3, signal: 1 });
    const plan = buildPlan(merged);
    expect(plan.map((b) => b.id)).toEqual(['P1', 'P2']);
    expect(plan[0].items[0]).toMatchObject({ rule: 'FR-400', count: 3, targets: ['p', 'h2', 'li'] });
    expect(merged.counts).toEqual({ error: 3, review: 1, signal: 0 });
    expect(toPlanMarkdown(merged, '.')).toMatch(/Elements: p \| h2 \| li[\s\S]*Fix:/);
  });
  it('a static shared-component error stays ahead of runtime ones', () => {
    const staticErr: CheckResult = { ...empty, findings: [{ rule: 'FR-203', severity: 'error', message: 'm', hint: 'h', loc: { file: '/p/ui/Input.tsx', line: 1, col: 0 }, cluster: 'FR-203@ui/Input.tsx', priority: 1050 }], clusters: [{ id: 'FR-203@ui/Input.tsx', rule: 'FR-203', file: 'ui/Input.tsx', count: 1, priority: 1050, fixability: 'mechanical', rootCause: 'shared component', importedBy: 5, critical: false }], counts: { error: 1, review: 0, signal: 0 } };
    const plan = buildPlan(mergeScan(staticErr, scanned, { error: 10, review: 3, signal: 1 }));
    expect(plan[0].id).toBe('P0');
    expect(plan[0].items[0].rule).toBe('FR-203');
  });
});

describe('plan --scan', () => {
  it('rejects --scan without a URL', async () => {
    const errs: string[] = [];
    expect(await runCli(['plan', '--scan'], { log: () => {}, err: (s) => errs.push(s) })).toBe(2);
    expect(errs.join('')).toContain('--scan needs a URL');
  });
  it.skipIf(!existsSync('/Applications/Google Chrome.app') && !existsSync('/usr/bin/google-chrome'))('merges a live page into the static plan', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-planscan-'));
    writeFileSync(join(dir, 'package.json'), '{}');
    writeFileSync(join(dir, 'a.html'), '<img src="x.png">');
    const page = join(dir, 'p.html');
    writeFileSync(page, '<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1><p style="color:#bbb;background:#fff">faint</p></main></body></html>');
    const out: string[] = [];
    await runCli(['plan', dir, '--scan', pathToFileURL(page).href], { log: (s) => out.push(s), err: () => {}, cwd: join(__dirname, '..') });
    rmSync(dir, { recursive: true, force: true });
    expect(out.join('\n')).toMatch(/FR-201[\s\S]*FR-400 · ×1/);
  }, 60000);
});
