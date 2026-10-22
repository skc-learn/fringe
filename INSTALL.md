# Install

Fringe is one npm package, `@fringetools/cli` (Node ≥ 18), plus skills for your agent. Pick your agent.

## Claude Code, as a plugin (hook + skills in one step)

Send these as two separate prompts:

```
/plugin marketplace add skc-learn/fringe
```
```
/plugin install fringetool@fringe
```

This adds the post-edit and playbook hooks and the skills, namespaced: `/fringetool:fringe-setup`, `/fringetool:fringe-review`, `/fringetool:fringe-audit`, `/fringetool:fringe-debt`, `/fringetool:fringe-help`. The playbook hook is one small file **inside the plugin** (needs `node` 18+ on the PATH); nothing is downloaded when hooks run. The post-edit check runs the `fringe` installed in your project or on your PATH, so run `npm i -D @fringetools/cli` once to turn it on; without it the plugin stays silent after edits.

## Claude Code, without the plugin

In your project:

```sh
npx @fringetools/cli init            # this project
npx @fringetools/cli init --global   # once, for every project (writes to ~/.claude)
```

Writes the same hook into `.claude/settings.json` (existing settings kept) and copies the skills to `.claude/skills/`. Skills are then `/fringe-review` and so on, with no namespace.

## Any other agent (Cursor, Copilot, Windsurf, Cline, Codex, Gemini, …)

One command writes the rules file in the place each tool reads:

```sh
npx @fringetools/cli init --for cursor,codex,gemini,copilot,windsurf,cline,kiro   # pick yours
npx @fringetools/cli init --git                                                   # optional commit gate for any agent
```

If your agent runs in a sandbox with no network, install once with `npm i -D @fringetools/cli` so the check does not need `npx` to download anything. The manual route is below.

1. Copy [`AGENTS.md`](AGENTS.md) into your project (or your agent's rules file).
2. Have the agent run `npx -y @fringetools/cli check` after edits. These agents have no Fringe hook yet, so the instruction does the work. Most also read the skill files in [`packages/cli/skill/`](packages/cli/skill/) if you copy them into your agent's skills folder.

## CI and pre-commit (no agent)

```sh
npx -y @fringetools/cli check --hook     # one-line JSON, exit 1 on errors
npx -y @fringetools/cli check            # human output, same exit code
```

On an existing repo, run `npx -y @fringetools/cli check --update-baseline` once and commit `fringe.baseline.json` so only new problems fail the build.

## Optional: check the running page

For real contrast and keyboard behaviour (needs your app running and Chrome installed):

```sh
npm i -D playwright-core axe-core
npx @fringetools/cli scan http://localhost:3000
```

## Check it worked

```sh
npx -y @fringetools/cli --version
npx -y @fringetools/cli check
```

Only install from `@fringetools/cli` on npm or `skc-learn/fringe` on GitHub.
