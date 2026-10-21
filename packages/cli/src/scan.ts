import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { score } from './score.js';
import { TIER, wcagBonus } from './prioritize.js';
import type { CheckResult, Cluster, Finding } from './types.js';

/** Runtime accessibility scan of a live page: axe-core inside headless Chrome, plus a Tab-key walk. Needs the optional `playwright-core` and `axe-core` packages in the project being scanned. */
export const SCAN_HELP = 'fringe scan needs two optional packages in your project: npm i -D playwright-core axe-core (it uses your installed Google Chrome; otherwise run npx playwright-core install chromium)';

const WCAG_TAG = /^wcag(\d)(\d)(\d+)$/;
const FOCUSABLE = 'a[href], button, input:not([type=hidden]):not([type=radio]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

interface AxeNode { target: string[]; failureSummary?: string }
export interface AxeViolation { id: string; impact?: string; help: string; helpUrl: string; tags: string[]; nodes: AxeNode[] }

const at = (url: string) => ({ file: url, line: 1, col: 0 });

/** One finding per failing element. axe's critical/serious gate (error); moderate/minor advise (review). */
export function axeToFindings(url: string, violations: AxeViolation[]): Finding[] {
  return violations.flatMap((v) => {
    const tag = v.tags.map((t) => WCAG_TAG.exec(t)).find(Boolean);
    const wcag = tag ? `${tag[1]}.${tag[2]}.${tag[3]}` : undefined;
    const severity = v.impact === 'critical' || v.impact === 'serious' ? 'error' as const : 'review' as const;
    return v.nodes.map((n) => {
      const detail = (n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim() || v.help;
      return {
      rule: 'FR-400', severity, target: n.target.join(' '), cluster: `${v.id}@${url}`, message: `${v.id} at ${n.target.join(' ')}: ${detail}`,
      hint: `${v.help} (${v.helpUrl})`, loc: at(url), ...(wcag ? { wcag } : {}),
    }; });
  });
}

/** `focusables` = everything the page offers to the keyboard; `visits` = what each Tab press landed on (null = left the page). */
export function tabWalkFindings(url: string, focusables: string[], visits: Array<string | null>): Finding[] {
  const out: Finding[] = [];
  let run = 1;
  for (let i = 1; i < visits.length; i++) {
    run = visits[i] !== null && visits[i] === visits[i - 1] ? run + 1 : 1;
    if (run === 4) out.push({ rule: 'FR-401', severity: 'error', message: `keyboard trap: Tab keeps landing on ${visits[i]}`, hint: 'let focus move on (Tab or Escape must leave), and trap it only inside an open modal dialog', loc: at(url), wcag: '2.1.2' });
  }
  const reached = new Set(visits.filter(Boolean));
  const missed = focusables.filter((f) => !reached.has(f));
  if (missed.length > 0)
    out.push({ rule: 'FR-401', severity: 'review', message: `${missed.length} interactive element(s) were not reached with Tab: ${missed.slice(0, 5).join(', ')}${missed.length > 5 ? ', …' : ''}`, hint: 'make sure each control is a real button/link/input or has tabIndex={0}; hidden-until-hover controls also land here', loc: at(url), wcag: '2.1.1' });
  return out;
}

/** One step in a state script. Selectors are Playwright selectors (CSS, text=..., role=...). */
export type Step = { click: string } | { fill: string; value: string } | { press: string } | { hover: string } | { waitFor: string } | { goto: string };
export interface ScanState { name: string; steps: Step[] }

const STEP_KEYS = ['click', 'fill', 'press', 'hover', 'waitFor', 'goto'] as const;

const bad = (m: string): never => { throw new Error(`fringe.scan.json: ${m}`); };

function checkSteps(steps: any, where: string): Step[] {
  if (!Array.isArray(steps) || steps.length === 0) return bad(`${where} needs a non-empty "steps" list`);
  for (const [k, step] of steps.entries()) {
    const keys = STEP_KEYS.filter((x) => step && typeof step === 'object' && x in step);
    if (keys.length !== 1 || typeof step[keys[0]] !== 'string') bad(`${where} step ${k + 1} must be exactly one of ${STEP_KEYS.join(', ')} with a string value`);
    if (keys[0] === 'fill' && typeof step.value !== 'string') bad(`${where} step ${k + 1}: fill needs a "value"`);
  }
  return steps;
}

/** Validates the contents of fringe.scan.json: `{ "states": [{ "name": "menu open", "steps": [{ "click": "#menu" }] }] }`. `states` may be omitted when the file only describes a login. */
export function parseStates(json: unknown): ScanState[] {
  const o = json as { states?: unknown; login?: unknown; sessions?: unknown; storageState?: unknown };
  if (o?.states === undefined && (o?.login !== undefined || o?.sessions !== undefined || o?.storageState !== undefined)) return [];
  if (!Array.isArray(o?.states)) return bad('expected { "states": [ ... ] }');
  return o.states.map((s: any, i: number) => {
    if (typeof s?.name !== 'string' || !s.name.trim()) bad(`states[${i}] needs a "name"`);
    return { name: s.name.trim(), steps: checkSteps(s.steps, `state "${s.name}"`) };
  });
}

/** A way to be logged in: a saved browser session, or steps that sign in (credentials come from ${env:NAME} so none are stored in the file). */
export interface Session { name?: string; storageState?: string; login?: { url?: string; steps: Step[] } }

/** Reads `login`, `storageState` and `sessions` from fringe.scan.json. Paths are relative to the file (`baseDir`). */
export function parseSessions(json: unknown, baseDir: string): Session[] {
  const o = (json ?? {}) as { login?: any; storageState?: unknown; sessions?: unknown };
  const one = (x: any, where: string, name?: string): Session => {
    if (x?.storageState !== undefined && typeof x.storageState !== 'string') bad(`${where}: storageState must be a file path`);
    if (x?.login !== undefined && typeof x.login?.url !== 'undefined' && typeof x.login.url !== 'string') bad(`${where}: login.url must be a string`);
    return { ...(name ? { name } : {}), ...(x?.storageState ? { storageState: join(baseDir, x.storageState) } : {}), ...(x?.login ? { login: { ...(x.login.url ? { url: x.login.url } : {}), steps: checkSteps(x.login.steps, `${where} login`) } } : {}) };
  };
  const out: Session[] = [];
  if (o.login !== undefined || o.storageState !== undefined) out.push(one(o, 'top level'));
  if (o.sessions !== undefined) {
    if (!Array.isArray(o.sessions) || o.sessions.length === 0) bad('"sessions" must be a non-empty list');
    for (const [i, s] of (o.sessions as any[]).entries()) {
      if (typeof s?.name !== 'string' || !s.name.trim()) bad(`sessions[${i}] needs a "name"`);
      if (!s.storageState && !s.login) bad(`session "${s.name}" needs a "storageState" or a "login"`);
      out.push(one(s, `session "${s.name}"`, s.name.trim()));
    }
  }
  return out;
}

const ENV_REF = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g;
/** Replaces ${env:NAME} with the variable's value. Used at run time only, so secrets never appear in messages or saved files. */
const expandEnv = (s: string) => s.replace(ENV_REF, (_m, n: string) => { const v = process.env[n]; if (v === undefined) throw new Error(`environment variable ${n} is not set (named in fringe.scan.json)`); return v; });
const envNames = (steps: Step[]) => steps.flatMap((st) => ('fill' in st ? [st.value] : 'goto' in st ? [st.goto] : []).flatMap((v) => [...v.matchAll(ENV_REF)].map((m) => m[1])));

async function runStep(page: any, step: Step, base: string): Promise<void> {
  const t = { timeout: 10000 };
  if ('click' in step) await page.click(step.click, t);
  else if ('fill' in step) await page.fill(step.fill, expandEnv(step.value), t);
  else if ('press' in step) await page.keyboard.press(step.press);
  else if ('hover' in step) await page.hover(step.hover, t);
  else if ('waitFor' in step) await page.waitForSelector(step.waitFor, t);
  else await page.goto(new URL(expandEnv(step.goto), base).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(150); // let transitions settle before the next step or the audit
}

/** axe-core plus a Tab walk on whatever the page looks like right now. */
async function audit(page: any, axePath: string, url: string): Promise<Finding[]> {
  if (!(await page.evaluate(() => !!(globalThis as any).axe))) await page.addScriptTag({ path: axePath });
  const axeRes = await page.evaluate(() => (globalThis as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  const describe = `(el) => { const i = [...document.querySelectorAll(${JSON.stringify(FOCUSABLE)})].indexOf(el); return i < 0 ? null : el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '[' + i + ']'; }`;
  const focusables: string[] = await page.evaluate(`[...document.querySelectorAll(${JSON.stringify(FOCUSABLE)})].filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.disabled; }).map((el, _i, all) => (${describe})(el))`);
  const visits: Array<string | null> = [];
  for (let i = 0; i < focusables.length + 6; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(40); // let focus/blur handlers settle: a script that steals focus back only shows up after a tick
    const now: string | null = await page.evaluate(`(${describe})(document.activeElement)`);
    if (now === null && visits.length > 0) break; // focus left the page content: the walk wrapped around
    visits.push(now);
  }
  return [...axeToFindings(url, axeRes.violations), ...tabWalkFindings(url, focusables, visits)];
}

/** Findings from a named state say so, and cluster separately from the same rule on the initial page. */
const inState = (name: string, url: string, f: Finding): Finding =>
  ({ ...f, message: `[${name}] ${f.message}`, loc: { ...f.loc, file: `${f.loc.file === url ? url : f.loc.file} [${name}]` }, ...(f.cluster ? { cluster: `${f.cluster} [${name}]` } : {}) });

export const MODES = ['dark', 'reduced', 'reflow'] as const;
export type Mode = (typeof MODES)[number];

/** `--stress` = every mode; `--modes dark,reflow` = a subset. */
export function parseModes(list: string): Mode[] {
  const out = list.split(',').map((m) => m.trim()).filter(Boolean);
  const bad = out.find((m) => !(MODES as readonly string[]).includes(m));
  if (bad || out.length === 0) throw new Error(`unknown scan mode '${bad ?? ''}': use ${MODES.join(', ')}`);
  return out as Mode[];
}

/** A stress pass re-runs the whole audit, so most of what it finds was already reported on the plain page. Keep only what is new. */
export function onlyNew(base: Finding[], extra: Finding[]): Finding[] {
  const seen = new Set(base.map((f) => `${f.rule}|${f.message}`));
  return extra.filter((f) => !seen.has(`${f.rule}|${f.message}`));
}

const countRunningLoops = `[...document.getAnimations()].filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => { const t = a.effect.target; return t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\\s+/)[0] : '') : 'unknown'; })`;

/** Re-checks the plain page under conditions many users really have. Findings are labelled with the mode. */
async function stress(context: any, axePath: string, url: string, mode: Mode, base: Finding[], shot: (page: any, name: string) => Promise<void>): Promise<Finding[]> {
  const page = await context.newPage(); // a fresh page per mode: media emulation never leaks from one mode into the next
  try { return await stressOn(page, axePath, url, mode, base, shot); } finally { await page.close(); }
}

async function stressOn(page: any, axePath: string, url: string, mode: Mode, base: Finding[], shot: (page: any, name: string) => Promise<void>): Promise<Finding[]> {
  const at0 = { file: `${url} [${mode}]`, line: 1, col: 0 };
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  if (mode === 'dark') {
    await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(150); await shot(page, 'mode-dark');
    return onlyNew(base, await audit(page, axePath, url)).map((f) => inState('dark mode', url, f));
  }
  if (mode === 'reduced') {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(300); await shot(page, 'mode-reduced');
    const loops: string[] = await page.evaluate(countRunningLoops);
    return loops.length === 0 ? [] : [{ rule: 'FR-403', severity: 'review', message: `[reduced motion] ${loops.length} animation(s) keep looping when the user asks for reduced motion: ${loops.slice(0, 3).join(', ')}`, hint: 'honour prefers-reduced-motion: stop or replace infinite animations under @media (prefers-reduced-motion: reduce)', loc: at0 }];
  }
  await page.setViewportSize({ width: 320, height: 256 }); await page.waitForTimeout(250); await shot(page, 'mode-reflow'); // 400% zoom of a 1280px window
  const wide: number = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const out: Finding[] = wide > 1 ? [{ rule: 'FR-404', severity: 'review', message: `[reflow] content is ${wide}px wider than a 320px screen, so it needs horizontal scrolling`, hint: 'let content reflow to one column at 320px (WCAG 1.4.10); wide tables and code blocks may scroll inside their own container', loc: at0, wcag: '1.4.10' }] : [];
  return [...out, ...onlyNew(base, await audit(page, axePath, url)).map((f) => inState('reflow', url, f))];
}

export interface ScanOptions {
  states?: ScanState[];
  modes?: Mode[];
  /** Shorthand for one unnamed session loaded from a Playwright storage-state file (cookies + localStorage). */
  storageState?: string;
  /** Who to be logged in as. Default: nobody. With several, the whole scan runs once per session and findings are labelled `[as name]`. */
  sessions?: Session[];
  /** Directory to save a full-page PNG of every state and mode into. */
  screenshots?: string;
  /** Write today's findings to fringe.scan.baseline.json instead of reporting them. */
  updateBaseline?: boolean;
}

const baselinePath = (cwd: string) => join(cwd, 'fringe.scan.baseline.json');
// Matches on rule + page/state + element, not on axe's wording or numbers, so a contrast ratio that shifts by 0.1 stays "known".
const scanKey = (f: Finding) => `${f.rule}|${f.loc.file}|${f.message.split(': ')[0]}`;

function applyScanBaseline(cwd: string, findings: Finding[]): { fresh: Finding[]; known: number } {
  if (!existsSync(baselinePath(cwd))) return { fresh: findings, known: 0 };
  let keys: string[];
  try { keys = JSON.parse(readFileSync(baselinePath(cwd), 'utf8')); if (!Array.isArray(keys)) throw 0; } catch { throw new Error('fringe.scan.baseline.json is not a JSON array: rerun with --update-baseline'); }
  const left = new Map<string, number>();
  for (const k of keys) left.set(k, (left.get(k) ?? 0) + 1);
  const fresh = findings.filter((f) => { const k = scanKey(f), n = left.get(k) ?? 0; if (n > 0) { left.set(k, n - 1); return false; } return true; });
  return { fresh, known: findings.length - fresh.length };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
const LOGINISH = /log-?in|sign-?in|sso|auth/i;
const firstLine = (e: unknown) => String((e as Error).message).split('\n')[0].slice(0, 120);

/** If the scan was bounced to a login screen, everything it finds describes the login page, not the app: say so. */
async function loginRedirect(page: any, requested: string, who: string | undefined): Promise<Finding[]> {
  let now: URL, want: URL;
  try { now = new URL(page.url()); want = new URL(requested); } catch { return []; }
  if (now.pathname === want.pathname) return [];
  const hasPassword: boolean = await page.evaluate(() => !!document.querySelector('input[type=password]'));
  if (!LOGINISH.test(now.pathname) && !hasPassword) return [];
  return [{ rule: 'FR-405', severity: 'review', message: `the scan was sent to ${now.pathname}, which looks like a login page: ${who ? `the "${who}" session may have expired or the login failed` : 'this page needs a login'}`, hint: 'save a session with `fringe login <url>` or add a "login" block to fringe.scan.json; findings for this page describe the login screen, not your app', loc: { file: requested, line: 1, col: 0 } }];
}

/** Everything audited for one browser context (one login): the plain page, each named state, each stress mode. */
async function auditContext(context: any, axePath: string, url: string, opts: ScanOptions, who: string | undefined, shot: (page: any, name: string) => Promise<void>): Promise<Finding[]> {
  const { states = [], modes = [] } = opts;
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await shot(page, 'initial');
  const all: Finding[] = [...(await loginRedirect(page, url, who)), ...(await audit(page, axePath, url))];
  const plain = [...all];
  for (const st of states) {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    let step = 0;
    try { for (; step < st.steps.length; step++) await runStep(page, st.steps[step], url); }
    catch (e) {
      // The raw step is shown (with ${env:...} placeholders), never the expanded secret.
      all.push({ rule: 'FR-402', severity: 'review', message: `[${st.name}] state could not be reached: step ${step + 1} ${JSON.stringify(st.steps[step])} failed (${firstLine(e)})`, hint: 'fix the step in fringe.scan.json or the page; nothing in this state was audited', loc: { file: `${url} [${st.name}]`, line: 1, col: 0 } });
      continue;
    }
    await shot(page, `state-${st.name}`);
    all.push(...(await audit(page, axePath, url)).map((f) => inState(st.name, url, f)));
  }
  for (const m of modes) all.push(...(await stress(context, axePath, url, m, plain, shot)));
  return all;
}

export async function scan(url: string, cwd = process.cwd(), opts: ScanOptions = {}): Promise<CheckResult> {
  const { states = [], modes = [] } = opts;
  if (!/^(https?|file):\/\//i.test(url)) throw new Error(`fringe scan takes an http(s):// or file:// URL, got '${url}'`);
  const sessions: Session[] = opts.sessions?.length ? opts.sessions : [opts.storageState ? { storageState: opts.storageState } : {}];
  // Fail before opening a browser: a missing secret or session file is a setup problem, not a finding.
  for (const n of new Set([...sessions.flatMap((s) => envNames(s.login?.steps ?? [])), ...states.flatMap((s) => envNames(s.steps))])) {
    if (process.env[n] === undefined) throw new Error(`environment variable ${n} is not set (named in fringe.scan.json)`);
  }
  for (const s of sessions) if (s.storageState && !existsSync(s.storageState)) throw new Error(`storage state file not found: ${s.storageState} (create one with: fringe login ${url})`);
  const req = createRequire(join(cwd, 'noop.js'));
  let playwright: any, axePath: string;
  try { playwright = req('playwright-core'); axePath = req.resolve('axe-core/axe.min.js'); } catch { throw new Error(SCAN_HELP); }
  let browser: any;
  try { browser = await playwright.chromium.launch({ channel: 'chrome' }); }
  catch { try { browser = await playwright.chromium.launch(); } catch { throw new Error(SCAN_HELP); } }
  try {
    const all: Finding[] = [];
    for (const s of sessions) {
      const who = s.name, label = who ? `as ${who}` : undefined;
      const shot = async (page: any, name: string) => {
        if (!opts.screenshots) return;
        mkdirSync(opts.screenshots, { recursive: true });
        await page.screenshot({ path: join(opts.screenshots, `${slug(who ? `${who}-${name}` : name)}.png`), fullPage: true });
      };
      const context = await browser.newContext(s.storageState ? { storageState: s.storageState } : {});
      try {
        let found: Finding[];
        if (s.login) {
          const lp = await context.newPage();
          let step = 0;
          try {
            await lp.goto(new URL(s.login.url ?? url, url).href, { waitUntil: 'load', timeout: 30000 });
            for (; step < s.login.steps.length; step++) await runStep(lp, s.login.steps[step], url);
            found = await auditContext(context, axePath, url, opts, who, shot);
          } catch (e) {
            found = [{ rule: 'FR-402', severity: 'review', message: `login${who ? ` as ${who}` : ''} failed at step ${step + 1} ${JSON.stringify(s.login.steps[step] ?? {})} (${firstLine(e)})`, hint: 'check the login steps and selectors in fringe.scan.json; nothing was scanned for this session', loc: { file: url, line: 1, col: 0 } }];
          } finally { await lp.close().catch(() => {}); }
        } else found = await auditContext(context, axePath, url, opts, who, shot);
        all.push(...(label ? found.map((f) => inState(label, url, f)) : found));
      } finally { await context.close(); }
    }
    const files = sessions.length * (1 + states.length + modes.length);
    if (opts.updateBaseline) {
      writeFileSync(baselinePath(cwd), JSON.stringify(all.map(scanKey).sort(), null, 2) + '\n');
      return { stack: { jsx: false, tailwind: false, vue: false, svelte: false, html: true }, files, skipped: [], findings: [], clusters: [], counts: { error: 0, review: 0, signal: 0 }, score: 100, baselined: all.length };
    }
    const { fresh, known } = applyScanBaseline(cwd, all);
    const { findings, clusters } = rankScan(url, fresh);
    const counts = { error: 0, review: 0, signal: 0 };
    for (const f of findings) counts[f.severity]++;
    return { stack: { jsx: false, tailwind: false, vue: false, svelte: false, html: true }, files, skipped: [], findings, clusters, counts, score: score(counts, { error: 10, review: 3, signal: 1 }, 1), ...(known ? { baselined: known } : {}) };
  } finally { await browser.close(); }
}

/** Puts runtime findings on the same footing as static ones: a priority each, and one cluster per axe rule (one root cause, many elements). */
export function rankScan(url: string, findings: Finding[]): { findings: Finding[]; clusters: Cluster[] } {
  const clusters = new Map<string, Cluster>();
  const ranked = findings.map((f) => {
    const priority = Math.round(TIER[f.severity] + wcagBonus(f.wcag));
    const id = f.cluster ?? `${f.rule}@${url}`;
    const c = clusters.get(id) ?? { id, rule: f.rule, file: f.loc.file, count: 0, priority: 0, fixability: 'judgment', rootCause: 'local', importedBy: 0, critical: false } as Cluster;
    c.count++; c.priority = Math.max(c.priority, priority);
    clusters.set(id, c);
    return { ...f, priority, cluster: id, fixability: c.fixability };
  });
  for (const c of clusters.values()) c.priority += Math.round(Math.min(15, 3 * Math.log2(c.count)));
  return { findings: ranked, clusters: [...clusters.values()] };
}

/** One CheckResult from a static run plus a runtime scan: the input `fringe plan --scan` orders. */
export function mergeScan(base: CheckResult, scanned: CheckResult, weights: { error: number; review: number; signal: number }): CheckResult {
  const counts = { error: base.counts.error + scanned.counts.error, review: base.counts.review + scanned.counts.review, signal: base.counts.signal + scanned.counts.signal };
  return { ...base, findings: [...base.findings, ...scanned.findings], clusters: [...(base.clusters ?? []), ...(scanned.clusters ?? [])].sort((a, b) => b.priority - a.priority), counts, score: score(counts, weights, base.files), ...((base.baselined ?? 0) + (scanned.baselined ?? 0) ? { baselined: (base.baselined ?? 0) + (scanned.baselined ?? 0) } : {}) };
}
