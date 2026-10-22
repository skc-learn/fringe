// The only code the Claude Code plugin ships: the playbook prompt hook. Dependency-free (no parsers, no network),
// so what a plugin reviewer reads is what runs. Built and vendored into plugin/vendor by scripts/vendor-plugin.mjs.
// The post-edit check is not here: plugin/hooks/check.sh runs the user's own installed `fringe`.
import { promptHookOutput } from './promptHook.js';

const readStdin = () => new Promise<string>((ok) => {
  if (process.stdin.isTTY) return ok('');
  let d = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => ok(d));
});

/** A hook must never break the user's session: every failure is swallowed and the exit code is always 0. */
export async function main(argv: string[], log: (s: string) => void): Promise<void> {
  try {
    if (argv[0] === 'hook-prompt') {
      const out = promptHookOutput(await readStdin());
      if (out) log(out);
    }
  } catch { /* never fail the user's prompt */ }
}

if (process.argv[1] && /pluginHook\.(m?js|ts)$/.test(process.argv[1])) await main(process.argv.slice(2), (s) => console.log(s));
