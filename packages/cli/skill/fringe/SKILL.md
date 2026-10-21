---
name: fringe
description: Use when writing or changing frontend code (JSX/TSX, HTML, CSS, Vue, Svelte). Runs the Fringe checker so accessibility, state handling, dark patterns, token drift and the generic "AI look" are measured, not guessed.
---

# Fringe

Command: use `fringe` if it is on the PATH, otherwise `npx -y @fringetools/cli@0.4.1` in its place (e.g. `npx -y @fringetools/cli@0.4.1 check --json .`).

Ponytail trims your code. Fringe handles your edges. Work the ladder in order.

0. **Building a common component (form, sign-in, checkout, table, search, tabs, modal, ...)?** Run `fringe explain pattern <name>` first (`fringe explain pattern` lists them: form, auth, checkout, table, search, tabs, accordion, toast, upload, datepicker, onboarding, empty-state, modal, navigation, data-view, pricing, settings, dashboard, carousel, drag-and-drop, rich-text, chat): a short best-practice checklist, each item marked verified (Fringe checks it) or judged (you decide and say why).
1. **Flow (judged).** Before building, ask what the user can skip. Cut steps, screens or options nobody needs. Write each decision with its evidence to `.fringe/manifest.json`: `{"flows":[{"action":"cut"|"kept","what":"...","evidence":"..."}]}`. No evidence, no cut.
2. **Edges (verified, gates).** After every edit the hook runs `fringe check --claude-hook` and feeds errors back to you. Fix every listed finding. If there is no hook, run `fringe check --hook` yourself from the project root and do not finish while `block` is `true`.
   On a repo with many existing findings, run `fringe plan` and work it batch by batch (shared components first, since one fix clears many uses), re-running `fringe check` after each batch. `fringe explain <rule>` gives the recipe and what to avoid.
3. **Polish (verified, never gates).** Run `fringe check` once before finishing. Fix `review` items you agree with. Fix `signal` items that are cheap. Say which you left and why.

When done: `fringe check --record --manifest .fringe/manifest.json`. Report the health score as measured; never estimate it yourself.

Rules of the road:
- Never grade your own work where the checker can measure it.
- Do not silence a rule with `ignore`/`disable` in `fringe.config.json` to get green. Fix the code, or tell the user why the rule is wrong.
- A `// fringe-ignore FR-123` comment is allowed only for a real false positive. Say so in your final message with the rule and why; the run output counts suppressions (`N suppressed`) and a reviewer will see them.
- If `fringe` is not installed, say so. Do not skip the check silently.
- Hook wiring and the full rule table: `packages/cli/README.md`.
