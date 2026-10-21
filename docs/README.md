# Fringe — Documentation Index

> **Fringe** — a UX-quality layer for AI coding agents. *Ponytail trims your code. Fringe handles your edges.*

## Start here

| Document | What it's for | Status |
|---|---|---|
| [product.md](product.md) | What Fringe is, who it's for, how it's positioned | current |
| [PRD.md](PRD.md) | Requirements, personas, releases, success metrics | current (v0.1) |
| [architecture.md](architecture.md) | System design, pipeline, IR, data contracts, extension recipe | current (v0.1) |
| [ROADMAP.md](ROADMAP.md) | Staged plan to evolve Fringe, with what evidence moves each item | current |
| [decisions.md](decisions.md) | Decision matrix (D-01…D-34) + deferral log | current |
| [test-strategy.md](test-strategy.md) | Test philosophy, suite layers, per-rule test-case catalog | current |
| [../packages/cli/README.md](../packages/cli/README.md) | **User-facing reference**: quick start, every command and flag, exit codes, score, baseline, suppression, hook + skill, ledger, 29-rule table, config | current |
| [../INSTALL.md](../INSTALL.md) | Install per agent: Claude Code plugin, `init`, other agents, CI | current |
| [../AGENTS.md](../AGENTS.md) | Compact rules file for any agent | current |
| [../packages/cli/skill/](../packages/cli/skill/) | The six skills (installed by `fringe init`, loaded by the plugin) | current |

## Historical records (do not edit; superseded by the docs above)

| Document | Role |
|---|---|
| [superpowers/specs/2026-10-20-fringe-design.md](superpowers/specs/2026-10-20-fringe-design.md) | The design spec (v2.1) — the brainstorm + six-source research output that Plans 1–4 derive from |
| [superpowers/specs/assets/](superpowers/specs/assets/) | Approved dashboard mockups (hybrid layout → Plan 3) |
| [superpowers/plans/2026-10-20-fringe-1-cli-core.md](superpowers/plans/2026-10-20-fringe-1-cli-core.md) | Plan 1 — CLI core (21 tasks, executed & merged) |
| [superpowers/plans/2026-10-20-fringe-2-rung3-slop.md](superpowers/plans/2026-10-20-fringe-2-rung3-slop.md) | Plan 2 — rung 3 + slop catalog (14 tasks, executed & merged) |

## Research

| Document | Role |
|---|---|
| [research/ponytail-reverse-engineering.md](research/ponytail-reverse-engineering.md) | Mechanism-level dissection of ponytail v5.3.2 (prompt, delivery hooks, band/board, benchmark, hardening) — informs Plans 3–4 and the Bangs sibling |

## Roadmap

Full plan: [ROADMAP.md](ROADMAP.md).

- **Shipped:** v0.1 on npm (`@fringetools/cli`).
- **Next:** per-rule precision view from the ledger; full dashboard (`fringe board`; layout approved, see mockups).
- **Only if wanted:** adapters for other agent platforms, slash commands, README site.
- **v2** — token drift, `fringe shot`, `--stamp verified`, tier-2 depth.

Engineering process: TDD everywhere; implementation via per-task subagents with independent review; whole-branch review before every merge (decisions.md D-18).
