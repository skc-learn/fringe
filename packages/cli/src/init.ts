import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// npx runs a locally installed copy if there is one and downloads otherwise, so init needs no prior install.
const HOOK = 'npx -y @fringetools/cli check --claude-hook';
// Every folder under packages/cli/skill/ is one skill (same layout the Claude Code plugin loads).
const SKILL_DIR = fileURLToPath(new URL('../skill/', import.meta.url));

/** A copy installed in the project is faster and offline-safe, so use it when it exists; otherwise npx fetches one. */
function hookCommand(root: string): string {
  return existsSync(join(root, 'node_modules', '@fringetools', 'cli', 'package.json')) ? 'npx --no-install fringe check --claude-hook' : HOOK;
}

/** True when the Claude Code hook (or the plugin) is already set up for this project or for the user, so the bare command stops nudging. */
export function isWired(root: string, home: string): boolean {
  for (const dir of [root, home]) {
    try { if (/claude-hook|fringe(tool)?@/.test(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'))) return true; } catch { /* no settings there */ }
  }
  return false;
}

/** Wires the PostToolUse gate and installs the skill. Never overwrites: invalid settings.json aborts, an existing hook is kept. */
export function initProject(root: string): string[] {
  const done: string[] = [];
  const settingsPath = join(root, '.claude', 'settings.json');
  let settings: any = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); }
    catch { throw new Error(`${settingsPath} is not valid JSON — fix it and rerun`); }
  }
  const post: any[] = ((settings.hooks ??= {}).PostToolUse ??= []);
  if (/(fringe|@fringetools\/cli) check/.test(JSON.stringify(post))) done.push('hook already present');
  else {
    post.push({ matcher: 'Edit|Write', hooks: [{ type: 'command', command: hookCommand(root) }] });
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    done.push(`hook added to ${settingsPath}`);
  }
  for (const name of readdirSync(SKILL_DIR)) {
    const skillPath = join(root, '.claude', 'skills', name, 'SKILL.md');
    if (existsSync(skillPath)) done.push(`skill ${name} already present`);
    else {
      mkdirSync(dirname(skillPath), { recursive: true });
      copyFileSync(join(SKILL_DIR, name, 'SKILL.md'), skillPath);
      done.push(`skill ${name} installed`);
    }
  }
  return done;
}
