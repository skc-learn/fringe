---
name: fringe-audit
description: Use when the user wants a whole-repo UX/accessibility audit, a plan for an existing frontend with many problems, or to adopt Fringe on a messy repo ("audit this codebase", "where do we start", "adopt fringe"). Produces a prioritized plan and sets a baseline.
---

# Fringe audit

Command: use `fringe` if it is on the PATH, otherwise `npx -y @fringetools/cli` in its place (e.g. `npx -y @fringetools/cli check --json .`).

1. Run `fringe check --json .` and note the totals. Do not print every finding.
2. Summarize as a plan:
   - Totals by severity and the health score, plus files scanned and skipped.
   - **Top rules** by count, and **top files** by error count (the 5 worst of each).
   - For each top rule: what it means in one sentence, a typical fix, and whether it is likely mechanical (add `aria-label`, add `alt`) or needs design judgment.
   - A suggested order: mechanical `error` fixes first, then `error`s needing judgment, then `review`, then `signal`.
3. Offer the baseline: "`fringe check --update-baseline` records today's findings so only new problems gate; commit `fringe.baseline.json`." Run it only if the user agrees.
4. Ask before changing code. If the user says go, fix one rule at a time, re-run `fringe check` after each, and re-baseline at the end so the file shrinks.

Spot-check a few reported findings by reading the code before presenting them as certain; Fringe is static and can be wrong. Say which you checked.
