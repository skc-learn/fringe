# Fringe — Design Spec

**Date:** 2026-10-20
**Status:** v2 — approved design (research-amended), pending implementation planning
**Repo:** `pony tail for ux` (renaming to product name at first release)
**v2 changelog:** folded in findings from six-source research (Impeccable, ui-ux-pro-max, Design with Intent, Composio top-10, Figma skills guide, Perception-First Design) — see §11.

## 1. What we're building

**Fringe** is an open-source prompt/skill + CLI + local dashboard that makes AI coding agents ship UI with the edges handled. It is modeled on [ponytail](https://github.com/dietrichgebert/ponytail) (the 167k-star skill that steers agents toward minimal code) but inverts the focus: instead of less code, **better UX**.

- **Tagline:** *"Ponytail trims your code. Fringe handles your edges."*
- **Name rationale:** hair-kinship with ponytail; "fringe" literally means *edge cases*. Commands: `/fringe`, `fringe check`, `fringe open`.
- **Positioning stat** (README problem statement): Figma's 2025 AI report — agents deliver 78% efficiency gains but only 40% quality gains. *Agents made UI fast; Fringe is how you make it good — measured edges, no drift, a ledger that remembers.*
- **Goal:** popular open-source project. Success = people install it, the README sells it, it works across agents out of the box.

### Core discipline — the ladder

Ponytail's core: "the best code is the code you never wrote." Fringe's core: **"be lazy about features, never about edge cases."**

| Rung | Name | Discipline | Verified? |
|---|---|---|---|
| 1 | **Flow** | Before writing UI, identify the job-to-be-done; cut screens, steps, features the user doesn't need | Judged (agent manifest, with evidence — §5) |
| 2 | **Edges** | Every state handled — loading, empty, error, success; keyboard/focus/a11y never skipped | **Verified (CLI)** |
| 3 | **Polish** | Design tokens over hardcoding, type/spacing scales, contrast, no generic-AI-look | **Verified (CLI, as signals)** |

The judged/verified split is deliberate honesty: rung 1 is judgment, so it comes from the agent's manifest; rungs 2–3 are measured. Every number the product shows is labeled **verified** or **judged**. This is the credibility moat — "we don't let the agent grade its own homework where it matters."

Ordered gates as a product shape are independently validated by [Perception-First Design](https://github.com/skovalik/perception-first-design)'s five-layer fix-ordering ("upstream failures block everything downstream") — a parallel derivation from cognitive psychology rather than interaction completeness.

## 2. Architecture

Four components, one pnpm monorepo:

```
fringe/
├── skills/fringe/SKILL.md      # canonical skill (source of truth — the ladder)
├── packages/cli/               # the checker; `fringe check|open|board` (npm package)
├── packages/dashboard/         # Vite + React local web app
├── adapters/                   # generated platform ports (~20 agents, committed)
├── scripts/build-adapters.ts   # canonical → adapters transformation
├── fixtures/                   # per-rule fixtures + reference app + calibration corpus
└── .github/workflows/ci.yml    # test + adapter freshness check
```

### Data flow

1. Agent works on a UI task. The skill forces the ladder: rung 1 manifest decisions *before* coding; rung 2/3 enforced by the checker.
2. Before finishing, agent runs `fringe check --record`. The CLI analyzes the code, merges results with the agent's manifest (flows considered/cut + evidence), and appends one task record to `.fringe/ledger.jsonl` **in the project** (repos carry their own history; gitignoreable).
3. `fringe open` starts a tiny local server and opens the dashboard for the current project.
4. `fringe board` scans registered projects (`~/.config/fringe/projects.json`) for the cross-project view.

**Hook enforcement (v1):** `fringe check --hook` emits a stable JSON output contract so it can be wired as a Claude Code PostToolUse/Stop hook — enforcement does not depend on the agent remembering. The skill instructs agents to set this up at install; the slash-command flow remains the primary path.

## 3. The checker (`fringe check`)

**Stack:** TypeScript, Node ≥ 18, one npm package, zero-config by default, `fringe.config.json` to tune (ignore paths, disable rules, custom token definitions, health-score weights).

**Stack auto-detection:** the CLI reads `package.json` / file markers to detect the frontend stack (React, Vue, Svelte, Tailwind, plain HTML) and auto-selects the parsing tier. The detected stack is reported in output and recorded in the ledger. Never assume a stack.

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
| FR-210–214 | **dark patterns** (severity `review`): fake countdown timers ("expires in 09:59"), prechecked consent boxes, confirm-shaming copy ("No thanks, I hate saving money"), infinite scroll without opt-out, bait-and-switch pricing. Taxonomy adapted (with attribution) from [Design with Intent](https://designwithintent.ai)'s CC0 anti-pattern library |

**Rung 3 — polish (signals):**

| ID | Rule |
|---|---|
| FR-301 | hardcoded colors where design tokens exist (token-adoption ratio, measured against the declared token source — below) |
| FR-302 | font sizes off the type scale (arbitrary px / arbitrary values) |
| FR-303 | spacing off the scale (magic padding/margin values) |
| FR-304 | WCAG contrast math on hardcoded color/background pairs (AA 4.5:1) |
| FR-305 | tiny hit areas on interactive elements |
| FR-36x | **slop catalog** (the expanded AI-look detector): italic-serif display type, eyebrow chips above heroes ("✦ Introducing…"), nested cards, icon-tile stacks, thin-border-wide-shadow, status-chip soup, "01 / 02 / 03" numbered section labels, purple/white gradients, emoji in headings. Each rule has a stable ID and a public docs anchor — the catalog doubles as content marketing (as Impeccable's `/slop` pages do) |

**Token source declaration:** `fringe.config.json` declares where truth lives — repo CSS vars, a theme-factory output, or a Figma-exported W3C design-tokens JSON. FR-301 measures adoption against that source. The ledger records `tokenSource`. **Token-drift checks** (design says 16px, code says 15px) are v2 — schema reserved now.

**Output & behavior:** pretty terminal report (ID, severity, `file:line`, one-line fix hint); `--json` for machines; `--record` merges findings + manifest into the ledger; `--hook` emits the hook JSON contract. Files parsed in parallel with a per-file timeout. Exit codes: `0` clean / `1` errors found (CI-friendly) / `2` internal failure.

## 4. The dashboard

Hybrid layout (approved via mockup; wireframes in `docs/superpowers/specs/assets/dashboard-hybrid.html` — chosen option — and `dashboard-layout-options.html` — the original three):

- **Slim stat strip** (top): health score, errors, review, signals, states coverage %.
  - **Health score** = `100 − (10×errors + 3×review + 1×signals)`, floored at 0, computed per project over the current window. Weights live in `fringe.config.json` and are **calibrated** (§8).
- **Ladder board** (home): three rung columns — Flow / Edges / Polish — each with counts and worst-offender chips, each footed with its data source (`judged · manifests` vs `verified · fringe check`).
- **Task story drawer** (drill-down): click any task chip → drawer shows that task's flow cuts (judged; rendered with evidence citations, and visually distinct when evidence is absent), edge checklist (verified), polish signals; plus diff view, re-run check, and **export as handoff artifact** (Markdown: cuts with rationale + verified results + open signals — the QA-gate-before-ship pattern from the Figma skills ecosystem).
- `fringe board`: same layout across all registered projects.

The dashboard's own empty/loading/error states are a feature: a UX tool whose onboarding screen (no ledger yet) *is* the demo.

## 5. The skill

Canonical `skills/fringe/SKILL.md`, ponytail in spirit:

- **Rule Zero** (rung 1 gate): no UI code until the manifest states the job-to-be-done and what's kept/cut. Echoes PFD's Rule Zero and Figma's framing that the human's leverage is "deciding what to cut."
- **Rung 2 is non-negotiable:** never ship a state-less interaction; a11y is not optional. Rationale in-skill: the ADHD-Curb-Cut principle — constraints designed for some users benefit everyone (curb cuts).
- **Rung 3:** apply tokens/scales; avoid the generic-AI look (points the checker at the slop catalog).
- **Evidence discipline:** every manifest cut carries an `evidence` field (analytics, user path, heuristic, stakeholder call) — borrowed from PFD's "every claim needs a citation or is labeled practitioner observation."
- **Zero-fabrication policy:** never claim a state is handled without evidence; `--record` enforces this mechanically (adapted from ui-ux-pro-max's zero-result policy).
- **Intensity dials:** `/fringe lite|full|ultra`. Ultra adds **multi-pass review** (Ralph-Loop-inspired: the review pass runs 3–5×; only findings that survive or emerge across passes are recorded) — single LLM passes are probabilistically incomplete.
- **Figma MCP note:** if a Figma MCP server is available and a design file is linked, use its variables as the token source.
- Ends every UX task with `fringe check --record` and a note on what was cut and what risks remain.

**Slash commands:** `/fringe [lite|full|ultra]` (intensity), `/fringe-review` (UX diff review), `/fringe-audit` (whole repo), `/fringe-open` (dashboard).

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
- **Calibration corpus** (from PFD's scored-examples pattern): complete reference UIs with *expected health scores*; any change to severity weights must keep corpus scores within tolerance, making the health score a calibrated instrument rather than an arbitrary formula.
- **Snapshot tests:** terminal formatter, adapter generation output, hook JSON contract.
- **Dashboard:** component tests against fixture ledger data.

## 9. v1 roadmap & success bar

**Build order:** ① canonical SKILL.md (incl. Rule Zero, evidence discipline, dials) → ② CLI core (parsing pipeline + stack auto-detection + rung 2 rules + dark-pattern reviews + ledger + `--hook` contract) → ③ rung 3 rules + slop catalog → ④ dashboard → ⑤ adapter matrix → ⑥ README + npm publish.

**v1 success bar:**
- `npx fringe check` on any React + Tailwind repo produces useful, true-positive findings.
- The hook contract works as a Claude Code PostToolUse/Stop hook.
- Dashboard renders a real ledger (stat strip, ladder board, story drawer).
- Skill installs on Claude Code and generic AGENTS.md platforms.

**Out of scope for v1 (v2+):** token-drift checks (schema reserved: `tokenSource`), visual feedback loop `fringe shot` (Playwright screenshots per task in the story drawer — Composio's "highest-leverage" technique; schema reserved: `shots: []`), Vue/Svelte tier-2 depth, verification stamping of manifests (`--stamp verified`), hosted mode, custom rule plugins.

## 10. Risks

| Risk | Mitigation |
|---|---|
| npm name `fringe` taken | Check at implementation start; fallbacks: `fringeux`, `checkfringe`, scoped package. Everything swappable pre-release. |
| **Overlap with Impeccable** (61-rule slop detector + hooks, established) | Differentiate: Impeccable enforces taste; Fringe measures edge-case completeness + keeps the ledger/trends — nobody else has the measured-history story. Position explicitly as complementary ("Impeccable catches the tells. Fringe checks whether your UI works at the edges — and remembers."). |
| False positives erode trust | Severity system (`error` only for high-confidence AST checks), `review` for heuristics, config to disable rules, golden-fixture + calibration regression tests |
| 20-adapter maintenance burden | Generated from one source + CI freshness check; adapters are content, not code |
| `@babel/parser` weight in CLI | Acceptable for a dev tool; can swap to oxc later behind the same rule engine interface |
| License hygiene | Never copy CC BY-SA or trademarked content (PFD framework text, "Perception-First Design" name — cite/link only); Dwi anti-pattern taxonomy is CC0 — adapt with attribution; Impeccable's rule catalog: write our own detectors, no verbatim borrowing |

## 11. Ecosystem & positioning

Research base: six sources reviewed 2026-10-19/20 (Composio top-10 design skills; ui-ux-pro-max; Impeccable; Design with Intent; Figma's Claude-skills guide; Perception-First Design).

| Player | What they own | Fringe's relationship |
|---|---|---|
| [ponytail](https://github.com/dietrichgebert/ponytail) | Minimal code discipline | Explicit compatibility — running both is a feature |
| Anthropic frontend-design | Taste floor (font bans, aesthetic direction) | Complementary |
| [Impeccable](https://impeccable.style/) | Polish + 61-rule anti-slop + hooks | Closest neighbor; we own measured edges + ledger + trends |
| [Design with Intent](https://designwithintent.ai) | UX strategy, dark-pattern taxonomy (CC0) | Source for FR-210–214 with attribution; complementary strategy layer |
| ui-ux-pro-max | Design dataset + search | Adopted its zero-fabrication and stack-detection disciplines |
| [Perception-First Design](https://github.com/skovalik/perception-first-design) | Perception diagnosis, ordered gates | Validates the ladder shape; complementary (cite-only, CC BY-SA + trademark) |
| Figma skills cluster | Design-to-code drift tooling | Confirms drift as a gap; our token-source → drift path (v2) |

README includes a "plays well with" section listing these. One-sentence pitch: **agents made UI fast (78% efficiency); Fringe is how you make it good (the 40%) — measured edges, no drift, a ledger that remembers.**
