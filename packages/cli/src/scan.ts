import { createRequire } from 'node:module';
import { join } from 'node:path';
import { score } from './score.js';
import type { CheckResult, Finding } from './types.js';

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
    return v.nodes.map((n) => ({
      rule: 'FR-400', severity, message: `${v.id} at ${n.target.join(' ')}: ${v.help}`,
      hint: `${(n.failureSummary ?? '').split('\n').slice(1, 2).join('').trim() || v.help} (${v.helpUrl})`, loc: at(url), ...(wcag ? { wcag } : {}),
    }));
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

export async function scan(url: string, cwd = process.cwd()): Promise<CheckResult> {
  if (!/^(https?|file):\/\//i.test(url)) throw new Error(`fringe scan takes an http(s):// or file:// URL, got '${url}'`);
  const req = createRequire(join(cwd, 'noop.js'));
  let playwright: any, axePath: string;
  try { playwright = req('playwright-core'); axePath = req.resolve('axe-core/axe.min.js'); } catch { throw new Error(SCAN_HELP); }
  let browser: any;
  try { browser = await playwright.chromium.launch({ channel: 'chrome' }); }
  catch { try { browser = await playwright.chromium.launch(); } catch { throw new Error(SCAN_HELP); } }
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.addScriptTag({ path: axePath });
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
    const findings = [...axeToFindings(url, axeRes.violations), ...tabWalkFindings(url, focusables, visits)];
    const counts = { error: 0, review: 0, signal: 0 };
    for (const f of findings) counts[f.severity]++;
    return { stack: { jsx: false, tailwind: false, vue: false, svelte: false, html: true }, files: 1, skipped: [], findings, counts, score: score(counts, { error: 10, review: 3, signal: 1 }, 1) };
  } finally { await browser.close(); }
}
