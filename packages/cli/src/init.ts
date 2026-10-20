import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// npx runs a locally installed copy if there is one and downloads otherwise, so init needs no prior install.
const HOOK = 'npx -y @fringetools/cli check --claude-hook';
const SKILL = fileURLToPath(new URL('../skill/SKILL.md', import.meta.url));

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
    post.push({ matcher: 'Edit|Write', hooks: [{ type: 'command', command: HOOK }] });
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    done.push(`hook added to ${settingsPath}`);
  }
  const skillPath = join(root, '.claude', 'skills', 'fringe', 'SKILL.md');
  if (existsSync(skillPath)) done.push('skill already present');
  else {
    mkdirSync(dirname(skillPath), { recursive: true });
    copyFileSync(SKILL, skillPath);
    done.push(`skill installed at ${skillPath}`);
  }
  return done;
}
