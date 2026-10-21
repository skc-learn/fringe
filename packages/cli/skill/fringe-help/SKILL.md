---
name: fringe-help
description: Use when the user asks what Fringe can do or how to use it ("fringe help", "what commands does fringe have", /fringe-help). Quick reference; changes nothing.
---

# Fringe help

Fringe checks agent-written frontends for accessibility, state, dark-pattern and "AI look" problems, gates the hard failures, and keeps a local history.

**Skills**

| Skill | Use it to |
|---|---|
| `fringe` | The working rules: cut what users don't need, fix every hook finding, polish, record |
| `/fringe-review` | Review a page or component: ranked findings with plain-English fixes |
| `/fringe-audit` | Audit the whole repo: top rules and files, a fix order, offer a baseline |
| `/fringe-debt` | List silenced findings (`fringe-ignore`, baseline) |
| `/fringe-setup` | Guided onboarding: wire the hook, offer a baseline, set critical paths |
| `/fringe-help` | This reference |

**Commands** (`fringe`, or `npx -y @fringetools/cli@0.4.1`)

| Command | What it does |
|---|---|
| `check [dir]` | Scan and print findings and the health score; exit 1 on any error |
| `check --json` / `--hook` / `--claude-hook` | Machine output; CI gate; agent feedback form |
| `check --update-baseline` | Accept today's findings; only new ones gate |
| `scan <url>` | Runtime check of a live page: real contrast, keyboard walk, and named states from `fringe.scan.json` (needs `playwright-core` + `axe-core`) |
| `plan [dir\|file] [--scan url]` | Ordered fix batches (shared components first) with recipes; `--scan` adds the live page |
| `login <url>` | Log in once in a browser window and save the session, so `scan` can reach pages behind a sign-in |
| `handoff` / `verify` | Work order for another agent or CI, and proof it was done (complete / partial / regressed) |
| `rules` | Per rule: open / baselined / silenced, to spot rules that do not suit this repo |
| `init --for <agents>` / `--git` | Rules file for Codex, Cursor, Copilot, Gemini…; commit gate for any agent |
| `explain [FR-203]` | Why a rule matters and how to fix it well |
| `check --record [--manifest f]` | Append the run to `.fringe/ledger.jsonl` |
| `init` | Add the hook and install the skills |
| `open` | View the ledger at 127.0.0.1:4173 |

**Escape hatch:** `// fringe-ignore FR-203` on or above the line, for a real false positive only; every run reports `N suppressed`.

Full reference: https://github.com/skc-learn/fringe/blob/main/packages/cli/README.md
