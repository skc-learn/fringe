import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { initProject } from '../src/init.js';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

describe('Claude Code plugin manifests', () => {
  it('point at real files and share one skill source with `fringe init`', () => {
    const plugin = json('.claude-plugin/plugin.json');
    expect(plugin.version).toBe(json('packages/cli/package.json').version);
    expect(plugin.skills).toBe('./packages/cli/skill/');
    // hooks/hooks.json is auto-loaded by Claude Code; listing it in the manifest breaks the plugin ("Duplicate hooks file").
    expect(plugin.hooks).toBeUndefined();
    expect(existsSync(join(root, 'hooks/hooks.json'))).toBe(true);
    const market = json('.claude-plugin/marketplace.json');
    expect(market.plugins[0].name).toBe(plugin.name);
  });
  it('every skill folder has a SKILL.md whose name matches the folder', () => {
    const dir = join(root, 'packages/cli/skill');
    const names = readdirSync(dir);
    expect(names.length).toBeGreaterThanOrEqual(6);
    for (const n of names) expect(readFileSync(join(dir, n, 'SKILL.md'), 'utf8')).toMatch(new RegExp(`^---\\nname: ${n}\\n`));
  });
  it('the plugin hooks run the same commands `fringe init` writes, pinned to this version', () => {
    const hooks = json('hooks/hooks.json').hooks;
    const version = json('.claude-plugin/plugin.json').version;
    const dir = mkdtempSync(join(tmpdir(), 'fringe-plugin-'));
    try {
      initProject(dir);
      const written = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).hooks;
      for (const ev of ['PostToolUse', 'UserPromptSubmit']) {
        const pinned: string = hooks[ev][0].hooks[0].command;
        expect(pinned, ev).toContain(`@fringetools/cli@${version} `);
        expect(pinned.replace(/cli@[\d.]+ /, 'cli '), ev).toBe(written[ev][0].hooks[0].command);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
