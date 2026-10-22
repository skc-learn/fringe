import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';

const dirs: string[] = [];
const mk = (files: Record<string, string>) => {
  const d = mkdtempSync(join(tmpdir(), 'fringe-bl-')); dirs.push(d);
  for (const [n, c] of Object.entries(files)) { mkdirSync(join(d, n, '..'), { recursive: true }); writeFileSync(join(d, n), c); }
  return d;
};
const run = async (args: string[]) => { const out: string[] = []; const err: string[] = []; const code = await runCli(args, { log: (s) => out.push(s), err: (s) => err.push(s) }); return { code, out: out.join('\n'), err: err.join('') }; };
const IMG = '<html lang="en"><head><title>t</title></head><body><img src="a.png"></body></html>';

describe('baseline', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('gates only on findings added after the baseline', async () => {
    const d = mk({ 'a.html': IMG });
    expect((await run(['check', d])).code).toBe(1);
    expect((await run(['check', d, '--update-baseline'])).code).toBe(0);
    const after = await run(['check', d]);
    expect(after.code).toBe(0);
    expect(after.out).toContain('1 baselined');
    writeFileSync(join(d, 'b.html'), IMG);                     // a new file with the same problem
    expect((await run(['check', d])).code).toBe(1);
    writeFileSync(join(d, 'a.html'), '\n\n' + IMG);            // moved lines must not resurrect the old finding
    rmSync(join(d, 'b.html'));
    expect((await run(['check', d])).code).toBe(0);
  });
  it('a corrupt baseline fails loudly (exit 2), not silently green', async () => {
    const d = mk({ 'a.html': IMG, 'fringe.baseline.json': '{nope' });
    const r = await run(['check', d]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('baseline');
  });
});

describe('init', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('adds the hook once and keeps existing settings', async () => {
    const d = mk({ '.claude/settings.json': JSON.stringify({ permissions: { allow: ['x'] } }) });
    expect((await run(['init', d])).code).toBe(0);
    await run(['init', d]);
    const s = JSON.parse(readFileSync(join(d, '.claude/settings.json'), 'utf8'));
    expect(s.permissions.allow).toEqual(['x']);
    expect(s.hooks.PostToolUse).toHaveLength(1);
    expect(s.hooks.PostToolUse[0].hooks[0].command).toMatch(/@fringetools\/cli@\d+\.\d+\.\d+ check --claude-hook/);
    expect(existsSync(join(d, '.claude/skills/fringe/SKILL.md'))).toBe(true);
  });
  it('refuses to overwrite invalid settings.json', async () => {
    const d = mk({ '.claude/settings.json': '{bad' });
    expect((await run(['init', d])).code).toBe(2);
    expect(readFileSync(join(d, '.claude/settings.json'), 'utf8')).toBe('{bad');
  });
});

describe('inline suppression', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('silences the named rule on the next line, reports it, and nothing else', async () => {
    const d = mk({ 'a.html': '<!-- fringe-ignore FR-201 -->\n<img src="a.png">\n<img src="b.png">' });
    const r = await run(['check', d]);
    expect(r.out).toContain('1 suppressed');
    expect(r.out).toContain('1 errors');              // the second <img> is not covered
    const other = mk({ 'a.html': '<!-- fringe-ignore FR-202 -->\n<img src="a.png">' });
    expect((await run(['check', other])).code).toBe(1); // wrong rule id does not silence
  });
});

describe('manifest evidence', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('flags a cut with vague or missing evidence as unsupported, keeps real evidence clean', async () => {
    const m = { flows: [{ action: 'cut', what: 'export tab', evidence: '0 uses in analytics (90d)' }, { action: 'cut', what: 'footer', evidence: 'none' }, { action: 'kept', what: 'login', evidence: '' }] };
    const d = mk({ 'a.html': '<html><body><p>ok</p></body></html>', 'm.json': JSON.stringify(m) });
    const r = await run(['check', d, '--record', '--manifest', join(d, 'm.json')]);
    expect(r.err).toContain("cut 'footer'");
    expect(r.err).not.toContain('export tab');
    expect(r.err).not.toContain('login');
    const rec = JSON.parse(readFileSync(join(d, '.fringe', 'ledger.jsonl'), 'utf8').trim());
    expect(rec.manifest.flows.map((f: any) => !!f.unsupported)).toEqual([false, true, false]);
  });
  it('init installs all three skills', async () => {
    const d = mk({});
    await run(['init', d]);
    for (const n of ['fringe', 'fringe-review', 'fringe-audit', 'fringe-debt', 'fringe-help', 'fringe-setup']) expect(existsSync(join(d, '.claude/skills', n, 'SKILL.md'))).toBe(true);
  });
});

describe('regression receipts in the Claude hook', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  const reason = async (d: string) => { const r = await run(['check', d, '--claude-hook']); return r.out ? (JSON.parse(r.out).reason as string) : ''; };
  const bad = (n: string) => `<html lang="en"><head><title>t</title></head><body><img src="${n}.png"></body></html>`;
  it('says what the last edit broke and fixed, stays silent when clean, and survives corrupt state', async () => {
    const d = mk({ 'a.html': bad('a') });
    const first = await reason(d);
    expect(first).toContain('1 accessibility error');
    expect(first).not.toContain('introduced');                 // nothing to compare with on the first run
    writeFileSync(join(d, 'b.html'), bad('b'));                // the agent's edit breaks another file
    const second = await reason(d);
    expect(second).toMatch(/introduced 1 new error/);
    expect(second).toMatch(/NEW FR-201 b\.html/);
    expect(second.indexOf('NEW FR-201 b.html')).toBeLessThan(second.indexOf('- FR-201 a.html')); // new one listed first
    writeFileSync(join(d, 'b.html'), '<html lang="en"><head><title>t</title></head><body><img src="b.png" alt=""></body></html>');
    const third = await reason(d);
    expect(third).toMatch(/introduced 0 new error\(s\) and fixed 1/);
    writeFileSync(join(d, 'a.html'), '<html lang="en"><head><title>t</title></head><body><img src="a.png" alt="A"></body></html>');
    expect(await reason(d)).toBe('');                          // all clean: silent
    writeFileSync(join(d, '.fringe', 'last.json'), '{garbage');
    writeFileSync(join(d, 'a.html'), bad('a'));
    expect(await reason(d)).toContain('1 accessibility error'); // corrupt state: no comparison, no crash
  });
});

describe('simpler setup', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('init --global writes the hook and skills under the home directory, leaving the project alone', async () => {
    const home = mk({}), proj = mk({});
    const out: string[] = [];
    expect(await runCli(['init', '--global'], { log: (s) => out.push(s), err: () => {}, home, cwd: proj })).toBe(0);
    expect(existsSync(join(home, '.claude/settings.json'))).toBe(true);
    expect(existsSync(join(home, '.claude/skills/fringe-review/SKILL.md'))).toBe(true);
    expect(existsSync(join(proj, '.claude'))).toBe(false);
    expect(out.join('\n')).toContain('every project');
  });
  it('init uses the project\'s own installed copy when there is one', async () => {
    const d = mk({ 'node_modules/@fringetools/cli/package.json': '{}' });
    await run(['init', d]);
    expect(readFileSync(join(d, '.claude/settings.json'), 'utf8')).toContain('npx --no-install fringe check --claude-hook');
    const e = mk({});
    await run(['init', e]);
    expect(readFileSync(join(e, '.claude/settings.json'), 'utf8')).toMatch(/npx -y @fringetools\/cli@\d+\.\d+\.\d+ check --claude-hook/);
  });
  it('bare `fringe` checks the folder and nudges until the hook is set up, then stops nudging', async () => {
    const home = mk({}), d = mk({ 'a.html': IMG });
    const out: string[] = [];
    const code = await runCli([], { log: (s) => out.push(s), err: () => {}, cwd: d, home });
    expect(code).toBe(1);                                    // same exit code as `check`
    expect(out.join('\n')).toContain('init --global');
    await runCli(['init', '--global'], { log: () => {}, err: () => {}, home });
    const again: string[] = [];
    await runCli([], { log: (s) => again.push(s), err: () => {}, cwd: d, home });
    expect(again.join('\n')).not.toContain('not checking after');
  });
});

describe('other agents', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('init --for writes each tool\'s own rules file, and never overwrites an existing one', async () => {
    const d = mk({ 'AGENTS.md': '# My project rules\nBe nice.\n' });
    const r = await run(['init', d, '--for', 'cursor,codex,gemini,copilot,windsurf,cline,kiro']);
    expect(r.code).toBe(0);
    for (const f of ['.cursor/rules/fringe.mdc', 'GEMINI.md', '.github/copilot-instructions.md', '.windsurf/rules/fringe.md', '.clinerules/fringe.md', '.kiro/steering/fringe.md']) expect(existsSync(join(d, f)), f).toBe(true);
    expect(readFileSync(join(d, '.cursor/rules/fringe.mdc'), 'utf8')).toMatch(/^---\ndescription: [\s\S]*alwaysApply: true\n---/);
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('Be nice.');                       // the user's rules survive
    expect(agents).toContain('Fringe: handle your edges');      // ours appended
    await run(['init', d, '--for', 'codex']);                   // second run adds nothing
    expect(readFileSync(join(d, 'AGENTS.md'), 'utf8').match(/Fringe: handle your edges/g)).toHaveLength(1);
    expect(existsSync(join(d, '.claude'))).toBe(false);          // --for does not touch Claude settings unless asked
  });
  it('rejects an unknown agent and lists the valid ones', async () => {
    const r = await run(['init', mk({}), '--for', 'vim']);
    expect(r.code).toBe(2);
    expect(r.err).toContain('cursor');
  });
  it('init --git installs a pre-commit gate once, refuses to replace someone else\'s hook, and needs a repo', async () => {
    const d = mk({ '.git/HEAD': 'ref: refs/heads/main\n' });
    expect((await run(['init', d, '--git'])).code).toBe(0);
    const hook = join(d, '.git/hooks/pre-commit');
    expect(readFileSync(hook, 'utf8')).toMatch(/# fringe pre-commit[\s\S]*exit 1/);
    expect(statSync(hook).mode & 0o111).not.toBe(0);             // executable
    expect((await run(['init', d, '--git'])).out).toContain('already present');
    writeFileSync(hook, '#!/bin/sh\necho mine\n');
    expect((await run(['init', d, '--git'])).code).toBe(2);
    expect((await run(['init', mk({}), '--git'])).err).toContain('not a git repository');
  });
  it('the shipped rules file is the same as the repo-root AGENTS.md', () => {
    const root = join(__dirname, '..', '..', '..');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(readFileSync(join(__dirname, '..', 'rules', 'fringe.md'), 'utf8'));
  });
});
