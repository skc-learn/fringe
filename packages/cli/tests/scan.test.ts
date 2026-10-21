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
    await expect(scan('http://127.0.0.1:1', join(__dirname, '..'), { storageState: '/nope/auth.json' })).rejects.toThrow(/storage state file not found[\s\S]*fringe login/);
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

import { parseSessions } from '../src/scan.js';
import type { Server } from 'node:http';

describe('scan: sessions, scripted login, expiry', () => {
  it('parses login and sessions, with paths relative to the file', () => {
    const s = parseSessions({ sessions: [{ name: 'admin', storageState: 'a.json' }, { name: 'member', login: { url: '/login', steps: [{ fill: '#e', value: '${env:X}' }, { click: 'text=Go' }] } }] }, '/cfg');
    expect(s).toMatchObject([{ name: 'admin', storageState: '/cfg/a.json' }, { name: 'member', login: { url: '/login' } }]);
    expect(parseSessions({ login: { steps: [{ click: 'b' }] } }, '/cfg')).toHaveLength(1);
    expect(parseSessions({}, '/cfg')).toEqual([]);
    expect(() => parseSessions({ sessions: [{ name: 'x' }] }, '/cfg')).toThrow(/needs a "storageState" or a "login"/);
    expect(() => parseSessions({ sessions: [{ storageState: 'a' }] }, '/cfg')).toThrow(/needs a "name"/);
    expect(() => parseSessions({ login: { steps: [] } }, '/cfg')).toThrow(/non-empty/);
  });
  it('a file that only describes a login needs no states', () => { expect(parseStates({ login: { steps: [{ click: 'b' }] } })).toEqual([]); });

  const roles = (c: string | undefined) => /session=(admin|member)/.exec(c ?? '')?.[1];
  async function app(): Promise<{ server: Server; url: string }> {
    const server = createServer((req, res) => {
      const role = roles(req.headers.cookie);
      const html = (b: string) => { res.setHeader('content-type', 'text/html'); res.end(`<!doctype html><html lang="en"><head><title>t</title></head><body><main>${b}</main></body></html>`); };
      if (req.url === '/autologin') { res.setHeader('set-cookie', 'session=member; Path=/'); res.statusCode = 302; res.setHeader('location', '/app'); return res.end(); }
      if (req.url === '/login' && req.method === 'GET') return html('<h1>Sign in</h1><form method="post" action="/login"><label for="e">Email</label><input id="e" name="email"><label for="p">Password</label><input id="p" name="password" type="password"><button type="submit">Sign in</button></form>');
      if (req.url === '/login' && req.method === 'POST') {
        let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
          const q = new URLSearchParams(body);
          if (q.get('password') === 'pw') { res.setHeader('set-cookie', `session=${q.get('email')!.startsWith('admin') ? 'admin' : 'member'}; Path=/`); res.statusCode = 302; res.setHeader('location', '/app'); return res.end(); }
          html('<h1>Sign in</h1><p role="alert">Wrong password</p><input type="password" aria-label="Password">');
        }); return;
      }
      if (req.url === '/app') {
        if (!role) { res.statusCode = 302; res.setHeader('location', '/login'); return res.end(); }
        return html(role === 'admin' ? '<h1>Admin</h1><p style="color:#bbb;background:#fff">faint admin text</p>' : '<h1>Member</h1><p>all good</p>');
      }
      res.statusCode = 404; res.end();
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
  }
  const cwd = join(__dirname, '..');
  const loginSteps = (who: string) => [{ fill: '#e', value: `\${env:FRINGE_T_${who}_EMAIL}` }, { fill: '#p', value: '${env:FRINGE_T_PW}' }, { click: 'button:has-text("Sign in")' }, { waitFor: 'h1:has-text("' + (who === 'ADMIN' ? 'Admin' : 'Member') + '")' }];

  it('rejects a missing environment variable before opening a browser, naming it but never a value', async () => {
    delete process.env.FRINGE_T_PW;
    await expect(scan('http://127.0.0.1:1/app', cwd, { sessions: [{ login: { steps: [{ fill: '#p', value: '${env:FRINGE_T_PW}' }] } }] })).rejects.toThrow(/environment variable FRINGE_T_PW is not set/);
  });

  it.skipIf(!HAS_CHROME)('logs in with scripted steps per role, labels findings by role, and warns when the session is rejected', async () => {
    const { server, url } = await app();
    process.env.FRINGE_T_ADMIN_EMAIL = 'admin@x'; process.env.FRINGE_T_MEMBER_EMAIL = 'member@x'; process.env.FRINGE_T_PW = 'pw';
    try {
      const r = await scan(`${url}/app`, cwd, { sessions: [
        { name: 'admin', login: { url: '/login', steps: loginSteps('ADMIN') as never } },
        { name: 'member', login: { url: '/login', steps: loginSteps('MEMBER') as never } },
      ] });
      const faint = r.findings.filter((f) => f.message.includes('color-contrast'));
      expect(faint).toHaveLength(1);
      expect(faint[0].message).toMatch(/^\[as admin\] color-contrast/);                  // only the admin role has the problem
      expect(JSON.stringify(r)).not.toContain('"pw"');                                    // the secret never lands in a result
      const stale = await scan(`${url}/app`, cwd, { sessions: [{ name: 'ghost', login: undefined, storageState: undefined }] });
      expect(stale.findings.find((f) => f.rule === 'FR-405')?.message).toMatch(/\/login[\s\S]*looks like a login page/);
    } finally { server.close(); }
  }, 120000);

  it.skipIf(!HAS_CHROME)('fringe login saves a session that scan can then use', async () => {
    const { server, url } = await app();
    const dir = mkdtempSync(join(tmpdir(), 'fringe-login-'));
    const out = join(dir, 'auth.json');
    try {
      const code = await runCli(['login', `${url}/autologin`, '--headless', '--out', out], { log: () => {}, err: () => {}, cwd, waitForUser: async () => {} });
      expect(code).toBe(0);
      expect(existsSync(out)).toBe(true);
      const r = await scan(`${url}/app`, cwd, { storageState: out });
      expect(r.findings.find((f) => f.rule === 'FR-405')).toBeUndefined();               // we are in, not bounced to /login
    } finally { server.close(); rmSync(dir, { recursive: true, force: true }); }
  }, 90000);

  it('login without a URL exits 2', async () => {
    expect(await runCli(['login'], { log: () => {}, err: () => {} })).toBe(2);
  });
});
