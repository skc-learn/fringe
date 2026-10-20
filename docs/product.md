# Fringe — Product Overview

**Fringe** is an open-source UX-quality layer for AI coding agents. It is a CLI (`fringe check`) plus a local task ledger that measures whether agent-written frontends handle their edges — accessibility, interaction states, dark patterns, design-token drift — and remembers the results over time.

> **Tagline:** *Ponytail trims your code. Fringe handles your edges.*

## The problem

AI coding agents made UI fast but not good. Figma's 2025 AI report puts agent gains at **78% efficiency but only 40% quality**: agents ship the median implementation on the first pass — missing alt text, state-less data fetching, outline-free buttons, purple gradients — and nothing in the loop notices. Human review is the bottleneck the agent was supposed to remove.

## The product in one minute

```sh
npx @fringetools/cli check            # scan the repo, print findings + health score
fringe check --hook                  # one-line JSON gate for CI / pre-commit
fringe check --claude-hook           # the form Claude Code feeds back to the agent
fringe init                          # wire the hook + install the skill
fringe check --record --manifest .fringe/manifest.json   # append to the task ledger
```

Fringe statically analyzes JSX/TSX (real AST), HTML, and CSS with **29 rules** across three severities:

- **`error`** (8 rules) — high-confidence structural violations: missing alt, unnamed buttons, unlabeled inputs, heading skips, removed focus rings, `onClick` on divs, positive tabIndex, invalid aria. These gate: exit code 1, hook `block: true`.
- **`review`** (7 rules) — heuristics needing human judgment: missing loading/empty/error handling, the five dark patterns (fake countdowns, prechecked consent, confirm-shaming, forced infinite scroll, drip pricing), generic error copy with no recovery action.
- **`signal`** (14 rules) — taste and polish: hardcoded colors vs design tokens, off-scale type/spacing, WCAG contrast math, tiny hit areas, and the nine-rule slop catalog (italic serif display, eyebrow chips, card-in-card, icon-tile stacks, thin-border-wide-shadow, status-chip soup, "01 Discover" labels, the purple AI gradient, emoji headings).

Every run produces a **health score** — `100 − (10×errors + 3×review + 1×signals)`, weights configurable — calibrated against three pinned reference apps (clean = 100, legacy reference = 34, deliberate slop = 82).

## The core discipline — the ladder

Fringe encodes a three-rung discipline for agent UI work (the skill layer, Plan 4, will teach it; the CLI verifies it):

| Rung | Name | Discipline | Verified? |
|---|---|---|---|
| 1 | **Flow** | Identify the job-to-be-done; cut screens, steps, features the user doesn't need | Judged — agent manifest with evidence |
| 2 | **Edges** | Every state handled (loading/empty/error/success); keyboard/focus/a11y never skipped | **Verified — the CLI** |
| 3 | **Polish** | Tokens over hardcoding, scales, contrast, no generic-AI look | **Verified — as signals** |

The **judged/verified split** is the credibility moat: rung 1 is judgment, recorded in a structured manifest (each cut carries an `evidence` field); rungs 2–3 are measured. Every number Fringe shows is labeled *verified* or *judged* — the agent never grades its own homework where measurement is possible.

## Who it's for

- **Developers using AI agents** (Claude Code, Cursor, Codex, …) — run it in the loop or as a PostToolUse hook so the agent fixes its own a11y gaps before you see them.
- **Team leads / CI owners** — `--hook` gates merges on error-severity findings; the ledger gives trend history per project.
- **Anyone who cares about UI quality** — zero-config defaults, one dependency surface, Node ≥ 18.

## Positioning in the ecosystem

Fringe is complementary, not competitive, with the taste-and-strategy layers:

| Tool | Owns | Relationship |
|---|---|---|
| [ponytail](https://github.com/dietrichgebert/ponytail) | Minimal-code discipline | Explicit compatibility — running both is a feature |
| [Impeccable](https://impeccable.style/) | Polish + 61-rule anti-slop enforcement | Closest neighbor. *"Impeccable catches the tells. Fringe checks whether your UI works at the edges — and remembers."* Fringe's differentiators: edge-case completeness, measured history (ledger + trends), exit-code gates |
| Anthropic frontend-design | Taste floor (font bans, aesthetic direction) | Complementary |
| [Design with Intent](https://designwithintent.ai) | UX strategy, dark-pattern taxonomy (CC0) | Source of FR-210–214, with attribution |
| [Perception-First Design](https://github.com/skovalik/perception-first-design) | Perception diagnosis, ordered gates | Cite-only (CC BY-SA + trademark); independently validates the ladder shape |
| Figma skills cluster | Design↔code sync | Confirms drift as a gap; Fringe's v2 token-drift path |

**One-sentence pitch:** agents made UI fast (78%); Fringe is how you make it good (the 40%) — measured edges, no drift, a ledger that remembers.

## Status

- **Shipped (v0.1):** full checker — 29 rules, stack auto-detection, pretty/JSON/CI-hook/Claude-hook outputs, size-aware health score, baseline mode, inline suppression, `fringe init`, ledger with manifest merge and token-source recording, minimal `fringe open`, WCAG criterion tags, the agent skill, golden snapshots and score calibration, CI. Agent loop verified with real Claude Code runs; checker dogfooded on six real projects.
- **Next:** npm publish (blocked on account 2FA); per-rule precision view; the full dashboard (`fringe board`: stat strip, ladder board, task story drawer); adapters for other agent platforms, only if wanted.
- **Later (v2):** token-drift checks against the design source, `fringe shot` visual verification, `--stamp verified` manifest stamping, Vue/Svelte tier-2 depth.

See [PRD.md](PRD.md) for requirements, [architecture.md](architecture.md) for how it works, [decisions.md](decisions.md) for why it's built this way.
