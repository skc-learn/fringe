# Fringe — Documentation Index

> **Fringe** — a UX-quality layer for AI coding agents. *Ponytail trims your code. Fringe handles your edges.*

## Start here

| Document | What it's for | Status |
|---|---|---|
| [product.md](product.md) | What Fringe is, who it's for, how it's positioned | current |
| [PRD.md](PRD.md) | Requirements, personas, releases, success metrics | current (v0.1) |
| [architecture.md](architecture.md) | System design, pipeline, IR, data contracts, extension recipe | current (v0.1) |
| [decisions.md](decisions.md) | Decision matrix (D-01…D-18) + deferral log | current |
| [test-strategy.md](test-strategy.md) | Test philosophy, suite layers, per-rule test-case catalog | current |
| [../packages/cli/README.md](../packages/cli/README.md) | **User-facing**: install, usage, full 29-rule table, config, hook wiring | current |

## Historical records (do not edit; superseded by the docs above)

| Document | Role |
|---|---|
| [superpowers/specs/2026-10-20-fringe-design.md](superpowers/specs/2026-10-20-fringe-design.md) | The design spec (v2.1) — the brainstorm + six-source research output that Plans 1–4 derive from |
| [superpowers/specs/assets/](superpowers/specs/assets/) | Approved dashboard mockups (hybrid layout → Plan 3) |
| [superpowers/plans/2026-10-20-fringe-1-cli-core.md](superpowers/plans/2026-10-20-fringe-1-cli-core.md) | Plan 1 — CLI core (21 tasks, executed & merged) |
| [superpowers/plans/2026-10-20-fringe-2-rung3-slop.md](superpowers/plans/2026-10-20-fringe-2-rung3-slop.md) | Plan 2 — rung 3 + slop catalog (14 tasks, executed & merged) |

## Roadmap

- **Plan 3** — dashboard: `fringe open` / `fringe board`; stat strip, ladder board, task story drawer (layout approved, see mockups).
- **Plan 4** — canonical skill, ~20-platform adapter matrix, README site, npm publish.
- **v2** — token drift, `fringe shot`, `--stamp verified`, tier-2 depth.

Engineering process: TDD everywhere; implementation via per-task subagents with independent review; whole-branch review before every merge (decisions.md D-18).
