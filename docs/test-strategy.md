# Fringe — Test Strategy & Test-Case Catalog

**Version:** 1.0 (v0.1: 39 test files, 309 tests, all green) · **Date:** 2026-10-20

## 1. Philosophy

1. **TDD always.** Every change lands as failing-test → implementation → green → commit. No exceptions; enforced by the execution process (decisions.md D-18).
2. **Fixtures are the spec.** Every rule has committed pass/fail fixture files — the pass file proves precision (no false positive), the fail file proves recall. A rule without fixtures does not exist.
3. **Goldens pin the whole.** Two full-app snapshot tests pin `rule:file:line` + counts + score, so no rule change can silently shift output. Snapshots are only accepted after **by-eye verification** against an enumerated expected-findings list.
4. **Calibration makes the score an instrument.** Three committed apps pin health-score bands; weight changes that move a band out of tolerance are wrong by definition.
5. **Honest severity, honest tests.** Heuristic rules assert `review` severity; the fail assertions check rule id + severity + loc, not just counts.
6. **Pristine output.** Any stray stdout/stderr in test runs is a finding (review-enforced since Plan 1).

## 2. How to run

```sh
cd packages/cli
pnpm test                        # full suite (vitest run)
pnpm vitest run tests/fr215.test.ts          # one file
pnpm vitest run tests/rules-slop-text.test.ts -u   # regenerate a golden snapshot
pnpm build && node dist/bin.js check ../../fixtures/slop-app   # smoke vs a committed app
```

## 3. Suite inventory — five layers

| Layer | Files | What it proves |
|---|---|---|
| **1. Unit — foundation** | `types`, `version`, `config`, `detect`, `walk`, `score`, `color`, `tokens`, `parse-jsx`, `parse-html`, `parse-css`, `parent-link`, `ledger` | Each module's contract in isolation: config defaults/validation/mutation-safety, glob semantics, WCAG math anchors (black/white 21:1, #777→4.48), token gathering per kind, parser IR shapes incl. parent linkage, ledger append/tolerant-read |
| **2. Unit — rules** | `rules-a11y-attrs` (FR-201/202/203/209), `rules-fr204`, `rules-fr205`, `rules-fr208`, `rules-interactivity` (FR-206/207), `rules-dark-patterns` (FR-210–214), `fr215`, `rules-rung3-core` (FR-301–305), `rules-slop-text` (367/368/369), `rules-slop-shape` (361/362/365), `guidance` (every rule has a recipe), `prioritize` (tier-first invariant, WCAG, critical, blast radius, clusters), `rules-slop-structural` (363/364/366), `wcag`, `registry` | Per-rule pass/fail via `expectRule` + edge/boundary cases beyond the fixtures |
| **3. Integration** | `check`, `cli`, `hook`, `pretty`, `board`, `baseline` (baseline, suppression, init, manifest evidence), `plugin` (manifests ↔ skills ↔ init hook), `plan` (batch order, JSON shape, limits) | The orchestrated pipeline: dispatch by extension, skip-not-crash on unparseable files, exit codes (0/1/2) through the real CLI with temp dirs, `--record`/`--manifest` end-to-end, hook single-line contract + block semantics |
| **4. Golden** | `golden` (reference-app), `slop-golden` (slop-app) | Whole-app `runCheck` snapshots: reference pins the 8 rung-2 findings (score 34); slop pins 16 findings across every planted rung-3/review trigger (score 82). Both carry by-eye audit comments enumerating expectations |
| **5. Calibration** | `calibration` | Band contracts: clean-app = **zero findings, ≥95** (actual 100); reference ∈ **25–40** (actual 34); slop ∈ **75–85** (actual 82) |

## 4. Test-case catalog — per rule

Standard pattern for every rule row below: pass fixture → **0 findings**; fail fixture → ≥1 finding asserting `rule` id, `severity`, `loc.file`. "Extra cases" are beyond-fixture coverage in the rule's test file.

| Rule | Sev | Fixtures (`fixtures/rules/<ID>/`) | Extra cases |
|---|---|---|---|
| FR-201 alt | error | `pass.tsx` (alt present, incl. `alt=""`) / `fail.tsx` (no alt) | — |
| FR-202 name | error | pass (text) / fail (empty `<button>`) | aria-label/labelledby/title accepted; aria-hidden skipped; **nested-span button passes** (post-fix-wave regression) |
| FR-203 labels | error | pass (id+htmlFor) / fail (placeholder only) | `aria-activedescendant` valid; `htmlFor="email2"` ≠ `id="email"` (boundary test); regex-metachar ids safe |
| FR-204 headings | error | pass (h1,h2,h3) / fail (h1,h3,h1 → exactly 2) | h2→h4 first-heading latch (regression); frozen-prev cascade semantics |
| FR-205 focus | error | pass/fail `.tsx` (outline-none ± focus-visible:) + pass/fail `.css` | file-level :focus-visible satisfaction; `outline: 0` |
| FR-206 onClick-div | error | pass (role+tabIndex) / fail | span variant; partial escapes (role-only, tabIndex-only); modal backdrop exempt (first child dialog/aria-modal) but a plain or sibling-of-dialog div still flags |
| FR-207 tabIndex | error | pass ({0}) / fail ({3}) | HTML `tabindex="2"` leg; whitespace `tabIndex={ 3 }`; multiple per line; `{-1}` never flags |
| FR-208 states | review | pass (fetch+isLoading) / fail (fetch only) | alternate markers (isPending/isError, axios, non-React-Query fetch); at-most-one finding |
| FR-209 aria | error | pass (aria-label) / fail (aria-labeledby typo) | aria-activedescendant passes (regression); full allowlist |
| FR-210 countdown | review | pass / fail ("expires in 09:59") | — |
| FR-211 prechecked | review | pass (unchecked) / fail (defaultChecked consent) | defaultChecked without consent context |
| FR-212 shaming | review | pass ("No thanks") / fail ("I hate saving money") | — |
| FR-213 infinite scroll | review | pass (Load more) / fail (auto-load marker) | opt-out suppression |
| FR-214 drip pricing | review | pass ($9/mo) / fail ("Free! then $29") | — |
| FR-215 error copy | review | pass (specific copy + Try again) / fail ("Something went wrong") | marker gate; all recovery escape words |
| FR-301 tokens | signal | pass (palette classes) / fail (4× hex utilities) | exactly-3 boundary; `--color-*` **definitions not counted** (regression); var(--) counting |
| FR-302 type scale | signal | pass (text-base) / fail (text-[17px]) | `text-[#hex]`/`text-[color:var()]` excluded (regression); responsive variants |
| FR-303 spacing | signal | pass (p-4) / fail (p-[13px] gap-[9px] → 2 findings) | longest-alternation matching; w-full/h-screen negatives |
| FR-304 contrast | signal | pass (#333/#fff and #767676/#fff = AA edge) / fail (#999/#fff) `.css` | all 4 alpha encodings skipped; background shorthand; per-selector isolation |
| FR-305 hit area | signal | pass (text-sm py-2) / fail (text-xs link) | px-vs-py confusion; p-1/py-0 below threshold |
| FR-361 italic serif | signal | pass / fail (italic font-serif text-4xl) | each conjunct alone |
| FR-362 eyebrow chip | signal | pass / fail (uppercase tracking-widest rounded-full) | length boundary |
| FR-363 card-in-card | signal | pass (rounded child, no border/shadow/bg) / fail (nested cardish) | shadow-parent/bg-child variant |
| FR-364 icon tiles | signal | pass (1 tile) / fail (3 tiles → exactly 1 file-level finding) | 2-tile boundary; text-bearing tile negative |
| FR-365 border+shadow | signal | pass (border shadow-sm) / fail (border shadow-2xl) | **border-0 → 0 findings** (regression); border-2 weight; borderless excluded |
| FR-366 chip soup | signal | pass (2 chips) / fail (5 → exactly 1) | 4-chip boundary; px-3 negative |
| FR-367 numbered labels | signal | pass / fail ("01 Discover") | bare ordinals, trailing numbers |
| FR-368 purple gradient | signal | pass (emerald gradient) / fail (violet) `.tsx` + `.css` legs | each leg isolated; non-purple stops |
| FR-369 emoji heading | signal | pass / fail (🚀 in h2) | — |

**Cross-cutting test files:** `wcag.test.ts` (10 tagged rules assert their criterion; untagged assert undefined), `registry.test.ts` (unique ids; disable filter), `calibration.test.ts` (bands), `golden`/`slop-golden` (whole-app pins + audit comments), `cli.test.ts` (exit codes incl. 2-on-internal-failure; `--json` parseable; `--record` writes one line; unknown flag tolerated), `hook.test.ts` (block semantics; severity-ordered reason; single line), `ledger.test.ts` (append/read/corrupt-line tolerance; tokenSource present-with-config absent-without).

## 5. Golden methodology (the part that keeps us honest)

1. Write the app deliberately: enumerate every planted trigger + everything that must NOT fire.
2. Run `vitest run <golden> -u`, then **verify the snapshot by eye** against the enumeration.
3. Record the enumeration as a comment in the test file.
4. Any later `-u` regeneration repeats step 2 — an unexplained delta is a bug, not a snapshot update.

Current pins: reference-app = 8 findings (6 error, 2 review, score 34) — audit comment explains why no rung-3 rule fires there; slop-app = 16 findings (0/1/15, score 82); clean-app = zero findings, score 100.

## 6. Adding a rule — checklist

fixtures (pass+fail) → failing `expectRule` test → pure rule file (severity per D-06) → registry (ID order) → wcag tag if applicable → golden delta check → calibration bands green → full suite.

## 7a. Beyond the fixtures

Two things the fixture suite could not catch were found by running the tool on real code, and now have regression tests: (1) dogfooding six real projects exposed false positives (valid `aria-pressed`, label-wrapped inputs, dynamic button names, nested-text links, `hidden` inputs) and a score that pinned at 0 — see `rules-a11y-attrs.test.ts`, `score.test.ts`; (2) a real `claude -p` session showed the CI hook format never reached the agent — see `hook.test.ts` (`toClaudeHook`) and [architecture.md](architecture.md) §5. Repeat both checks (a few real repos; a headless agent run with `fringe init`) before each release.

## 7. Known gaps & deferred coverage

- FR-365 has fixture coverage but no whole-app golden plant (Task-13 plan gap, recorded; per-rule net covers it).
- `check.ts`'s token-gathering path with a configured `tokenSource` is exercised at unit level (`tokens.test.ts`) and via the ledger E2E, not inside a golden.
- Vue/Svelte tier-2 files get text rules only — no tier-2 fixture app yet.
- Sloppy-edge deferrals (word boundaries, emoji ranges, Tailwind v4 naming, FR-304 cascade, `text-[rgba()]`) live in the deferral log of [decisions.md](decisions.md) — each is signal-severity only, none gate.
