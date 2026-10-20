// Fringe benchmark: same UI tasks, same agent, with and without Fringe (hook + skills via `fringe init`).
// Usage: node benchmarks/run.mjs [runsPerCell=2] [parallel=4]   (spends real Claude Code usage)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = Number(process.argv[2] ?? 2), PAR = Number(process.argv[3] ?? 4);
const PKG = '@fringetools/cli@' + JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../packages/cli/package.json'), 'utf8')).version;
// Prompts never mention accessibility: the point is what the agent does when nobody asks.
const TASKS = {
  signup: 'Create src/Signup.tsx: a React signup form with email, password and a submit button.',
  dashboard: 'Create src/Dashboard.tsx: a React dashboard with a page title, three stat cards that navigate when clicked, and refresh and settings icon buttons.',
  products: 'Create src/Products.tsx: a React product grid with an image, name and price per product and an add-to-cart icon button on each card.',
  settings: 'Create src/Settings.tsx: a React settings page with a name input, a country select, a notifications toggle and a save button.',
  modal: 'Create src/Modal.tsx: a React modal with a title, a close icon button and a short feedback form inside it.',
  navbar: 'Create src/Navbar.tsx: a React navbar with a logo image, a search box, nav links and a hamburger menu icon button.',
};
const out = mkdtempSync(join(tmpdir(), 'fringe-bench-'));
const sh = (cmd, args, cwd) => new Promise((ok) => {
  const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (o += d)); p.on('close', () => ok(o));
});

async function cell({ arm, task, run }) {
  const dir = join(out, `${arm}-${task}-${run}`); mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"b","dependencies":{"react":"^18"}}');
  if (arm === 'fringe') await sh('npx', ['-y', PKG, 'init', '.'], dir);
  const t0 = Date.now();
  const raw = await sh('claude', ['-p', TASKS[task], '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(npx:*)', '--max-turns', '20', '--output-format', 'json'], dir);
  let r = {}; try { r = JSON.parse(raw.slice(raw.indexOf('{'))); } catch {}
  let c = { counts: { error: -1, review: -1, signal: -1 }, score: -1, files: 0 };
  try { c = JSON.parse(execFileSync('npx', ['-y', PKG, 'check', '--json', '.'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { try { c = JSON.parse(e.stdout); } catch {} }
  let src = ''; try { src = execFileSync('sh', ['-c', 'cat src/*.tsx 2>/dev/null'], { cwd: dir, encoding: 'utf8' }); } catch {}
  const row = { arm, task, run, ...c.counts, score: c.score, files: c.files, suppressed: (src.match(/fringe-ignore/g) ?? []).length, turns: r.num_turns, cost: r.total_cost_usd, secs: Math.round((Date.now() - t0) / 1000) };
  console.log(JSON.stringify(row)); return row;
}

const jobs = []; for (let run = 1; run <= RUNS; run++) for (const task of Object.keys(TASKS)) for (const arm of ['plain', 'fringe']) jobs.push({ arm, task, run });
const rows = []; let i = 0;
await Promise.all(Array.from({ length: PAR }, async () => { while (i < jobs.length) rows.push(await cell(jobs[i++])); }));
writeFileSync(join(out, 'results.json'), JSON.stringify(rows, null, 1)); console.log('RESULTS', join(out, 'results.json'));
