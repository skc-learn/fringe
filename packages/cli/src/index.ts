import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
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
import { scan, mergeScan, parseStates, parseSessions, parseModes, MODES } from './scan.js';
import { saveSession } from './login.js';
import type { ScanState, ScanOptions } from './scan.js';
import { initProject, initFor, initGit, isWired, AGENTS } from './init.js';
import { homedir } from 'node:os';
import { renderExplain } from './guidance.js';
import { renderPatterns } from './patterns.js';
import { promptHookOutput } from './promptHook.js';
import { toPlanJson, toPlanMarkdown } from './report/plan.js';
import { ruleReport, rulesToText } from './rulereport.js';
import { buildHandoff, verifyHandoff, verifyToMarkdown } from './handoff.js';
import type { Handoff } from './handoff.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fringeDir } from './state.js';

export interface CliOpts { log?: (s: string) => void; cwd?: string; err?: (s: string) => void; /** Home directory for `init --global` (tests override it). */ home?: string; /** What `hook-prompt` reads instead of process.stdin (tests). */ stdin?: string; /** `fringe login` waits for this instead of Enter on the terminal (tests). */ waitForUser?: () => Promise<void> }
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
  let sessions: ScanOptions['sessions'];
  const storageFlag = flag('--storage-state') ? resolve(cwd, flag('--storage-state')!) : undefined;
  if (si !== -1 || existsSync(file)) {
    let raw: any;
    try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file}: ${(e as Error).message}`); }
    states = parseStates(raw);
    const parsed = parseSessions(raw, dirname(file)); // paths inside are relative to the file that names them
    if (parsed.length) sessions = parsed;
  }
  const shots = flag('--screenshots');
  return { states, modes: loadModes(rest), ...(storageFlag ? { storageState: storageFlag } : sessions ? { sessions } : {}), ...(shots ? { screenshots: resolve(cwd, shots) } : {}), ...(rest.includes('--update-baseline') ? { updateBaseline: true } : {}) };
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
fringe login <url> [--out auth.json]     log in once in a browser window and save the session for scans
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
  const paths = parseArgs(rest.filter((a, i) => !valued.has(a) && !valued.has(rest[i - 1]) && !flags.has(a)), err(opts));
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

type Run = (rest: string[], o: CliOpts) => Promise<number>;
const cwdOf = (o: CliOpts) => o.cwd ?? process.cwd();
const flagValue = (rest: string[], name: string) => { const i = rest.indexOf(name); return i === -1 ? undefined : rest[i + 1]; };
/** One place for "report the message on stderr and exit 2", so no command can forget it. `label` is the prefix some commands have always used. */
const guard = (run: Run, label = ''): Run => async (rest, o) => {
  try { return await run(rest, o); } catch (e) { err(o)(`fringe: ${label}${(e as Error).message}\n`); return 2; }
};
const INTERNAL = 'internal error: ';

const check: Run = async (rest, o) => {
  const paths = parseArgs(rest, err(o));
  const cwd = cwdOf(o);
  // First path is the check root (config + scan); extra paths accepted so agent-invoked runs never crash.
  const { root, only } = resolveTarget(paths.length > 0 ? resolve(cwd, paths[0]) : cwd);
  // Loaded once here and passed through, so the --record path can cite the same config.
  const cfg = loadConfig(root);
  if (rest.includes('--update-baseline')) {
    const all = await runCheck(root, cfg, false);
    writeBaseline(root, all.findings);
    log(o)(`fringe: baseline written — ${all.findings.length} known findings in fringe.baseline.json (commit it); only new ones gate from now on`);
    return 0;
  }
  const result = await runCheck(root, cfg, true, only);
  if (rest.includes('--claude-hook')) {
    const out = toClaudeHook(result, root, receipts(root, result.findings, only && [...only]));
    if (out) log(o)(out);
    return 0; // Claude reads the JSON, not the exit code; a non-zero exit would be discarded
  }
  if (rest.includes('--hook')) log(o)(toHook(result));
  else if (rest.includes('--json')) log(o)(toJson(result));
  else log(o)(toPretty(result));
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
    const manifest = flagValue(rest, '--manifest');
    if (manifest !== undefined) rec.manifest = readManifest(manifest, err(o));
    appendRecord(root, rec);
  }
  return result.counts.error > 0 ? 1 : 0;
};

const scanCmd: Run = async (rest, o) => {
  const url = rest.find((a, i) => !a.startsWith('--') && !['--states', '--modes', '--storage-state', '--screenshots'].includes(rest[i - 1]));
  if (!url) { err(o)('fringe: scan needs a URL, e.g. fringe scan http://localhost:3000\n'); return 2; }
  const cwd = cwdOf(o);
  const so = loadScanOptions(cwd, rest);
  const result = await scan(url, cwd, so);
  if (so.updateBaseline) { log(o)(`fringe: scan baseline written: ${result.baselined ?? 0} known findings in fringe.scan.baseline.json (commit it); only new ones show from now on`); return 0; }
  if (so.screenshots) err(o)(`fringe: screenshots saved in ${so.screenshots}\n`);
  log(o)(rest.includes('--json') ? toJson(result) : toPretty(result));
  return result.counts.error > 0 ? 1 : 0;
};

/** Claude Code UserPromptSubmit hook: adds the matching playbook to the agent's context before it starts building. It must never break the user's prompt. */
const hookPrompt: Run = async (_rest, o) => {
  try {
    const input = o.stdin ?? await new Promise<string>((ok) => { let d = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => ok(d)); if (process.stdin.isTTY) ok(''); });
    const out = promptHookOutput(input);
    if (out) log(o)(out);
  } catch { /* swallowed on purpose */ }
  return 0;
};

const login: Run = async (rest, o) => {
  const url = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--out');
  if (!url) { err(o)('fringe: login needs a URL, e.g. fringe login http://localhost:3000/login\n'); return 2; }
  const cwd = cwdOf(o);
  const outArg = flagValue(rest, '--out');
  const out = resolve(cwd, outArg ?? '.fringe/auth.json');
  if (dirname(out) === join(cwd, '.fringe')) fringeDir(cwd); // creates .fringe/ with its own .gitignore, so the session can never be committed by accident
  await saveSession(url, cwd, out, { headless: rest.includes('--headless'), wait: o.waitForUser });
  log(o)(`fringe: session saved to ${out}\nIt holds your logged-in cookies.${dirname(out) === join(cwd, '.fringe') ? ' .fringe/ is ignored by git automatically.' : ' Keep it out of git.'} Use it with: fringe scan <url> --storage-state ${outArg ?? '.fringe/auth.json'}`);
  return 0;
};

const rules: Run = async (rest, o) => {
  const rows = await ruleReport(resolve(cwdOf(o), rest.find((a) => !a.startsWith('--')) ?? '.'));
  log(o)(rest.includes('--json') ? JSON.stringify({ schema: 'fringe/rules.v1', rules: rows }, null, 2) : rulesToText(rows));
  return 0;
};

const plan: Run = async (rest, o) => {
  const g = await gather(o, rest);
  log(o)(rest.includes('--json') ? toPlanJson(g.result, g.limit) : toPlanMarkdown(g.result, g.target, g.limit));
  return 0;
};

const handoff: Run = async (rest, o) => {
  const g = await gather(o, rest);
  const inside = (p?: string) => (p && p.startsWith(g.root + sep) ? relative(g.root, p) : p); // paths inside the project travel as relative ones
  const h = buildHandoff(g.result, { root: g.root, target: g.target, ...(g.only ? { only: inside(g.only) } : {}), ...(g.scan ? { scan: { ...g.scan, ...(g.scan.statesFile ? { statesFile: inside(g.scan.statesFile) } : {}), ...(g.scan.storageState ? { storageState: inside(g.scan.storageState) } : {}) } } : {}) }, g.limit);
  const outArg = flagValue(rest, '--out');
  const outFile = resolve(g.root, outArg ?? '.fringe/handoff.json');
  h.rootRel = relative(dirname(outFile), g.root) || '.';
  if (dirname(outFile) === join(g.root, '.fringe')) fringeDir(g.root); else mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(h, null, 2) + '\n');
  log(o)(rest.includes('--json') ? JSON.stringify(h, null, 2) : h.prompt);
  err(o)(`fringe: hand-off saved to ${outFile}; the receiving agent proves it is done with: fringe verify${outArg ? ` --handoff ${outFile}` : ''}\n`);
  return 0;
};

const verify: Run = async (rest, o) => {
  const cwd = cwdOf(o);
  const file = resolve(cwd, flagValue(rest, '--handoff') ?? '.fringe/handoff.json');
  let h: Handoff;
  try { h = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error(`no readable hand-off at ${file} — run 'fringe handoff' first`); }
  if (h.schema !== 'fringe/handoff.v1') throw new Error(`${file} is not a fringe/handoff.v1 file`);
  // Where the project is NOW: an explicit --root, else the folder the hand-off file sits beside, else where it was made, else here.
  const rootFlag = flagValue(rest, '--root');
  const root = [rootFlag && resolve(cwd, rootFlag), h.rootRel !== undefined && resolve(dirname(file), h.rootRel), h.root, cwd].find((d): d is string => !!d && existsSync(d)) ?? cwd;
  const cfg = loadConfig(root);
  let result = await runCheck(root, cfg, true, h.only ? new Set([resolve(root, h.only)]) : undefined);
  if (h.scan) {
    const base = loadScanOptions(root, h.scan.statesFile ? ['--states', resolve(root, h.scan.statesFile)] : []);
    result = mergeScan(result, await scan(h.scan.url, root, { ...base, modes: h.scan.modes as never, ...(h.scan.storageState ? { storageState: resolve(root, h.scan.storageState) } : {}) }), cfg.weights);
  }
  const v = verifyHandoff(h, result, root);
  log(o)(rest.includes('--json') ? JSON.stringify(v, null, 2) : verifyToMarkdown(v));
  return v.status === 'complete' ? 0 : 1;
};

const explain: Run = async (rest, o) => {
  const pattern = rest[0] === 'pattern';
  const out = pattern ? renderPatterns(rest[1]) : renderExplain(rest[0]);
  if (out === undefined) { err(o)(`fringe: unknown ${pattern ? 'pattern' : 'rule'} '${pattern ? rest[1] : rest[0]}' — run 'fringe explain${pattern ? ' pattern' : ''}' to list them\n`); return 2; }
  log(o)(out);
  return 0;
};

const init: Run = async (rest, o) => {
  const global = rest.includes('--global') || rest.includes('-g');
  const target = global ? (o.home ?? homedir()) : resolve(cwdOf(o), rest.find((a, i) => !a.startsWith('-') && rest[i - 1] !== '--for') ?? '.');
  const forArg = flagValue(rest, '--for');
  const agents = rest.includes('--for') ? (forArg ?? '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean) : [];
  if (rest.includes('--for') && agents.length === 0) throw new Error(`--for needs an agent: ${AGENTS.join(', ')}, claude`);
  const lines: string[] = [];
  const wantsClaude = (!rest.includes('--for') && !rest.includes('--git')) || agents.includes('claude');
  if (wantsClaude) lines.push(...initProject(target));
  const others = agents.filter((a) => a !== 'claude');
  if (others.length) lines.push(...initFor(target, others));
  if (rest.includes('--git')) lines.push(...initGit(target));
  for (const line of lines) log(o)(`fringe: ${line}`);
  if (global) log(o)('fringe: set up for your user, so every project is covered (run without --global to set up one project only)');
  return 0;
};

const open: Run = async (rest, o) => {
  const port = Number(flagValue(rest, '--port')) || 4173;
  const path = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--port');
  await startBoard(resolve(cwdOf(o), path ?? '.'), port);
  log(o)(`fringe: ledger at http://127.0.0.1:${port} — Ctrl+C to stop`);
  return await new Promise<number>(() => {});
};

const COMMANDS: Record<string, Run> = {
  check: guard(check, INTERNAL), scan: guard(scanCmd), 'hook-prompt': hookPrompt, login: guard(login), rules: guard(rules),
  plan: guard(plan), handoff: guard(handoff), verify: guard(verify), explain, init: guard(init), open: guard(open, INTERNAL),
  '--help': async (_r, o) => (log(o)(HELP), 0), '-h': async (_r, o) => (log(o)(HELP), 0), help: async (_r, o) => (log(o)(HELP), 0),
  '--version': async (_r, o) => (log(o)(VERSION), 0), '-v': async (_r, o) => (log(o)(VERSION), 0),
};

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === undefined) { // bare `fringe`: check this folder, and say how to get the post-edit check if it is not set up yet
    const code = await runCli(['check'], opts);
    if (!isWired(cwdOf(opts), opts.home ?? homedir())) log(opts)('\nfringe: not checking after your agent\'s edits yet. Run `npx @fringetools/cli init` (this project) or `init --global` (every project).');
    return code;
  }
  if (Object.hasOwn(COMMANDS, cmd)) return COMMANDS[cmd](rest, opts); // hasOwn: 'constructor' or 'toString' are not commands
  log(opts)(`fringe: unknown command '${cmd}' — try 'fringe check --help'`);
  return 2;
}
