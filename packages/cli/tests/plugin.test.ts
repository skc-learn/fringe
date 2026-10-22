import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

describe('Claude Code plugin manifests', () => {
  it('point at real files and share one skill source with `fringe init`', () => {
    const plugin = json('plugin/.claude-plugin/plugin.json');
    expect(plugin.version).toBe(json('packages/cli/package.json').version);
    expect(plugin.skills).toBe('./skills/');
    // hooks/hooks.json is auto-loaded by Claude Code; listing it in the manifest breaks the plugin ("Duplicate hooks file").
    expect(plugin.hooks).toBeUndefined();
    expect(existsSync(join(root, 'plugin/hooks/hooks.json'))).toBe(true);
    const market = json('.claude-plugin/marketplace.json');
    expect(market.plugins[0].name).toBe(plugin.name);
    expect(market.plugins[0].source).toBe('./plugin');                  // the plugin is its own folder, not the whole repo
    expect(existsSync(join(root, 'plugin/.claude-plugin/plugin.json'))).toBe(true);
  });
  it('every skill folder has a SKILL.md whose name matches the folder', () => {
    const dir = join(root, 'packages/cli/skill');
    const names = readdirSync(dir);
    expect(names.length).toBeGreaterThanOrEqual(6);
    for (const n of names) expect(readFileSync(join(dir, n, 'SKILL.md'), 'utf8')).toMatch(new RegExp(`^---\\nname: ${n}\\n`));
  });
  it('the plugin hooks run vendored code from the plugin itself, never a package fetched at run time', () => {
    const hooks = json('plugin/hooks/hooks.json').hooks;
    const cmds: string[] = [hooks.PostToolUse[0].hooks[0].command, hooks.UserPromptSubmit[0].hooks[0].command];
    expect(cmds).toEqual(['node "${CLAUDE_PLUGIN_ROOT}/vendor/cli/pluginHook.js" check', 'node "${CLAUDE_PLUGIN_ROOT}/vendor/cli/pluginHook.js" hook-prompt']);
    for (const c of cmds) expect(c).not.toMatch(/npx|npm |uvx|https?:/);
    expect(existsSync(join(root, 'plugin/vendor/cli/pluginHook.js'))).toBe(true);
    // the vendored copy is the one this version builds (run `node scripts/vendor-plugin.mjs` after any change)
    expect(json('plugin/vendor/cli/package.json').version).toBe(json('packages/cli/package.json').version);
  });
  it('the vendored plugin stays inside the directory limits: every file < 256 KiB, fewer than 512 files, no maps or type files', () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
    walk(join(root, 'plugin'));
    expect(files.length).toBeLessThan(512);
    for (const f of files) { expect(statSync(f).size, f).toBeLessThan(256 * 1024); expect(f).not.toMatch(/\.(map|d\.ts|d\.mts|d\.cts)$/); }
  });
  it('the vendored hooks really run: a block for a bad file, a playbook for a build request, silence otherwise, exit 0 always', () => {
    const hook = join(root, 'plugin/vendor/cli/pluginHook.js');
    const dir = mkdtempSync(join(tmpdir(), 'fringe-vendored-'));
    try {
      mkdirSync(join(dir, 'src')); writeFileSync(join(dir, 'package.json'), '{}');
      writeFileSync(join(dir, 'src/A.tsx'), 'export default () => <img src="a.png" />;');
      const run = (args: string[], input = '') => spawnSync('node', [hook, ...args], { cwd: dir, input, encoding: 'utf8' });
      const check = run(['check']);
      expect(check.status).toBe(0);
      expect(JSON.parse(check.stdout)).toMatchObject({ decision: 'block' });
      expect(JSON.parse(run(['hook-prompt'], JSON.stringify({ prompt: 'create a carousel' })).stdout).hookSpecificOutput.additionalContext).toContain('Carousel: build it like this');
      expect(run(['hook-prompt'], JSON.stringify({ prompt: 'fix the bug' })).stdout).toBe('');
      expect(run(['nonsense']).status).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('plugin/skills is an exact copy of packages/cli/skill (run `node scripts/sync-plugin.mjs`)', () => {
    const from = join(root, 'packages/cli/skill'), to = join(root, 'plugin/skills');
    expect(readdirSync(to).sort()).toEqual(readdirSync(from).sort());
    for (const n of readdirSync(from)) expect(readFileSync(join(to, n, 'SKILL.md'), 'utf8'), n).toBe(readFileSync(join(from, n, 'SKILL.md'), 'utf8'));
  });
  it('the plugin folder holds only the plugin: manifest, icon, hooks, skills and the vendored runtime', () => {
    expect(readdirSync(join(root, 'plugin')).sort()).toEqual(['.claude-plugin', 'hooks', 'skills', 'vendor']);
  });
  it('the npm package ships a shrinkwrap that matches package.json (run `pnpm run shrinkwrap`)', () => {
    const pkg = json('packages/cli/package.json'), wrap = json('packages/cli/npm-shrinkwrap.json');
    expect(wrap.name).toBe(pkg.name);
    expect(wrap.version).toBe(pkg.version);
    expect(Object.keys(wrap.packages[''].dependencies).sort()).toEqual(Object.keys(pkg.dependencies).sort());
    for (const d of Object.keys(pkg.dependencies)) expect(wrap.packages[`node_modules/${d}`], d).toBeDefined();
    expect(pkg.files).toContain('npm-shrinkwrap.json');
  });
});
