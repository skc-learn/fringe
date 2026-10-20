# Fringe — Product Requirements Document

**Version:** 1.0 (reflects shipped v0.1 + committed roadmap) · **Date:** 2026-10-20 · **Status:** living document

## 1. Problem statement

AI coding agents produce frontend code at 78% efficiency gains but only 40% quality gains (Figma 2025 AI report). The specific quality gaps are consistent and mechanical: missing accessibility attributes, data fetching without loading/empty/error states, removed focus outlines, hardcoded colors ignoring design tokens, and a recognizable "AI look." Nothing in the agent loop measures these, so they reach human review — the bottleneck agents were meant to remove — or ship.

## 2. Goals

1. **G1 — Gate the edges.** Any error-severity accessibility/interaction violation stops the run (exit 1, hook block) so agents and CI cannot finish with broken markup unnoticed.
2. **G2 — Measure, don't opine.** UX quality claims come from static measurement (verified) or labeled agent judgment with evidence (judged) — never from the agent grading itself.
3. **G3 — Remember.** Every check can append to a local, gitignoreable task ledger, building per-project UX history for trending.
4. **G4 — Zero-friction adoption.** Zero-config defaults, one command to run, Node ≥ 18, three runtime dependencies, never crashes an agent's run.
5. **G5 — Earn trust.** High-confidence rules gate; heuristics are labeled `review`; taste is `signal`. No false-positive error gates on common patterns (regression-tested).

### Non-goals

- Generating designs or taste (frontend-design, Impeccable's territory).
- UX strategy/research workflows (Design with Intent's territory).
- Hosted service, accounts, telemetry (local-first, permanent non-goal for v1–v2).
- Runtimes other than Node ≥ 18; browser-based checking.
- Full WCAG audit (Fringe covers the statically-checkable subset and tags findings with criteria).

## 3. Personas

| Persona | Context | Needs |
|---|---|---|
| **Devin, agent-assisted dev** | Uses Claude Code/Cursor daily; agent writes most UI | Agent self-fixes before handoff; hook wiring; no config reading |
| **Priya, team lead / CI owner** | Owns merge quality for a React+Tailwind repo | Exit-code gate in CI; disable/ignore config; trend evidence for the team |
| **Sam, OSS maintainer** | Wants credible, honest tooling | Judged/verified labeling; WCAG criterion tags; calibration; public decision log |

## 4. Functional requirements

Requirements use stable IDs; **Status** reflects v0.1 (shipped) unless marked *planned*.

### 4.1 Checker core

| ID | Requirement | Status |
|---|---|---|
| F-01 | `fringe check [paths...]` scans a directory root; first path is root for config+scan; unknown flags warn to stderr and never crash | ✅ |
| F-02 | Stack auto-detection from package.json + file markers (React/Preact/Solid, Vue, Svelte, Tailwind, HTML); reported in output and ledger | ✅ |
| F-03 | File discovery: extensions `.jsx .tsx .js .ts .html .css .scss .vue .svelte .astro`; always skips node_modules, dot-dirs; config `ignore` globs (`dir/**` form) | ✅ |
| F-04 | Parsing tiers: JSX/TSX via @babel/parser AST (first-class), HTML via parse5 (first-class), CSS/SCSS via PostCSS (first-class); other template files get text-level rules only; unparseable files are skipped and reported, never crash | ✅ |
| F-05 | 29 rules with stable IDs and three severities (`error` 8 / `review` 7 / `signal` 14) — full table in the [package README](../packages/cli/README.md#rules) | ✅ |
| F-06 | Dark-pattern rules FR-210–214 adapted (attributed) from Design with Intent's CC0 taxonomy | ✅ |
| F-07 | WCAG success-criterion tags on a11y findings (10 rules tagged) | ✅ |
| F-08 | Health score: penalty `(10e+3r+1s) × 10/max(files,10)`; score `100 − penalty` to 75, then smooth decay (never pins at 0); weights configurable | ✅ |
| F-09 | Score calibration: three reference apps with pinned bands (clean ≥95/zero findings, reference 25–40, slop 75–85) | ✅ |
| F-10 | Token sources: `css-vars` / `theme-factory` / `design-tokens-json` declared in config; palette gathered project-wide; FR-301 hints reference it; custom-property *definitions* never counted as hardcoded usage | ✅ |
| F-11 | Contrast math (FR-304): CSS same-block color/background pairs; alpha-translucent pairs skipped honestly | ✅ |
| F-12 | Exit codes: 0 clean / 1 error findings / 2 internal failure with one-line stderr message | ✅ |
| F-13 | `--update-baseline` → `fringe.baseline.json`; later runs gate only on new findings (key = rule+file+message, multiset; corrupt file exits 2) | ✅ |
| F-14 | Inline `fringe-ignore FR-xxx` suppression (rule IDs required, line or line above); always reported as `N suppressed` | ✅ |
| F-15 | `fringe init`: merges the Claude Code `PostToolUse` hook into `.claude/settings.json` and installs the skill; idempotent; never overwrites invalid JSON | ✅ |
| F-16 | `fringe --help` / `-h` / `help` | ✅ |

### 4.2 Outputs

| ID | Requirement | Status |
|---|---|---|
| O-01 | Pretty terminal report: header (stack/files/skipped), findings ordered error→review→signal then file:line, health footer | ✅ |
| O-02 | `--json`: `fringe/check.v1` schema (stack, files, skipped, findings incl. wcag tags, counts, score) | ✅ |
| O-03 | `--hook`: one-line `fringe/hook.v1` (`errors/review/signals/block/reason`); precedence over `--json` | ✅ |
| O-05 | `--claude-hook`: silent when clean; on errors Claude Code's `{decision:"block",reason}` (up to 8 findings, relative paths), exit 0 — the only form Claude Code feeds back to the agent | ✅ |
| O-04 | Every finding carries: rule ID, severity, `file:line:col`, message, one-line fix hint | ✅ |

### 4.3 Ledger & manifests

| ID | Requirement | Status |
|---|---|---|
| L-01 | `--record` appends one JSONL record to `<root>/.fringe/ledger.jsonl`: id (uuid), ts (ISO), stack, files, counts, score, `byRule`, `suppressed`, `tokenSource?` | ✅ |
| L-02 | `--manifest <path>` merges `{ flows: [{ action: cut\|kept, what, evidence }] }` into the record; missing/invalid manifests warn and continue | ✅ |
| L-03 | Tolerant reader: corrupt lines skipped and counted; append-only format | ✅ |
| L-04 | Schema reserves `shots: string[]` (v2 visual verification) | ✅ (field reserved) |
| L-05 | `fringe open` — minimal local page over the ledger (newest first, flow cuts marked judged, suppressed count; loopback only, text escaped) | ✅ minimal |
| L-05b | Full dashboard (stat strip, ladder board, task story drawer) | 🔜 Plan 3 |
| L-06 | `fringe board` — cross-project view from `~/.config/fringe/projects.json` registry | 🔜 Plan 3 |

### 4.4 Agent integration (skill layer)

| ID | Requirement | Status |
|---|---|---|
| S-01 | Canonical SKILL.md teaching the ladder (Flow → Edges → Polish), no silencing rules to get green, suppression must be disclosed; shipped in the npm package and installed by `fringe init`. Loop verified with real Claude Code sessions (3 tasks) | ✅ (slash commands S-02 not built) |
| S-02 | Slash commands `/fringe [lite\|full\|ultra]` (ultra = multi-pass review), `/fringe-review` (named rubric: usability, hierarchy, consistency, accessibility), `/fringe-audit` (by WCAG criterion), `/fringe-open` | 🔜 Plan 4 |
| S-03 | Adapter generation for ~20 agent platforms from one canonical source; CI freshness check | 🔜 Plan 4 |
| S-04 | Skill built with trigger-description tuning + eval suite | 🔜 Plan 4 |

### 4.5 v2 requirements (design-committed, not scheduled)

- Token-drift checks: declared token source vs values used in code (design says 16px, code says 15px) — `tokenSource` field already recorded.
- `fringe shot`: Playwright screenshots per task in the story drawer (`shots` reserved).
- `--stamp verified`: verification stamping of agent manifests.
- Tailwind v4 `bg-linear-*` naming, emoji-range narrowing, FR-304 cascade modeling (slop-tuning pass — see [decisions.md](decisions.md) deferral log).

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| N-01 | Node ≥ 18 (enforced engines; all transitive deps verified Node-18-compatible) |
| N-02 | Runtime deps limited to `@babel/parser@^7`, `parse5@^7`, `postcss@^8` — nothing else without a decision record |
| N-03 | Never crash the agent's run: unknown flags/paths tolerated, parse failures skipped, internal failures exit 2 with a message |
| N-04 | Zero-config defaults must produce useful true-positive findings on any React+Tailwind repo |
| N-05 | Pristine test output; 100% TDD (failing test first) for every change |
| N-06 | Local-first: no network calls, no telemetry, ledger data stays in the repo |
| N-07 | MIT license; third-party content referenced/attributed, never copied from share-alike or trademarked sources |

## 6. Success metrics

- **Adoption (G5/OSS goal):** installs work out of the box; README sells the concept; plays-well-with ecosystem coverage.
- **Trust:** zero known error-severity false positives on idiomatic React+Tailwind (regression-pinned by fixtures + goldens); every severity claim auditable in the rule table.
- **Quality bar (from spec §9):** `npx @fringetool/cli check` on any React+Tailwind repo produces useful, true-positive findings; hook contract works as a Claude Code PostToolUse/Stop hook; ledger records carry manifests and tokenSource.
- **Process:** Full test suite green; goldens byte-stable across unrelated changes; calibration bands hold.

## 7. Release plan

| Release | Scope | Status |
|---|---|---|
| **v0.1** | Checker core: 29 rules, outputs, size-aware score, calibration, ledger, hooks, token sources, WCAG tags, baseline, suppression, `init`, minimal `open`, skill (Plans 1–2 + post-dogfood work) | ✅ on `main`; npm publish pending (account 2FA) |
| **v0.2** | Per-rule precision view from the ledger; full dashboard (`fringe board`, stat strip + ladder board + story drawer, handoff export) (Plan 3) | planned |
| **v0.3** | Adapters for other agent platforms, slash commands, README site (Plan 4) — only if real use shows demand | planned |
| **v0.4+** | Slop-tuning pass, Vue/Svelte tier-2 depth | backlog |
| **v1.0** | Token drift, `fringe shot`, `--stamp verified`, hosted-ready data format review | backlog |

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| False positives erode trust | Severity system (only high-confidence AST checks are `error`); fixture+golden regression nets; calibration bands |
| Overlap confusion with Impeccable | Explicit positioning + complementary framing; Fringe's moat is measured history and edge completeness |
| Agent-ecosystem churn (hook formats, skill formats) | Stable `fringe/hook.v1` + `fringe/check.v1` contracts; adapters generated from one source (Plan 4) |
| 29-rule maintenance burden | Rules are pure functions over a narrow IR; per-rule fixtures; adding-a-rule recipe documented in [test-strategy.md](test-strategy.md) |
| Memory profile on huge monorepos | Accepted, documented deviation (see [architecture.md](architecture.md) §9) with a tracked restructure plan |
