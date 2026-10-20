# @fringetools/cli

`fringe` — a UX-quality checker for agent-written frontends. It scans JSX/TSX/HTML/CSS (and Vue/Svelte/Astro templates, text rules only) for the accessibility, state-handling, dark-pattern and "AI look" mistakes coding agents commonly make, gates the hard failures, and keeps a local history.

Package `@fringetools/cli` · binary `fringe` · Node ≥ 18 · zero config by default.

## Quick start

In your project root:

```sh
npx @fringetools/cli init     # wires the Claude Code hook + installs the skill (nothing to install first)
npx @fringetools/cli check    # run it by hand
```

That is the whole setup. `init` adds a `PostToolUse` hook to `.claude/settings.json` (your existing settings are kept) and copies the skill to `.claude/skills/fringe/`. From then on, every time Claude Code edits a file, Fringe checks the project and feeds any accessibility errors back to the agent to fix.

Prefer a permanent command? `npm install -D @fringetools/cli`, then `npx fringe check`. Existing messy repo? Run `npx @fringetools/cli check --update-baseline` once so only *new* problems gate (see [Baseline](#baseline)).

## Commands

| Command | What it does |
|---|---|
| `fringe check [path]` | Scan a directory (default `.`) and print findings + health score. Exit `1` on any `error`. |
| `fringe check --json` | Full report as JSON, schema `fringe/check.v1` (stack, files, findings, counts, score). |
| `fringe check --claude-hook` | **For Claude Code hooks.** Silent when clean; on errors prints `{"decision":"block","reason":…}` (exit 0) so the agent sees and fixes them. |
| `fringe check --hook` | One-line `fringe/hook.v1` JSON for CI / pre-commit. Exits `1` on errors. Claude Code does **not** feed this back — use `--claude-hook` for agents. Wins over `--json`. |
| `fringe check --update-baseline` | Accept today's findings into `fringe.baseline.json` (commit it). Exit `0`. |
| `fringe check --record [--manifest <path>]` | Also append this run to `.fringe/ledger.jsonl`, optionally merging an agent flow manifest. |
| `fringe init [path]` | Add the Claude Code hook and install the skill. Safe to re-run; refuses to touch an invalid `settings.json`. |
| `fringe open [path] [--port <n>]` | Serve the ledger as a plain HTML page on `127.0.0.1:4173` (loopback only). Ctrl+C to stop. |
| `fringe --help` · `--version` | Usage / version. |

Notes: the first path is the check root (config + scan); extra paths are accepted and ignored so agent-invoked runs never crash. v0.1 takes directories, not single files. Unknown flags warn on stderr and are ignored.

Default (human) output:

```
fringe · stack jsx,tailwind · 3 files
[ERROR] FR-201 /path/to/app/src/App.tsx:15 — <img> missing alt text (add alt="description" (or alt="" if decorative))
health 34/100 · 6 errors · 2 review · 0 signals
```

When a baseline or inline suppressions are in play, the last line adds `· N baselined` / `· N suppressed`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Clean (no `error` findings), or a mode that never gates (`--claude-hook`, `--update-baseline`) |
| `1` | One or more `error`-severity findings (`check`, `--hook`, `--json`) |
| `2` | Internal failure — unreadable root, invalid config, corrupt `fringe.baseline.json`, invalid `.claude/settings.json`, unknown command. One line on stderr |

`review` and `signal` findings never change the exit code.

## Health score

Each finding costs its weight (default error 10, review 3, signal 1). The total is scaled to a 10-file baseline (`× 10 / max(files, 10)`), so repo size doesn't flatten the score. Score = `100 − penalty` up to a penalty of 75; beyond that it decays smoothly (`25·75/penalty`) and never pins at 0. Repos under 10 files score exactly `100 − total`. Weights live in `fringe.config.json`.

## Baseline

Adopting Fringe on a repo that already has problems? Don't fix 300 findings first.

```sh
fringe check --update-baseline   # writes fringe.baseline.json — commit it
fringe check                     # now only NEW findings count and gate
```

Entries match on rule + file + message (not line numbers), so edits above a known finding don't bring it back. Each entry covers one finding: adding a second identical problem still gates. Fixed findings simply stop matching; rerun `--update-baseline` to shrink the file. A corrupt baseline exits `2` rather than passing silently.

## Inline suppression

For a genuine false positive, put a comment on the finding's line or the line above, naming the rule(s):

```tsx
{/* fringe-ignore FR-203 */}
<input type="search" />
```

Also `// fringe-ignore FR-203, FR-202` and `<!-- fringe-ignore FR-203 -->`. Rule IDs are required (no blanket ignore), and every run reports `N suppressed`, so suppression is never invisible.

## The Claude Code hook and skill

`fringe init` does this for you. By hand, add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "npx -y @fringetools/cli check --claude-hook" }] }
    ]
  }
}
```

After each edit the hook runs; with errors it returns, for example:

```json
{"decision":"block","reason":"Fringe found 2 accessibility error(s). Fix them before finishing:\n- FR-203 src/Signup.tsx:9 — input not associated with a label (add id + <label htmlFor>, or aria-label)\n…"}
```

This was verified end to end with real agent runs: the agent receives the findings and fixes them (see [docs/architecture.md](../../docs/architecture.md)). Why `--claude-hook` and not `--hook`: Claude Code only passes a hook's output to the agent as `decision`/`reason` JSON on exit 0 (or stderr on exit 2); the CI contract `--hook` exits 1 and is ignored.

**The skill** (`.claude/skills/fringe/SKILL.md`, source: [skill/SKILL.md](skill/SKILL.md)) teaches the agent the ladder: *Flow* (cut what users don't need, with evidence in `.fringe/manifest.json`) → *Edges* (fix every hook finding, never silence a rule to get green) → *Polish* (tokens, scales, no AI look), then record the run. It is plain Markdown, so any agent platform that reads `AGENTS.md`/skill files can use it as-is.

For CI or pre-commit use `fringe check --hook` (or just the exit code):

```json
{"schema":"fringe/hook.v1","errors":1,"review":0,"signals":0,"block":true,"reason":"FR-201: <img> missing alt text (src/App.tsx:12)"}
```

## Ledger, manifest and dashboard

`--record` appends one JSON line per run to `.fringe/ledger.jsonl` (gitignore it): id, timestamp, stack, files, counts, score, findings per rule (`byRule`), `suppressed`, optional `tokenSource` and agent `manifest`. The manifest (`.fringe/manifest.json`, written by the agent before `--record --manifest …`) is `{"flows":[{"action":"cut"|"kept","what":"…","evidence":"…"}]}` — flow decisions the agent *judged*, shown as such. `fringe open` renders the ledger (newest first, with flow cuts) at `http://127.0.0.1:4173`; reload to see new runs. A richer dashboard is on the roadmap.

## Rules

Severity `error` fails the run; `review` and `signal` are heuristics that need a human look (they never change the exit code). The **WCAG** column cites the WCAG success criterion a finding is tagged with, when one applies.

### Rung 2 — structural (a11y, interaction, dark patterns)

| Rule | Severity | WCAG | Flags |
|---|---|---|---|
| FR-201 | error | 1.1.1 | `<img>` missing `alt` |
| FR-202 | error | 4.1.2 | button/link without an accessible name |
| FR-203 | error | 3.3.2 | form input without associated label |
| FR-204 | error | 1.3.1 | heading level skips, multiple `<h1>` |
| FR-205 | error | 2.4.7 | `outline: none` with no `:focus-visible` alternative |
| FR-206 | error | 2.1.1 | `onClick` on a non-interactive element |
| FR-207 | error | 2.4.3 | `tabIndex` > 0 |
| FR-208 | review | | states coverage heuristic — data-fetch present (fetch/useQuery/useSWR) but no loading/empty/error branch |
| FR-209 | error | 4.1.2 | invalid/misspelled `aria-*` attributes |
| FR-210 | review | | dark pattern — fake countdown timer / manufactured urgency |
| FR-211 | review | | dark pattern — pre-checked consent checkbox |
| FR-212 | review | | dark pattern — confirm-shaming copy |
| FR-213 | review | | dark pattern — infinite scroll without opt-out |
| FR-214 | review | | dark pattern — bait-and-switch ("free", then a price) pricing |
| FR-215 | review | | generic error copy ("something went wrong") with no recovery action — no retry, link, or contact |

The dark-pattern taxonomy (FR-210–214) is adapted, with attribution, from [Design with Intent](https://designwithintent.ai)'s CC0 anti-pattern library.

### Rung 3 — token adoption & slop signals

`signal` findings feed the health score but never gate. FR-301 counts and FR-364/366 are file-level; FR-368's CSS leg is per-declaration; the rest are per element/utility.

| Rule | Severity | WCAG | Flags |
|---|---|---|---|
| FR-301 | signal | | token adoption — file is dominated by hardcoded colors (Tailwind `bg-[#hex]` / CSS color declarations) over token uses (`var(--*)`, palette utilities) |
| FR-302 | signal | | off-scale font sizes — arbitrary `text-[17px]` utilities instead of the type scale |
| FR-303 | signal | | off-scale spacing/dimensions — arbitrary `p-[13px]` / `w-[111px]` style utilities |
| FR-304 | signal | 1.4.3 | contrast — CSS `color` on `background-color` pairs below AA 4.5:1 |
| FR-305 | signal | 2.5.8 | tiny hit area — `text-xs` button/link without `py-2`+ padding |
| FR-361 | signal | | italic serif display type — the AI-tell headline |
| FR-362 | signal | | hero eyebrow chip — uppercase, wide-tracked pill above a heading |
| FR-363 | signal | | card inside a card — nested rounded/shadowed boxes |
| FR-364 | signal | | icon-tile stack — three or more empty flex tiles in a file |
| FR-365 | signal | | thin border with wide shadow — elevation not matched to weight |
| FR-366 | signal | | status-chip soup — five or more labeled pills in a file |
| FR-367 | signal | | numbered section labels — "01 Discover" style kickers |
| FR-368 | signal | | the purple AI gradient — violet/indigo Tailwind gradient or its CSS hex equivalent |
| FR-369 | signal | | emoji in headings |

**FR-304 scope in v1:** contrast is checked only on CSS pairs — a `color` declaration and a `background-color` (or pure-color `background`) in the *same* CSS rule block. Tailwind utility classes in markup are not pair-checked, and translucent colors (alpha < 1) are skipped because contrast over an unknown backdrop is unknowable.

## Configuration — `fringe.config.json`

Optional, at the check root. Everything defaults sensibly; all keys are optional.

```json
{
  "ignore": ["node_modules/**", "dist/**", "build/**", "out/**", "coverage/**", ".fringe/**", "*.min.*", "examples/**"],
  "disable": ["FR-214"],
  "weights": { "error": 10, "review": 3, "signal": 1 }
}
```

- `ignore` — glob list matched against paths relative to the root. **Use the `dir/**` form to skip a directory** — a bare-dir glob like `"dist"` matches only the directory entry itself and does **not** prune the files inside it. (`node_modules` and dot-directories are always skipped.)
- `disable` — rule IDs to turn off.
- `weights` — per-finding penalties into the health score (see [Health score](#health-score)).
- `tokenSource` — where your design-token colors live (see below). Optional; when unset, FR-301 hints simply report `0 colors found`.

### Token sources

`tokenSource` tells `fringe` where to read your palette so token-adoption findings (FR-301) can point at it. Three kinds are supported:

| `kind` | Reads | Best for |
|---|---|---|
| `css-vars` | every `--*` custom-property declaration in your scanned CSS/SCSS whose value parses as a color | hand-rolled CSS variable sheets |
| `theme-factory` | same `--*` collection as `css-vars`, kept as a distinct kind for framework theme sheets that compile to custom properties (e.g. Tailwind v4 `@theme { --color-*: ... }`) | framework theme files |
| `design-tokens-json` | a recursive walk of a JSON token file collecting `$value` strings that parse as colors | W3C design-tokens-format files |

Example — pointing at a tokens file:

```json
{
  "tokenSource": { "kind": "design-tokens-json", "path": "tokens/colors.json" }
}
```

with `tokens/colors.json` shaped like:

```json
{
  "color": {
    "bg": { "primary": { "$value": "#ffffff" } },
    "text": { "primary": { "$value": "#0f172a" } }
  }
}
```

`path` is resolved relative to the check root (absolute paths work too). Gathered colors are deduped and reported in FR-301 hints (`tokenSource: 2 colors found`); an unreadable or malformed token file is not a crash — it just yields no tokens. `css-vars` and `theme-factory` need no `path`; they read the same CSS files the scan already covers.

## What it looks for, and where

Scanned extensions: `.jsx .tsx .js .ts .html .css .scss .vue .svelte .astro`. The stack (React/Vue/Svelte/Tailwind/plain HTML) is auto-detected from `package.json` and file markers, reported in output, and recorded in the ledger. Structural rules run on parsed JSX/HTML/CSS; text-level rules also scan raw source so unsupported extensions still get coverage.

## License

MIT
