import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { SCAN_HELP } from './scan.js';

/** Opens a visible browser at `url`, lets the person log in by hand (passwords, MFA and SSO all work), then saves the cookies and local storage for `fringe scan --storage-state`. */
export async function saveSession(url: string, cwd: string, out: string, o: { headless?: boolean; wait?: () => Promise<void> } = {}): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error(`fringe login takes an http(s):// URL, got '${url}'`);
  const req = createRequire(join(cwd, 'noop.js'));
  let playwright: any;
  try { playwright = req('playwright-core'); } catch { throw new Error(SCAN_HELP); }
  let browser: any;
  const headless = o.headless ?? false;
  try { browser = await playwright.chromium.launch({ channel: 'chrome', headless }); }
  catch { try { browser = await playwright.chromium.launch({ headless }); } catch { throw new Error(SCAN_HELP); } }
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (o.wait) await o.wait();
    else {
      process.stderr.write('fringe: log in in the browser window, then come back here and press Enter. Close the window afterwards, not before.\n');
      await new Promise<void>((ok, fail) => {
        const rl = createInterface({ input: process.stdin });
        rl.once('line', () => { rl.close(); ok(); });
        browser.once('disconnected', () => { rl.close(); fail(new Error('the browser was closed before the session was saved: press Enter in this terminal first, then close the window')); });
      });
    }
    mkdirSync(dirname(out), { recursive: true });
    await context.storageState({ path: out });
  } finally { await browser.close().catch(() => {}); }
}
