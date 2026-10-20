# @fringetool/cli

`fringe` — a UX-sanity checker for agent-written frontends. It scans JSX/TSX/HTML/CSS for the accessibility and interaction mistakes LLMs commonly make, prints findings, and exits nonzero when there are hard errors — so a coding agent (or CI) cannot finish with broken markup unnoticed.

- Package: `@fringetool/cli` · binary: `fringe` · Node ≥ 18 · zero config by default.

## Install

```sh
npm install -D @fringetool/cli
# or run once:
npx @fringetool/cli check
```

## Usage

```
fringe check [--json] [--hook] [--record] [--manifest <path>] [paths...]
fringe --version
```

- `[paths...]` — the directory to check. Defaults to `.` (current directory). The **first path** is the root used for config loading (`fringe.config.json`) and the scan; extra paths are accepted and ignored beyond that, so an agent-invoked run never crashes on argument shape. **v0.1 supports directory roots only** — a path must be a directory, not a single file.
- `--json` — full machine-readable report, schema `fringe/check.v1` (stack, files, findings with `rule`/`severity`/`loc`/`message`/`hint`, counts, health score).
- `--hook` — one-line JSON, schema `fringe/hook.v1` (`errors`, `review`, `signals`, `block`, `reason`). For pre-commit/CI gates and Claude Code hooks. Takes precedence over `--json` when both are given.
- `--record` — append one JSONL record to `<root>/.fringe/ledger.jsonl` (id, ts, stack, files, counts, score). The ledger is the task-by-task history; it is gitignoreable.
- `--manifest <path>` — merge an agent flow manifest `{ "flows": [{ "action": "cut"|"kept", "what", "evidence" }] }` into the record written by `--record`. Missing/invalid manifests warn to stderr and are skipped.
- **Unknown flags** produce a warning on stderr and are otherwise ignored — `fringe` never crashes mid-run because an agent passed an unexpected flag.

Default (human) output is the pretty formatter:

```
fringe · stack jsx,tailwind · 3 files
[ERROR] FR-201 src/App.tsx:12 — <img> missing alt text (add alt="description" (or alt="" if decorative))
health 70/100 · 3 errors · 0 review · 0 signals
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Clean (no `error` findings) |
| `1` | One or more `error`-severity findings |
| `2` | Internal failure — the run itself broke (unreadable root, invalid config, unexpected error); one-line message on stderr |

An unknown command also exits `2` with a usage hint.

`review` and `signal` findings never change the exit code — they need human judgment, not a gate.

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
- `weights` — per-finding penalties subtracted from the 100-point health score (floor 0).
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

## Wiring as a Claude Code hook

`--hook` emits the stable `fringe/hook.v1` contract so enforcement does not depend on the agent remembering to check. Add to `.claude/settings.json` (project) or `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "fringe check --hook" }
        ]
      }
    ]
  }
}
```

After each file edit the hook prints one line:

```json
{"schema":"fringe/hook.v1","errors":1,"review":0,"signals":0,"block":true,"reason":"FR-201: <img> missing alt text (src/App.tsx:12)"}
```

`block: true` means there are error-severity findings the agent should fix before finishing. The same contract works for `Stop` hooks, pre-commit, and CI gates.

## What it looks for, and where

Scanned extensions: `.jsx .tsx .js .ts .html .css .scss .vue .svelte .astro`. The stack (React/Vue/Svelte/Tailwind/plain HTML) is auto-detected from `package.json` and file markers, reported in output, and recorded in the ledger. Structural rules run on parsed JSX/HTML/CSS; text-level rules also scan raw source so unsupported extensions still get coverage.

## License

MIT
