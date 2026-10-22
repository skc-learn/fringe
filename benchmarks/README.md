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

## Playbooks: asking for them vs pushing them (v0.6.4 vs v0.7.0, 2026-10-21)

`node benchmarks/playbooks.mjs`. Six component tasks (carousel, tabs, modal, login, table, search), 2 runs per cell, two arms: **plain** (nothing installed) and **fringe** (`fringe init`). The prompts never mention accessibility or playbooks (e.g. "Create src/Carousel.tsx: a React image carousel with 4 slides, previous and next buttons, and automatic rotation."). Each task has 3 checks that a text search can verify (e.g. a pause control, `aria-roledescription`, reduced-motion handling for the carousel), so the score is a **proxy for a few playbook items, not an accessibility audit**. Rows: [opt-in](results-playbooks-optin-2026-10-21.json), [pushed](results-playbooks-pushed-2026-10-21.json).

| | plain | fringe |
|---|---|---|
| **v0.6.4, playbook opt-in** (the skill says "run `explain pattern` first") | 10/36 | 6/36 |
| **v0.7.0, playbook pushed** (a prompt hook adds the matching playbook before the agent starts) | 9/36 | **33/36** |
| Mean turns / cost / time (v0.7.0) | 4.7 / $0.19 / 25 s | 5.4 / $0.27 / 71 s |

- **Asking does not work.** With the skill telling the agent to read the playbook, it did so in **0 of 12** runs, and the score was no better than doing nothing.
- **Pushing does.** With the hook, every task jumped (carousel 0 to 5 of 6, login 0 to 6, table 0 to 6, tabs 2 to 6). The three checks still missed were a modal's dialog role and Escape handling in one run, and reduced motion in one carousel run.
- **It costs time.** About 40% more spend and nearly three times the wall-clock time, from the agent writing more complete components plus two `npx` hook calls per step (each 1 to 4 s; a locally installed copy, `npm i -D @fringetools/cli`, brings that to well under a second).
- **Read it carefully.** The checks come from the playbook, and the plain agents never saw it, so this shows agents *follow a checklist they are given*, not that the components are more usable. The checks are text searches (a pause button that exists but does not work would still pass). 12 runs per arm, one model, small components.

### Do the pushed-playbook components actually work? (runtime check, same 24 components)

`node benchmarks/runtime-check.mjs <results dir>` builds every component the playbook benchmark produced (esbuild + React), opens it in Chrome, runs `fringe scan` (axe-core + keyboard walk) and one **behaviour probe** per task: a carousel's pause button really freezes the slides (compared by screenshot), ArrowRight moves between tabs, an empty sign-in submit gives an announced error, sorting a table sets `aria-sort`, a search with no match announces something, Escape closes a modal. Rows: [results-playbooks-runtime-2026-10-21.json](results-playbooks-runtime-2026-10-21.json).

| | plain | fringe (v0.7.0, playbook pushed) |
|---|---|---|
| Components that built | 12 of 12 | **11 of 12** |
| Behaviour probes that passed | **2 of 12** (both sign-in forms) | **9 of 9** that could be judged |
| Could not be judged | 0 | 2 (modal: needs props to open) |
| axe-core errors (excluding touch-target size on unstyled controls) | 0 | 0 |
| Keyboard traps | 0 | 0 |

- **The behaviours are real, not just text.** The pushed playbook produced carousels whose pause button stops the rotation, tabs that respond to the arrow keys, tables that set `aria-sort` when sorted, and searches that announce results. The plain components mostly had none of it.
- **It also produced one broken file.** In one tabs run the agent put unescaped double quotes inside a string, so the component did not compile (`Expected "}" but found "Exactly"`). The checklist proxy had scored that run 6/6. Fringe's own check skipped the unparseable file without telling the agent, which is a gap (see the roadmap).
- **axe-core finds nothing either way.** These small unstyled components have no color or markup problems for it to catch, so the difference between the arms is behaviour (keyboard, announcements, state), which static and axe checks do not see. That is also why the probes exist.
- Limits: 12 components per arm, one model, probes are my own and cover one behaviour per task, the two modal cells could not be tested without props.
