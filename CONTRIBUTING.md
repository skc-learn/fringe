# Contributing

Fringe is TDD all the way: every change starts as a failing test.

```sh
pnpm install
pnpm test                     # whole suite (cd packages/cli for single files: pnpm vitest run tests/<file>)
pnpm --filter @fringetools/cli build && node packages/cli/dist/bin.js check fixtures/reference-app
```

**Adding a rule** (full recipe in [docs/test-strategy.md](docs/test-strategy.md) §6): fixtures `fixtures/rules/FR-XXX/{pass,fail}.tsx` → failing `expectRule` test → pure rule file in `packages/cli/src/rules/` → register in `registry.ts` → tag `wcag` if a criterion applies → check goldens and calibration bands stay green.

**Before opening a PR:** tests green; if a rule changed, regenerate goldens (`vitest run <golden> -u`) and verify the diff by eye; run the checker on a real repo and look for new false positives. Severity rule of thumb: `error` only if AST-exact, heuristics are `review`, taste is `signal`.

**Benchmark:** `node benchmarks/run.mjs` (spends real usage) reruns the with/without comparison; record new results in `benchmarks/README.md`.

**Releasing:** bump `packages/cli/package.json`, `plugin/.claude-plugin/plugin.json`, `packages/cli/src/version.ts` and the pinned version in `plugin/hooks/hooks.json` together, then run `pnpm --filter @fringetools/cli run shrinkwrap` (refreshes the lockfile the npm package ships) and `node scripts/sync-plugin.mjs` (copies the skills into the plugin folder) (a test fails if they drift), commit, then `git tag v<version> && git push origin v<version>`. The `publish` workflow tests, publishes to npm (trusted publishing, with provenance) and creates the GitHub Release; it fails if the tag and `package.json` disagree. One-time setup: npmjs.com → the package → Settings → Trusted Publisher → GitHub Actions: owner `skc-learn`, repository `fringe`, workflow `publish.yml`.

Design decisions live in [docs/decisions.md](docs/decisions.md); add an entry when you change one.
