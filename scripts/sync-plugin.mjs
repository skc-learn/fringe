// The Claude Code plugin ships from plugin/ only (hooks + skills + manifest), so a directory scan of the plugin sees
// nothing but the plugin. The skills live in packages/cli/skill/ (one source for the npm package, `fringe init` and the plugin);
// this copies them into plugin/skills/ (and AGENTS.md into packages/cli/rules/fringe.md). A test fails if they drift. Run: node scripts/sync-plugin.mjs
import { copyFileSync, cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'packages/cli/skill'), to = join(root, 'plugin/skills');
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
for (const name of readdirSync(from)) cpSync(join(from, name), join(to, name), { recursive: true });
copyFileSync(join(root, 'AGENTS.md'), join(root, 'packages/cli/rules/fringe.md')); // AGENTS.md is the one source for the rules text
console.log(`plugin/skills synced from packages/cli/skill (${readdirSync(to).length} skills); rules/fringe.md copied from AGENTS.md`);
