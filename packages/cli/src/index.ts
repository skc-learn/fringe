import { VERSION } from './version.js';
import { runCheck } from './check.js';
import { toJson } from './report/json.js';

export interface CliOpts { log?: (s: string) => void }
const log = (o: CliOpts) => o.log ?? ((s: string) => console.log(s));

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') { log(opts)(VERSION); return 0; }
  if (cmd === 'check') {
    const result = await runCheck(process.cwd());
    if (rest.includes('--json')) log(opts)(toJson(result));
    else {
      log(opts)(`fringe: score ${result.score}/100 — ${result.counts.error} errors, ${result.counts.review} review, ${result.counts.signal} signal (${result.files} files)`);
      for (const f of result.findings)
        log(opts)(`  ${f.severity}  ${f.rule}  ${f.loc.file}:${f.loc.line}:${f.loc.col}  ${f.message}`);
      for (const s of result.skipped) log(opts)(`  skipped: ${s}`);
    }
    return result.counts.error > 0 ? 1 : 0;
  }
  log(opts)(`fringe: unknown command '${cmd ?? ''}' — try 'fringe check --help'`);
  return 2;
}
