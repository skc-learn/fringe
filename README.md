# Fringe

**A UX-quality layer for AI coding agents.** *Ponytail trims your code. Fringe handles your edges.*

AI agents made UI fast — Figma's 2025 report pegs the gains at 78% efficiency but only 40% quality. Fringe closes the quality half: a static checker that measures whether agent-written frontends handle their **edges** — accessibility, interaction states, dark patterns, design-token drift, the generic "AI look" — gates the hard failures, and keeps a local ledger so the history is measurable, not vibes.

```sh
pnpm --filter @fringetool/cli build && node packages/cli/dist/bin.js check .
```

```
fringe · stack jsx,tailwind · 3 files
[ERROR] FR-201 /path/to/app/src/App.tsx:15 — <img> missing alt text (add alt="description" (or alt="" if decorative))
[ERROR] FR-204 /path/to/app/src/App.tsx:17 — heading skips from h1 to h3 (don't skip heading levels for visual size)
…
health 34/100 · 6 errors · 2 review · 0 signals
```

Not on npm yet; `npx @fringetool/cli check` will work once published.

**Exit 1.** The agent (or CI) cannot finish with broken markup unnoticed. Review-level heuristics and taste-level signals never gate — they inform.

## What it checks — 29 rules, three severities

- **Edges (`error`, gates):** missing alt, unnamed buttons, unlabeled inputs, heading skips, removed focus rings, `onClick` on divs, positive `tabIndex`, invalid aria — every finding tagged with its **WCAG success criterion**.
- **Judgment (`review`):** data fetching with no loading/empty/error handling; five **dark patterns** (fake countdowns, prechecked consent, confirm-shaming, forced infinite scroll, drip pricing); generic "Something went wrong" copy with no recovery action.
- **Polish (`signal`):** hardcoded colors vs design tokens, off-scale type/spacing, WCAG contrast math, tiny hit areas, and the **slop catalog** — italic serif display headlines, eyebrow chips, card-inside-card, icon-tile stacks, thin-border-wide-shadow, status-chip soup, "01 Discover" labels, the purple AI gradient, emoji headings.

Full rule table, configuration (`ignore` / `disable` / `weights` / `tokenSource`), and Claude Code hook wiring: **[packages/cli/README.md](packages/cli/README.md)**.

## The discipline

Fringe encodes a ladder: **Flow** (cut what users don't need — agent-judged, with evidence, via manifests) → **Edges** (never skip states/a11y — CLI-verified, gated) → **Polish** (tokens, scales, no AI-look — CLI-verified signals). Every number it shows is labeled **verified** or **judged** — the agent never grades its own homework where measurement is possible. Runs can `--record` to an append-only local ledger (`.fringe/ledger.jsonl`), the substrate for the upcoming dashboard and trends.

## Status

| | |
|---|---|
| **Now (v0.1)** | Checker complete: 29 rules, health score (calibrated), pretty/JSON/hook outputs, ledger + manifests + token sources, stack auto-detection. Golden snapshots and three calibration apps. |
| **Also shipped** | `fringe init` (hook + skill in one command), `--update-baseline` (adopt on a messy repo; only new findings gate), `fringe open` (minimal ledger page), canonical agent skill at [packages/cli/skill/SKILL.md](packages/cli/skill/SKILL.md). |
| **Next** | Richer dashboard (ladder board, cross-project `fringe board`), per-platform skill adapters, npm publish. |
| **Not yet published** | install from source (see top) |

## Documentation

**[Product](docs/product.md)** · **[PRD](docs/PRD.md)** · **[Architecture](docs/architecture.md)** · **[Decision matrix](docs/decisions.md)** · **[Test strategy](docs/test-strategy.md)** · **[Docs index](docs/README.md)**

Plays well with [ponytail](https://github.com/dietrichgebert/ponytail) (run both), [Impeccable](https://impeccable.style/), [Design with Intent](https://designwithintent.ai) — positioning in [docs/product.md](docs/product.md).

## Contributing

TDD everywhere: every change is a failing test first. Adding a rule is a documented recipe — fixtures, `expectRule` test, pure rule file, registry, golden check — see [docs/test-strategy.md](docs/test-strategy.md). All load-bearing decisions are recorded in [docs/decisions.md](docs/decisions.md).

## License

[MIT](LICENSE). Dark-pattern taxonomy adapted (with attribution) from Design with Intent's CC0 library.
