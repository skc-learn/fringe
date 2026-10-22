// Vendors the Claude Code plugin's runtime into plugin/vendor so the plugin runs code that is IN the plugin
// (readable, reviewable, version-locked) instead of fetching a package from the npm registry at run time.
//   plugin/vendor/cli/pluginHook.js   the dependency-free playbook hook, unminified (from packages/cli/src/pluginHook.ts); no third-party code ships
// Limits the plugin directory enforces: every file < 256 KiB, whole plugin < 512 files. This script fails if either is exceeded.
// Run after any source or dependency change, then commit: node scripts/vendor-plugin.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli');
const out = join(root, 'plugin/vendor');
const pkg = JSON.parse(readFileSync(join(cli, 'package.json'), 'utf8'));
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'cli'), { recursive: true });

// 1. our code, one readable ESM file
const tmp = mkdtempSync(join(tmpdir(), 'fringe-vendor-'));
execFileSync('pnpm', ['exec', 'tsup', 'src/pluginHook.ts', '--format', 'esm', '--outDir', tmp, '--no-splitting', '--target', 'es2022', '--no-minify'], { cwd: cli, stdio: 'inherit' });
renameSync(join(tmp, 'pluginHook.js'), join(out, 'cli', 'pluginHook.js'));
writeFileSync(join(out, 'cli', 'package.json'), JSON.stringify({ name: '@fringetools/cli-plugin-hooks', version: pkg.version, type: 'module', private: true, description: 'Vendored hook subset of @fringetools/cli, built by scripts/vendor-plugin.mjs' }, null, 2) + '\n');

writeFileSync(join(out, 'README.md'), `Vendored runtime for the Fringe Claude Code plugin (version ${pkg.version}).\n\n\`cli/pluginHook.js\` is the only code the plugin runs itself: the dependency-free playbook hook, built unminified from packages/cli/src/pluginHook.ts. No third-party code and no package download. The post-edit check (hooks/check.sh) runs the \`fringe\` you installed. Regenerate with \`node scripts/vendor-plugin.mjs\`.\n`);

// 2. the directory's limits
let files = 0, biggest = ['', 0];
const count = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isSymbolicLink()) throw new Error(`${p} is a symlink: vendored files must be real files`); if (e.isDirectory()) count(p); else { files++; const s = statSync(p).size; if (s > biggest[1]) biggest = [p, s]; } } };
count(out);
if (biggest[1] >= 256 * 1024) throw new Error(`${biggest[0]} is ${biggest[1]} bytes: a vendored file must stay under 256 KiB`);
console.log(`vendored ${files} files into plugin/vendor (largest: ${biggest[0].replace(root + '/', '')}, ${Math.round(biggest[1] / 1024)} KiB)`);
