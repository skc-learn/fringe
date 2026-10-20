# Fringe

**A UX-quality layer for AI coding agents.** *Ponytail trims your code. Fringe handles your edges.*

AI agents made UI fast — Figma's 2025 report pegs the gains at 78% efficiency but only 40% quality. Fringe closes the quality half: a static checker that measures whether agent-written frontends handle their **edges** — accessibility, interaction states, dark patterns, design-token drift, the generic "AI look" — gates the hard failures, and keeps a local ledger so the history is measurable, not vibes.

```sh
npx @fringetools/cli init     # one command: wires the Claude Code hook + installs the skill
npx @fringetools/cli check    # or run it by hand
```

```
fringe · stack jsx,tailwind · 3 files
[ERROR] FR-201 /path/to/app/src/App.tsx:15 — <img> missing alt text (add alt="description" (or alt="" if decorative))
[ERROR] FR-204 /path/to/app/src/App.tsx:17 — heading skips from h1 to h3 (don't skip heading levels for visual size)
…
health 34/100 · 6 errors · 2 review · 0 signals
```

Once wired, every time Claude Code edits a file Fringe checks the project and hands accessibility errors back to the agent to fix — verified with real agent runs. For CI, `fringe check` exits `1` on any error. Review-level heuristics and taste-level signals never gate; they inform.

**Messy existing repo?** `fringe check --update-baseline` once; from then on only *new* problems gate. **False positive?** `// fringe-ignore FR-203` on the line (counted in every report).

## What it checks — 29 rules, three severities

- **Edges (`error`, gates):** missing alt, unnamed buttons, unlabeled inputs, heading skips, removed focus rings, `onClick` on divs, positive `tabIndex`, invalid aria — every finding tagged with its **WCAG success criterion**.
- **Judgment (`review`):** data fetching with no loading/empty/error handling; five **dark patterns** (fake countdowns, prechecked consent, confirm-shaming, forced infinite scroll, drip pricing); generic "Something went wrong" copy with no recovery action.
- **Polish (`signal`):** hardcoded colors vs design tokens, off-scale type/spacing, WCAG contrast math, tiny hit areas, and the **slop catalog** — italic serif display headlines, eyebrow chips, card-inside-card, icon-tile stacks, thin-border-wide-shadow, status-chip soup, "01 Discover" labels, the purple AI gradient, emoji headings.

Full rule table, configuration (`ignore` / `disable` / `weights` / `tokenSource`), and Claude Code hook wiring: **[packages/cli/README.md](packages/cli/README.md)**.

## The discipline

Fringe encodes a ladder: **Flow** (cut what users don't need — agent-judged, with evidence, via manifests) → **Edges** (never skip states/a11y — CLI-verified, gated) → **Polish** (tokens, scales, no AI-look — CLI-verified signals). Every number it shows is labeled **verified** or **judged** — the agent never grades its own homework where measurement is possible. Runs can `--record` to an append-only local ledger (`.fringe/ledger.jsonl`), the substrate for the upcoming dashboard and trends.

## Status (v0.1)

| | |
|---|---|
| **Published** | `@fringetools/cli@0.1.0` on npm — `npx @fringetools/cli init`. Source: [skc-learn/fringe](https://github.com/skc-learn/fringe). |
| **Shipped** | 29 rules, calibrated size-aware health score, pretty/JSON/CI-hook/Claude-hook outputs, `init`, baseline, inline suppression, ledger + manifests + token sources, `fringe open` ledger page, the agent skill, stack auto-detection. Golden snapshots + three calibration apps; CI on every push. |
| **Verified** | Agent loop run end to end with real Claude Code sessions (three tasks): errors reach the agent and get fixed. Checker dogfooded on six real projects; false positives found there are fixed. |
| **Next** | Per-rule precision view (data already recorded), richer dashboard (`fringe board`), skill adapters for other agent platforms. See [PRD](docs/PRD.md) §7. |

## Documentation

**Using it:** [CLI reference — every command, flag, rule and config key](packages/cli/README.md) · [the agent skill](packages/cli/skill/SKILL.md)

**Understanding it:** [Product](docs/product.md) · [PRD](docs/PRD.md) · [Architecture](docs/architecture.md) · [Decision matrix](docs/decisions.md) · [Test strategy](docs/test-strategy.md) · [Docs index](docs/README.md)

Plays well with [ponytail](https://github.com/dietrichgebert/ponytail) (run both), [Impeccable](https://impeccable.style/), [Design with Intent](https://designwithintent.ai) — positioning in [docs/product.md](docs/product.md).

## Contributing

TDD everywhere: every change is a failing test first. Adding a rule is a documented recipe — fixtures, `expectRule` test, pure rule file, registry, golden check — see [docs/test-strategy.md](docs/test-strategy.md). All load-bearing decisions are recorded in [docs/decisions.md](docs/decisions.md).

## License

[MIT](LICENSE). Dark-pattern taxonomy adapted (with attribution) from Design with Intent's CC0 library.
