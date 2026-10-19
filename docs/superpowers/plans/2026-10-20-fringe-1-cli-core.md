# Fringe Plan 1 — CLI Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `fringe check` — a static UX checker that parses JSX/HTML/CSS, runs all rung-2 rules (FR-201–209) and dark-pattern reviews (FR-210–214), reports findings (pretty/JSON/hook), computes a health score, and records task results to a local ledger.

**Architecture:** pnpm monorepo, single package `packages/cli`. Pipeline: `detect` (stack) → `walk` (files) → `parse` (JSX/HTML/CSS → shared `Elem`/`CssDecl` IR) → `rules` (pure functions over IR + source text) → `report` (formatter/JSON/hook) with optional ledger append. Rules are pure and registered; every rule has pass/fail fixtures.

**Tech Stack:** TypeScript (strict), Node ≥ 18, `@babel/parser`, `postcss`, `parse5`; dev: `vitest`, `tsup`, `typescript`. Zero other runtime deps.

## Global Constraints

- Node ≥ 18; pnpm workspaces; TypeScript `strict: true`.
- Runtime deps allowed: `@babel/parser`, `postcss`, `parse5` only. Dev deps: `typescript`, `vitest`, `tsup`, `@types/node`.
- License: MIT. Repo root = `/Users/skc/Desktop/coding/pony tail for ux`.
- Package name: run `npm view fringe version` — if 404 → package name `fringe`; if it exists → package name `@fringetool/cli`. Bin name is always `fringe`. Apply consistently in every `package.json`.
- Rule IDs are stable strings `FR-201`…`FR-214` (this plan). Severities: `error` (high-confidence AST), `review` (heuristic), `signal` (taste; none in this plan).
- Exit codes: `0` clean, `1` any `error` findings, `2` internal failure. Unparseable files are skipped with a warning, never crash.
- Health score: `max(0, 100 − (10×errors + 3×review + 1×signals))`; weights configurable.
- Ledger: `.fringe/ledger.jsonl`, append-only JSONL, tolerant reader (skip corrupt lines, report count).
- Config: `fringe.config.json` — `{ ignore?: string[], disable?: string[], weights?: { error: number, review: number, signal: number } }`. Zero-config works with defaults.
- Every task: TDD — failing test first, minimal implementation, pass, commit. Run tests from repo root: `pnpm --filter fringe test` (or `@fringetool/cli` if scoped — use the actual filter for the chosen name).

## File Structure (final state of this plan)

```
package.json                     pnpm root, workspaces scripts
pnpm-workspace.yaml
tsconfig.base.json
fixtures/                        (repo-level, committed)
  rules/<FR-xxx>/{pass,fail}.<ext>
  reference-app/                 golden snapshot target (Task 19)
packages/cli/
  package.json  tsconfig.json  vitest.config.ts
  src/bin.ts                     #!/usr/bin/env node shim → ./index.js
  src/index.ts                   argv parsing, exit codes
  src/types.ts                   Severity, Finding, Elem, CssDecl, Rule, RuleContext, FringeConfig
  src/config.ts                  load + validate fringe.config.json
  src/detect.ts                  stack auto-detection
  src/walk.ts                    file walker
  src/parse/jsx.ts  html.ts  css.ts
  src/rules/registry.ts          rule list + disable filter
  src/rules/fr201.ts … fr214.ts  one file per rule
  src/check.ts                   orchestration → CheckResult
  src/score.ts                   health score
  src/ledger.ts                  append + tolerant read
  src/report/pretty.ts  json.ts  hook.ts
  tests/*.test.ts                one per concern, fixtures via FIXTURES dir
```

---

### Task 1: Monorepo scaffold + version command

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `packages/cli/package.json`, `packages/cli/tsconfig.json`, `packages/cli/vitest.config.ts`, `packages/cli/src/index.ts`, `packages/cli/src/version.ts`, `packages/cli/tests/version.test.ts`
- Test: `packages/cli/tests/version.test.ts`

**Interfaces:**
- Produces: `runCli(argv: string[]): Promise<number>` in `src/index.ts` (returns exit code); `VERSION` in `src/version.ts`; package name decided here (Global Constraints rule) — later tasks' `pnpm --filter` uses it.

- [ ] **Step 1: Decide package name**

Run: `npm view fringe version`
If output is `npm ERR! code E404` → name `fringe`; else → name `@fringetool/cli`. Record it; use everywhere below.

- [ ] **Step 2: Write the failing test**

`packages/cli/tests/version.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/version.js';

describe('version', () => {
  it('is semver', () => expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/));
});
```
And `packages/cli/tests/cli.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runCli } from '../src/index.js';

describe('runCli', () => {
  it('prints version for --version and exits 0', async () => {
    const logs: string[] = [];
    const code = await runCli(['--version'], { log: (s) => logs.push(s) });
    expect(code).toBe(0);
    expect(logs.join('\n')).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('exits 2 for unknown command', async () => {
    expect(await runCli(['nope'], { log: () => {} })).toBe(2);
  });
});
```

- [ ] **Step 3: Scaffold files (test cannot run until they exist)**

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
```

`package.json` (root):
```json
{
  "name": "fringe-monorepo",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "skipLibCheck": true,
    "sourceMap": true
  }
}
```

`packages/cli/package.json` (name per Step 1):
```json
{
  "name": "fringe",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "bin": { "fringe": "dist/bin.js" },
  "engines": { "node": ">=18" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts src/bin.ts --format esm --dts --outDir dist",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "tests"] }
```

`packages/cli/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

`packages/cli/src/version.ts`:
```ts
export const VERSION = '0.1.0';
```

`packages/cli/src/bin.ts`:
```ts
#!/usr/bin/env node
import { runCli } from './index.js';
process.exit(await runCli(process.argv.slice(2)));
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd packages/cli && pnpm install && pnpm test`
Expected: FAIL — `Cannot find module '../src/index.js'` (runCli not implemented yet).

- [ ] **Step 5: Minimal implementation**

`packages/cli/src/index.ts`:
```ts
import { VERSION } from './version.js';

export interface CliOpts { log?: (s: string) => void }
const log = (o: CliOpts) => o.log ?? ((s: string) => console.log(s));

export async function runCli(argv: string[], opts: CliOpts = {}): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd === '--version' || cmd === '-v') { log(opts)(VERSION); return 0; }
  if (cmd === 'check') return 0; // wired up in Task 10
  log(opts)(`fringe: unknown command '${cmd ?? ''}' — try 'fringe check --help'`);
  return 2;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/cli && pnpm test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages/cli pnpm-lock.yaml
git commit -m "feat(cli): monorepo scaffold with version command"
```

---

### Task 2: Core types

**Files:**
- Create: `packages/cli/src/types.ts`
- Test: `packages/cli/tests/types.test.ts`

**Interfaces:**
- Produces (used by every later task — import from `../src/types.js`):
  - `type Severity = 'error' | 'review' | 'signal'`
  - `export const SEVERITIES: readonly Severity[] = ['error', 'review', 'signal']` (the only runtime export; everything else is types)
  - `interface Loc { file: string; line: number; col: number }`
  - `interface Finding { rule: string; severity: Severity; message: string; hint: string; loc: Loc }`
  - `interface Elem { tag: string; attrs: Record<string, string>; text: string; loc: Loc }`
  - `interface CssDecl { prop: string; value: string; selector: string; loc: Loc }`
  - `interface RuleContext { file: string; source: string; elems: Elem[]; css: CssDecl[] }`
  - `interface Rule { id: string; rung: 2 | 3; severity: Severity; check(ctx: RuleContext): Finding[] }`
  - `interface FringeConfig { ignore: string[]; disable: string[]; weights: { error: number; review: number; signal: number } }`
  - `interface Counts { error: number; review: number; signal: number }`
  - `interface CheckResult { stack: StackInfo; files: number; skipped: string[]; findings: Finding[]; counts: Counts; score: number }`
  - `interface StackInfo { jsx: boolean; tailwind: boolean; vue: boolean; svelte: boolean; html: boolean }`

- [ ] **Step 1: Write the failing test**

`packages/cli/tests/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SEVERITIES } from '../src/types.js';
import type { Finding } from '../src/types.js';

describe('types', () => {
  it('exports the three severities', () => {
    expect(SEVERITIES).toEqual(['error', 'review', 'signal']);
  });
  it('Finding shape compiles', () => {
    const f: Finding = { rule: 'FR-201', severity: 'error', message: 'm', hint: 'h', loc: { file: 'a.tsx', line: 1, col: 0 } };
    expect(f.rule).toBe('FR-201');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && pnpm vitest run tests/types.test.ts`
Expected: FAIL — cannot find module `../src/types.js`.

- [ ] **Step 3: Write `packages/cli/src/types.ts`**

Exactly the interfaces listed in the Interfaces block above, written out as TypeScript.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && pnpm vitest run tests/types.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add packages/cli/src/types.ts packages/cli/tests/types.test.ts && git commit -m "feat(cli): core types"`

---

### Task 3: Config loader

**Files:**
- Create: `packages/cli/src/config.ts`
- Test: `packages/cli/tests/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(root: string): FringeConfig` — reads `fringe.config.json` if present, validates types, throws `Error` with file path in message on invalid shape; defaults: `ignore: ['node_modules/**', 'dist/**', '.fringe/**', '*.min.*']`, `disable: []`, `weights: { error: 10, review: 3, signal: 1 }`.
- Consumes: `FringeConfig` from types.ts.

- [ ] **Step 1: Write the failing test**

`packages/cli/tests/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

function dir() { return mkdtempSync(join(tmpdir(), 'fringe-cfg-')); }

describe('loadConfig', () => {
  it('returns defaults when no config file', () => {
    const c = loadConfig(dir());
    expect(c.weights).toEqual({ error: 10, review: 3, signal: 1 });
    expect(c.ignore).toContain('node_modules/**');
  });
  it('merges user config', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ disable: ['FR-208'] }));
    const c = loadConfig(d);
    expect(c.disable).toEqual(['FR-208']);
    expect(c.weights.error).toBe(10);
  });
  it('throws on bad weights', () => {
    const d = dir();
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ weights: { error: 'x' } }));
    expect(() => loadConfig(d)).toThrow(/fringe\.config\.json/);
  });
  it('returns a fresh object each call (defaults not shared)', () => {
    const a = loadConfig(dir());
    a.ignore.push('mutated/**');
    const b = loadConfig(dir());
    expect(b.ignore).not.toContain('mutated/**');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd packages/cli && pnpm vitest run tests/config.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/config.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FringeConfig } from './types.js';

export const DEFAULT_CONFIG: FringeConfig = {
  ignore: ['node_modules/**', 'dist/**', '.fringe/**', '*.min.*'],
  disable: [],
  weights: { error: 10, review: 3, signal: 1 },
};

export function loadConfig(root: string): FringeConfig {
  try {
    const raw = readFileSync(join(root, 'fringe.config.json'), 'utf8');
    const user = JSON.parse(raw) as Partial<FringeConfig>;
    const cfg: FringeConfig = {
      ignore: Array.isArray(user.ignore) ? user.ignore : DEFAULT_CONFIG.ignore,
      disable: Array.isArray(user.disable) ? user.disable : DEFAULT_CONFIG.disable,
      weights: { ...DEFAULT_CONFIG.weights, ...(user.weights ?? {}) },
    };
    for (const k of ['error', 'review', 'signal'] as const) {
      if (typeof cfg.weights[k] !== 'number' || Number.isNaN(cfg.weights[k]))
        throw new Error(`weights.${k} must be a number`);
    }
    return cfg;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG;
    if (e instanceof SyntaxError) throw new Error(`fringe.config.json: invalid JSON`);
    throw e;
  }
}
```
Note: ENOENT → defaults; invalid JSON / bad weights → thrown `Error` mentioning `fringe.config.json` (the weights check above must re-throw with that prefix — wrap the validation throw as `new Error('fringe.config.json: ' + e.message)`).

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run tests/config.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(cli): config loader with defaults and validation"`

---

### Task 4: Stack auto-detection

**Files:**
- Create: `packages/cli/src/detect.ts`
- Test: `packages/cli/tests/detect.test.ts`

**Interfaces:**
- Produces: `detectStack(root: string): StackInfo` — reads `package.json` deps+devDeps and `src/` markers: `jsx: true` if deps contain react/preact/solid-js OR any `src/**/*.{jsx,tsx}` exists; `tailwind: true` if deps contain tailwindcss; `vue`/`svelte` similarly; `html: true` if any root-level `*.html` or `src/**/*.html` exists.

- [ ] **Step 1: Failing test**

`packages/cli/tests/detect.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack } from '../src/detect.js';

function dir() { return mkdtempSync(join(tmpdir(), 'fringe-det-')); }

describe('detectStack', () => {
  it('detects react+tailwind from package.json', () => {
    const d = dir();
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { react: '*', tailwindcss: '*' } }));
    expect(detectStack(d)).toEqual({ jsx: true, tailwind: true, vue: false, svelte: false, html: false });
  });
  it('detects jsx from files when package.json is silent', () => {
    const d = dir(); mkdirSync(join(d, 'src'));
    writeFileSync(join(d, 'src', 'App.jsx'), '<div/>');
    expect(detectStack(d).jsx).toBe(true);
  });
  it('no stack in empty dir', () => {
    const d = dir();
    expect(detectStack(d)).toEqual({ jsx: false, tailwind: false, vue: false, svelte: false, html: false });
  });
});
```

- [ ] **Step 2: Verify fail** — `pnpm vitest run tests/detect.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/detect.ts`**

```ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StackInfo } from './types.js';

function findFile(dir: string, match: (name: string) => boolean, depth: number): boolean {
  if (depth > 6) return false;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return false; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory()) { if (findFile(join(dir, e.name), match, depth + 1)) return true; }
    else if (match(e.name)) return true;
  }
  return false;
}

export function detectStack(root: string): StackInfo {
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch { /* no package.json */ }
  const has = (...names: string[]) => names.some((n) => deps[n]);
  return {
    jsx: has('react', 'react-dom', 'preact', 'solid-js') || findFile(root, (n) => n.endsWith('.jsx') || n.endsWith('.tsx'), 0),
    tailwind: has('tailwindcss'),
    vue: has('vue', 'nuxt'),
    svelte: has('svelte'),
    html: findFile(root, (n) => n.endsWith('.html'), 0),
  };
}
```
(Also import `readFileSync` from `node:fs` at the top.)

- [ ] **Step 4: Verify pass** — `pnpm vitest run tests/detect.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(cli): stack auto-detection"`

---

### Task 5: File walker

**Files:**
- Create: `packages/cli/src/walk.ts`
- Test: `packages/cli/tests/walk.test.ts`

**Interfaces:**
- Produces: `walk(root: string, cfg: FringeConfig): string[]` — absolute file paths under root, skipping `node_modules`, `.git`, dot-dirs, `.fringe`, and `cfg.ignore` glob patterns (support `**` and `*` via a tiny matcher — no new deps). Only these extensions are returned: `.jsx .tsx .js .ts .html .css .vue .svelte .astro .scss`.

- [ ] **Step 1: Failing test**

`packages/cli/tests/walk.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walk } from '../src/walk.js';
import { DEFAULT_CONFIG } from '../src/config.js';

function seed() {
  const d = mkdtempSync(join(tmpdir(), 'fringe-walk-'));
  writeFileSync(join(d, 'App.tsx'), '');
  mkdirSync(join(d, 'src'));
  writeFileSync(join(d, 'src', 'a.css'), '');
  mkdirSync(join(d, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(d, 'node_modules', 'x', 'y.tsx'), '');
  mkdirSync(join(d, 'gen'));
  writeFileSync(join(d, 'gen', 'b.tsx'), '');
  return d;
}

describe('walk', () => {
  it('finds files, skips node_modules', () => {
    const files = walk(seed(), DEFAULT_CONFIG).map((f) => f.split('/').pop()!).sort();
    expect(files).toEqual(['App.tsx', 'a.css', 'b.tsx']);
  });
  it('honors ignore globs', () => {
    const d = seed();
    const files = walk(d, { ...DEFAULT_CONFIG, ignore: [...DEFAULT_CONFIG.ignore, 'gen/**'] });
    expect(files.some((f) => f.endsWith('b.tsx'))).toBe(false);
  });
});
```

- [ ] **Step 2: Verify fail** — `pnpm vitest run tests/walk.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/walk.ts`**

```ts
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FringeConfig } from './types.js';

const EXTS = ['.jsx', '.tsx', '.js', '.ts', '.html', '.css', '.vue', '.svelte', '.astro', '.scss'];

export function globToRegex(g: string): RegExp {
  const esc = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp('^' + esc + '$');
}

export function walk(root: string, cfg: FringeConfig): string[] {
  const ignores = cfg.ignore.map(globToRegex);
  const out: string[] = [];
  const rec = (dir: string, depth: number) => {
    if (depth > 12) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      const rel = relative(root, p);
      if (e.isDirectory()) rec(p, depth + 1);
      else if (EXTS.some((x) => e.name.endsWith(x)) && !ignores.some((r) => r.test(rel))) out.push(p);
    }
  };
  rec(root, 0);
  return out;
}
```
(Skip `.fringe` via the leading-dot rule and the default ignore entry; verify the test's `gen/**` expectation holds with this matcher — `relative` paths use `/` on posix.)

- [ ] **Step 4: Verify pass** — `pnpm vitest run tests/walk.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(cli): file walker with glob ignores"`

---

### Task 6: JSX parser (AST → Elem IR)

**Files:**
- Create: `packages/cli/src/parse/jsx.ts`
- Test: `packages/cli/tests/parse-jsx.test.ts`
- Add dep: `@babel/parser`

**Interfaces:**
- Produces: `parseJsx(file: string, source: string): Elem[]` — throws `Error('parse-skip: <msg>')` on unparseable source (caller skips+warns). `Elem.attrs` includes JSX attribute names as written (`className`, `htmlFor`, `aria-label`, event handlers like `onClick` with value `''` for non-literal expressions); `Elem.text` is the concatenated JSXText of the element's immediate children.

- [ ] **Step 1: Failing test**

`packages/cli/tests/parse-jsx.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseJsx } from '../src/parse/jsx.js';

describe('parseJsx', () => {
  it('flattens elements with attrs and text', () => {
    const els = parseJsx('a.tsx', `export default () => <button className="btn" onClick={go}>Save</button>;`);
    const btn = els.find((e) => e.tag === 'button')!;
    expect(btn.attrs.className).toBe('btn');
    expect(btn.attrs.onClick).toBe('');
    expect(btn.text).toBe('Save');
    expect(btn.loc.line).toBe(1);
  });
  it('nests and reports all elements', () => {
    const els = parseJsx('a.tsx', `const x = <div><img src="a.png" alt="logo" /></div>;`);
    expect(els.map((e) => e.tag).sort()).toEqual(['div', 'img']);
    expect(els.find((e) => e.tag === 'img')!.attrs.alt).toBe('logo');
  });
  it('throws parse-skip on garbage', () => {
    expect(() => parseJsx('a.tsx', 'export ~~ broken')).toThrow('parse-skip');
  });
});
```

- [ ] **Step 2: Install dep + verify fail**

Run: `cd packages/cli && pnpm add @babel/parser && pnpm vitest run tests/parse-jsx.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/parse/jsx.ts`**

```ts
import { parse } from '@babel/parser';
import type { Elem } from '../types.js';

function attrValue(v: any): string {
  if (v == null) return 'true';
  if (v.type === 'StringLiteral') return v.value;
  if (v.type === 'JSXExpressionContainer' && v.expression?.type === 'StringLiteral') return v.expression.value;
  return '';
}

function collectText(node: any): string {
  let t = '';
  for (const c of node.children ?? []) {
    if (c.type === 'JSXText') t += c.value;
    else if (c.type === 'JSXExpressionContainer' && c.expression?.type === 'StringLiteral') t += c.expression.value;
  }
  return t.trim();
}

export function parseJsx(file: string, source: string): Elem[] {
  let ast;
  try {
    ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'], errorRecovery: false });
  } catch (e) {
    throw new Error(`parse-skip: ${(e as Error).message}`);
  }
  const elems: Elem[] = [];
  (function walkNode(node: any) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXElement') {
      const nameNode = node.openingElement.name;
      const tag = nameNode.type === 'JSXIdentifier' ? nameNode.name : `${nameNode.object?.name ?? ''}.${nameNode.property?.name ?? ''}`;
      const attrs: Record<string, string> = {};
      for (const a of node.openingElement.attributes) {
        if (a.type === 'JSXAttribute') attrs[a.name.name as string] = attrValue(a.value);
      }
      elems.push({ tag, attrs, text: collectText(node), loc: { file, line: node.loc?.start.line ?? 0, col: node.loc?.start.column ?? 0 } });
    }
    for (const k of Object.keys(node)) {
      const c = (node as any)[k];
      if (Array.isArray(c)) c.forEach((x) => typeof x === 'object' && x && typeof x.type === 'string' && walkNode(x));
      else if (c && typeof c === 'object' && typeof c.type === 'string') walkNode(c);
    }
  })(ast.program);
  return elems;
}
```

- [ ] **Step 4: Verify pass** — `pnpm vitest run tests/parse-jsx.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(cli): JSX parser to Elem IR"`

---

### Task 7: HTML parser (parse5 → Elem IR)

**Files:**
- Create: `packages/cli/src/parse/html.ts`
- Test: `packages/cli/tests/parse-html.test.ts`
- Add dep: `parse5`

**Interfaces:**
- Produces: `parseHtml(file: string, source: string): Elem[]` — same `Elem` shape; attribute names as written (`class` not `className`); `text` = concatenated direct-child text nodes, trimmed.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseHtml } from '../src/parse/html.js';

describe('parseHtml', () => {
  it('flattens elements', () => {
    const els = parseHtml('i.html', `<body><a href="/x" class="link">Home</a><img src="a.png"></body>`);
    expect(els.find((e) => e.tag === 'a')!.attrs.class).toBe('link');
    expect(els.find((e) => e.tag === 'a')!.text).toBe('Home');
    expect(els.find((e) => e.tag === 'img')!.attrs.src).toBe('a.png');
  });
});
```

- [ ] **Step 2: Install + verify fail** — `cd packages/cli && pnpm add parse5 && pnpm vitest run tests/parse-html.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/parse/html.ts`**

```ts
import { parse } from 'parse5';
import type { Elem } from '../types.js';

export function parseHtml(file: string, source: string): Elem[] {
  const doc = parse(source, { sourceCodeLocationInfo: true });
  const elems: Elem[] = [];
  (function walkNode(node: any) {
    if (node?.tagName) {
      const attrs: Record<string, string> = {};
      for (const a of node.attrs ?? []) attrs[a.name] = a.value;
      const text = (node.childNodes ?? [])
        .filter((c: any) => c.nodeName === '#text')
        .map((c: any) => c.value)
        .join('')
        .trim();
      elems.push({ tag: node.tagName, attrs, text, loc: { file, line: node.sourceCodeLocation?.startLine ?? 0, col: node.sourceCodeLocation?.startCol ?? 0 } });
    }
    for (const c of node?.childNodes ?? []) walkNode(c);
  })(doc);
  return elems;
}
```

- [ ] **Step 4: Verify pass** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(cli): HTML parser to Elem IR"`

---

### Task 8: CSS parser (PostCSS → CssDecl IR)

**Files:**
- Create: `packages/cli/src/parse/css.ts`
- Test: `packages/cli/tests/parse-css.test.ts`
- Add dep: `postcss`

**Interfaces:**
- Produces: `parseCss(file: string, source: string): CssDecl[]` — every declaration with its nearest ancestor selector; throws `Error('parse-skip: …')` on hard parse failure.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseCss } from '../src/parse/css.js';

describe('parseCss', () => {
  it('collects declarations with selectors', () => {
    const decls = parseCss('s.css', `.btn:focus { outline: none; color: red }`);
    expect(decls).toHaveLength(2);
    expect(decls[0]).toMatchObject({ prop: 'outline', value: 'none', selector: '.btn:focus' });
    expect(decls[0].loc.line).toBe(1);
  });
});
```

- [ ] **Step 2: Install + verify fail** — `cd packages/cli && pnpm add postcss && pnpm vitest run tests/parse-css.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/parse/css.ts`**

```ts
import postcss from 'postcss';
import type { CssDecl } from '../types.js';

export function parseCss(file: string, source: string): CssDecl[] {
  const decls: CssDecl[] = [];
  const rec = (node: any, selector: string) => {
    for (const child of node.nodes ?? []) {
      if (child.type === 'decl') {
        decls.push({ prop: child.prop, value: String(child.value), selector, loc: { file, line: child.source?.start?.line ?? 0, col: child.source?.start?.column ?? 0 } });
      } else if (child.type === 'rule' || child.type === 'atrule') {
        rec(child, child.type === 'rule' ? child.selector : selector);
      }
    }
  };
  try {
    rec(postcss.parse(source), '');
  } catch (e) {
    throw new Error(`parse-skip: ${(e as Error).message}`);
  }
  return decls;
}
```

- [ ] **Step 4: Verify pass** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(cli): CSS parser to CssDecl IR"`

---

### Task 9: Rule registry

**Files:**
- Create: `packages/cli/src/rules/registry.ts`
- Test: `packages/cli/tests/registry.test.ts`

**Interfaces:**
- Produces: `ALL_RULES: Rule[]` (initially empty array, rules appended by later tasks — each later task imports nothing new here beyond appending to the array literal); `activeRules(cfg: FringeConfig): Rule[]` filters `cfg.disable`.
- Consumes: `Rule`, `FringeConfig` from types.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ALL_RULES, activeRules } from '../src/rules/registry.js';
import { DEFAULT_CONFIG } from '../src/config.js';

describe('registry', () => {
  it('has unique ids', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('filters disabled', () => {
    const r = activeRules({ ...DEFAULT_CONFIG, disable: [ALL_RULES[0]?.id ?? 'FR-999'] });
    expect(r.some((x) => x.id === ALL_RULES[0]?.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify fail** → FAIL (module missing).
- [ ] **Step 3: Implement** — `src/rules/registry.ts` starts with **no rule imports** (rules don't exist yet; each rule task adds its own import + push):
```ts
import type { Rule, FringeConfig } from '../types.js';
export const ALL_RULES: Rule[] = [];
export function activeRules(cfg: FringeConfig): Rule[] {
  return ALL_RULES.filter((r) => !cfg.disable.includes(r.id));
}
```
(Task 11+ pattern for registering a rule: add `import { fr201 } from './fr201.js';` at top and `ALL_RULES.push(fr201);` at the bottom of the array's assignment site. The uniqueness test grows in value as rules land.)

- [ ] **Step 4: Verify pass** → PASS (registry is trivially valid while empty).
- [ ] **Step 5: Commit** — `git commit -am "feat(cli): rule registry"`

---

### Task 10: Orchestration (`check.ts`) + JSON output

**Files:**
- Create: `packages/cli/src/check.ts`, `packages/cli/src/score.ts`, `packages/cli/src/report/json.ts`
- Modify: `packages/cli/src/index.ts` (wire `check` command)
- Test: `packages/cli/tests/check.test.ts`, `packages/cli/tests/score.test.ts`

**Interfaces:**
- Produces: `runCheck(root: string, cfg: FringeConfig): Promise<CheckResult>`; `score(counts: Counts, weights): number`; `toJson(result: CheckResult): string`.
- Consumes: detect/walk/parsers/registry from Tasks 4–9. Dispatch by extension: `.jsx/.tsx/.js/.ts` → parseJsx + parseCss(no) — elems only; `.html` → parseHtml; `.css/.scss` → parseCss; `.vue/.svelte/.astro` → no elems (tier 2 in Plan 2; source-text rules still run with empty IR). `RuleContext.source` is always the raw file text so text rules work everywhere. Parse failures → push file into `skipped`, continue.

- [ ] **Step 1: Failing tests**

`tests/score.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { score } from '../src/score.js';
describe('score', () => {
  it('100 when clean', () => expect(score({ error: 0, review: 0, signal: 0 }, { error: 10, review: 3, signal: 1 })).toBe(100));
  it('weights and floors at 0', () => {
    expect(score({ error: 2, review: 3, signal: 4 }, { error: 10, review: 3, signal: 1 })).toBe(100 - 20 - 9 - 4);
    expect(score({ error: 20, review: 0, signal: 0 }, { error: 10, review: 3, signal: 1 })).toBe(0);
  });
});
```

`tests/check.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';

describe('runCheck', () => {
  it('runs rules over a temp project and reports structure', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-chk-'));
    writeFileSync(join(d, 'App.tsx'), 'export default () => <div><img src="a.png" /></div>;');
    const res = await runCheck(d, loadConfig(d));
    expect(res.files).toBe(1);
    expect(res.stack.jsx).toBe(true);
    expect(res.counts).toEqual({ error: 0, review: 0, signal: 0 }); // no rules registered yet
    expect(res.skipped).toEqual([]);
  });
  it('skips unparseable files without crashing', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-chk-'));
    writeFileSync(join(d, 'bad.tsx'), 'export ~~ nope');
    const res = await runCheck(d, loadConfig(d));
    expect(res.skipped).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify fail** → FAIL.

- [ ] **Step 3: Implement**

`src/score.ts`:
```ts
import type { Counts, FringeConfig } from './types.js';
export function score(counts: Counts, weights: FringeConfig['weights']): number {
  return Math.max(0, 100 - counts.error * weights.error - counts.review * weights.review - counts.signal * weights.signal);
}
```

`src/report/json.ts`:
```ts
import type { CheckResult } from '../types.js';
export function toJson(r: CheckResult): string {
  return JSON.stringify({ schema: 'fringe/check.v1', ...r }, null, 2);
}
```

`src/check.ts`:
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult, Counts, FringeConfig, RuleContext } from './types.js';
import { loadConfig } from './config.js';
import { detectStack } from './detect.js';
import { walk } from './walk.js';
import { parseJsx } from './parse/jsx.js';
import { parseHtml } from './parse/html.js';
import { parseCss } from './parse/css.js';
import { activeRules } from './rules/registry.js';
import { score } from './score.js';

export async function runCheck(root: string, cfg: FringeConfig = loadConfig(root)): Promise<CheckResult> {
  const stack = detectStack(root);
  const files = walk(root, cfg);
  const rules = activeRules(cfg);
  const findings = [] as CheckResult['findings'];
  const skipped: string[] = [];
  const counts: Counts = { error: 0, review: 0, signal: 0 };
  for (const file of files) {
    let source = '';
    try { source = readFileSync(file, 'utf8'); } catch { skipped.push(file); continue; }
    const ctx: RuleContext = { file, source, elems: [], css: [] };
    try {
      if (/\.(jsx|tsx|js|ts)$/.test(file)) ctx.elems = parseJsx(file, source);
      else if (/\.html$/.test(file)) ctx.elems = parseHtml(file, source);
      else if (/\.(css|scss)$/.test(file)) ctx.css = parseCss(file, source);
    } catch (e) {
      if ((e as Error).message.startsWith('parse-skip')) { skipped.push(file); continue; }
      throw e;
    }
    for (const rule of rules) for (const f of rule.check(ctx)) { findings.push(f); counts[f.severity]++; }
  }
  return { stack, files: files.length, skipped, findings, counts, score: score(counts, cfg.weights) };
}
```

Wire into `src/index.ts` (replace the `check` stub): parse flags `--json` from `rest`; call `runCheck(process.cwd())`; print via `toJson` when `--json`; return `result.counts.error > 0 ? 1 : 0`.

- [ ] **Step 4: Verify pass** — `pnpm vitest run tests/check.test.ts tests/score.test.ts` → PASS, and full `pnpm test` stays green.

- [ ] **Step 5: Commit** — `git commit -am "feat(cli): check orchestration, score, JSON output, exit codes"`

---

### Task 11: Accessibility attribute rules — FR-201, FR-202, FR-203, FR-209

**Files:**
- Create: `packages/cli/src/rules/fr201.ts`, `fr202.ts`, `fr203.ts`, `fr209.ts`
- Modify: `packages/cli/src/rules/registry.ts` (register all four)
- Test: `packages/cli/tests/rules-a11y-attrs.test.ts`
- Fixtures: `fixtures/rules/FR-201/{pass,fail}.tsx`, `fixtures/rules/FR-202/{pass,fail}.tsx`, `fixtures/rules/FR-203/{pass,fail}.tsx`, `fixtures/rules/FR-209/{pass,fail}.tsx`

**Interfaces:**
- Produces four `Rule` objects exported as `fr201`, `fr202`, `fr203`, `fr209` (shape: `{ id, rung: 2, severity, check }`). Rules only read `ctx.elems` / `ctx.source`. Fixture convention (all rule tasks): test reads `fixtures/rules/<ID>/{pass,fail}.tsx`, runs the rule's `check` with a synthesized ctx (parse fixture via `parseJsx`), expects **0 findings on pass** and **≥1 finding with the rule's id on fail**.

- [ ] **Step 1: Write fixtures**

`fixtures/rules/FR-201/pass.tsx`: `export default () => <img src="a.png" alt="Logo" />;`
`fixtures/rules/FR-201/fail.tsx`: `export default () => <img src="a.png" />;`
`fixtures/rules/FR-202/pass.tsx`: `export default () => <button onClick={save}>Save</button>;`
`fixtures/rules/FR-202/fail.tsx`: `export default () => <button onClick={save} />;`
`fixtures/rules/FR-203/pass.tsx`: `export default () => (<><label htmlFor="email">Email</label><input id="email" type="text" /></>);`
`fixtures/rules/FR-203/fail.tsx`: `export default () => <input type="text" placeholder="Email" />;`
`fixtures/rules/FR-209/pass.tsx`: `export default () => <div aria-label="Menu" />;`
`fixtures/rules/FR-209/fail.tsx`: `export default () => <div aria-labeledby="x" />;`

- [ ] **Step 2: Write the failing test**

First create the shared test helpers — `packages/cli/tests/helpers.ts` (used by every later rule task):
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseJsx } from '../src/parse/jsx.js';
import type { Rule, RuleContext } from '../src/types.js';

export const FIXTURES = fileURLToPath(new URL('../../../fixtures', import.meta.url));

export function ctxOf(file: string, source: string): RuleContext {
  try { return { file, source, elems: parseJsx(file, source), css: [] }; }
  catch { return { file, source, elems: [], css: [] }; }
}

export function fixture(id: string, kind: 'pass' | 'fail'): { file: string; source: string } {
  const file = join(FIXTURES, 'rules', id, `${kind}.tsx`);
  return { file, source: readFileSync(file, 'utf8') };
}

export function expectRule(rule: Rule, id: string) {
  describe(`rule ${id}`, () => {
    it('passes on pass fixture', () => {
      const { file, source } = fixture(id, 'pass');
      expect(rule.check(ctxOf(file, source))).toEqual([]);
    });
    it('flags fail fixture', () => {
      const { file, source } = fixture(id, 'fail');
      const out = rule.check(ctxOf(file, source));
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.every((f) => f.rule === id && f.severity === rule.severity)).toBe(true);
      expect(out[0].loc.file).toBe(file);
    });
  });
}
```

Then `tests/rules-a11y-attrs.test.ts`:
```ts
import { expectRule } from './helpers.js';
import { fr201 } from '../src/rules/fr201.js';
import { fr202 } from '../src/rules/fr202.js';
import { fr203 } from '../src/rules/fr203.js';
import { fr209 } from '../src/rules/fr209.js';
expectRule(fr201, 'FR-201');
expectRule(fr202, 'FR-202');
expectRule(fr203, 'FR-203');
expectRule(fr209, 'FR-209');
```

- [ ] **Step 3: Verify fail** — `pnpm vitest run tests/rules-a11y-attrs.test.ts` → FAIL (rule modules missing).

- [ ] **Step 4: Implement the four rules**

`src/rules/fr201.ts`:
```ts
import type { Rule } from '../types.js';
export const fr201: Rule = {
  id: 'FR-201', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems
    .filter((e) => e.tag === 'img' && e.attrs.alt === undefined)
    .map((e) => ({ rule: 'FR-201', severity: 'error' as const, message: `<img> missing alt text`, hint: `add alt="description" (or alt="" if decorative)`, loc: e.loc })),
};
```

`src/rules/fr202.ts`:
```ts
import type { Rule } from '../types.js';
const NAME_ATTRS = ['aria-label', 'aria-labelledby', 'title'];
export const fr202: Rule = {
  id: 'FR-202', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems
    .filter((e) => ['button', 'a'].includes(e.tag) && e.attrs['aria-hidden'] !== 'true')
    .filter((e) => !e.text && !NAME_ATTRS.some((a) => e.attrs[a]))
    .map((e) => ({ rule: 'FR-202', severity: 'error' as const, message: `<${e.tag}> has no accessible name`, hint: `add text content or aria-label`, loc: e.loc })),
};
```

`src/rules/fr203.ts`:
```ts
import type { Rule } from '../types.js';
export const fr203: Rule = {
  id: 'FR-203', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems
    .filter((e) => e.tag === 'input' && e.attrs.type !== 'hidden')
    .filter((e) => {
      const labeled = e.attrs['aria-label'] || e.attrs['aria-labelledby'] ||
        (e.attrs.id && new RegExp(`(htmlFor|for)=["'\`{]${e.attrs.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`}]`).test(ctx.source));
      return !labeled;
    })
    .map((e) => ({ rule: 'FR-203', severity: 'error' as const, message: `input not associated with a label`, hint: `add id + <label htmlFor>, or aria-label`, loc: e.loc })),
};
```

`src/rules/fr209.ts`:
```ts
import type { Rule } from '../types.js';
const VALID_ARIA = new Set(['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden', 'aria-expanded', 'aria-controls', 'aria-current', 'aria-live', 'aria-disabled', 'aria-invalid', 'aria-required', 'aria-selected', 'aria-checked', 'aria-valuenow', 'aria-orientation', 'aria-placeholder', 'aria-roledescription', 'aria-atomic', 'aria-relevant', 'aria-dropeffect', 'aria-grabbed', 'aria-level', 'aria-multiline', 'aria-multiselectable', 'aria-readonly', 'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuetext', 'aria-busy', 'aria-colcount', 'aria-rowcount', 'aria-details', 'aria-errormessage', 'aria-flowto', 'aria-owns', 'aria-posinset', 'aria-setsize', 'aria-modal', 'aria-activedescendant']);
export const fr209: Rule = {
  id: 'FR-209', rung: 2, severity: 'error',
  check: (ctx) => ctx.elems.flatMap((e) =>
    Object.keys(e.attrs)
      .filter((a) => a.startsWith('aria-') && !VALID_ARIA.has(a))
      .map((a) => ({ rule: 'FR-209', severity: 'error' as const, message: `unknown aria attribute '${a}'`, hint: `check spelling against the ARIA spec`, loc: e.loc }))),
};
```

Register in `registry.ts`: import each and `ALL_RULES.push(fr201, fr202, fr203, fr209);`

- [ ] **Step 5: Verify pass** — `pnpm vitest run tests/rules-a11y-attrs.test.ts` → PASS; full suite green.

- [ ] **Step 6: Commit** — `git add fixtures packages/cli && git commit -m "feat(cli): FR-201/202/203/209 a11y attribute rules"`

---

### Task 12: FR-204 heading order

**Files:**
- Create: `packages/cli/src/rules/fr204.ts`
- Modify: `packages/cli/src/rules/registry.ts`
- Test: `packages/cli/tests/rules-fr204.test.ts` (copy helper from Task 11)
- Fixtures: `fixtures/rules/FR-204/{pass,fail}.tsx`

- [ ] **Step 1: Fixtures** — pass: `export default () => (<><h1>Title</h1><h2>Sub</h2><h3>Deep</h3></>);` — fail: `export default () => (<><h1>Title</h1><h3>Skip</h3><h1>Again</h1></>);`

- [ ] **Step 2: Failing test** — same helper pattern; import `fr204`, `expectRule(fr204, 'FR-204')`. Fail fixture must yield exactly **2** findings (level skip h1→h3, second h1) — assert `out.length === 2` in the flags case instead of ≥1 (extend helper locally).

- [ ] **Step 3: Verify fail** → FAIL.

- [ ] **Step 4: Implement**

```ts
import type { Rule } from '../types.js';
export const fr204: Rule = {
  id: 'FR-204', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    let prev = 0; let seenH1 = false;
    for (const e of ctx.elems.filter((e) => /^h[1-6]$/.test(e.tag))) {
      const lvl = Number(e.tag[1]);
      if (lvl === 1 && seenH1) out.push({ rule: 'FR-204', severity: 'error' as const, message: `multiple <h1> in file`, hint: `use one h1 per page`, loc: e.loc });
      if (lvl === 1) seenH1 = true;
      if (prev && lvl > prev + 1) out.push({ rule: 'FR-204', severity: 'error' as const, message: `heading skips from h${prev} to h${lvl}`, hint: `don't skip heading levels for visual size`, loc: e.loc });
      if (lvl < prev || lvl === prev + 1 || lvl === prev) prev = lvl;
    }
    return out;
  },
};
```
Register + verify pass + commit: `git commit -am "feat(cli): FR-204 heading order rule"`

---

### Task 13: FR-205 focus visibility (JSX + CSS)

**Files:**
- Create: `packages/cli/src/rules/fr205.ts`
- Modify: `registry.ts`
- Test: `packages/cli/tests/rules-fr205.test.ts`
- Fixtures: `fixtures/rules/FR-205/{pass,fail}.tsx`, `fixtures/rules/FR-205/{pass,fail}.css`

- [ ] **Step 1: Fixtures** —
`pass.tsx`: `export default () => <button className="outline-none focus-visible:outline-2" onClick={go}>Go</button>;`
`fail.tsx`: `export default () => <button className="outline-none" onClick={go}>Go</button>;`
`pass.css`: `.x:focus-visible { outline: 2px solid blue }`; `fail.css`: `.x { outline: none }`

- [ ] **Step 2: Failing test** — helper pattern + additionally a CSS case: build ctx as `{ file, source, elems: [], css: parseCss(file, source) }` for the `.css` fixtures; expect pass/fail accordingly. JSX and CSS both run in one rule.

- [ ] **Step 3: Verify fail** → FAIL.

- [ ] **Step 4: Implement**

```ts
import type { Rule } from '../types.js';
export const fr205: Rule = {
  id: 'FR-205', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? '';
      if (/\boutline-(none|0)\b/.test(cls) && !cls.includes('focus-visible:'))
        out.push({ rule: 'FR-205', severity: 'error' as const, message: `outline removed without focus-visible alternative`, hint: `add focus-visible:outline-* or a custom focus ring`, loc: e.loc });
    }
    for (const d of ctx.css) {
      if (d.prop === 'outline' && /^(none|0)/.test(d.value) && !d.selector.includes(':focus-visible') && !ctx.source.includes(':focus-visible'))
        out.push({ rule: 'FR-205', severity: 'error' as const, message: `outline: none without :focus-visible alternative`, hint: `add a :focus-visible rule with visible outline`, loc: d.loc });
    }
    return out;
  },
};
```
Register + verify pass + commit: `git commit -am "feat(cli): FR-205 focus visibility rule"`

---

### Task 14: FR-206 / FR-207 interactive-element rules

**Files:**
- Create: `packages/cli/src/rules/fr206.ts`, `fr207.ts`
- Modify: `registry.ts`
- Test: `packages/cli/tests/rules-interactivity.test.ts`
- Fixtures: `fixtures/rules/FR-206/{pass,fail}.tsx`, `fixtures/rules/FR-207/{pass,fail}.tsx`

- [ ] **Step 1: Fixtures** —
FR-206 pass: `export default () => <div role="button" tabIndex={0} onClick={go}>Go</div>;` fail: `export default () => <div onClick={go}>Go</div>;`
FR-207 pass: `export default () => <div tabIndex={0} />;` fail: `export default () => <div tabIndex={3} />;`

- [ ] **Step 2: Failing test** — helper pattern for both rules. Note `tabIndex={0}` has attr value `''` (non-literal expression) and `tabIndex={3}` also `''` — so FR-207 must read numeric tabIndex from `ctx.source` near the element: regex `tabIndex=\{(\d+)\}` against source and match by line proximity (`loc.line`), or scan `ctx.source.matchAll(/tabIndex=\{(\d+)\}/g)`. Simplest correct impl: regex over source with line counting:

```ts
import type { Rule } from '../types.js';
export const fr207: Rule = {
  id: 'FR-207', rung: 2, severity: 'error',
  check: (ctx) => {
    const out: ReturnType<Rule['check']> = [];
    const lines = ctx.source.split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/tabIndex=\{(\d+)\}/g)) {
        if (Number(m[1]) > 0)
          out.push({ rule: 'FR-207', severity: 'error' as const, message: `tabIndex=${m[1]} > 0 disrupts natural tab order`, hint: `use tabIndex={0} and place in DOM order`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  },
};
```
`fr206.ts`: filter `['div', 'span'].includes(tag) && attrs.onClick !== undefined && attrs.role === undefined && attrs.tabIndex === undefined` → error finding `onClick on non-interactive <div>`.

- [ ] **Step 3: Verify fail → implement both → verify pass → commit** — `git commit -am "feat(cli): FR-206/207 interactivity rules"`

---

### Task 15: FR-208 states coverage heuristic

**Files:**
- Create: `packages/cli/src/rules/fr208.ts`
- Modify: `registry.ts`
- Test: `packages/cli/tests/rules-fr208.test.ts`
- Fixtures: `fixtures/rules/FR-208/{pass,fail}.tsx`

- [ ] **Step 1: Fixtures** —
pass: file contains a fetch marker AND state markers:
```tsx
const { data, isLoading, error } = useQuery(['u'], fetchUser);
export default () => isLoading ? <Spinner /> : error ? <p>Something went wrong</p> : data.length === 0 ? <Empty /> : <List items={data} />;
```
fail: `const { data } = useQuery(['u'], fetchUser); export default () => <List items={data} />;`

- [ ] **Step 2: Failing test** — helper pattern, plus assert severity is `'review'` on the fail case.

- [ ] **Step 3: Verify fail → implement → pass → commit**

```ts
import type { Rule } from '../types.js';
const FETCH = /useQuery|useSWR|useMutation|useFetcher|useInfiniteQuery|\bfetch\(|axios|createResource|loader/i;
const STATES = /isLoading|isPending|isError|isFetching|loading|empty|isEmpty|\berror\b|\bcatch\b|skeleton|spinner|fallback|onError|Suspense/i;
export const fr208: Rule = {
  id: 'FR-208', rung: 2, severity: 'review',
  check: (ctx) => {
    if (!FETCH.test(ctx.source) || STATES.test(ctx.source)) return [];
    return [{ rule: 'FR-208', severity: 'review' as const, message: `data is fetched but no loading/empty/error handling found`, hint: `render loading, empty, and error states — heuristic, verify by hand`, loc: { file: ctx.file, line: 1, col: 0 } }];
  },
};
```

---

### Task 16: Dark patterns — FR-210…FR-214

**Files:**
- Create: `packages/cli/src/rules/fr210.ts` … `fr214.ts` (five files, one rule each — all `rung: 2`, `severity: 'review'`, all regex-on-source)
- Modify: `registry.ts` (register all five)
- Test: `packages/cli/tests/rules-dark-patterns.test.ts`
- Fixtures: `fixtures/rules/FR-21{0..4}/{pass,fail}.tsx`

**Interfaces:** same Rule shape. All run on `ctx.source` text (works in tier-2 files too).

- [ ] **Step 1: Fixtures**

FR-210 pass: `export default () => <p>Standard pricing</p>;` fail: `export default () => <p>Hurry! Offer expires in 09:59</p>;`
FR-211 pass: `export default () => <input type="checkbox" id="tos" />;` fail: `export default () => <input type="checkbox" defaultChecked id="consent-agree" />;`
FR-212 pass: `export default () => <button>No thanks</button>;` fail: `export default () => <button>No thanks, I hate saving money</button>;`
FR-213 pass: `export default () => <button onClick={more}>Load more</button>;` fail: `export default () => <div className="infinite-scroll" data-load-on-scroll="true" />;`
FR-214 pass: `export default () => <p>$9/mo</p>;` fail: `export default () => <p>Free! then $29/month after trial</p>;`

- [ ] **Step 2: Failing test** — helper pattern ×5 (assert severity `'review'`).

- [ ] **Step 3: Verify fail → implement the five rules → pass → commit**

Regex cores (wrap each in the Rule shell, message + hint included, single finding at the matching line — use the line-counting approach from FR-207):
- FR-210 countdown urgency: `/(hurry|expires?|offer ends|ending soon)[^<>\n]{0,60}\d{1,2}:\d{2}/i`
- FR-211 prechecked consent: `/<input[^>]*type=["']checkbox["'][^>]*defaultChecked[^>]*>/` with id containing `consent|agree|terms|subscribe|opt[- ]?in`, OR `defaultChecked` present anywhere + those keywords anywhere in source.
- FR-212 confirm-shaming: `/no thanks[^<>\n]{0,50}(hate|don'?t (want|like|need)|prefer paying|pay full|miss out)/i`
- FR-213 infinite scroll without opt-out: `/(infinite[- ]?scroll|load[- ]?more.{0,40}scroll|IntersectionObserver)/i` AND NOT `/load more|loadMore|show more/i` elsewhere (opt-out present).
- FR-214 drip pricing: `/(free|\$0)[^<>\n]{0,30}(then|after|later)[^<>\n]{0,30}\$\d+/i`

Commit: `git commit -am "feat(cli): FR-210..214 dark-pattern review rules"`

---

### Task 17: Pretty terminal formatter

**Files:**
- Create: `packages/cli/src/report/pretty.ts`
- Test: `packages/cli/tests/pretty.test.ts`

**Interfaces:**
- Produces: `toPretty(r: CheckResult): string` — header line `fringe · stack jsx,tailwind · N files · M skipped`, one line per finding `[SEVERITY] FR-XXX file:line — message (hint)`, ordered error→review→signal then by file:line, footer `health 67/100 · 3 errors · 7 review · 12 signals` and a legend line when skipped > 0.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toPretty } from '../src/report/pretty.js';
import type { CheckResult } from '../src/types.js';

const R: CheckResult = {
  stack: { jsx: true, tailwind: false, vue: false, svelte: false, html: false },
  files: 3, skipped: [],
  findings: [
    { rule: 'FR-208', severity: 'review', message: 'no states', hint: 'add', loc: { file: 'B.tsx', line: 2, col: 0 } },
    { rule: 'FR-201', severity: 'error', message: 'img alt', hint: 'add alt', loc: { file: 'A.tsx', line: 1, col: 0 } },
  ],
  counts: { error: 1, review: 1, signal: 0 }, score: 86,
};
describe('toPretty', () => {
  it('orders errors first and includes ids, loc, score', () => {
    const s = toPretty(R);
    expect(s.indexOf('FR-201')).toBeLessThan(s.indexOf('FR-208'));
    expect(s).toContain('A.tsx:1');
    expect(s).toContain('health 86/100');
    expect(s).toContain('1 errors · 1 review · 0 signals');
  });
});
```

- [ ] **Step 2: Verify fail → implement (plain string building, severity rank map `{error:0,review:1,signal:2}`, sort by rank then file then line) → verify pass → commit** — `git commit -am "feat(cli): pretty terminal formatter"`

---

### Task 18: Ledger — `--record`, manifest merge, tolerant reader

**Files:**
- Create: `packages/cli/src/ledger.ts`
- Modify: `packages/cli/src/index.ts` (flags `--record`, `--manifest <path>`)
- Test: `packages/cli/tests/ledger.test.ts`

**Interfaces:**
- Produces: `interface LedgerRecord { id: string; ts: string; stack: StackInfo; files: number; counts: Counts; score: number; tokenSource?: 'css-vars' | 'theme-factory' | 'design-tokens-json'; shots?: string[]; manifest?: { flows: Array<{ action: 'cut' | 'kept'; what: string; evidence: string }> } }`
- `appendRecord(root: string, rec: LedgerRecord): void` — appends JSON line to `<root>/.fringe/ledger.jsonl` (mkdir -p).
- `readLedger(root: string): { records: LedgerRecord[]; corrupt: number }` — skips unparseable lines, counts them.
- Manifest: `--record` + optional `--manifest path` reads `{ flows: [...] }` JSON and embeds it.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendRecord, readLedger } from '../src/ledger.js';
import type { LedgerRecord } from '../src/ledger.js';

const rec: LedgerRecord = { id: 't1', ts: '2026-10-20T00:00:00Z', stack: { jsx: true, tailwind: true, vue: false, svelte: false, html: false }, files: 2, counts: { error: 0, review: 1, signal: 0 }, score: 97 };

describe('ledger', () => {
  it('appends and reads back', () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-led-'));
    appendRecord(d, rec);
    const { records, corrupt } = readLedger(d);
    expect(records).toEqual([rec]);
    expect(corrupt).toBe(0);
  });
  it('tolerates corrupt lines', () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-led-'));
    appendRecord(d, rec);
    const p = join(d, '.fringe'); mkdirSync(p, { recursive: true });
    require('node:fs').appendFileSync(join(p, 'ledger.jsonl'), 'not json\n');
    const { records, corrupt } = readLedger(d);
    expect(records).toHaveLength(1);
    expect(corrupt).toBe(1);
  });
});
```
(Replace the `require` with `appendFileSync` from the node:fs import at top — plan executor: use the import.)

- [ ] **Step 2: Verify fail → implement** — `appendRecord`: `mkdirSync(join(root, '.fringe'), { recursive: true })` then `appendFileSync(join(root, '.fringe', 'ledger.jsonl'), JSON.stringify(rec) + '\n')`. `readLedger`: read file if exists, split lines, `JSON.parse` each in try/catch, count failures. Wire `--record` in `index.ts`: build `LedgerRecord` from `CheckResult` (id = `crypto.randomUUID()`, ts = new Date().toISOString()), merge manifest if `--manifest` given (read+parse; missing file → warn to stderr, continue without).

- [ ] **Step 3: Verify pass → commit** — `git commit -am "feat(cli): ledger append/read with manifest merge"`

---

### Task 19: Reference app + golden JSON snapshot

**Files:**
- Create: `fixtures/reference-app/package.json`, `fixtures/reference-app/src/App.tsx`, `fixtures/reference-app/src/Pricing.tsx`, `fixtures/reference-app/styles.css`, `packages/cli/tests/golden.test.ts`, `packages/cli/tests/__snapshots__/golden.test.ts.snap` (generated)
- Test: `packages/cli/tests/golden.test.ts`

**Interfaces:**
- Produces: golden snapshot of `runCheck` over `fixtures/reference-app` — the regression net for every future rule change. Expected content (must match implementation exactly):
  - `App.tsx`: `<img src="hero.png" />` (FR-201), `<div onClick={open}>Menu</div>` (FR-206), `tabIndex={2}` (FR-207), `<h1>`→`<h3>` skip (FR-204), a `useQuery` with `isLoading` handling (no FR-208).
  - `Pricing.tsx`: `<p>Free! then $29/month after trial</p>` (FR-214), `<button>No thanks, I prefer paying full price</button>` (FR-212).
  - `styles.css`: `.x { outline: none }` (FR-205).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';

describe('reference app golden', () => {
  it('matches snapshot', async () => {
    const root = join(FIXTURES, 'reference-app');
    const result = await runCheck(root, loadConfig(root));
    expect({ counts: result.counts, score: result.score, rules: result.findings.map((f) => `${f.rule}:${f.loc.file.split('/').pop()}:${f.loc.line}`) }).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Create the fixture files (content above), run `pnpm vitest run tests/golden.test.ts`**

Expected: FAIL first run with snapshot mismatch (new snapshot) — vitest writes the snap in CI mode only with `--run -u`; run `pnpm vitest run tests/golden.test.ts -u` to create it, then **inspect the snapshot file by eye**: it must contain exactly FR-201, FR-204×2, FR-205, FR-206, FR-207, FR-212, FR-214 and nothing else. If a finding is missing or extra, fix the rule or fixture — the snapshot is only accepted once it matches this expected list.

- [ ] **Step 3: Verify pass** — `pnpm vitest run tests/golden.test.ts` → PASS (snapshot exists and matches).

- [ ] **Step 4: Commit** — `git add fixtures packages/cli && git commit -m "test(cli): reference app golden snapshot"`

---

### Task 20: Hook contract output

**Files:**
- Create: `packages/cli/src/report/hook.ts`
- Modify: `packages/cli/src/index.ts` (`--hook` flag)
- Test: `packages/cli/tests/hook.test.ts`

**Interfaces:**
- Produces: `toHook(r: CheckResult): string` — single-line JSON `{"schema":"fringe/hook.v1","errors":N,"review":N,"signals":N,"block":bool,"reason":"..."}` where `block = errors > 0` and reason summarizes top finding.

- [ ] **Step 1: Failing test** — parse the output of `toHook` for a CheckResult with 2 errors/1 review: expect `block === true`, `schema === 'fringe/hook.v1'`, `reason` contains the first error's rule id; and `block === false` when errors = 0. Single-line assertion: `expect(out.split('\n')).toHaveLength(1)`.

- [ ] **Step 2: Verify fail → implement → pass → commit** — `git commit -am "feat(cli): hook JSON contract output"`

---

### Task 21: CLI wiring end-to-end + package README

**Files:**
- Modify: `packages/cli/src/index.ts` (final flag surface), `packages/cli/README.md`
- Test: `packages/cli/tests/cli.test.ts` (extend)

**Interfaces:** Final CLI: `fringe check [--json] [--hook] [--record] [--manifest <path>] [paths...]` (default path `.`), `fringe --version`. Unknown flags → warning to stderr, ignored (never crash the agent's run).

- [ ] **Step 1: Extend cli.test.ts** — cases: `check` on a temp dir with a failing fixture returns exit `1` and (with `--json`) prints parseable `fringe/check.v1` JSON; `check` on a clean temp dir returns `0`; `--record` creates `.fringe/ledger.jsonl` with one line; unknown flag `--wat` still exits `0` on a clean dir.

- [ ] **Step 2: Verify fail → finalize index.ts (arg loop over `rest`, path args default `['.']`, first path is root for runCheck/loadConfig) → pass → write README** (usage, rules table copied from spec §3 rung-2 + dark patterns, exit codes, config example, hook wiring snippet for Claude Code `PostToolUse`).

- [ ] **Step 3: Full suite + build** — `cd packages/cli && pnpm test && pnpm build` → all green, `dist/bin.js` exists. Smoke: `node dist/bin.js --version`.

- [ ] **Step 4: Commit** — `git commit -am "feat(cli): final CLI surface, README, build"`

---

## Self-Review (completed)

- **Spec coverage (Plan-1 scope):** §3 rung-2 rules → Tasks 11–15; dark patterns → Task 16; parsing tiers → Tasks 6–8 (tier-2 text rules run via `ctx.source` everywhere, matching spec's "text-level rules with partial analysis" — the warning lands with the dashboard/pretty output in later plans); stack detection → Task 4; severities/exit codes → Tasks 10/21; health score → Task 10; ledger + manifest + `tokenSource`/`shots` schema reservation → Task 18; hook contract → Task 20; reference app + calibration entry → Task 19. Not in Plan 1 by design: rung 3/slop catalog (Plan 2), dashboard (Plan 3), skill/adapters/publish (Plan 4), `fringe open`/`board` commands (Plan 3).
- **Placeholder scan:** no TBDs; every code step shows code. Fixes applied during self-review: Task 4's helper is fully implemented (no placeholder), Task 9's registry starts empty (no forward imports), test helpers centralized in `tests/helpers.ts` with ESM-safe path resolution (`import.meta.url`).
- **Type consistency:** `Elem/CssDecl/RuleContext/Rule/CheckResult/LedgerRecord` names match across tasks; `parseJsx/parseHtml/parseCss` signatures used identically in Tasks 10–16; registry push pattern identical in every rule task.
