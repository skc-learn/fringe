import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { VERSION } from './version.js';
import { runCheck } from './check.js';
import { toJson } from './report/json.js';
import { appendRecord } from './ledger.js';
import type { LedgerRecord } from './ledger.js';

export interface CliOpts { log?: (s: string) => void; err?: (s: string) => void; cwd?: string }
const log = (o: CliOpts) => o.log ?? ((s: string) => console.log(s));
const err = (o: CliOpts) => o.err ?? ((s: string) => process.stderr.write(s));

/** Reads `{ flows: [...] }` from a manifest file; warns and returns undefined if unreadable. */
function readManifest(path: string, warn: (s: string) => void): LedgerRecord['manifest'] {
  let raw: string;
  try { raw = readFileSync(path, 'utf8'); } catch { warn(`fringe: warning: manifest not found at ${path} — continuing without\n`); return undefined; }
  try {
    const parsed = JSON.parse(raw) as LedgerRecord['manifest'];
    if (!parsed || !Array.isArray(parsed.flows)) throw new Error('missing flows');
    return parsed;
  } catch { warn(`fringe: warning: manifest at ${path} is not valid '{ flows: [...] }' JSON — continuing without\n`); return undefined; }
}

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') { log(opts)(VERSION); return 0; }
  if (cmd === 'check') {
    const root = opts.cwd ?? process.cwd();
    const result = await runCheck(root);
    if (rest.includes('--json')) log(opts)(toJson(result));
    else {
      log(opts)(`fringe: score ${result.score}/100 — ${result.counts.error} errors, ${result.counts.review} review, ${result.counts.signal} signal (${result.files} files)`);
      for (const f of result.findings)
        log(opts)(`  ${f.severity}  ${f.rule}  ${f.loc.file}:${f.loc.line}:${f.loc.col}  ${f.message}`);
      for (const s of result.skipped) log(opts)(`  skipped: ${s}`);
    }
    if (rest.includes('--record')) {
      const rec: LedgerRecord = {
        id: randomUUID(),
        ts: new Date().toISOString(),
        stack: result.stack,
        files: result.files,
        counts: result.counts,
        score: result.score,
      };
      const mIdx = rest.indexOf('--manifest');
      if (mIdx !== -1 && rest[mIdx + 1] !== undefined) rec.manifest = readManifest(rest[mIdx + 1], err(opts));
      appendRecord(root, rec);
    }
    return result.counts.error > 0 ? 1 : 0;
  }
  log(opts)(`fringe: unknown command '${cmd ?? ''}' — try 'fringe check --help'`);
  return 2;
}
