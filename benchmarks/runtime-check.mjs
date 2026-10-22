// Renders the components produced by benchmarks/playbooks.mjs in a real browser and tests what they DO, not what their source says:
// `fringe scan` (axe-core + keyboard walk) plus one behaviour probe per task.
// Usage: node benchmarks/runtime-check.mjs <results dir from playbooks.mjs>   (needs network once, to install react/esbuild/playwright-core/axe-core into a temp tool dir)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node benchmarks/runtime-check.mjs <results dir>'); process.exit(2); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'packages/cli/dist/bin.js');
const tool = mkdtempSync(join(tmpdir(), 'fringe-rt-'));
writeFileSync(join(tool, 'package.json'), '{"name":"rt","private":true}');
execFileSync('npm', ['i', 'react@18', 'react-dom@18', 'esbuild', 'playwright-core', 'axe-core'], { cwd: tool, stdio: 'ignore' });
const req = createRequire(join(tool, 'x.js'));
const { chromium } = req('playwright-core');
const FILE = { carousel: 'Carousel', tabs: 'Tabs', modal: 'ConfirmModal', login: 'Login', table: 'UsersTable', search: 'Search' };

function bundle(cell, task) {
  const comp = join(SRC, cell, 'src', `${FILE[task]}.tsx`);
  if (!existsSync(comp)) return null;
  const dir = join(tool, cell); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'entry.tsx'), `import * as M from ${JSON.stringify(comp)};\nimport { createRoot } from 'react-dom/client';\nimport { createElement } from 'react';\nconst C: any = (M as any).default ?? Object.values(M).find((v) => typeof v === 'function');\ncreateRoot(document.getElementById('root')!).render(createElement(C));\n`);
  try {
    execFileSync(join(tool, 'node_modules/.bin/esbuild'), [join(dir, 'entry.tsx'), '--bundle', '--format=iife', `--outdir=${dir}`, '--jsx=automatic', '--define:process.env.NODE_ENV="development"'], { cwd: tool, env: { ...process.env, NODE_PATH: join(tool, 'node_modules') }, stdio: 'pipe' });
  } catch (e) { return { error: 'build failed: ' + String(e.stderr ?? e).split('\n')[0].slice(0, 120) }; }
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${task}</title>${existsSync(join(dir, 'entry.css')) ? '<link rel="stylesheet" href="entry.css">' : ''}</head><body><div id="root"></div><script src="entry.js"></script></body></html>`);
  return { url: pathToFileURL(join(dir, 'index.html')).href };
}

const scanCell = (url) => {
  try { return JSON.parse(execFileSync('node', [BIN, 'scan', url, '--json'], { cwd: tool, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch (e) { try { return JSON.parse(e.stdout); } catch { return null; } }
};

// One behaviour probe per task: does the thing the playbook asks for actually work?
const probes = {
  async carousel(page) {
    const pause = page.locator('button', { hasText: /pause|stop/i }).or(page.locator('button[aria-label*="ause" i], button[aria-label*="top" i]')).first();
    if (!(await pause.count())) return { ok: false, note: 'no pause/stop button' };
    const same = async (ms) => { const a = await page.screenshot(); await page.waitForTimeout(ms); return a.equals(await page.screenshot()); };
    if (await same(6500)) return { ok: null, note: 'did not visibly rotate in 6.5s, cannot judge' };   // slides may all sit in the page, so compare pixels, not text
    await pause.click(); await page.waitForTimeout(1200); // let any fade finish before comparing
    return { ok: await same(6500), note: 'pause button stops rotation' };
  },
  async tabs(page) {
    const tabs = page.locator('[role="tab"]');
    if ((await tabs.count()) < 2) return { ok: false, note: 'no role=tab elements' };
    await tabs.nth(0).focus(); await page.keyboard.press('ArrowRight');
    const moved = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement !== document.querySelectorAll('[role="tab"]')[0]);
    return { ok: moved, note: 'ArrowRight moves to the next tab' };
  },
  async login(page) {
    const btn = page.locator('button[type="submit"], button:has-text("Sign in")').first();
    if (!(await btn.count())) return { ok: false, note: 'no submit button' };
    await btn.click(); await page.waitForTimeout(400);
    const announced = await page.evaluate(() => [...document.querySelectorAll('[role="alert"], [aria-live], [role="status"]')].some((e) => (e.textContent ?? '').trim().length > 0));
    const nativeBlocked = await page.evaluate(() => !!document.querySelector('input:invalid'));
    return { ok: announced || nativeBlocked, note: 'empty submit gives an announced error (or native validation)' };
  },
  async table(page) {
    const th = page.locator('th button, th[role="columnheader"], th').first();
    if (!(await th.count())) return { ok: false, note: 'no table header' };
    await th.click().catch(() => {}); await page.waitForTimeout(200);
    return { ok: await page.evaluate(() => !!document.querySelector('[aria-sort]')), note: 'sorting sets aria-sort' };
  },
  async search(page) {
    const input = page.locator('input').first();
    if (!(await input.count())) return { ok: false, note: 'no input' };
    await input.fill('zzzz-no-match'); await page.waitForTimeout(400);
    const live = await page.evaluate(() => [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].some((e) => (e.textContent ?? '').trim().length > 0));
    return { ok: live, note: 'results/no-results change is announced' };
  },
  async modal(page) {
    const open = page.locator('button', { hasText: /delete|open|show|confirm/i }).first();
    if (await page.locator('[role="dialog"], [role="alertdialog"]').count() === 0 && await open.count()) await open.click().catch(() => {});
    await page.waitForTimeout(200);
    if (await page.locator('[role="dialog"], [role="alertdialog"]').count() === 0) return { ok: null, note: 'no dialog rendered without props, cannot judge' };
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    return { ok: (await page.locator('[role="dialog"], [role="alertdialog"]').count()) === 0, note: 'Escape closes the dialog' };
  },
};

const rows = [];
const browser = await chromium.launch({ channel: 'chrome' });
for (const cell of readdirSync(SRC).filter((d) => /^(plain|fringe)-/.test(d)).sort()) {
  const [arm, task, run] = cell.split('-');
  const b = bundle(cell, task);
  if (!b || b.error) { rows.push({ arm, task, run, rendered: false, note: b?.error ?? 'component file missing' }); continue; }
  const page = await browser.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(b.url); await page.waitForTimeout(500);
  const rendered = (await page.evaluate(() => document.getElementById('root')?.children.length ?? 0)) > 0;
  let probe = { ok: null, note: 'not rendered' };
  if (rendered) { try { probe = await probes[task](page, b.url); } catch (e) { probe = { ok: null, note: 'probe error: ' + String(e.message).split('\n')[0].slice(0, 80) }; }
    if (errors.length) probe = { ok: null, note: 'the component threw (it likely needs props): ' + errors[0].slice(0, 60) }; }
  await page.close();
  const s = rendered ? scanCell(b.url) : null;
  const row = { arm, task, run, rendered, axeErrors: s ? s.findings.filter((f) => f.rule === 'FR-400' && f.severity === 'error' && !f.message.startsWith('target-size')).length : null, targetSize: s ? s.findings.filter((f) => f.message.startsWith('target-size')).length : null, axeReview: s ? s.findings.filter((f) => f.rule === 'FR-400' && f.severity === 'review').length : null, keyboardTrap: s ? s.findings.some((f) => f.rule === 'FR-401' && f.severity === 'error') : null, probe: probe.ok, probeNote: probe.note, ...(errors[0] ? { error: errors[0].slice(0, 100) } : {}) };
  rows.push(row); console.log(JSON.stringify(row));
}
await browser.close();
const out = join(tool, 'runtime.json'); writeFileSync(out, JSON.stringify(rows, null, 1)); console.log('RESULTS', out);
