import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { VERSION } from './version.js';
import { runCheck } from './check.js';
import { toJson } from './report/json.js';
import { toHook, toClaudeHook } from './report/hook.js';
import { toPretty } from './report/pretty.js';
import { appendRecord } from './ledger.js';
import type { LedgerRecord } from './ledger.js';
import { loadConfig } from './config.js';
import { startBoard } from './board.js';
import { writeBaseline } from './baseline.js';
import { receipts } from './receipts.js';
import { scan, mergeScan, parseStates } from './scan.js';
import type { ScanState } from './scan.js';
import { initProject } from './init.js';
import { renderExplain } from './guidance.js';
import { renderPatterns } from './patterns.js';
import { toPlanJson, toPlanMarkdown } from './report/plan.js';

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
    for (const f of parsed.flows) {
      if (f.action === 'cut' && weakEvidence(f.evidence)) {
        f.unsupported = true;
        warn(`fringe: warning: cut '${f.what}' has no real evidence — recorded as unsupported\n`);
      }
    }
    return parsed;
  } catch { warn(`fringe: warning: manifest at ${path} is not valid '{ flows: [...] }' JSON — continuing without\n`); return undefined; }
}

/** Resolves a path argument to the project root plus, for a file, the single file to judge. Climbs to the nearest package.json / fringe.config.json so config and baseline are found. */
function resolveTarget(arg: string): { root: string; only?: Set<string> } {
  if (!statSync(arg).isFile()) return { root: arg };
  let dir = dirname(arg);
  for (let d = dir, i = 0; i < 12; i++, d = dirname(d)) {
    if (existsSync(join(d, 'package.json')) || existsSync(join(d, 'fringe.config.json'))) { dir = d; break; }
    if (dirname(d) === d) break;
  }
  return { root: dir, only: new Set([arg]) };
}

/** `--states <file>`, else `fringe.scan.json` in the working directory when present. */
function loadStates(cwd: string, rest: string[]): ScanState[] {
  const i = rest.indexOf('--states');
  const file = i !== -1 ? resolve(cwd, rest[i + 1] ?? '') : join(cwd, 'fringe.scan.json');
  if (i === -1 && !existsSync(file)) return [];
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file}: ${(e as Error).message}`); }
  return parseStates(raw);
}

/** A cut needs a reason a reviewer can check; empty or one-word filler does not count. */
const weakEvidence = (e: unknown) => typeof e !== 'string' || e.trim().length < 12 || /^(n\/?a|none|tbd|obvious|unnecessary|clutter|unused)\.?$/i.test(e.trim());

const HELP = `fringe check [--json] [--hook] [--record] [--manifest <path>] [path]
fringe check --claude-hook [path]       for Claude Code hooks (feeds errors back to the agent)
fringe check --update-baseline [path]   accept today's findings; only new ones gate
fringe scan <url> [--states f] [--json]               runtime check in a real browser (axe-core + keyboard walk); needs playwright-core and axe-core
fringe plan [dir|file] [--scan url] [--json] [--limit n]   ordered fix batches with recipes; --scan adds the live page
fringe explain pattern [form]           best-practice checklist for a component type
fringe explain [FR-203]                 why a rule matters and how to fix it well
fringe init [path]                       add the Claude Code hook + skill
fringe open [path] [--port <n>]   serve the .fringe ledger on 127.0.0.1
fringe --help | --version`;

const KNOWN_FLAGS = new Set(['--json', '--hook', '--claude-hook', '--record', '--manifest', '--update-baseline']);

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
      const { root, only } = resolveTarget(paths.length > 0 ? resolve(cwd, paths[0]) : cwd);
      // Loaded once here and passed through, so the --record path can cite the same config.
      const cfg = loadConfig(root);
      if (rest.includes('--update-baseline')) {
        const all = await runCheck(root, cfg, false);
        writeBaseline(root, all.findings);
        log(opts)(`fringe: baseline written — ${all.findings.length} known findings in fringe.baseline.json (commit it); only new ones gate from now on`);
        return 0;
      }
      const result = await runCheck(root, cfg, true, only);
      if (rest.includes('--claude-hook')) {
        const out = toClaudeHook(result, root, receipts(root, result.findings));
        if (out) log(opts)(out);
        return 0; // Claude reads the JSON, not the exit code; a non-zero exit would be discarded
      }
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
          byRule: result.findings.reduce<Record<string, number>>((m, f) => ((m[f.rule] = (m[f.rule] ?? 0) + 1), m), {}),
          suppressed: result.suppressed,
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
  if (cmd === 'scan') {
    try {
      const url = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--states');
      if (!url) { err(opts)('fringe: scan needs a URL, e.g. fringe scan http://localhost:3000\n'); return 2; }
      const cwd = opts.cwd ?? process.cwd();
      const result = await scan(url, cwd, loadStates(cwd, rest));
      log(opts)(rest.includes('--json') ? toJson(result) : toPretty(result));
      return result.counts.error > 0 ? 1 : 0;
    } catch (e) { err(opts)(`fringe: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === 'plan') {
    try {
      const si = rest.indexOf('--scan');
      const scanUrl = si !== -1 ? rest[si + 1] : undefined;
      if (si !== -1 && (!scanUrl || scanUrl.startsWith('--'))) { err(opts)('fringe: --scan needs a URL, e.g. fringe plan --scan http://localhost:3000\n'); return 2; }
      const li = rest.indexOf('--limit');
      const limit = li !== -1 ? Number(rest[li + 1]) || undefined : undefined;
      const paths = parseArgs(rest.filter((a, i) => a !== '--limit' && rest[i - 1] !== '--limit' && a !== '--json' && a !== '--scan' && rest[i - 1] !== '--scan' && a !== '--states' && rest[i - 1] !== '--states'), err(opts));
      const arg = resolve(opts.cwd ?? process.cwd(), paths[0] ?? '.');
      const { root, only } = resolveTarget(arg);
      const cfg = loadConfig(root);
      let result = await runCheck(root, cfg, true, only);
      if (scanUrl) { const cwd = opts.cwd ?? process.cwd(); result = mergeScan(result, await scan(scanUrl, cwd, loadStates(cwd, rest)), cfg.weights); }
      log(opts)(rest.includes('--json') ? toPlanJson(result, limit) : toPlanMarkdown(result, paths[0] ?? '.', limit));
      return 0;
    } catch (e) { err(opts)(`fringe: internal error: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === 'explain' && rest[0] === 'pattern') {
    const out = renderPatterns(rest[1]);
    if (out === undefined) { err(opts)(`fringe: unknown pattern '${rest[1]}' — run 'fringe explain pattern' to list them\n`); return 2; }
    log(opts)(out);
    return 0;
  }
  if (cmd === 'explain') {
    const out = renderExplain(rest[0]);
    if (out === undefined) { err(opts)(`fringe: unknown rule '${rest[0]}' — run 'fringe explain' to list them\n`); return 2; }
    log(opts)(out);
    return 0;
  }
  if (cmd === 'init') {
    try {
      for (const line of initProject(resolve(opts.cwd ?? process.cwd(), rest[0] ?? '.'))) log(opts)(`fringe: ${line}`);
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
