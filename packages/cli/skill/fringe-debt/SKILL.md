---
name: fringe-debt
description: Use when the user asks what Fringe findings have been silenced or deferred ("fringe debt", "what did we suppress", "what's in the baseline", /fringe-debt). One-shot report of suppressions and the baseline; changes nothing.
---

# Fringe debt

Fringe has two ways to defer a finding: an inline `fringe-ignore` comment and the `fringe.baseline.json` file. This lists both so a deferral can't quietly become permanent.

Command: use `fringe` if it is on the PATH, otherwise `npx -y @fringetools/cli@0.4.0` in its place.

1. **Inline suppressions.** `git grep --no-index --exclude-standard -nE 'fringe-ignore +FR-[0-9]+'`. One row per hit: `<file>:<line>, <rule> — <why, if the comment or nearby code says>`. Skip hits that are only prose mentioning the convention.
2. **Baseline.** If `fringe.baseline.json` exists, count entries per rule (each entry is `rule|file|message`) and list the files with the most. If it is missing, say there is no baseline.
3. **Today's picture.** Run `fringe check --json .` and report the current counts by severity next to the baseline total, so the user sees whether the debt is shrinking.
4. Close with the single most valuable thing to pay down first (usually the rule with the most baselined entries that has a mechanical fix) and the command to shrink the baseline afterwards: `fringe check --update-baseline`.

Change nothing. Do not run `--update-baseline` unless the user asks.
