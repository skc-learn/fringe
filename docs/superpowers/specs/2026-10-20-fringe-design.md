# Fringe — Design Spec

**Date:** 2026-10-20
**Status:** Approved design, pending implementation planning
**Repo:** `pony tail for ux` (renaming to product name at first release)

## 1. What we're building

**Fringe** is an open-source prompt/skill + CLI + local dashboard that makes AI coding agents ship UI with the edges handled. It is modeled on [ponytail](https://github.com/dietrichgebert/ponytail) (the 167k-star skill that steers agents toward minimal code) but inverts the focus: instead of less code, **better UX**.

- **Tagline:** *"Ponytail trims your code. Fringe handles your edges."*
- **Name rationale:** hair-kinship with ponytail; "fringe" literally means *edge cases*. Commands: `/fringe`, `fringe check`, `fringe open`.
- **Positioning:** explicitly compatible with ponytail — running both is a feature.
- **Goal:** popular open-source project. Success = people install it, the README sells it, it works across agents out of the box.

### Core discipline — the ladder

Ponytail's core: "the best code is the code you never wrote." Fringe's core: **"be lazy about features, never about edge cases."**

| Rung | Name | Discipline | Verified? |
|---|---|---|---|
| 1 | **Flow** | Before writing UI, identify the job-to-be-done; cut screens, steps, features the user doesn't need | Judged (agent manifest) |
| 2 | **Edges** | Every state handled — loading, empty, error, success; keyboard/focus/a11y never skipped | **Verified (CLI)** |
| 3 | **Polish** | Design tokens over hardcoding, type/spacing scales, contrast, no generic-AI-look | **Verified (CLI, as signals)** |

The judged/verified split is deliberate honesty: rung 1 is judgment, so it comes from the agent's manifest; rungs 2–3 are measured. Every number the product shows is labeled **verified** or **judged**. This is the credibility moat — "we don't let the agent grade its own homework where it matters."

## 2. Architecture

Four components, one pnpm monorepo:

```
fringe/
├── skills/fringe/SKILL.md      # canonical skill (source of truth — the ladder)
├── packages/cli/               # the checker; `fringe check|open|board` (npm package)
├── packages/dashboard/         # Vite + React local web app
├── adapters/                   # generated platform ports (~20 agents, committed)
├── scripts/build-adapters.ts   # canonical → adapters transformation
├── fixtures/                   # per-rule fixtures + reference app
└── .github/workflows/ci.yml    # test + adapter freshness check
```

### Data flow

1. Agent works on a UI task. The skill forces the ladder: rung 1 manifest decisions *before* coding; rung 2/3 enforced by running the checker.
2. Before finishing, agent runs `fringe check --record`. The CLI analyzes the code, merges results with the agent's manifest (flows considered/cut, judgment calls), and appends one task record to `.fringe/ledger.jsonl` **in the project** (repos carry their own history; gitignoreable).
3. `fringe open` starts a tiny local server and opens the dashboard for the current project.
4. `fringe board` scans registered projects (`~/.config/fringe/projects.json`) for the cross-project view.

## 3. The checker (`fringe check`)

**Stack:** TypeScript, Node ≥ 18, one npm package, zero-config by default, `fringe.config.json` to tune (ignore paths, disable rules, custom token definitions).

**Parsing tiers** (the anti-false-positive strategy):

- **Tier 1 — first-class:** JSX/TSX via `@babel/parser` (real AST), Tailwind via `className` string analysis, CSS/SCSS via PostCSS, plain HTML via parse5. Covers the majority of AI-generated frontend (React + Tailwind). README states the coverage matrix openly.
- **Tier 2 — best-effort:** Vue/Svelte/Astro templates get text-level rules with a "partial analysis" warning.
- Unparseable files: skipped and reported; never crash the run.

**Severities:** `error` (rung 2 violations, high confidence), `review` (heuristic findings — flagged for human attention), `signal` (rung 3 polish/taste — informational).

### Rules (stable IDs `FR-xxx`)

**Rung 2 — edges ("never skip"):**

| ID | Rule |
|---|---|
| FR-201 | `<img>` missing `alt` |
| FR-202 | button/link without an accessible name |
| FR-203 | form input without associated label |
| FR-204 | heading level skips, multiple `<h1>` |
| FR-205 | `outline: none` with no `:focus-visible` alternative |
| FR-206 | `onClick` on a non-interactive element |
| FR-207 | `tabIndex` > 0 |
| FR-208 | states coverage heuristic — data-fetch present (fetch/useQuery/useSWR) but no loading/empty/error branch. Fires as `review`, not `error` |
| FR-209 | invalid/misspelled `aria-*` attributes |

**Rung 3 — polish (signals):**

| ID | Rule |
|---|---|
| FR-301 | hardcoded colors where design tokens exist (token-adoption ratio) |
| FR-302 | font sizes off the type scale (arbitrary px / arbitrary values) |
| FR-303 | spacing off the scale (magic padding/margin values) |
| FR-304 | WCAG contrast math on hardcoded color/background pairs (AA 4.5:1) |
| FR-305 | tiny hit areas on interactive elements |
| FR-306 | "AI-look" detector — purple gradients, emoji in headings (informational; the README's viral hook) |

**Output & behavior:** pretty terminal report (ID, severity, `file:line`, one-line fix hint); `--json` for machines; `--record` merges findings + manifest into the ledger. Files parsed in parallel with a per-file timeout. Exit codes: `0` clean / `1` errors found (CI-friendly) / `2` internal failure.

## 4. The dashboard

Hybrid layout (approved via mockup; wireframes preserved in `docs/superpowers/specs/assets/dashboard-hybrid.html` — chosen option — and `dashboard-layout-options.html` — the original three):

- **Slim stat strip** (top): health score, errors, review, signals, states coverage %.
  - **Health score** = `100 − (10×errors + 3×review + 1×signals)`, floored at 0, computed per project over the current window. Weights live in `fringe.config.json`.
- **Ladder board** (home): three rung columns — Flow / Edges / Polish — each with counts and worst-offender chips, each footed with its data source (`judged · manifests` vs `verified · fringe check`).
- **Task story drawer** (drill-down): click any task chip → drawer shows that task's flow cuts (judged), edge checklist (verified), polish signals; plus diff view, re-run check, Markdown export.
- `fringe board`: same layout across all registered projects.

The dashboard's own empty/loading/error states are a feature: a UX tool whose onboarding screen (no ledger yet) *is* the demo.

## 5. The skill

Canonical `skills/fringe/SKILL.md`, ponytail in spirit:

- **Rung 1 gate:** state the job-to-be-done and what's being cut *before* writing UI.
- **Rung 2 is non-negotiable:** never ship a state-less interaction; a11y is not optional.
- **Rung 3:** apply tokens/scales; avoid the generic-AI look.
- Ends every UX task with `fringe check --record` and a note on what was cut and what risks remain.

**Slash commands:** `/fringe [lite|full|ultra]` (intensity), `/fringe-review` (UX-focused diff review), `/fringe-audit` (whole repo), `/fringe-open` (dashboard).

## 6. Adapters

One canonical skill; `scripts/build-adapters.ts` generates ~20 platform outputs (Claude Code plugin, Cursor rules, Codex, Windsurf, Copilot, Cline, Gemini, OpenCode, and the rest of ponytail's matrix) into `adapters/`, committed. CI fails if generated files are stale — the matrix cannot drift from the source.

## 7. Error handling

- **CLI:** unparseable files skipped with warning; per-file timeout; config validation with clear messages; never crashes the agent's run.
- **Ledger:** append-only JSONL; tolerant reader skips corrupt lines and reports them.
- **Dashboard:** empty states everywhere; missing ledger → onboarding screen.

## 8. Testing

- Vitest for all packages.
- **Per-rule fixtures:** every FR-xxx rule has passing and failing fixture files.
- **Reference app:** synthetic React + Tailwind app seeded with known violations; golden JSON snapshot so rule changes can't silently shift output.
- **Snapshot tests:** terminal formatter, adapter generation output.
- **Dashboard:** component tests against fixture ledger data.

## 9. v1 roadmap & success bar

**Build order:** ① canonical SKILL.md → ② CLI core (parsing pipeline + rung 2 rules + ledger) → ③ rung 3 rules → ④ dashboard → ⑤ adapter matrix → ⑥ README + npm publish.

**v1 success bar:**
- `npx fringe check` on any React + Tailwind repo produces useful, true-positive findings.
- Dashboard renders a real ledger (stat strip, ladder board, story drawer).
- Skill installs on Claude Code and generic AGENTS.md platforms.

**Out of scope for v1 (v2+):** Vue/Svelte tier-2 depth, verification stamping of manifests (`--stamp verified`), hosted mode, custom rule plugins.

## 10. Risks

| Risk | Mitigation |
|---|---|
| npm name `fringe` taken | Check at implementation start; fallbacks: `fringeux`, `checkfringe`, scoped package. Everything is swappable pre-release. |
| False positives erode trust | Severity system (`error` only for high-confidence AST checks), `review` for heuristics, config to disable rules, golden-fixture regression tests |
| 20-adapter maintenance burden | Generated from one source + CI freshness check; adapters are content, not code |
| `@babel/parser` weight in CLI | Acceptable for a dev tool; can swap to oxc later behind the same rule engine interface |
