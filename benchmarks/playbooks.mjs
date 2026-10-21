// Playbook benchmark: do agents run `fringe explain pattern` unprompted, and does it change what they build?
// Arms: plain (nothing installed) | fringe (`fringe init`: hook + skills, whose main skill says to read the playbook first).
// Prompts never mention accessibility or playbooks. The checks are a text-search PROXY for a few playbook items per task, not a full audit.
// Usage: node benchmarks/playbooks.mjs [runsPerCell=2] [parallel=3]   (spends real Claude Code usage)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = Number(process.argv[2] ?? 2), PAR = Number(process.argv[3] ?? 3);
const PKG = '@fringetools/cli@' + JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../packages/cli/package.json'), 'utf8')).version;
const has = (re) => (src) => re.test(src);
const TASKS = {
  carousel: { prompt: 'Create src/Carousel.tsx: a React image carousel with 4 slides, previous and next buttons, and automatic rotation.', checks: {
    'pause/stop control': has(/(pause|stop)/i), 'carousel semantics (aria-roledescription)': has(/aria-roledescription/), 'reduced motion handled or no autoplay': (s) => /prefers-reduced-motion|matchMedia/.test(s) || !/setInterval|setTimeout/.test(s) } },
  tabs: { prompt: 'Create src/Tabs.tsx: a React tabbed panel with three tabs (Overview, Details, Reviews) and their content.', checks: {
    'tablist/tab/tabpanel roles': (s) => /role="tablist"/.test(s) && /role="tab"/.test(s) && /role="tabpanel"/.test(s), 'aria-selected': has(/aria-selected/), 'arrow-key handling': has(/ArrowRight|ArrowLeft/) } },
  modal: { prompt: 'Create src/ConfirmModal.tsx: a React modal dialog asking the user to confirm deleting a project, with Cancel and Delete buttons.', checks: {
    'dialog role + aria-modal': (s) => /role="(alert)?dialog"/.test(s) && /aria-modal/.test(s), 'Escape closes': has(/Escape/), 'focus is moved/restored': has(/\.focus\(\)/) } },
  login: { prompt: 'Create src/Login.tsx: a React sign-in form with email, password, a Sign in button and a Forgot password link.', checks: {
    'password autocomplete': has(/autoComplete="(current|new)-password"/), 'error is announced (role=alert/aria-live)': has(/role="alert"|aria-live/), 'pending state on submit': has(/disabled=\{|aria-busy|isSubmitting|loading/i) } },
  table: { prompt: 'Create src/UsersTable.tsx: a React table of users (name, email, role) with sortable columns.', checks: {
    'th with scope': has(/<th[^>]*scope=/), 'table name (caption/aria-label)': has(/<caption|aria-label/), 'aria-sort': has(/aria-sort/) } },
  search: { prompt: 'Create src/Search.tsx: a React search box that filters a list of products as the user types and shows the results.', checks: {
    'search landmark/type': has(/role="search"|type="search"|<search/), 'result count announced (aria-live/role=status)': has(/aria-live|role="status"/), 'no-results message': has(/no results|nothing found|no products|no matches/i) } },
};
const out = mkdtempSync(join(tmpdir(), 'fringe-pbench-'));
const sh = (cmd, args, cwd) => new Promise((ok) => { const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (o += d)); p.on('close', () => ok(o)); });
const srcOf = (dir) => { try { return readdirSync(join(dir, 'src')).filter((f) => f.endsWith('.tsx')).map((f) => readFileSync(join(dir, 'src', f), 'utf8')).join('\n'); } catch { return ''; } };

async function cell({ arm, task, run }) {
  const dir = join(out, `${arm}-${task}-${run}`); mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"b","dependencies":{"react":"^18"}}');
  if (arm === 'fringe') await sh('npx', ['-y', PKG, 'init', '.'], dir);
  const t0 = Date.now();
  const raw = await sh('claude', ['-p', TASKS[task].prompt, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(npx:*)', '--max-turns', '25', '--output-format', 'stream-json', '--verbose'], dir);
  const events = raw.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const cmds = events.flatMap((m) => (m.message?.content ?? []).filter((c) => c.type === 'tool_use' && c.name === 'Bash').map((c) => String(c.input?.command ?? '')));
  const result = events.find((m) => m.type === 'result') ?? {};
  const src = srcOf(dir);
  const passed = Object.entries(TASKS[task].checks).filter(([, f]) => f(src)).map(([k]) => k);
  const row = { arm, task, run, readPlaybook: cmds.some((c) => /explain\s+pattern/.test(c)), ranFringe: cmds.some((c) => /(fringetools\/cli|npx[^|;&]*\bfringe\b|(^|[;&|]\s*)fringe\s)/.test(c)), score: passed.length, of: Object.keys(TASKS[task].checks).length, missed: Object.keys(TASKS[task].checks).filter((k) => !passed.includes(k)), turns: result.num_turns, cost: result.total_cost_usd, secs: Math.round((Date.now() - t0) / 1000) };
  console.log(JSON.stringify(row)); return row;
}
const jobs = []; for (let run = 1; run <= RUNS; run++) for (const task of Object.keys(TASKS)) for (const arm of ['plain', 'fringe']) jobs.push({ arm, task, run });
const rows = []; let i = 0;
await Promise.all(Array.from({ length: PAR }, async () => { while (i < jobs.length) rows.push(await cell(jobs[i++])); }));
writeFileSync(join(out, 'results.json'), JSON.stringify(rows, null, 1)); console.log('RESULTS', join(out, 'results.json'));
