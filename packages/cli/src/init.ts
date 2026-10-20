import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// npx runs a locally installed copy if there is one and downloads otherwise, so init needs no prior install.
const HOOK = 'npx -y @fringetools/cli check --claude-hook';
// Skill name -> shipped source file (packages/cli/skill/).
const SKILLS: Record<string, string> = { fringe: 'SKILL.md', 'fringe-review': 'review.md', 'fringe-audit': 'audit.md' };
const skillSrc = (file: string) => fileURLToPath(new URL(`../skill/${file}`, import.meta.url));

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
  for (const [name, file] of Object.entries(SKILLS)) {
    const skillPath = join(root, '.claude', 'skills', name, 'SKILL.md');
    if (existsSync(skillPath)) done.push(`skill ${name} already present`);
    else {
      mkdirSync(dirname(skillPath), { recursive: true });
      copyFileSync(skillSrc(file), skillPath);
      done.push(`skill ${name} installed`);
    }
  }
  return done;
}
