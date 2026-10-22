import { describe, it, expect, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';
import { startBoard } from '../src/board.js';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { matchPlaybooks } from '../src/promptHook.js';
import { ALL_RULES } from '../src/rules/registry.js';
import { PATTERNS } from '../src/patterns.js';

const dirs: string[] = [];
const mk = (files: Record<string, string> = {}) => {
  const d = mkdtempSync(join(tmpdir(), 'fringe-audit-')); dirs.push(d);
  for (const [n, c] of Object.entries(files)) { mkdirSync(join(d, n, '..'), { recursive: true }); writeFileSync(join(d, n), c); }
  return d;
};
const run = async (args: string[], cwd?: string) => { const out: string[] = [], err: string[] = []; const code = await runCli(args, { log: (s) => out.push(s), err: (s) => err.push(s), cwd }); return { code, out: out.join('\n'), err: err.join('') }; };
const IMG = (n: string) => `export default () => <img src="${n}.png" />;`;
const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });

describe('audit 1: .fringe/ can never be committed by accident', () => {
  it('the hook and --record leave git with nothing to commit, and login output is ignored too', async () => {
    const d = mk({ 'package.json': '{}', 'src/A.tsx': IMG('a') });
    git(d, 'init', '-q'); git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
    await run(['check', d, '--claude-hook']);
    await run(['check', d, '--record']);
    expect(existsSync(join(d, '.fringe/last.json'))).toBe(true);
    expect(readFileSync(join(d, '.fringe/.gitignore'), 'utf8')).toBe('*\n');
    expect(git(d, 'status', '--short').stdout.trim()).toBe('');
  });
});

describe('audit 2: a hand-off survives the checkout moving', () => {
  it('verify finds the project beside the hand-off file, and --root overrides', async () => {
    const d = mk({ 'package.json': '{}', 'src/A.tsx': IMG('a'), 'src/B.tsx': IMG('b') });
    await run(['handoff', d]);
    const moved = join(mk(), 'elsewhere');
    renameSync(d, moved);                                              // the old path no longer exists
    const v = await run(['verify'], moved);
    expect(v.code).toBe(1);
    expect(v.out).toContain('0 of 2 fixed');
    writeFileSync(join(moved, 'src/A.tsx'), 'export default () => <img src="a.png" alt="A" />;');
    writeFileSync(join(moved, 'src/B.tsx'), 'export default () => <img src="b.png" alt="B" />;');
    const here = mk();
    expect((await run(['verify', '--handoff', join(moved, '.fringe/handoff.json'), '--root', moved], here)).out).toContain('status: complete');
    const saved = JSON.parse(readFileSync(join(moved, '.fringe/handoff.json'), 'utf8'));
    expect(saved.rootRel).toBe('..');
  });
});

describe('audit 3: init pins the version it ran with', () => {
  it('writes the exact version into the hook and the commit gate, and recognises it when re-run', async () => {
    const d = mk({ '.git/HEAD': 'ref: refs/heads/main\n' });
    await run(['init', d, '--git']);
    await run(['init', d]);
    await run(['init', d]);                                             // second run must see the pinned hook as already there
    const settings = JSON.parse(readFileSync(join(d, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toMatch(/^npx -y @fringetools\/cli@\d+\.\d+\.\d+ check --claude-hook$/);
    expect(readFileSync(join(d, '.git/hooks/pre-commit'), 'utf8')).toMatch(/npx -y @fringetools\/cli@\d+\.\d+\.\d+ check/);
  });
});

describe('audit 4: the post-edit hook judges the edited file only', () => {
  it('lean mode parses one file and ignores a broken neighbour; receipts never mark other files fixed', async () => {
    const d = mk({ 'package.json': '{}', 'src/A.tsx': IMG('a'), 'src/B.tsx': IMG('b'), 'src/Broken.tsx': 'export default ( => <<<' });
    const only = new Set([join(d, 'src/A.tsx')]);
    const lean = await runCheck(d, loadConfig(d), true, only, true);
    const full = await runCheck(d, loadConfig(d), true, only, false);
    expect(lean.findings.map((f) => f.loc.file)).toEqual([join(d, 'src/A.tsx')]);
    expect(lean.skipped).toEqual([]);                                   // the broken neighbour was never parsed
    expect(full.skipped.length).toBe(1);
    // whole-project run records A and B; a scoped run for A (now fixed) must not touch B's entry
    await run(['check', d, '--claude-hook']);
    writeFileSync(join(d, 'src/A.tsx'), 'export default () => <img src="a.png" alt="A" />;');
    const out = (await run(['check', join(d, 'src/A.tsx'), '--claude-hook'])).out;
    expect(JSON.parse(readFileSync(join(d, '.fringe/last.json'), 'utf8'))).toHaveProperty(['src/B.tsx']);
    expect(out).toBe('');                                               // A is clean: silent
  });
});

describe('audit 5: playbooks stay out of backend work', () => {
  it('does not fire for table/search/settings/chat words in backend requests, still fires for UI ones', () => {
    for (const p of ['add a new column to the users table', 'write a script to search the logs', 'create a database migration for the orders table', 'add a settings flag to the CLI', 'implement a chat completion client for the API', 'make the form validation faster on the server'])
      expect(matchPlaybooks(p), p).toEqual([]);
    expect(matchPlaybooks('create a React table of users')).toEqual(['table']);
    expect(matchPlaybooks('build a settings page')).toEqual(['settings']);
    expect(matchPlaybooks('Create src/Search.tsx: a search box')).toEqual(['search']);
    expect(matchPlaybooks('create a carousel')).toEqual(['carousel']);     // unmistakable UI components need no cue
    expect(matchPlaybooks('create a database table component for the admin page')).toEqual(['table']);
  });
});

describe('audit 6: the commit gate script really blocks, and really fails open', () => {
  function repoWithGate(npx: string | null) {
    const d = mk({ 'package.json': '{}', 'a.txt': 'x' });
    git(d, 'init', '-q');
    spawnSync('node', [join(__dirname, '..', 'dist', 'bin.js'), 'init', d, '--git'], { encoding: 'utf8' });
    const bin = mk();
    if (npx !== null) { writeFileSync(join(bin, 'npx'), `#!/bin/sh\n${npx}\n`); chmodSync(join(bin, 'npx'), 0o755); }
    git(d, 'add', '-A');
    const env = { ...process.env, PATH: `${bin}:/usr/bin:/bin`, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
    return () => spawnSync('git', ['commit', '-qm', 'x'], { cwd: d, encoding: 'utf8', env });
  }
  const built = existsSync(join(__dirname, '..', 'dist', 'bin.js'));
  it.skipIf(!built)('blocks on an error finding, passes when clean, and passes when the checker cannot run', () => {
    expect(repoWithGate('echo "[ERROR] FR-201 a.tsx:1 — img missing alt"; exit 1')().status).not.toBe(0);   // a real finding blocks
    expect(repoWithGate('echo "fringe · clean"; exit 0')().status).toBe(0);                                  // clean passes
    expect(repoWithGate('echo "npm ERR! network"; exit 1')().status).toBe(0);                               // checker failed for another reason: fail open
    expect(repoWithGate(null)().status).toBe(0);                                                             // no npx at all: fail open
  });
});

describe('audit 8 and 9: the CLI and the ledger page', () => {
  it('names that are not commands (constructor, toString) are unknown commands', async () => {
    expect((await run(['constructor'])).code).toBe(2);
    expect((await run(['toString'])).out).toContain('unknown command');
  });
  it('the ledger page answers its own address and refuses a rebinding hostname', async () => {
    const d = mk();
    const server = await startBoard(d, 0);
    const port = (server.address() as { port: number }).port;
    try {
      expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(200);
      const status = await new Promise<number>((ok, fail) => { http.get({ host: '127.0.0.1', port, headers: { host: 'evil.example.com' } }, (r) => { r.resume(); ok(r.statusCode ?? 0); }).on('error', fail); }); // async: a sync child process would block the server living in this same process
      expect(status).toBe(421);
    } finally { server.close(); }
  });
});

describe('audit 7: numbers in the docs match the code', () => {
  const root = join(__dirname, '..', '..', '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  const docs = ['README.md', 'packages/cli/README.md', 'docs/PRD.md', 'docs/product.md', 'docs/architecture.md', 'docs/ROADMAP.md', 'INSTALL.md'];
  it('every "N rules" and "N playbooks" in the docs equals what the code has', () => {
    const items = Object.values(PATTERNS).reduce((n, p) => n + p.items.length, 0);
    for (const f of docs) {
      const text = read(f);
      for (const m of text.matchAll(/\b(\d+) (?:pure )?rules?\b(?! in)/g)) if (Number(m[1]) > 20) expect(Number(m[1]), `${f}: "${m[0]}"`).toBe(ALL_RULES.length);
      for (const m of text.matchAll(/\b(\d+) (?:build-time )?playbooks\b/g)) expect(Number(m[1]), `${f}: "${m[0]}"`).toBe(Object.keys(PATTERNS).length);
      for (const m of text.matchAll(/\b(\d+) items\b/g)) if (Number(m[1]) > 100) expect(Number(m[1]), `${f}: "${m[0]}"`).toBe(items);
    }
  });
});
