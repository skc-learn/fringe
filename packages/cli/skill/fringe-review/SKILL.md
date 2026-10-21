---
name: fringe-review
description: Use when the user asks to review, check or critique a UI, page or component for accessibility and UX edges ("review this page", "what's wrong with this form", "is this accessible"). Runs Fringe and reports ranked findings with fixes, in plain English.
---

# Fringe review

Command: use `fringe` if it is on the PATH, otherwise `npx -y @fringetools/cli@0.4.0` in its place (e.g. `npx -y @fringetools/cli@0.4.0 check --json .`).

1. Run `fringe check --json <file or folder>` from the project root: the file or page the user named, else `.`. Each finding already carries `priority` and `fixability`; report highest priority first. For the fix text use `fringe explain <rule>` (why, recipe, what to avoid) rather than improvising.
2. Report in plain English, no jargon left unexplained:
   - **Must fix** — `error` findings. Group by rule. For each: where (`file:line`), what is wrong in one sentence, the exact fix, and who is hurt (for example "a screen reader says only 'button'"). Cite the `wcag` criterion when present.
   - **Worth a look** — `review` findings. These are heuristics: say they need your judgment, and give your call on each.
   - **Polish** — `signal` findings, only the top few. Never present them as bugs.
3. End with the health score as measured, the count by severity, and one line on what was not checked (Fringe is static: it cannot judge contrast on images, real focus order, or whether copy is good).
4. Change no code unless asked. If asked to fix, fix `error` items first and re-run to confirm.

Do not invent findings the tool did not report, and do not call the score an estimate: it is measured.
