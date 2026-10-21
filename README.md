<h1 align="center">Fringe</h1>

<p align="center"><strong>Your AI coding agent builds the UI. Fringe checks the edges it forgets.</strong><br>
<em>Ponytail trims your code. Fringe handles your edges.</em></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@fringetools/cli"><img src="https://img.shields.io/npm/v/@fringetools/cli?style=flat-square&label=npm" alt="npm"></a>
  <a href="https://github.com/skc-learn/fringe/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/skc-learn/fringe/ci.yml?style=flat-square&label=tests" alt="tests"></a>
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/node-%E2%89%A518-111111?style=flat-square" alt="Node 18+">
</p>

AI agents write UI fast, and quietly skip the unglamorous parts: an `alt` on the image, a label on the input, a name on the icon button, a visible focus ring. Fringe is a **static checker that runs after every edit**, hands the problems back to the agent, and keeps the agent from finishing with broken markup. Nothing leaves your machine.

**Measured:** in our [benchmark](benchmarks/README.md), an agent asked for ordinary UI left error-level accessibility problems in **4 of 12 runs** on its own, and **1 of 12 with Fringe**, at the same cost. (Small test, honest caveats inside.)

---

## Start in 60 seconds

Pick **one**:

**A. Claude Code plugin** (hook + skills in one step). Send these as two separate prompts:

```
/plugin marketplace add skc-learn/fringe
```
```
/plugin install fringetool@fringe
```

**B. One command** (any Claude Code project, nothing to install first):

```sh
npx @fringetools/cli init            # this project
npx @fringetools/cli init --global   # once, for every project
```

Not sure whether it's set up? Run `npx @fringetools/cli` with no arguments: it checks the folder and tells you if the post-edit check isn't wired yet. Already inside Claude Code? Type `/fringe-setup` for a guided setup.

**C. Just try the checker**, no agent needed:

```sh
npx @fringetools/cli check
```

Needs [Node.js](https://nodejs.org) 18 or newer. Using Cursor, Copilot, Windsurf, Codex, CI or pre-commit instead? See **[INSTALL.md](INSTALL.md)**.

### See it work

Ask your agent for any UI, for example *"add a signup form with email and password"*. Behind the scenes:

```
agent writes src/Signup.tsx
  └─ Fringe runs automatically  →  "2 errors: inputs have no label"
agent adds the labels
  └─ Fringe runs again          →  clean
```

You can also run it yourself:

```
$ npx @fringetools/cli check
fringe · stack jsx,tailwind · 3 files
[ERROR] FR-201 src/App.tsx:15 — <img> missing alt text (add alt="description" (or alt="" if decorative))
[ERROR] FR-204 src/App.tsx:17 — heading skips from h1 to h3 (don't skip heading levels for visual size)
health 34/100 · 6 errors · 2 review · 0 signals
```

Errors make the command exit `1` (so CI fails too). Everything else is advice and never blocks.

---

## What you get

**Six skills** your agent can use (Claude Code: type the slash command):

| Skill | Use it to |
|---|---|
| `fringe` | Always-on rules: cut what users don't need, fix every flagged error, never silence a rule to get green |
| `/fringe-review` | "Review this page": ranked, plain-English findings with the fix for each |
| `/fringe-audit` | Audit a whole repo: top problems, a fix order, and an offer to set a baseline |
| `/fringe-debt` | List everything silenced or deferred (suppressions and baseline) |
| `/fringe-setup` | Guided onboarding from inside Claude Code: checks the environment, wires the hook, offers a baseline, records your critical pages |
| `/fringe-help` | Quick reference |

> Installed as a plugin, the names are namespaced: `/fringetool:fringe-review`. The review and audit skills run the checker, so Claude Code asks you to approve that command once.

**36 rules in three tiers**, each with a fix hint and (for accessibility) its WCAG criterion:

| Tier | Gates? | Examples |
|---|---|---|
| **Edges** (`error`) | **Yes** | missing `alt`, unnamed buttons, unlabeled inputs, skipped headings, removed focus rings, `onClick` on a `<div>`, invalid `aria-*` |
| **Judgment** (`review`) | No | data fetching with no loading/error state, dark patterns (fake countdowns, pre-checked consent, confirm-shaming, infinite scroll, drip pricing), "Something went wrong" with no next step, form basics (wrong input type, no autocomplete), "click here" and `href="#"` links, missing page `lang`/`title` or a viewport that blocks zoom, animation with no reduced-motion handling, autoplaying sound, hover-only interactions |
| **Polish** (`signal`) | No | lorem ipsum / TODO text left in the UI, hardcoded colors vs your design tokens, off-scale spacing/type, low contrast, tiny tap targets, the "AI look" (purple gradient, italic serif hero, card-in-card, emoji headings) |

Full rule table: **[CLI reference](packages/cli/README.md#rules)**.

---

## Everyday recipes

| I want to… | Do this |
|---|---|
| Check my project | `npx @fringetools/cli check` (a folder, default `.`, or one file) |
| Know what to fix first | `npx @fringetools/cli plan` (add `--scan http://localhost:3000` to include the live page): batches ordered by impact, shared components first, with the fix for each rule |
| Scan pages behind a login | `npx @fringetools/cli login http://localhost:3000/login` (log in once in the window), then `scan <url> --storage-state .fringe/auth.json`. For CI, script the login with test credentials from env vars ([how](packages/cli/README.md#pages-behind-a-login)) |
| See the running page (real contrast, keyboard, menus and modals) | `npm i -D playwright-core axe-core`, then `npx @fringetools/cli scan http://localhost:3000`. Add a `fringe.scan.json` to also audit states like "menu open" ([how](packages/cli/README.md#states-audit-what-only-exists-after-a-click)) |
| Use another agent (Codex, Cursor, Copilot, Gemini…) | `npx @fringetools/cli init --for cursor,codex` writes the rules file each reads; add `--git` for a commit gate that works with any agent |
| Hand the fixing to another agent or CI | `npx @fringetools/cli handoff > prompt.md`, give it to the agent, then `npx @fringetools/cli verify` (exit 0 only when done; reports anything it silenced) |
| See which rules don't suit my repo | `npx @fringetools/cli rules`: per rule, findings open vs baselined vs silenced; mostly-overridden rules are flagged |
| Understand a rule | `npx @fringetools/cli explain FR-203`: why it matters, the right fix, the tempting wrong one |
| Use it on a repo that already has problems | `npx @fringetools/cli check --update-baseline`, commit `fringe.baseline.json`. Now only **new** problems gate |
| Silence a real false positive | Put `// fringe-ignore FR-203` on the line or the line above (JSX: `{/* fringe-ignore FR-203 */}`, HTML: `<!-- … -->`). It is always counted in the report |
| Turn a rule off everywhere | `fringe.config.json`: `{ "disable": ["FR-214"] }` |
| Fail CI on accessibility errors | Run `npx -y @fringetools/cli check` in your pipeline: exit code `1` on errors |
| Get machine-readable output | `--json` (full report) or `--hook` (one-line CI gate) |
| Keep a history of runs | `--record` appends to `.fringe/ledger.jsonl`; `npx @fringetools/cli open` shows it at `http://127.0.0.1:4173` |

Every command, flag, exit code and config key: **[CLI reference](packages/cli/README.md)**.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npx: command not found` | Install Node.js 18+ from nodejs.org |
| Agent never gets Fringe's feedback | The hook only fires when the agent edits or writes a file. Restart Claude Code after installing; check `.claude/settings.json` has the `fringe check --claude-hook` entry (re-run `npx @fringetools/cli init` if not) |
| `/fringe-review` asks for permission | Expected: it runs the checker. Approve once, or allow `Bash(npx:*)` |
| "No findings" but I see problems | Fringe is static. It can't judge real colors on images, runtime focus order, or whether your copy is good |
| Hundreds of findings on an old repo | Use the baseline (see above); fix at your own pace |
| A rule is wrong for my case | `fringe-ignore` it on that line, and please [report the false positive](https://github.com/skc-learn/fringe/issues/new?template=false-positive.md) |
| `exit 2` / "internal error" | The message names the cause: bad `fringe.config.json`, corrupt `fringe.baseline.json`, or an invalid `.claude/settings.json` |
| It checked a folder I don't want | Add globs to `ignore` in `fringe.config.json`, e.g. `"examples/**"` (use the `dir/**` form) |
| Remove it | Plugin: `/plugin uninstall fringetool`. Init: delete the Fringe entry in `.claude/settings.json` and the `.claude/skills/fringe*` folders |

## What the plugin runs

- **One hook**, [hooks/hooks.json](hooks/hooks.json): after Claude edits or writes a file it runs `npx -y @fringetools/cli@<plugin version> check --claude-hook`. The version is pinned to the plugin's own version, and a test fails if they drift.
- **The package** is this repo's [packages/cli](packages/cli) (readable TypeScript source, MIT), published to npm by [a tagged GitHub Actions run](.github/workflows/publish.yml) with npm provenance, so the npm tarball can be traced to a commit here. Runtime dependencies: `@babel/parser`, `parse5`, `postcss`.
- **It reads** the file that was edited and, for project-wide checks, the project's own source and `fringe.config.json`. **It writes** only under `.fringe/` and, if you ask, `fringe.baseline.json`.
- **It does not** make network calls, send telemetry, read credentials or environment secrets, or change Claude's settings on its own. Two commands you run yourself are the exceptions: `fringe scan <url>` opens the page you name in a local browser, and `fringe init` writes the hook and skills into your `.claude/` folder.
- **The skills** (`/fringetool:fringe-review` and the others) are Markdown instructions that run the same pinned command.

**Privacy:** Fringe reads your source files locally and makes no network calls and sends no telemetry. The only download is `npx` fetching the package itself. Its run history stays in your repo (`.fringe/`).

---

## How it thinks

Fringe encodes a three-step ladder for agents: **Flow** (cut what users don't need, with evidence) → **Edges** (never skip accessibility and states, checked and gated) → **Polish** (tokens, scales, no "AI look", advice only). Every number it shows is labelled **verified** (the checker measured it) or **judged** (the agent decided it). The agent never grades its own work where a measurement exists.

Works alongside [Ponytail](https://github.com/dietrichgebert/ponytail): Ponytail keeps the code small and promises never to cut accessibility; Fringe is the check that verifies the promise. Also complementary to [Impeccable](https://impeccable.style/) and [Design with Intent](https://designwithintent.ai) (positioning in [docs/product.md](docs/product.md)).

---

## Roadmap

Where Fringe is going, in plain terms (the full plan, with the reasons and the evidence that moves each item, is in **[docs/ROADMAP.md](docs/ROADMAP.md)**):

| When | Theme | What you'll get |
|---|---|---|
| **Now** (v0.1.x) | **Easy to try and trust** | Real-world false-positive fixes, issue templates, a larger public benchmark |
| **Shipped** (v0.2) | **Know what to fix, and how** | `fringe plan` (priority order, shared components first), `fringe explain` (recipes), single-file checks, fix recipes inside the agent hook |
| **Next** | **Close the loop** | Tell the agent what its last edit broke, see which rules your repo overrides most |
| **Then** (v0.3) | **Works wherever you work** | A GitHub Action with PR annotations, SARIF for GitHub code scanning, pre-commit config, rules files for Cursor/Copilot/Windsurf |
| **Later** (v0.4) | **See the trend** | A proper dashboard: health over time, per-project board, handoff report |
| **v1.0** | **Beyond static** | Design-token drift, real-browser checks (screenshots, rendered contrast), stable output schemas |

Want something sooner? [Open an issue](https://github.com/skc-learn/fringe/issues): what real use asks for decides the order.

---

## Docs

**Use it:** [INSTALL.md](INSTALL.md) · [CLI reference](packages/cli/README.md) · [AGENTS.md](AGENTS.md) (rules file for any agent) · [Skills](packages/cli/skill/)
**Understand it:** [Product](docs/product.md) · [PRD](docs/PRD.md) · [Architecture](docs/architecture.md) · [Decisions](docs/decisions.md) · [Test strategy](docs/test-strategy.md) · [Benchmark](benchmarks/README.md) · [Docs index](docs/README.md)

## Contributing

Bug reports, false positives and rule ideas are all welcome as [issues](https://github.com/skc-learn/fringe/issues). Code changes: every change starts as a failing test; adding a rule is a documented recipe. Start at **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Privacy and terms

[Privacy Policy](PRIVACY.md) · [Terms of Use](TERMS.md)

## License

[MIT](LICENSE). The dark-pattern taxonomy is adapted, with attribution, from Design with Intent's CC0 library.
