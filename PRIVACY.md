# Privacy Policy

_Last updated: 2026-10-21_

Fringe (the `fringetool` Claude Code plugin and the `@fringetools/cli` npm package) is a local tool. This policy says what it does with data.

## What we collect

Nothing. Fringe has no server, no accounts, no analytics and no telemetry. The maintainers receive no data from your use of it.

## What runs on your machine

- After Claude edits or writes a file, the plugin's hook runs `@fringetools/cli check --claude-hook` locally. It reads the edited file and, for project-wide checks, your project's source and `fringe.config.json`.
- Results go back to Claude Code on your machine. Claude's handling of your conversation is governed by Anthropic's own terms and privacy policy, not by Fringe.
- Fringe writes only under `.fringe/` (run history, if you use `--record`) and `fringe.baseline.json` (if you ask). Both stay in your repository.
- `fringe scan <url>` is run only by you. It opens the URL you give it in a local browser and checks the page. Nothing is sent to us.

## Network use

Fringe makes no network calls itself. The one download is `npx` fetching the pinned `@fringetools/cli` package from the npm registry on first use, which is subject to npm's own policies.

## Personal data, retention, children

The hook and skills do not read, store or transmit personal data, credentials or environment secrets. The one case where a secret is used is a login script you write for `fringe scan` (`${env:NAME}`): Fringe reads only the variables you name, types them into the page you chose, and never prints, logs or saves the values. Fringe keeps nothing beyond the local files above, which you control and can delete. It is a developer tool and is not directed at people under 18.

## Changes and contact

Changes are made in this file and dated above. Questions: open an issue at https://github.com/skc-learn/fringe/issues.
