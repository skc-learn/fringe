# Contributing

Fringe is TDD all the way: every change starts as a failing test.

```sh
pnpm install
pnpm test                     # whole suite (cd packages/cli for single files: pnpm vitest run tests/<file>)
pnpm --filter @fringetools/cli build && node packages/cli/dist/bin.js check fixtures/reference-app
```

**Adding a rule** (full recipe in [docs/test-strategy.md](docs/test-strategy.md) §6): fixtures `fixtures/rules/FR-XXX/{pass,fail}.tsx` → failing `expectRule` test → pure rule file in `packages/cli/src/rules/` → register in `registry.ts` → tag `wcag` if a criterion applies → check goldens and calibration bands stay green.

**Before opening a PR:** tests green; if a rule changed, regenerate goldens (`vitest run <golden> -u`) and verify the diff by eye; run the checker on a real repo and look for new false positives. Severity rule of thumb: `error` only if AST-exact, heuristics are `review`, taste is `signal`.

Design decisions live in [docs/decisions.md](docs/decisions.md); add an entry when you change one.
