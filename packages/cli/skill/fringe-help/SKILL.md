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
| `/fringe-help` | This reference |

**Commands** (`fringe`, or `npx -y @fringetools/cli`)

| Command | What it does |
|---|---|
| `check [dir]` | Scan and print findings and the health score; exit 1 on any error |
| `check --json` / `--hook` / `--claude-hook` | Machine output; CI gate; agent feedback form |
| `check --update-baseline` | Accept today's findings; only new ones gate |
| `check --record [--manifest f]` | Append the run to `.fringe/ledger.jsonl` |
| `init` | Add the hook and install the skills |
| `open` | View the ledger at 127.0.0.1:4173 |

**Escape hatch:** `// fringe-ignore FR-203` on or above the line, for a real false positive only; every run reports `N suppressed`.

Full reference: https://github.com/skc-learn/fringe/blob/main/packages/cli/README.md
