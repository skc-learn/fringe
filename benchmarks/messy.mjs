// Messy-repo benchmark: "fix this app's accessibility problems" on a generated app with 100+ findings and shared components.
// Arms: plain | hook (post-edit hook only) | full (`fringe init`: hook + skills, so the agent can use `fringe plan`).
// Usage: node benchmarks/messy.mjs [runsPerArm=2] [parallel=3]   (spends real Claude Code usage)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = Number(process.argv[2] ?? 2), PAR = Number(process.argv[3] ?? 3);
const PKG = '@fringetools/cli@' + JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../packages/cli/package.json'), 'utf8')).version;
const PROMPT = 'This React app has accessibility problems. Find and fix them across the codebase. Keep the design and behavior the same.';
const PAGES = ['Home', 'Pricing', 'Products', 'Cart', 'Checkout', 'Login', 'Signup', 'Profile', 'Settings', 'Orders', 'Support', 'About', 'Blog', 'Search', 'Wishlist', 'Billing', 'Team', 'Reports', 'Admin', 'Help'];

function generate(dir) {
  mkdirSync(join(dir, 'src/ui'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"messy","dependencies":{"react":"^18"}}');
  writeFileSync(join(dir, 'src/ui/Input.tsx'), 'export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input className="field" {...p} />;\n');
  writeFileSync(join(dir, 'src/ui/IconButton.tsx'), 'export const IconButton = ({ icon, onClick }: { icon: string; onClick: () => void }) => <button className="icon" onClick={onClick}><span>{icon}</span></button>;\n');
  writeFileSync(join(dir, 'src/ui/Card.tsx'), 'export const Card = ({ onOpen, children }: any) => <div className="card" onClick={onOpen}>{children}</div>;\n');
  PAGES.forEach((name, i) => writeFileSync(join(dir, `src/${name}.tsx`), `import { Input } from './ui/Input';
import { IconButton } from './ui/IconButton';
import { Card } from './ui/Card';

export default function ${name}() {
  return (
    <main>
      <h1>${name}</h1>
      <h3>Overview</h3>
      <Card onOpen={() => open('${name}')}>
        <img src="/photos/${name.toLowerCase()}-product.jpg" />
        <img src="/decor/divider-${i}.svg" />
      </Card>
      <form>
        <input type="text" placeholder="Name" />
        <input type="email" placeholder="Email" />
        <Input placeholder="Search" />
        <button type="submit">Save</button>
      </form>
      <div onClick={() => open('${name}-more')}>More</div>
      <button><span>✕</span></button>
      <IconButton icon="⟳" onClick={() => reload()} />
    </main>
  );
}
`));
}

const out = mkdtempSync(join(tmpdir(), 'fringe-messy-'));
const sh = (cmd, args, cwd) => new Promise((ok) => { const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (o += d)); p.on('close', () => ok(o)); });
const check = (dir) => { try { return JSON.parse(execFileSync('npx', ['-y', PKG, 'check', '--json', '.'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { try { return JSON.parse(e.stdout); } catch { return null; } } };
const srcOf = (dir) => readdirSync(join(dir, 'src'), { recursive: true }).filter((f) => f.endsWith('.tsx')).map((f) => readFileSync(join(dir, 'src', f), 'utf8')).join('\n');

async function cell({ arm, run }) {
  const dir = join(out, `${arm}-${run}`); generate(dir);
  const before = check(dir);
  if (arm === 'full') await sh('npx', ['-y', PKG, 'init', '.'], dir);
  if (arm === 'hook') { mkdirSync(join(dir, '.claude')); writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: `npx -y ${PKG} check --claude-hook` }] }] } })); }
  const t0 = Date.now();
  const raw = await sh('claude', ['-p', PROMPT, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(npx:*)', '--max-turns', '60', '--output-format', 'json'], dir);
  let r = {}; try { r = JSON.parse(raw.slice(raw.indexOf('{'))); } catch {}
  const after = check(dir), src = srcOf(dir);
  const row = {
    arm, run, before: before?.counts.error, errors: after?.counts.error ?? -1, score: after?.score ?? -1,
    visibleLabels: (src.match(/<label/g) ?? []).length, ariaLabelOnly: (src.match(/<input[^>]*aria-label/g) ?? []).length,
    badAlt: (src.match(/<img[^>]*alt=""[^>]*product|<img[^>]*product[^>]*alt=""/g) ?? []).length + (src.match(/alt="(image|photo|picture|img)"/gi) ?? []).length, // informative image hidden or named generically
    suppressed: (src.match(/fringe-ignore/g) ?? []).length, turns: r.num_turns, cost: r.total_cost_usd, secs: Math.round((Date.now() - t0) / 1000),
  };
  console.log(JSON.stringify(row)); return row;
}
const jobs = []; for (let run = 1; run <= RUNS; run++) for (const arm of ['plain', 'hook', 'full']) jobs.push({ arm, run });
const rows = []; let i = 0;
await Promise.all(Array.from({ length: PAR }, async () => { while (i < jobs.length) rows.push(await cell(jobs[i++])); }));
writeFileSync(join(out, 'results.json'), JSON.stringify(rows, null, 1)); console.log('RESULTS', join(out, 'results.json'));
