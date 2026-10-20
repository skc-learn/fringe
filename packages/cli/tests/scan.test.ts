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
    expect(f[0].message).toContain('color-contrast at p');
    expect(f[0].hint).toContain('Do the thing');
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
