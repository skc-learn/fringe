---
name: fringe
description: Use when writing or changing frontend code (JSX/TSX, HTML, CSS, Vue, Svelte). Runs the Fringe checker so accessibility, state handling, dark patterns, token drift and the generic "AI look" are measured, not guessed.
---

# Fringe

Ponytail trims your code. Fringe handles your edges. Work the ladder in order.

1. **Flow (judged).** Before building, ask what the user can skip. Cut steps, screens or options nobody needs. Write each decision with its evidence to `.fringe/manifest.json`: `{"flows":[{"action":"cut"|"kept","what":"...","evidence":"..."}]}`. No evidence, no cut.
2. **Edges (verified, gates).** After every edit run `fringe check --hook` from the project root. If `block` is `true`, fix the named finding and re-run. Do not finish with `block: true`.
3. **Polish (verified, never gates).** Run `fringe check` once before finishing. Fix `review` items you agree with. Fix `signal` items that are cheap. Say which you left and why.

When done: `fringe check --record --manifest .fringe/manifest.json`. Report the health score as measured; never estimate it yourself.

Rules of the road:
- Never grade your own work where the checker can measure it.
- Do not silence a rule with `ignore`/`disable` in `fringe.config.json` to get green. Fix the code, or tell the user why the rule is wrong.
- If `fringe` is not installed, say so. Do not skip the check silently.
- Hook wiring and the full rule table: `packages/cli/README.md`.
