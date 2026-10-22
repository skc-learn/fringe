// The entire runtime the Claude Code plugin ships: the post-edit check and the playbook prompt hook, nothing else.
// No browser, login, hand-off, init or network code lives here, so what a plugin reviewer reads is what runs.
// Built and vendored into plugin/vendor by scripts/vendor-plugin.mjs.
import { realpathSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { runCheck } from './check.js';
import { loadConfig } from './config.js';
import { receipts } from './receipts.js';
import { toClaudeHook } from './report/hook.js';
import { promptHookOutput } from './promptHook.js';

const readStdin = () => new Promise<string>((ok) => {
  if (process.stdin.isTTY) return ok('');
  let d = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => ok(d));
});

/** `tool_input.file_path` from the hook's JSON, if it names a file inside the project (symlink-safe: /var and /private/var are the same place on macOS). */
function editedFile(stdin: string, cwd: string): string | undefined {
  try {
    const p = JSON.parse(stdin)?.tool_input?.file_path;
    if (typeof p !== 'string') return undefined;
    const rel = relative(realpathSync(cwd), realpathSync(p));
    return rel && !rel.startsWith('..') && !isAbsolute(rel) ? join(cwd, rel) : undefined;
  } catch { return undefined; }
}

/** A hook must never break the user's session: every failure is swallowed and the exit code is always 0. */
export async function main(argv: string[], cwd: string, log: (s: string) => void): Promise<void> {
  try {
    if (argv[0] === 'check') {
      const cfg = loadConfig(cwd);
      const file = editedFile(await readStdin(), cwd);
      const only = file ? new Set([file]) : undefined; // the edited file, when Claude says which; otherwise the whole project
      const result = await runCheck(cwd, cfg, true, only, true);
      const out = toClaudeHook(result, cwd, receipts(cwd, result.findings, file ? [file] : undefined));
      if (out) log(out);
    } else if (argv[0] === 'hook-prompt') {
      const out = promptHookOutput(await readStdin());
      if (out) log(out);
    }
  } catch { /* never fail the user's edit */ }
}

if (process.argv[1] && /pluginHook\.(m?js|ts)$/.test(process.argv[1])) await main(process.argv.slice(2), process.cwd(), (s) => console.log(s));
