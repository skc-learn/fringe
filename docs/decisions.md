# Fringe — Decision Matrix

Every load-bearing decision, in one place: what was decided, the alternatives, and the consequence. ADRs marked **🔒** are locked by shipped code; changing them requires a new entry that supersedes the old one.

| # | Decision | Date | Status |
|---|---|---|---|
| D-01 | Product form: skill + CLI + local dashboard ("both") | 2026-10-20 | 🔒 CLI + skill shipped; full dashboard deferred (D-23) |
| D-02 | Measurement model: CLI-verified (static analysis) + judged manifests | 2026-10-20 | 🔒 |
| D-03 | Core discipline: three-rung ladder (Flow → Edges → Polish) | 2026-10-20 | 🔒 |
| D-04 | Name: **Fringe**; package `@fringetools/cli` (org `fringetools`; `fringetool` was never created), bin `fringe` | 2026-10-20 | 🔒 |
| D-05 | Judged/verified labeling as the credibility moat | 2026-10-20 | 🔒 |
| D-06 | Severity system: error/review/signal; only `error` gates | 2026-10-20 | 🔒 |
| D-07 | Parsing tiers: AST first-class, text best-effort, honest coverage matrix | 2026-10-20 | 🔒 |
| D-08 | React+Tailwind-first scope honesty | 2026-10-20 | 🔒 |
| D-09 | Rules = pure functions over narrow IR (Elem/CssDecl/RuleContext) | 2026-10-20 | 🔒 |
| D-10 | Health score formula + calibration corpus | 2026-10-20 | 🔒 |
| D-11 | Local-first JSONL ledger in-repo; manifest with evidence fields | 2026-10-20 | 🔒 |
| D-12 | Stable machine contracts: `fringe/check.v1`, `fringe/hook.v1` | 2026-10-20 | 🔒 |
| D-13 | Node ≥ 18 floor; pinned Node-compatible majors only | 2026-10-20 | 🔒 |
| D-14 | WCAG criterion tags on a11y findings | 2026-10-20 | 🔒 |
| D-15 | Dark patterns from Design with Intent (CC0, attributed); slop rules written in-house | 2026-10-20 | 🔒 |
| D-16 | Ecosystem positioning: complementary; differentiation = measured edges + history | 2026-10-20 | 🔒 |
| D-17 | Dashboard layout: hybrid (stat strip + ladder board + story drawer) | 2026-10-20 | approved mockup, Plan 3 |
| D-18 | Execution process: TDD + per-task review + whole-branch review | 2026-10-20 | 🔒 |
| D-19 | Two hook outputs: `--claude-hook` (agent feedback) vs `--hook` (CI contract) | 2026-10-20 | 🔒 |
| D-20 | Baseline mode for adopting on existing repos | 2026-10-20 | 🔒 |
| D-21 | Inline suppression: rule IDs required, always counted | 2026-10-20 | 🔒 |
| D-22 | Size-aware health score with soft decay | 2026-10-20 | 🔒 |
| D-23 | Dashboard scope cut: minimal `fringe open` now, full dashboard later | 2026-10-20 | 🔒 / deferred |
| D-24 | Flow evidence check; review/audit skills instead of levels | 2026-10-20 | 🔒 |
| D-27 | Priority is tier-first and published; guidance lives apart from rules | 2026-10-21 | 🔒 |
| D-26 | Automated publishing via tag + npm trusted publishing | 2026-10-20 | 🔒 |
| D-25 | Align with Ponytail's distribution: plugin, AGENTS.md, INSTALL.md, debt/help skills | 2026-10-20 | 🔒 |

---

### D-01 — Product form: skill + CLI + dashboard
**Context:** "Build something like ponytail, focused on UI/UX." Ponytail is a prompt/skill; its board UI is Claude-Code-only.
**Alternatives:** (a) prompt-only clone — fastest, but UX claims would be agent self-reports; (b) standalone review app — objective but heavy, fragile across stacks; (c) both: skill + CLI + local dashboard.
**Decision:** (c). The CLI earns credibility today; the skill (Plan 4) distributes it; the dashboard (Plan 3) differentiates it.
**Consequence:** more surface to build (plan series), but each layer ships independently working software.

### D-02 — CLI-verified measurement
**Context:** How is UX quality "measured" without grading homework?
**Alternatives:** self-reported ledger only (weak), static analysis only (can't judge flows), hybrid.
**Decision:** hybrid with a hard split — statically checkable rungs verified by CLI; rung-1 judgment recorded as manifests with evidence. Every displayed number labeled verified or judged.
**Consequence:** FR-208-style heuristics fire at `review`, never `error` (D-06); the manifest schema (evidence field) is a contract.

### D-03 — The ladder
**Context:** Ponytail's core is one sentence. Ours needed the same memorability.
**Decision:** "Be lazy about features, never about edge cases" as three ordered rungs — Flow (judged) → Edges (verified, error-gated) → Polish (verified, signals). Ordered-gate QA independently validated by Perception-First Design's fix-ordering ("upstream failures block downstream").
**Consequence:** rule IDs encode rungs (FR-2xx / FR-3xx); the dashboard's board columns mirror it (D-17).

### D-04 — Name
**Alternatives considered at naming:** Fringe / fringeux / checkfringe.
**Decision:** **Fringe** — hair kinship with ponytail (brand adjacency), literal meaning "edge cases" ("Fringe checks your edges"). npm `fringe` was taken (checked 2026-10-20) → package `@fringetools/cli`, bin `fringe`.
**Consequence:** everything swappable pre-publish; bin name is the user-facing constant.

### D-05 — Judged/verified moat
**Decision:** no product surface shows an unmeasured claim as if measured. Rationale: ponytail's benchmarks were external; agent self-grades would be weaker.
**Consequence:** the future `--stamp verified` (v2) extends this — the CLI can *stamp* manifest claims it can verify.

### D-06 — Severity system & gating
**Context:** Linters die from false-positive gates.
**Decision:** three severities. `error` = high-confidence AST/declaration checks only (8 rules). Heuristics = `review` (7). Taste = `signal` (14). Exit code 1 and hook `block` key exclusively on `error`; review/signal never gate.
**Consequence:** adding an `error` rule has a high bar (fixture-proven precision); signals can be playful (purple-gradient detector) without risking trust. Regression-pinned: no known error-severity false positive on idiomatic patterns.

### D-07 — Parsing tiers
**Alternatives:** one regex engine for everything (false-positive factory); full parsers for all frameworks (huge maintenance).
**Decision:** Tier 1 AST/PostCSS/parse5 for JSX/HTML/CSS; Tier 2 text-rules-only for Vue/Svelte/Astro templates; unparseable → skip+report; README states coverage openly.
**Consequence:** framework breadth is honest, not over-claimed; tier-2 files still get dark-pattern/FR-208/FR-215 coverage via `ctx.source`.

### D-08 — React+Tailwind-first
**Decision:** the majority of AI-generated frontend is React+Tailwind, so that's where precision lives (Tailwind class analysis, palette-utility token counting). Vue/Svelte are tier-2 until demand justifies depth.
**Consequence:** slop rules are Tailwind-idiom-aware (`from-violet-600`, `tracking-widest`); Tailwind v4 `bg-linear-*` naming is a known, deferred gap.

### D-09 — Pure rules over narrow IR
**Decision:** rules receive `{file, source, elems[], css[], tokenColors[]}` and nothing else; no rule reads the filesystem, config, or other rules. One file per rule.
**Consequence:** every rule is fixture-testable in isolation; the adding-a-rule recipe is mechanical (architecture.md §8); cross-cutting data (tokens) flows through the context, gathered once in `check.ts`.

### D-10 — Health score + calibration
**Alternatives:** raw counts only (no at-a-glance number); unweighted score (everything equal).
**Decision:** `max(0, 100 − (10e+3r+1s))`, weights configurable, **calibrated** by three committed apps with pinned bands (clean 100, reference 34 ∈ 25–40, slop 82 ∈ 75–85) — the PFD scored-examples pattern. Weight changes must keep bands in tolerance or they're wrong.
**Consequence:** the score is an instrument, not a vibe. (Band history: the original slop band ≤25 was miscalculated for shipped weights and corrected to 75–85 during Plan 2 with the arithmetic recorded in the test.)

### D-11 — Local-first ledger
**Alternatives:** hosted service (reach, but backend+auth+trust); local now, hosted-ready.
**Decision:** append-only `.fringe/ledger.jsonl` **in the repo** (history travels with the project, gitignoreable); cross-project registry only later (`fringe board`, Plan 3). Schema reserves `tokenSource` (populated) and `shots` (v2).
**Consequence:** zero infra; privacy by default; the hosted-ready data format remains a possible later step without re-migration.

### D-12 — Stable machine contracts
**Decision:** `fringe/check.v1` (full JSON) and `fringe/hook.v1` (one-line gate) are versioned contracts consumed by CI and Claude Code PostToolUse/Stop hooks; `--hook` takes precedence over `--json` (single-line guarantee). Enforcement therefore doesn't depend on the agent remembering.
**Consequence:** breaking either schema is a major-version event; adapters (Plan 4) build on them.

### D-13 — Node ≥ 18, pinned majors
**Context:** @babel/parser@8 requires Node ≥22.18 — silently raising our floor.
**Decision:** engines `>=18`; all runtime deps pinned to Node-18-compatible majors (`@babel/parser@^7.29.9`, `parse5@^7.3.0` — its v8 pulls `entities@8` needing Node ≥20 — `postcss@^8.5.31`). No other runtime deps without a decision entry.
**Consequence:** install works everywhere agents run; dependency bumps must check transitive engines (this rule caught two real incidents).

### D-14 — WCAG tags
**Decision:** a11y findings carry their success criterion (10 rules tagged; 2.5.8 is WCAG 2.2 — phrased "WCAG success criterion", not "2.1"). Enables `/fringe-audit` by-criterion reporting (Plan 4) and instant credibility with audited teams.
**Consequence:** tags are part of the finding schema; untagged rules must leave `wcag` undefined (test-enforced).

### D-15 — Third-party content policy
**Decision:** dark-pattern taxonomy adapted from Design with Intent's **CC0** library with attribution; slop detectors written in-house (Impeccable's catalog referenced, never copied); Perception-First Design is cite-only (CC BY-SA + trademarked name).
**Consequence:** no license contamination; the ecosystem section credits sources.

### D-16 — Positioning
**Decision:** complementary to ponytail (run both), frontend-design, Intent; explicitly differentiated from Impeccable: *"Impeccable catches the tells. Fringe checks whether your UI works at the edges — and remembers."* Moats: edge-case completeness gates, measured history, calibration.
**Consequence:** README "plays well with" section is part of the product, not marketing garnish.

### D-17 — Dashboard layout (Plan 3, approved via interactive mockup)
**Decision:** hybrid of the three mocked options — slim stat strip (health/errors/review/signals/states%), ladder board home (three rung columns, each footed judged/verified with data source), task story drawer (cuts with evidence, verified results, diff, re-run, handoff Markdown export). `fringe board` renders the same layout across registered projects. Mockups preserved in `docs/superpowers/specs/assets/`.

### D-18 — Execution process
**Decision:** every change TDD (failing test first); implementation via fresh-subagent-per-task with independent two-verdict review (spec compliance + quality), whole-branch review before merge, one consolidated fix wave per plan. All decisions that contradicted reviews amended the plan docs in-commit.
**Consequence:** the process caught, among others: two plan-code bugs (parse5 attrs, FR-202 fixture contradiction), two error-severity false positives (aria-haspopup, nested-span buttons), a Node-floor dependency incident, a golden-snapshot coverage gap (the un-planted second h1), and three rung-3 false positives before merge. All tests green at merge.

### D-19 — Two hook outputs
**Context:** the first real agent test showed `fringe/hook.v1` (JSON, exit 1) is ignored by Claude Code; only `{"decision":"block","reason"}` on exit 0 (or stderr on exit 2) reaches the agent.
**Decision:** keep `--hook` unchanged as the CI/pre-commit contract; add `--claude-hook` for agents (silent when clean, up to 8 findings, relative paths, exit 0). `fringe init` writes the latter via `npx -y @fringetools/cli check --claude-hook`, so setup needs no prior install.
**Consequence:** a hook format is a contract with the host agent — verify it with a real session, not by reading docs.

### D-20 — Baseline mode
**Decision:** `--update-baseline` writes `fringe.baseline.json`; key = rule + relative file + message (no line numbers), matched as a multiset so duplicates still surface. Corrupt file → exit 2.
**Alternatives:** line-based keys (break on any edit); config-level `ignore` (too blunt, hides new problems in the same file).
**Consequence:** a repo with hundreds of existing findings can adopt the gate on day one.

### D-21 — Inline suppression
**Decision:** `fringe-ignore FR-xxx[, FR-yyy]` on the finding's line or the line above; IDs mandatory (no blanket ignore); each run reports `N suppressed`; the skill requires the agent to disclose any use.
**Consequence:** an escape hatch for real false positives that cannot be used silently.

### D-22 — Health score
**Context:** the original linear, uncapped penalty scored 5 of 6 real projects at 0.
**Decision:** penalty scaled per 10 files; `100 − penalty` up to 75, then `25·75/penalty`. Repos under 10 files score as before, so calibration bands are unchanged.
**Consequence:** big repos stay distinguishable; the score works as a trend, not just a gate.

### D-23 — Dashboard scope
**Decision:** ship `fringe open` as a dependency-free HTML page (loopback only, escaped output); defer the React dashboard, `fringe board`, and the ~20-platform adapter generator until real ledger data and real demand exist. The skill is plain Markdown that works on any platform reading skill/AGENTS files.
**Supersedes:** D-17 for now (layout still approved, build deferred).

### D-24 — Review/audit skills; evidence check; no levels
**Decision:** add `fringe-review` and `fringe-audit` (Markdown only, built on `check --json`) rather than strictness levels — baseline and the severity tiers already cover that need. `--record --manifest` marks a `cut` with empty or one-word evidence `unsupported` (stderr warning, `unsupported: true` in the ledger, "no evidence" in `fringe open`). The Flow rung is still judged, but no longer silently unchecked.
**Finding from testing:** with a plain "review this" prompt the agent did a manual review and never ran Fringe; invoking `/fringe-review` ran it. Skills need an explicit trigger, so the docs name the slash commands.

### D-25 — Alignment with Ponytail's distribution model
**Context:** reviewed [Ponytail](https://github.com/dietrichgebert/ponytail): one canonical prompt, a Claude Code plugin marketplace, a compact `AGENTS.md` for rules-file agents, `INSTALL.md` per agent, six commands (`ponytail`, `-review`, `-audit`, `-debt`, `-gain`, `-help`), levels, an always-on session hook, a benchmark behind every claim.
**Adopted:** Claude Code plugin + marketplace (one-step install, skills namespaced `/fringe:…`); root `AGENTS.md`; `INSTALL.md`; `fringe-debt` (our debt = suppressions + baseline) and `fringe-help`; skills in one folder-per-skill source shared by plugin, npm package and `init`.
**Deliberately not adopted:** intensity levels (baseline + severity tiers cover it, D-24); `-gain` (it reports benchmark savings, and Fringe has no benchmark to cite — a ledger trend view is the honest analogue, already on the roadmap); a status band; ~20 per-agent adapter files (AGENTS.md covers them until demand shows otherwise).
**Open gap (partly closed):** Ponytail publishes a 39-task, 5-run benchmark. Fringe now has [benchmarks/](../benchmarks/README.md): 6 tasks × 2 runs × 2 arms — errors left in 4/12 plain runs vs 1/12 with Fringe, same cost. Small; a larger run is still the credibility step.

### D-26 — Automated publishing
**Decision:** a `v*` tag triggers `.github/workflows/publish.yml`: tag-vs-version check, tests, `npm publish --provenance` via npm trusted publishing (GitHub OIDC), then a GitHub Release with generated notes. **Alternatives:** an `NPM_TOKEN` secret (a long-lived credential; npm is restricting bypass-2FA tokens); manual publish (needs a human authenticator code every release — what we had).
**Consequence:** no secret to leak or expire; releases are reproducible and carry provenance. Requires the one-time Trusted Publisher setting on npmjs.com.

### D-27 — Priority, clusters, recipes, plan
**Context:** the tool listed problems in gate order and gave one-line hints; a developer triaging a legacy repo got 300 lines and no order, and an agent got "what is wrong" without "how to fix it well".
**Decision:** `priority = tier (error 1000 / review 400 / signal 100) + WCAG level + critical path + blast radius`, adders summing under the tier gap so severity is never inverted (tested). Findings cluster by rule+file; a file imported by ≥ 3 others is a *shared component* and ranks into P0 of `fringe plan`. Guidance (why / recipe / avoid / example) sits in `src/guidance.ts`, not in the 29 rule files, so rules stay pure (D-09); a drift test requires an entry per rule. All new JSON fields are additive to `fringe/check.v1`; `fringe plan` has its own `fringe/plan.v1`.
**Alternatives:** weighting by an opaque score (unexplainable); component-level root cause via a real import graph (deferred, base-name matching is a documented shortcut); auto-fixing (still out of scope, D-24 era decision).
**Audience:** triage of existing repos first, agent mid-task second (receipts, v0.2.x).
**Consequence:** the claim that plans and recipes help agents is *not yet measured*; the messy-repo benchmark is the gate before the README says so.

---

## Deferral log (tracked, deliberate)

| Deferred item | Reason | Home |
|---|---|---|
| `check.ts` memory restructure (CSS pre-pass + streaming) | v0.1 scale fine; documented in code | follow-up task |
| Sequential parse, no per-file timeout | measured fast; spec aspiration | revisit on perf evidence |
| Slop-tuning pass: px-2/px-20 + flex-1 word boundaries, emoji narrowing (©®™), Tailwind v4 `bg-linear-*`, FR-304 cascade modeling, `text-[rgba()]` FR-302 leak | signals never gate; batch tuning beats dribbles | backlog plan |
| FR-364/366 thresholds fixed (3 tiles / 5 chips) | deliberately conservative first cut | tuning pass |
| Token-drift checks, `fringe shot`, `--stamp verified` | v2 scope, schema already reserved | PRD §4.5 |
| Per-rule precision view | ledger records `byRule`/`suppressed`; needs real data | v0.2 |
