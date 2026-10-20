# Benchmark

Does Fringe change what an agent ships? Same Claude Code agent, same prompts, two arms:

- **plain**: an empty React project.
- **fringe**: the same project after `npx @fringetools/cli init` (post-edit hook + five skills).

Six UI tasks (signup, dashboard, product grid, settings, modal, navbar), 2 runs each = 12 runs per arm. The prompts never mention accessibility: they measure what the agent does when nobody asks. After each run the published package (`npx @fringetools/cli check --json`) counts the findings in what the agent left behind. Reproduce with `node benchmarks/run.mjs [runs] [parallel]` (spends real usage). Raw rows: [results-2026-10-20.json](results-2026-10-20.json).

## Result (v0.1.2, 2026-10-20; FR-206 fix shipped in 0.1.3)

| | plain | fringe |
|---|---|---|
| Runs ending with ≥1 `error` finding | **4 of 12** | **1 of 12** |
| `error` findings left in total | 6 | 1 |
| Mean health score | 95.0 | 99.2 |
| `fringe-ignore` suppressions used | 0 | 0 |
| Mean turns / cost / time | 4.1 / $0.183 / 27 s | 4.3 / $0.184 / 31 s |

What the plain arm left behind: unlabeled inputs, an icon-only button, an unnamed control in a modal and a navbar. With Fringe, the same agent fixed them in-loop and never silenced a rule. Cost and turns are within noise: the hook adds about one turn on the runs that need a fix.

The one error left in the fringe arm is `FR-206` on a modal backdrop `<div onClick={onClose}>` (the dialog also has a Close button). That is a common, defensible pattern, so it was a false positive of the rule, not an agent miss. FR-206 now exempts a backdrop whose first child is a `role="dialog"` / `aria-modal` element (fixed after this run; with the fix that run scores 100). The numbers above are the unmodified results.

## Read this before quoting it

- **Small.** 12 runs per arm, one model, one agent, simple single-file tasks. 4/12 vs 1/12 is a direction, not a rate; the gap could shrink or grow with more runs. Treat it as a smoke test.
- **The plain arm is already decent**: the model puts `aria-label` on most things unprompted. The measured gap is about a third of runs, not most of them.
- **Static findings only.** Fringe counts what it can see; "fewer findings" is not "accessible".
- **Same global setup in both arms** (the author's other Claude Code hooks and plugins ran in both), which adds noise but not a bias toward either arm.
- Ponytail publishes 39 tasks × 5 runs; this is a first, much smaller step toward the same standard.

## Messy repo: "fix this app's accessibility problems" (v0.2.0, 2026-10-21)

`node benchmarks/messy.mjs`. A generated React app, 20 pages plus three shared components, **122 error findings** before the agent starts. Prompt: *"This React app has accessibility problems. Find and fix them across the codebase. Keep the design and behavior the same."* Three arms, 2 runs each: **plain** (nothing installed), **hook** (post-edit hook with fix recipes only), **full** (`fringe init`: hook + five skills, so the agent can run `fringe plan`). Raw rows: [results-messy-2026-10-21.json](results-messy-2026-10-21.json).

| | plain | hook | full (hook + skills) |
|---|---|---|---|
| Errors left (2 runs) | 1, 1 | 0, 0 | 0, 0 |
| Mean turns / cost / time | 50 / $0.90 / 232 s | 62 / $1.50 / 361 s | 74 / $1.60 / 410 s |
| Inputs fixed with `aria-label` only (visible `<label>` added) | 40 (0) | 40 (0) | 41 (0) |
| Informative images given `alt=""` / generic alt | 0, 0 | 20, 0 | 0, 0 |
| `fringe-ignore` used | 0, 0 | 1, 1 | 0, 0 |

**What it shows, honestly**
- A capable agent already fixes almost everything unprompted: 122 → 1 error with nothing installed. Fringe's measurable gain here is the last error (0 vs 1), at **about 70–75% more cost and time**. On this task the check-and-recipe loop is not a bargain.
- **Fix recipes and `fringe plan` did not change fix quality.** Every arm used `aria-label` on all inputs and added no visible labels, even with the recipe saying to prefer a visible label. The prompt said "keep the design the same", which makes `aria-label` the defensible choice, so this tests the prompt as much as the recipe. We do not claim recipes improve fixes.
- The hook-only arm hid 20 informative product images with `alt=""` in one run and used `fringe-ignore` once per run; the `full` arm did neither. Two runs per arm is not enough to say the skills caused that.
- The comparison that favours Fringe is still the earlier one: agents asked to *build* UI left errors in 4 of 12 runs without it, 1 of 12 with it, at the same cost. Fringe's value is clearest when the agent is not told to fix accessibility.
- n = 2 per arm, one model, a synthetic app.
