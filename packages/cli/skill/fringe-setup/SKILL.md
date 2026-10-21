---
name: fringe-setup
description: Use when the user wants to set up or get started with Fringe, or asks why it is not checking their edits ("set up fringe", "get started", "install fringe", /fringe-setup). Guided onboarding: checks the environment, wires the hook, offers a baseline, and records the critical pages.
---

# Fringe setup

Command: use `fringe` if it is on the PATH, otherwise `npx -y @fringetools/cli` in its place. Ask before each step that changes a file, and say what it will change.

1. **Environment.** Run `node -v` (needs 18 or newer). If it is missing or older, stop and tell the user to install Node first.
2. **Where things stand.** Run `fringe check .` and report the counts. If it says it is not checking after edits, the hook is not wired.
3. **Wire the hook (skip if the Fringe plugin is already installed, or the check above reported it is set up).** Ask: this project only, or every project? Then run `fringe init` or `fringe init --global`. Both add the post-edit hook and the skills without touching other settings.
4. **Existing problems.** If there are more than a handful of errors, explain that `fringe check --update-baseline` records today's findings so only new ones block, and offer it. Do not run it without a yes. Remind the user to commit `fringe.baseline.json`.
5. **What matters most.** Ask which folders are most important to users (checkout, sign-up, login). Add them to `fringe.config.json` as `"critical": ["src/checkout/**", ...]`, merging into the file if it exists, never overwriting other keys.
6. **Optional.** Mention `fringe scan <url>` (needs `npm i -D playwright-core axe-core` and Chrome) for real contrast and keyboard checks; install nothing unless asked.
7. **Finish** with one short summary of what was changed and the commands to remember: `/fringe-review`, `/fringe-audit`, `fringe plan`, `fringe explain FR-203`.

If anything fails, report the exact message; do not retry blindly or edit `.claude/settings.json` by hand.
