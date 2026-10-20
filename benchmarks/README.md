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
