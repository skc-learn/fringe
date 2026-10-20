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
import { loadConfig } from './config.js';
import { startBoard } from './board.js';
import { writeBaseline } from './baseline.js';
import { initProject } from './init.js';

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

const HELP = `fringe check [--json] [--hook] [--record] [--manifest <path>] [path]
fringe check --update-baseline [path]   accept today's findings; only new ones gate
fringe init [path]                       add the Claude Code hook + skill
fringe open [path] [--port <n>]   serve the .fringe ledger on 127.0.0.1
fringe --version`;

const KNOWN_FLAGS = new Set(['--json', '--hook', '--record', '--manifest', '--update-baseline']);

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
    try {
      const paths = parseArgs(rest, err(opts));
      const cwd = opts.cwd ?? process.cwd();
      // First path is the check root (config + scan); extra paths accepted so agent-invoked runs never crash.
      const root = paths.length > 0 ? resolve(cwd, paths[0]) : cwd;
      // Loaded once here and passed through, so the --record path can cite the same config.
      const cfg = loadConfig(root);
      if (rest.includes('--update-baseline')) {
        const all = await runCheck(root, cfg, false);
        writeBaseline(root, all.findings);
        log(opts)(`fringe: baseline written — ${all.findings.length} known findings in fringe.baseline.json (commit it); only new ones gate from now on`);
        return 0;
      }
      const result = await runCheck(root, cfg);
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
          tokenSource: cfg.tokenSource?.kind,
        };
        const mIdx = rest.indexOf('--manifest');
        if (mIdx !== -1 && rest[mIdx + 1] !== undefined) rec.manifest = readManifest(rest[mIdx + 1], err(opts));
        appendRecord(root, rec);
      }
      return result.counts.error > 0 ? 1 : 0;
    } catch (e) {
      // Internal failure (unreadable root, bad config, unexpected rule crash): report and exit 2.
      err(opts)(`fringe: internal error: ${(e as Error).message}\n`);
      return 2;
    }
  }
  if (cmd === 'init') {
    try {
      for (const line of initProject(resolve(opts.cwd ?? process.cwd(), rest[0] ?? '.'))) log(opts)(`fringe: ${line}`);
      log(opts)('fringe: the hook runs `fringe check --hook` — install the CLI so that command resolves');
      return 0;
    } catch (e) { err(opts)(`fringe: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === 'open') {
    try {
      const port = Number(rest[rest.indexOf('--port') + 1]) || 4173;
      const path = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--port');
      await startBoard(resolve(opts.cwd ?? process.cwd(), path ?? '.'), port);
      log(opts)(`fringe: ledger at http://127.0.0.1:${port} — Ctrl+C to stop`);
      return await new Promise<number>(() => {});
    } catch (e) { err(opts)(`fringe: internal error: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') { log(opts)(HELP); return 0; }
  log(opts)(`fringe: unknown command '${cmd ?? ''}' — try 'fringe check --help'`);
  return 2;
}
