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
  const prompt: any[] = ((settings.hooks ??= {}).UserPromptSubmit ??= []);
  if (/hook-prompt/.test(JSON.stringify(prompt))) done.push('playbook hook already present');
  else {
    prompt.push({ hooks: [{ type: 'command', command: hookCommand(root).replace('check --claude-hook', 'hook-prompt'), timeout: 20 }] });
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    done.push('playbook hook added (adds the matching playbook when you ask for a component)');
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

// Where each tool reads project rules from. The text is the same file everywhere (packages/cli/rules/fringe.md).
const RULES_FILE = fileURLToPath(new URL('../rules/fringe.md', import.meta.url));
const AGENT_FILES: Record<string, { path: string; wrap?: (body: string) => string }> = {
  codex: { path: 'AGENTS.md' }, generic: { path: 'AGENTS.md' }, amp: { path: 'AGENTS.md' }, jules: { path: 'AGENTS.md' }, zed: { path: 'AGENTS.md' },
  gemini: { path: 'GEMINI.md' },
  cursor: { path: '.cursor/rules/fringe.mdc', wrap: (b) => `---\ndescription: Fringe: check and fix UX/accessibility problems after editing frontend files\nalwaysApply: true\n---\n\n${b}` },
  copilot: { path: '.github/copilot-instructions.md' },
  windsurf: { path: '.windsurf/rules/fringe.md' },
  cline: { path: '.clinerules/fringe.md' },
  kiro: { path: '.kiro/steering/fringe.md' },
};
export const AGENTS = Object.keys(AGENT_FILES);
const MARK = '<!-- fringe:rules -->';

/** Writes (or appends to) each named tool's rules file with the Fringe rules. Never overwrites: a shared file such as AGENTS.md gets the rules appended once, behind a marker. */
export function initFor(root: string, agents: string[]): string[] {
  const body = readFileSync(RULES_FILE, 'utf8');
  const done: string[] = [];
  for (const a of agents) {
    const spec = AGENT_FILES[a];
    if (!spec) throw new Error(`unknown agent '${a}': use ${AGENTS.join(', ')} (or 'claude' for the hook + skills)`);
    const file = join(root, spec.path);
    const text = spec.wrap ? spec.wrap(body) : body;
    if (existsSync(file)) {
      const cur = readFileSync(file, 'utf8');
      if (cur.includes(MARK) || cur.includes('# Fringe: handle your edges')) { done.push(`${spec.path} already has the Fringe rules`); continue; }
      writeFileSync(file, `${cur.replace(/\n*$/, '\n')}\n${MARK}\n${spec.wrap ? body : text}`);
      done.push(`rules appended to ${spec.path}`);
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text.replace('# Fringe: handle your edges', `${MARK}\n# Fringe: handle your edges`));
      done.push(`${spec.path} created`);
    }
  }
  return done;
}

/** A git pre-commit gate: the one check every agent that commits will see, whatever its hook system. Never replaces somebody else's hook. */
export function initGit(root: string): string[] {
  const dir = join(root, '.git', 'hooks');
  if (!existsSync(join(root, '.git'))) throw new Error('not a git repository (no .git here)');
  const file = join(dir, 'pre-commit');
  const local = existsSync(join(root, 'node_modules', '@fringetools', 'cli', 'package.json'));
  // Fails open: only a real error-level finding blocks the commit. If the checker cannot run at all (no network, no node), the commit goes through.
  const cmd = local ? 'npx --no-install fringe check' : 'npx -y @fringetools/cli check';
  const script = `#!/bin/sh\n# fringe pre-commit: blocks the commit while error-level UX/accessibility problems remain\nout=$(${cmd} 2>&1); code=$?\nprintf '%s\\n' "$out"\nif [ "$code" -eq 1 ] && printf '%s' "$out" | grep -q '^\\[ERROR\\]'; then\n  echo "fringe: fix the errors above (or record them with: fringe check --update-baseline) and commit again." >&2\n  exit 1\nfi\nexit 0\n`;
  if (existsSync(file)) {
    if (readFileSync(file, 'utf8').includes('# fringe pre-commit')) return ['pre-commit hook already present'];
    throw new Error(`${file} already exists and is not Fringe's: add 'npx -y @fringetools/cli check || exit 1' to it yourself`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, script, { mode: 0o755 });
  return [`pre-commit hook installed at ${file}`];
}
