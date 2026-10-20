# Fringe: handle your edges

For any coding agent that reads a rules file. Fringe is a static checker for frontends: it measures accessibility, interaction states, dark patterns and the generic "AI look", and exits non-zero on hard failures.

Run it from the project root: `npx -y @fringetools/cli check` (or `fringe check` if installed). It takes a directory, not a single file.

## While you work

1. **Flow.** Before building UI, ask what the user can skip. Cut steps, screens and options nobody needs, and say why with evidence (a metric, a usage count, a requirement). No evidence, no cut.
2. **Edges.** After every edit to a frontend file, run `fringe check`. Fix every `[ERROR]` before you finish: missing `alt`, unnamed buttons, unlabeled inputs, skipped headings, removed focus rings, `onClick` on non-interactive elements, invalid `aria-*`. Do not finish with errors outstanding.
3. **Polish.** Fix `[REVIEW]` items you agree with and cheap `[SIGNAL]` items; say which you left and why.

## Rules

- Never silence a rule to get green. A `// fringe-ignore FR-123` comment is for a real false positive only; say so in your final message with the rule and the reason. Every run prints `N suppressed`.
- On a repo that already has problems, do not fix everything first: `fringe check --update-baseline` records today's findings so only new ones gate (commit `fringe.baseline.json`).
- If Fringe is not available, say so. Do not skip the check silently.
- Report the health score as measured; never estimate it.

Works alongside Ponytail: Ponytail keeps the code small and promises never to cut accessibility; Fringe is the check that verifies that promise.

Reference: https://github.com/skc-learn/fringe/blob/main/packages/cli/README.md
