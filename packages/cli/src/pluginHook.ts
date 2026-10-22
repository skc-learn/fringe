// The entire runtime the Claude Code plugin ships: the post-edit check and the playbook prompt hook, nothing else.
// No browser, login, hand-off, init or network code lives here, so what a plugin reviewer reads is what runs.
// Built and vendored into plugin/vendor by scripts/vendor-plugin.mjs.
import { runCheck } from './check.js';
import { loadConfig } from './config.js';
import { receipts } from './receipts.js';
import { toClaudeHook } from './report/hook.js';
import { promptHookOutput } from './promptHook.js';

const readStdin = () => new Promise<string>((ok) => {
  if (process.stdin.isTTY) return ok('');
  let d = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => ok(d));
});

/** A hook must never break the user's session: every failure is swallowed and the exit code is always 0. */
export async function main(argv: string[], cwd: string, log: (s: string) => void): Promise<void> {
  try {
    if (argv[0] === 'check') {
      const cfg = loadConfig(cwd);
      const result = await runCheck(cwd, cfg);
      const out = toClaudeHook(result, cwd, receipts(cwd, result.findings));
      if (out) log(out);
    } else if (argv[0] === 'hook-prompt') {
      const out = promptHookOutput(await readStdin());
      if (out) log(out);
    }
  } catch { /* never fail the user's edit */ }
}

if (process.argv[1] && /pluginHook\.(m?js|ts)$/.test(process.argv[1])) await main(process.argv.slice(2), process.cwd(), (s) => console.log(s));
