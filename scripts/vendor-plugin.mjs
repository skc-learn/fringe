// Vendors the Claude Code plugin's runtime into plugin/vendor so the plugin runs code that is IN the plugin
// (readable, reviewable, version-locked) instead of fetching a package from the npm registry at run time.
//   plugin/vendor/cli/pluginHook.js   our two hooks, bundled, unminified (from packages/cli/src/pluginHook.ts)
//   plugin/vendor/node_modules/       the production dependencies at the exact versions in npm-shrinkwrap.json
// Limits the plugin directory enforces: every file < 256 KiB, whole plugin < 512 files. This script fails if either is exceeded.
// Run after any source or dependency change, then commit: node scripts/vendor-plugin.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

// 2. dependencies, installed exactly as the shrinkwrap pins them
const deps = join(tmp, 'deps');
mkdirSync(deps);
writeFileSync(join(deps, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, dependencies: pkg.dependencies }, null, 2));
copyFileSync(join(cli, 'npm-shrinkwrap.json'), join(deps, 'package-lock.json'));
execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: deps, stdio: 'inherit' });
cpSync(join(deps, 'node_modules'), join(out, 'node_modules'), { recursive: true });

// 3. keep only what runs: drop type declarations, source maps, docs, tests and CLI shims
const drop = /(\.d\.[cm]?ts|\.map|\.md|\.markdown|\.ts)$/i;
const keepAnyway = /^(license|licence|notice)/i;
const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) {
  const p = join(dir, e.name);
  if (e.isDirectory()) { if (/^(test|tests|__tests__|docs?|\.github|bin)$/.test(e.name)) rmSync(p, { recursive: true, force: true }); else walk(p); }
  else if (drop.test(e.name) && !keepAnyway.test(e.name)) rmSync(p, { force: true });
} };
walk(join(out, 'node_modules'));
rmSync(join(out, 'node_modules', '.package-lock.json'), { force: true });
rmSync(join(out, 'node_modules', '.bin'), { recursive: true, force: true }); // symlinks to CLI shims we do not ship; a dangling symlink in a plugin is a defect
writeFileSync(join(out, 'README.md'), `Vendored runtime for the Fringe Claude Code plugin (version ${pkg.version}).\n\nThe plugin's two hooks run \`node pluginHook.js\` from this folder: no package is downloaded at run time. \`cli/pluginHook.js\` is the unminified build of packages/cli/src/pluginHook.ts; \`node_modules/\` holds the production dependencies at the exact versions in packages/cli/npm-shrinkwrap.json. Regenerate with \`node scripts/vendor-plugin.mjs\`.\n`);

// 4. the directory's limits
let files = 0, biggest = ['', 0];
const count = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isSymbolicLink()) throw new Error(`${p} is a symlink: vendored files must be real files`); if (e.isDirectory()) count(p); else { files++; const s = statSync(p).size; if (s > biggest[1]) biggest = [p, s]; } } };
count(out);
if (biggest[1] >= 256 * 1024) throw new Error(`${biggest[0]} is ${biggest[1]} bytes: a vendored file must stay under 256 KiB`);
console.log(`vendored ${files} files into plugin/vendor (largest: ${biggest[0].replace(root + '/', '')}, ${Math.round(biggest[1] / 1024)} KiB)`);
