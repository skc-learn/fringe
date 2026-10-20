import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VERSION } from './version.js';
import { runCheck } from './check.js';
import { toJson } from './report/json.js';
import { toHook } from './report/hook.js';
import { toPretty } from './report/pretty.js';
import { appendRecord } from './ledger.js';
import type { LedgerRecord } from './ledger.js';

export interface CliOpts { log?: (s: string) => void; cwd?: string; err?: (s: string) => void }
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

const KNOWN_FLAGS = new Set(['--json', '--hook', '--record', '--manifest']);

/** Splits check args into positional paths, warning on (and ignoring) unknown flags. */
function parseArgs(rest: string[], warn: (s: string) => void): string[] {
  const paths: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--manifest') { i++; continue; } // consume its value
    if (a.startsWith('--')) {
      if (!KNOWN_FLAGS.has(a)) warn(`fringe: warning: unknown flag '${a}' — ignored\n`);
      continue;
    }
    paths.push(a);
  }
  return paths;
}

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') { log(opts)(VERSION); return 0; }
  if (cmd === 'check') {
    const paths = parseArgs(rest, err(opts));
    const cwd = opts.cwd ?? process.cwd();
    // First path is the check root (config + scan); extra paths accepted so agent-invoked runs never crash.
    const root = paths.length > 0 ? resolve(cwd, paths[0]) : cwd;
    const result = await runCheck(root);
    if (rest.includes('--hook')) log(opts)(toHook(result));
    else if (rest.includes('--json')) log(opts)(toJson(result));
    else log(opts)(toPretty(result));
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
