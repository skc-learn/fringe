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

import { parseStates } from '../src/scan.js';
describe('scan states', () => {
  it('validates fringe.scan.json with clear messages', () => {
    expect(parseStates({ states: [{ name: 'menu', steps: [{ click: '#m' }, { fill: '#q', value: 'x' }, { press: 'Escape' }] }] })).toHaveLength(1);
    expect(() => parseStates({})).toThrow(/expected \{ "states"/);
    expect(() => parseStates({ states: [{ name: 'a', steps: [] }] })).toThrow(/non-empty/);
    expect(() => parseStates({ states: [{ name: 'a', steps: [{ click: '#a', hover: '#b' }] }] })).toThrow(/exactly one of/);
    expect(() => parseStates({ states: [{ name: 'a', steps: [{ fill: '#a' }] }] })).toThrow(/exactly one of|value/);
    expect(() => parseStates({ states: [{ steps: [{ click: '#a' }] }] })).toThrow(/needs a "name"/);
  });
  it.skipIf(!existsSync('/Applications/Google Chrome.app') && !existsSync('/usr/bin/google-chrome'))('finds a problem that only exists after a click, labels it with the state, and reports an unreachable state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-states-'));
    const page = join(dir, 'p.html');
    writeFileSync(page, '<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1><button id="open" onclick="document.getElementById(\'d\').hidden=false">Open</button><div id="d" hidden><p style="color:#bbb;background:#fff">faint dialog text</p></div></main></body></html>');
    const url = pathToFileURL(page).href;
    const none = await scan(url, join(__dirname, '..'));
    const r = await scan(url, join(__dirname, '..'), { states: [{ name: 'dialog open', steps: [{ click: '#open' }] }, { name: 'broken', steps: [{ click: '#nope' }] }] });
    rmSync(dir, { recursive: true, force: true });
    expect(none.findings.some((f) => f.message.includes('color-contrast'))).toBe(false);
    const hit = r.findings.find((f) => f.message.startsWith('[dialog open] color-contrast'));
    expect(hit?.loc.file).toContain('[dialog open]');
    expect(r.clusters!.some((c) => c.id.endsWith('[dialog open]'))).toBe(true);
    expect(r.findings.find((f) => f.rule === 'FR-402')?.message).toContain('[broken] state could not be reached: step 1');
  }, 90000);
});

import { parseModes, onlyNew, MODES } from '../src/scan.js';
describe('stress modes', () => {
  it('parses a mode list and rejects unknown names', () => {
    expect(parseModes('dark, reflow')).toEqual(['dark', 'reflow']);
    expect(() => parseModes('dark,sepia')).toThrow(/unknown scan mode 'sepia'/);
    expect(MODES).toEqual(['dark', 'reduced', 'reflow']);
  });
  it('keeps only findings the plain page did not already have', () => {
    const a = { rule: 'FR-400', severity: 'error' as const, message: 'm1', hint: '', loc: { file: 'u', line: 1, col: 0 } };
    expect(onlyNew([a], [a, { ...a, message: 'm2' }]).map((f) => f.message)).toEqual(['m2']);
  });
  it.skipIf(!existsSync('/Applications/Google Chrome.app') && !existsSync('/usr/bin/google-chrome'))('finds dark-mode contrast, an animation that ignores reduced motion, and a 320px overflow', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-stress-'));
    const page = join(dir, 'p.html');
    writeFileSync(page, `<!doctype html><html lang="en"><head><title>t</title><style>
      @media (prefers-color-scheme: dark) { body { background:#222 } p { color:#333 } }
      @keyframes pulse { to { opacity:.5 } } .pulse { animation: pulse 1s infinite alternate }
      .wide { width: 600px; background:#eee }
    </style></head><body><main><h1>x</h1><p>readable on light</p><div class="pulse">live</div><div class="wide">wide block</div></main></body></html>`);
    const url = pathToFileURL(page).href;
    const r = await scan(url, join(__dirname, '..'), { modes: ['dark', 'reduced', 'reflow'] });
    rmSync(dir, { recursive: true, force: true });
    expect(r.findings.some((f) => f.message.startsWith('[dark mode] color-contrast'))).toBe(true);
    expect(r.findings.some((f) => f.rule === 'FR-403')).toBe(true);
    expect(r.findings.some((f) => f.rule === 'FR-404' && f.wcag === '1.4.10')).toBe(true);
    expect(r.findings.some((f) => f.message.startsWith('[reflow] color-contrast'))).toBe(false); // dark emulation must not leak into the next mode
  }, 90000);
});

import { createServer } from 'node:http';
import { readdirSync } from 'node:fs';
const HAS_CHROME = existsSync('/Applications/Google Chrome.app') || existsSync('/usr/bin/google-chrome');
const FAINT = '<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1><p style="color:#bbb;background:#fff">faint</p></main></body></html>';

describe('scan: login session, screenshots, baseline', () => {
  it('reports a missing storage-state file with how to create one', async () => {
    await expect(scan('http://127.0.0.1:1', join(__dirname, '..'), { storageState: '/nope/auth.json' })).rejects.toThrow(/storage state file not found[\s\S]*codegen --save-storage/);
  }, 30000);

  it.skipIf(!HAS_CHROME)('scans a page behind a login using a saved session, saves screenshots, and baselines the findings', async () => {
    const server = createServer((req, res) => { // the secret page only exists with the cookie
      res.setHeader('content-type', 'text/html');
      res.end(/session=ok/.test(req.headers.cookie ?? '') ? FAINT : '<!doctype html><html lang="en"><head><title>login</title></head><body><main><h1>Please sign in</h1></main></body></html>');
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
    const dir = mkdtempSync(join(tmpdir(), 'fringe-session-'));
    const auth = join(dir, 'auth.json');
    writeFileSync(auth, JSON.stringify({ cookies: [{ name: 'session', value: 'ok', domain: '127.0.0.1', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] }));
    const cwd = join(__dirname, '..');
    try {
      const anon = await scan(url, cwd);
      expect(anon.findings).toEqual([]);                                               // without the session: only the login page
      const shots = join(dir, 'shots');
      const r = await scan(url, cwd, { storageState: auth, screenshots: shots });
      expect(r.findings.some((f) => f.message.startsWith('color-contrast'))).toBe(true); // with it: the real page
      expect(readdirSync(shots)).toContain('initial.png');
      const bl = join(cwd, 'fringe.scan.baseline.json');
      try {
        await scan(url, cwd, { storageState: auth, updateBaseline: true });
        const again = await scan(url, cwd, { storageState: auth });
        expect(again.findings).toEqual([]);                                            // known problems are quiet
        expect(again.baselined).toBeGreaterThan(0);
      } finally { rmSync(bl, { force: true }); }
    } finally { server.close(); rmSync(dir, { recursive: true, force: true }); }
  }, 90000);
});
