# Fringe roadmap

How Fringe grows from "a checker one person trusts" to "a tool a stranger installs and keeps". This is intent, not a promise: **what real use asks for decides the order**, and each stage says what evidence moves the next one up. Versions are targets, not dates.

## Principles (what stays true)

1. **Verified vs judged.** A number is labelled by who produced it. The agent never grades its own work where a measurement exists.
2. **Only `error` gates, and only when AST-exact.** Heuristics advise. A noisy gate gets switched off, so precision beats coverage.
3. **Local-first.** No telemetry, no account, no network beyond fetching the package. History lives in the repo.
4. **Small surface.** New rules, flags and skills must earn their place with a failing test and a real case (the benchmark and the dogfooding each found a false positive; that is the bar).
5. **Honest claims.** Every number in the README has a method behind it, with its limits stated.

## Where we are (v0.6.2)

Shipped in 0.2: `fringe plan` (priority order, clusters, shared components first), `fringe explain` and fix recipes (also inside the agent hook), single-file `check`, `critical` paths, nested build output ignored by default. Shipped before: 29 rules, size-aware health score, baseline, inline suppression, `init`, Claude Code plugin, five skills, `AGENTS.md`, minimal ledger page, automated releases, a 24-run benchmark. Known gaps: no per-rule feedback loop; only Claude Code gets the live hook; the benchmark is small.

## Stage 1: Easy to try, easy to trust (v0.1.x, now)

*For a new user: install, see it work, believe it.*

| Item | Why | Done when |
|---|---|---|
| Tune false positives as they appear | Trust dies by a thousand wrong errors; two classes already found and fixed from real use | Each report becomes a test + fix within a patch release |
| Issue templates (false positive, bug) | Makes reports reproducible | ✅ in `.github/ISSUE_TEMPLATE/` |
| Larger public benchmark (more tasks, 5 runs, other models) | The 4/12 vs 1/12 result is a smoke test | ≥ 30 tasks × 5 runs, method + limits published |
| A short demo (terminal recording of the loop) on the README | Seeing the agent get corrected beats reading about it | Embedded in README |
| Smoke-test the install paths on a clean machine (plugin, `init`, CI) | These are the first 60 seconds of every user | Checklist run before each release |

**Moves up the list if:** issues report confusing first-run behaviour (then onboarding polish comes before everything else).

## Stage 2: Understand every finding (v0.2)

*For a new user: "why is this an error, and what do I do?" answered without leaving the terminal.*

| Item | Why |
|---|---|
| ✅ `fringe explain FR-203` | Per-rule page: why it matters, who it affects, WCAG link, a before/after fix. Doubles as public rule docs |
| ✅ `fringe check path/to/File.tsx` | Single-file checks (today the skills work around it by checking the folder) |
| ✅ Per-rule precision view | The ledger already records findings per rule and suppressions; show which rules your repo overrides most. Candidate rules to retune |
| Machine-readable suppression report | `fringe debt` as a command, not only a skill, so CI can track debt over time |
| FR-206 and similar second-pass tuning | Remaining known false-positive classes (e.g. backdrop whose dialog is not the first child) |

**Moves up if:** users ask the same "what does this mean?" question repeatedly, or the same rule is suppressed in many repos.

## Stage 2b: Close the loop (v0.2.x, next)

*For an agent mid-task: know what your last edit broke.*

| Item | Why |
|---|---|
| ✅ Regression receipts in the hook ("your last edit introduced 1 new error") | Done in 0.2.2: separates what the agent just did from what was already failing; state in `.fringe/last.json`. Still blocks on all remaining errors (baseline handles legacy debt) |
| ✅ Messy-repo benchmark (100+ findings) with and without `plan` + recipes | Done 2026-10-21: no fix-quality gain and ~70% more cost than a plain agent; claims limited accordingly. Repeat with a prompt that does not say "keep the design" and with more runs |
| FR-216 advisory: input labelled only by `aria-label` | Only if the benchmark shows agents keep choosing the weaker pattern |

## Stage 3: Works wherever you work (v0.3)

*For a new user on a team, not just one agent.*

| Item | Why |
|---|---|
| GitHub Action (`uses: skc-learn/fringe@v1`) | Fails PRs on new accessibility errors; annotates the diff lines |
| SARIF output | Findings appear in GitHub code scanning with no extra tooling |
| Pre-commit / lefthook config | Same gate before the commit exists |
| Rules files for Cursor, Copilot, Windsurf, Cline | `AGENTS.md` covers them manually; generated files (from one source, with a freshness check in CI) make it one copy-paste |
| Live hook for more agents | Only where the host supports feeding tool output back (verify with a real session first; this is how we found the hook-format bug) |

**Moves up if:** most issues come from non-Claude users or CI-only users.

## Stage 4: See the trend (v0.4)

*For a team lead: is the health of our UI getting better?*

| Item | Why |
|---|---|
| Full dashboard (`fringe open` upgrade): stat strip, ladder board, task drawer | Layout already approved (mockups in `docs/superpowers/specs/assets/`) |
| `fringe board`: cross-project view | Agencies and monorepos |
| Handoff report (Markdown): what the agent cut, kept, fixed, and what is left | Reviewable by a human in 2 minutes |
| Trend lines: health, errors, suppressions over time | The ledger is the data; nothing new to collect |

**Moves up if:** people run `--record` regularly and ask for charts. Until then the ledger page is enough, and building a dashboard first would be guessing.

## Stage 5: Beyond static (v1.0; first slice shipped in 0.3.0)

Shipped: `fringe scan <url>`: axe-core + keyboard walk on one URL. Merged into `plan` via `--scan` in 0.3.1; declarative multi-state scans (`fringe.scan.json`) in 0.4.0. Stress modes (dark, reduced motion, 320px reflow) in 0.4.1. Login sessions, screenshots and a baseline for scan findings in 0.5.0; `fringe login`, scripted env-var logins and multi-role sessions in 0.6.0. Still ahead: text-spacing and forced-colors passes, richer scan scripting.

*For a user who needs more than source analysis can say.*

| Item | Why |
|---|---|
| Token drift: declared design tokens vs values used in code | Config field already reserved (`tokenSource`) |
| `fringe shot` and richer scans: screenshots, stress modes (zoom, dark, reduced motion), state forcing | The next layer on top of the shipped `scan` |
| Vue/Svelte/Astro template parsing (today: text rules only) | Coverage honesty: the docs say "text rules only" for a reason |
| Frozen output schemas (`fringe/check.v2`, hook formats) with a deprecation policy | Integrations need stability before 1.0 |
| `--stamp verified` on agent manifests | Tamper-evident record that a measurement, not a claim, backs a number |

## What we are deliberately not doing

- **Intensity levels** (lite/full/ultra): baseline + severity tiers cover it.
- **A hosted service or accounts**: breaks local-first. A hosted view, if ever, is opt-in and separate.
- **Auto-fixing code**: the agent fixes with context; a blind codemod would hide the real fix. Revisit only for mechanical rules with zero judgment.
- **Chasing a rule count**: 36 precise rules beat 200 noisy ones.

## How to influence it

[Open an issue](https://github.com/skc-learn/fringe/issues) (false positive, bug, or "I wish it did X"). Reports with a minimal snippet jump the queue, because they become regression tests. Roadmap changes are recorded in [decisions.md](decisions.md) with the evidence that moved them.
