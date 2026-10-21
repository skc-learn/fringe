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
import { scan, mergeScan, parseStates, parseModes, MODES } from './scan.js';
import type { ScanState, ScanOptions } from './scan.js';
import { initProject, initFor, initGit, isWired, AGENTS } from './init.js';
import { homedir } from 'node:os';
import { renderExplain } from './guidance.js';
import { renderPatterns } from './patterns.js';
import { toPlanJson, toPlanMarkdown } from './report/plan.js';
import { ruleReport, rulesToText } from './rulereport.js';
import { buildHandoff, verifyHandoff, verifyToMarkdown } from './handoff.js';
import type { Handoff } from './handoff.js';
import { mkdirSync, writeFileSync } from 'node:fs';

export interface CliOpts { log?: (s: string) => void; cwd?: string; err?: (s: string) => void; /** Home directory for `init --global` (tests override it). */ home?: string }
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

/** Everything `scan` needs from the command line and `fringe.scan.json`: states, stress modes, login session, screenshots. */
function loadScanOptions(cwd: string, rest: string[]): ScanOptions {
  const flag = (n: string) => { const i = rest.indexOf(n); return i === -1 ? undefined : rest[i + 1]; };
  const si = rest.indexOf('--states');
  const file = si !== -1 ? resolve(cwd, rest[si + 1] ?? '') : join(cwd, 'fringe.scan.json');
  let states: ScanState[] = [];
  let storageState = flag('--storage-state') ? resolve(cwd, flag('--storage-state')!) : undefined;
  if (si !== -1 || existsSync(file)) {
    let raw: any;
    try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file}: ${(e as Error).message}`); }
    states = parseStates(raw);
    if (!storageState && typeof raw.storageState === 'string') storageState = resolve(dirname(file), raw.storageState); // relative to the file that names it
  }
  const shots = flag('--screenshots');
  return { states, modes: loadModes(rest), ...(storageState ? { storageState } : {}), ...(shots ? { screenshots: resolve(cwd, shots) } : {}), ...(rest.includes('--update-baseline') ? { updateBaseline: true } : {}) };
}

/** `--stress` = all stress modes; `--modes dark,reflow` = a subset. */
function loadModes(rest: string[]) {
  const i = rest.indexOf('--modes');
  return i !== -1 ? parseModes(rest[i + 1] ?? '') : rest.includes('--stress') ? [...MODES] : [];
}

/** A cut needs a reason a reviewer can check; empty or one-word filler does not count. */
const weakEvidence = (e: unknown) => typeof e !== 'string' || e.trim().length < 12 || /^(n\/?a|none|tbd|obvious|unnecessary|clutter|unused)\.?$/i.test(e.trim());

const HELP = `fringe check [--json] [--hook] [--record] [--manifest <path>] [path]
fringe check --claude-hook [path]       for Claude Code hooks (feeds errors back to the agent)
fringe check --update-baseline [path]   accept today's findings; only new ones gate
fringe scan <url> [--states f] [--stress | --modes ...] [--storage-state auth.json] [--screenshots dir] [--update-baseline] [--json]               runtime check in a real browser (axe-core + keyboard walk); needs playwright-core and axe-core
fringe rules [dir] [--json]               per rule: open / baselined / silenced, to spot rules that don't suit this repo
fringe handoff [dir|file] [--scan url]    a work order for another agent or CI (saved to .fringe/handoff.json)
fringe verify [--handoff file]             did the receiving agent finish? exit 0 only when complete
fringe plan [dir|file] [--scan url] [--json] [--limit n]   ordered fix batches with recipes; --scan adds the live page
fringe explain pattern [form]           best-practice checklist for a component type
fringe explain [FR-203]                 why a rule matters and how to fix it well
fringe init [path] [--global]          add the Claude Code hook + skills (--global: every project)
fringe init --for cursor,codex,...     write the rules file other agents read (cursor, codex, gemini, copilot, windsurf, cline, kiro, generic)
fringe init --git                      pre-commit gate for any agent that commits
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

/** Shared by `plan` and `handoff`: parse the target and flags, run the static check (and the live scan with --scan). */
async function gather(opts: CliOpts, rest: string[]) {
  const si = rest.indexOf('--scan');
  const scanUrl = si !== -1 ? rest[si + 1] : undefined;
  if (si !== -1 && (!scanUrl || scanUrl.startsWith('--'))) throw new Error('--scan needs a URL, e.g. fringe plan --scan http://localhost:3000');
  const li = rest.indexOf('--limit');
  const limit = li !== -1 ? Number(rest[li + 1]) || undefined : undefined;
  const valued = new Set(['--limit', '--scan', '--states', '--modes', '--out', '--storage-state', '--screenshots']);
  const flags = new Set(['--json', '--stress']);
  const paths = parseArgs(rest.filter((a, i) => !valued.has(a) && !valued.has(rest[i - 1]) && !flags.has(a)), (s) => process.stderr.write(s));
  const cwd = opts.cwd ?? process.cwd();
  const { root, only } = resolveTarget(resolve(cwd, paths[0] ?? '.'));
  const cfg = loadConfig(root);
  let result = await runCheck(root, cfg, true, only);
  let scanMeta: { url: string; statesFile?: string; modes: string[]; storageState?: string } | undefined;
  if (scanUrl) {
    result = mergeScan(result, await scan(scanUrl, cwd, loadScanOptions(cwd, rest)), cfg.weights);
    const sf = rest.indexOf('--states');
    const so = loadScanOptions(cwd, rest);
    scanMeta = { url: scanUrl, ...(sf !== -1 ? { statesFile: resolve(cwd, rest[sf + 1]) } : {}), modes: so.modes ?? [], ...(so.storageState ? { storageState: so.storageState } : {}) };
  }
  return { result, root, target: paths[0] ?? '.', only: only ? [...only][0] : undefined, limit, scan: scanMeta };
}

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === undefined) { // bare `fringe`: check this folder, and say how to get the post-edit check if it is not set up yet
    const code = await runCli(['check'], opts);
    if (!isWired(opts.cwd ?? process.cwd(), opts.home ?? homedir())) log(opts)('\nfringe: not checking after your agent\'s edits yet. Run `npx @fringetools/cli init` (this project) or `init --global` (every project).');
    return code;
  }
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
      const url = rest.find((a, i) => !a.startsWith('--') && !['--states', '--modes', '--storage-state', '--screenshots'].includes(rest[i - 1]));
      if (!url) { err(opts)('fringe: scan needs a URL, e.g. fringe scan http://localhost:3000\n'); return 2; }
      const cwd = opts.cwd ?? process.cwd();
      const so = loadScanOptions(cwd, rest);
      const result = await scan(url, cwd, so);
      if (so.updateBaseline) { log(opts)(`fringe: scan baseline written: ${result.baselined ?? 0} known findings in fringe.scan.baseline.json (commit it); only new ones show from now on`); return 0; }
      if (so.screenshots) err(opts)(`fringe: screenshots saved in ${so.screenshots}\n`);
      log(opts)(rest.includes('--json') ? toJson(result) : toPretty(result));
      return result.counts.error > 0 ? 1 : 0;
    } catch (e) { err(opts)(`fringe: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === 'rules') {
    try {
      const root = resolve(opts.cwd ?? process.cwd(), rest.find((a) => !a.startsWith('--')) ?? '.');
      const rows = await ruleReport(root);
      log(opts)(rest.includes('--json') ? JSON.stringify({ schema: 'fringe/rules.v1', rules: rows }, null, 2) : rulesToText(rows));
      return 0;
    } catch (e) { err(opts)(`fringe: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === 'plan' || cmd === 'handoff') {
    try {
      const g = await gather(opts, rest);
      if (cmd === 'plan') {
        log(opts)(rest.includes('--json') ? toPlanJson(g.result, g.limit) : toPlanMarkdown(g.result, g.target, g.limit));
        return 0;
      }
      const h = buildHandoff(g.result, { root: g.root, target: g.target, ...(g.only ? { only: g.only } : {}), ...(g.scan ? { scan: g.scan } : {}) }, g.limit);
      const oi = rest.indexOf('--out');
      const outFile = resolve(g.root, oi !== -1 ? rest[oi + 1] ?? '' : '.fringe/handoff.json');
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, JSON.stringify(h, null, 2) + '\n');
      log(opts)(rest.includes('--json') ? JSON.stringify(h, null, 2) : h.prompt);
      err(opts)(`fringe: hand-off saved to ${outFile}; the receiving agent proves it is done with: fringe verify${oi !== -1 ? ` --handoff ${outFile}` : ''}\n`);
      return 0;
    } catch (e) { err(opts)(`fringe: ${(e as Error).message}\n`); return 2; }
  }
  if (cmd === 'verify') {
    try {
      const hi = rest.indexOf('--handoff');
      const file = resolve(opts.cwd ?? process.cwd(), hi !== -1 ? rest[hi + 1] ?? '' : '.fringe/handoff.json');
      let h: Handoff;
      try { h = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error(`no readable hand-off at ${file} — run 'fringe handoff' first`); }
      if (h.schema !== 'fringe/handoff.v1') throw new Error(`${file} is not a fringe/handoff.v1 file`);
      const cfg = loadConfig(h.root);
      let result = await runCheck(h.root, cfg, true, h.only ? new Set([h.only]) : undefined);
      if (h.scan) result = mergeScan(result, await scan(h.scan.url, h.root, { ...loadScanOptions(h.root, h.scan.statesFile ? ['--states', h.scan.statesFile] : []), modes: h.scan.modes as never, ...(h.scan.storageState ? { storageState: h.scan.storageState } : {}) }), cfg.weights);
      const v = verifyHandoff(h, result);
      log(opts)(rest.includes('--json') ? JSON.stringify(v, null, 2) : verifyToMarkdown(v));
      return v.status === 'complete' ? 0 : 1;
    } catch (e) { err(opts)(`fringe: ${(e as Error).message}\n`); return 2; }
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
      const global = rest.includes('--global') || rest.includes('-g');
      const target = global ? (opts.home ?? homedir()) : resolve(opts.cwd ?? process.cwd(), rest.find((a, i) => !a.startsWith('-') && rest[i - 1] !== '--for') ?? '.');
      const fi = rest.indexOf('--for');
      const agents = fi !== -1 ? (rest[fi + 1] ?? '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean) : [];
      if (fi !== -1 && agents.length === 0) throw new Error(`--for needs an agent: ${AGENTS.join(', ')}, claude`);
      const lines: string[] = [];
      const wantsClaude = (fi === -1 && !rest.includes('--git')) || agents.includes('claude');
      if (wantsClaude) lines.push(...initProject(target));
      const others = agents.filter((a) => a !== 'claude');
      if (others.length) lines.push(...initFor(target, others));
      if (rest.includes('--git')) lines.push(...initGit(target));
      for (const line of lines) log(opts)(`fringe: ${line}`);
      if (global) log(opts)('fringe: set up for your user, so every project is covered (run without --global to set up one project only)');
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
