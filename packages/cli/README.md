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

Rung-2 (structural) checks. Severity `error` fails the run; `review` is a heuristic that needs a human look.

| Rule | Severity | Flags |
|---|---|---|
| FR-201 | error | `<img>` missing `alt` |
| FR-202 | error | button/link without an accessible name |
| FR-203 | error | form input without associated label |
| FR-204 | error | heading level skips, multiple `<h1>` |
| FR-205 | error | `outline: none` with no `:focus-visible` alternative |
| FR-206 | error | `onClick` on a non-interactive element |
| FR-207 | error | `tabIndex` > 0 |
| FR-208 | review | states coverage heuristic — data-fetch present (fetch/useQuery/useSWR) but no loading/empty/error branch |
| FR-209 | error | invalid/misspelled `aria-*` attributes |
| FR-210 | review | dark pattern — fake countdown timer / manufactured urgency |
| FR-211 | review | dark pattern — pre-checked consent checkbox |
| FR-212 | review | dark pattern — confirm-shaming copy |
| FR-213 | review | dark pattern — infinite scroll without opt-out |
| FR-214 | review | dark pattern — bait-and-switch ("free", then a price) pricing |

The dark-pattern taxonomy (FR-210–214) is adapted, with attribution, from [Design with Intent](https://designwithintent.ai)'s CC0 anti-pattern library.

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
