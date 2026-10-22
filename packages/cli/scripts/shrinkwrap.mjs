// Regenerates npm-shrinkwrap.json (production dependencies only). npm honours a shrinkwrap when it installs a package,
// including `npx @fringetools/cli`, so users get the exact dependency tree we tested instead of whatever resolves that day.
// Run it whenever dependencies or the version change: `pnpm run shrinkwrap`.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'fringe-shrinkwrap-'));
writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, dependencies: pkg.dependencies }, null, 2));
execFileSync('npm', ['install', '--package-lock-only', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: tmp, stdio: 'inherit' });
copyFileSync(join(tmp, 'package-lock.json'), join(here, '..', 'npm-shrinkwrap.json'));
console.log('npm-shrinkwrap.json written for', pkg.name + '@' + pkg.version);
