# Fringe — Architecture

**Version:** 1.0 (describes shipped v0.1; roadmap sections marked) · **Date:** 2026-10-20

## 1. System context

```
┌─────────────┐   runs    ┌──────────────────────────────────────────┐
│ AI agent /  │──────────▶│              fringe check                │
│ CI / human  │           │  (packages/cli — @fringetools/cli)        │
└─────────────┘           └───────────────┬──────────────────────────┘
        ▲                                 │ reads
        │ --hook block:true               ▼
        │                        ┌──────────────────┐
        │                        │  project source   │
        │                        │  + fringe.config  │
        │                        │  + token source   │
        │                        └──────────────────┘        ┌─────────────────────┐
        │                                                    │ .fringe/ledger.jsonl│◀── --record appends
        └────────────────────────────────────────────────────└─────────────────────┘
                                                             (fringe open / board — Plan 3, reads)
```

One package does everything today: `packages/cli`. The dashboard (Plan 3) and skill/adapters (Plan 4) join as siblings in the pnpm monorepo.

## 2. Module map

| Module | Responsibility | Key exports |
|---|---|---|
| `src/index.ts` | CLI entry: argv parsing, flag dispatch, exit codes, `--record`/`--manifest` wiring | `runCli(argv, opts): Promise<number>` |
| `src/bin.ts` | `#!/usr/bin/env node` shim; sets `process.exitCode` (never `process.exit` — pipes must drain) | — |
| `src/types.ts` | The shared vocabulary: `Severity`, `Finding` (+`wcag?`), `Elem` (+`parentTag?`/`parentClass?`), `CssDecl`, `RuleContext` (+`tokenColors`), `Rule`, `FringeConfig` (+`tokenSource`), `CheckResult`, `StackInfo`, `SEVERITIES` | types + `SEVERITIES` |
| `src/config.ts` | Load/validate `fringe.config.json`; defaults; mutation-safe (cloned) | `loadConfig`, `DEFAULT_CONFIG` |
| `src/detect.ts` | Stack auto-detection (deps + file markers, depth-capped scan skipping build dirs) | `detectStack(root): StackInfo` |
| `src/walk.ts` | File discovery: extension allowlist, dot/node_modules skip, glob→regex ignores | `walk(root, cfg): string[]` |
| `src/parse/jsx.ts` | `@babel/parser` AST → flat `Elem[]` with parent linkage; throws `parse-skip:` on hard failure | `parseJsx(file, source)` |
| `src/parse/html.ts` | parse5 → same `Elem` shape (`class` not `className`) | `parseHtml(file, source)` |
| `src/parse/css.ts` | PostCSS → `CssDecl[]` (nearest-ancestor selector; at-rules inherit) | `parseCss(file, source)` |
| `src/color.ts` | Pure WCAG math: `parseColor` (hex/rgb()/rgba()/hsl()/hsla(); null when unparseable), `relativeLuminance`, `contrastRatio` | — |
| `src/tokens.ts` | Gather project token colors per `tokenSource` kind (custom-property values / W3C `$value` walk) | `gatherTokenColors(root, cfg, cssSources)` |
| `src/scan.ts` | Runtime scan: dynamic-loads `playwright-core` + `axe-core` from the project, drives headless Chrome, maps axe violations and a Tab walk to `Finding`s (`FR-400`, `FR-401`) | `scan`, `parseStates`, `parseSessions`, `parseModes`, `axeToFindings`, `tabWalkFindings` |
| `src/login.ts` | `fringe login`: headed Chrome, user signs in, session saved (Playwright storage state) | `saveSession` |
| `src/promptHook.ts` | Maps a building request to playbooks (keyword table, build-intent gate, max 2) and renders them as `UserPromptSubmit` additional context | `matchPlaybooks`, `promptHookOutput` |
| `src/rulereport.ts` | Per-rule open / baselined / silenced counts and ledger trend (`fringe rules`) | `ruleReport`, `rulesToText` |
| `src/handoff.ts` | Builds the agent work order (prompt + plan + fingerprints) and verifies a later state against it | `buildHandoff`, `verifyHandoff` |
| `src/receipts.ts` | Previous-run error set in `.fringe/last.json`; what a hook run introduced or fixed | `receipts` |
| `src/patterns.ts` | Component checklists for `fringe explain pattern`; items name the rules that verify them | `PATTERNS`, `renderPatterns` |
| `src/rules/*` | 36 pure rules (one file per rule) + `registry.ts` (`ALL_RULES`, `activeRules(cfg)` with disable filter) | `Rule` objects |
| `src/check.ts` | Orchestration: detect → walk → parse+rule per file (two-phase: CSS sources collected for token gathering) → `CheckResult` | `runCheck(root, cfg)` |
| `src/score.ts` | `max(0, 100 − weighted findings)` | `score(counts, weights)` |
| `src/baseline.ts` | `fringe.baseline.json` read/write; multiset match on rule+file+message | `writeBaseline`, `applyBaseline` |
| `src/suppress.ts` | Inline `fringe-ignore FR-xxx` comment lookup (line or line above) | `suppressedIds` |
| `src/init.ts` | Claude hook + skills (`initProject`); other agents' rules files (`initFor`); git pre-commit gate (`initGit`); never overwrites | `initProject`, `initFor`, `initGit` |
| `src/board.ts` | Loopback-only ledger page (`fringe open`); output escaped | `renderBoard`, `startBoard` |
| `skill/<name>/SKILL.md` | Six skills (`fringe`, `-review`, `-audit`, `-debt`, `-setup`, `-help`) — one folder each; shipped in the npm package, copied by `init`, and loaded by the Claude Code plugin (`.claude-plugin/plugin.json` → `./packages/cli/skill/`) | — |
| `.claude-plugin/`, `hooks/hooks.json` | Claude Code plugin + marketplace manifests; hook = the same `--claude-hook` command as `init` (a test keeps them in sync) | — |
| `AGENTS.md`, `INSTALL.md` | Rules file for agents without hooks; per-agent install steps | — |
| `src/guidance.ts` | Per-rule `why` / `recipe` / `avoid` / example / fixability (rules stay pure); `renderExplain` for `fringe explain` | `GUIDANCE`, `renderExplain` |
| `src/prioritize.ts` | Post-pass: `priority`, `cluster`, `fixability` per finding and the `clusters` list; blast radius from import counts | `prioritize` |
| `src/report/plan.ts` | Orders clusters into P0–P3 batches; Markdown and `fringe/plan.v1` | `buildPlan`, `toPlanMarkdown`, `toPlanJson` |
| `src/ledger.ts` | Append JSONL; tolerant reader | `appendRecord`, `readLedger`, `LedgerRecord` |
| `src/report/pretty.ts` | Human formatter (severity-rank + file:line ordering) | `toPretty(result)` |
| `src/report/json.ts` | `fringe/check.v1` | `toJson(result)` |
| `src/report/hook.ts` | `fringe/hook.v1` one-line CI gate; and Claude Code's `{decision,reason}` form | `toHook`, `toClaudeHook` |

## 3. The pipeline

```
runCheck(root)
  ├─ loadConfig(root)                 fringe.config.json → defaults
  ├─ detectStack(root)                StackInfo
  ├─ walk(root, cfg)                  checkable files
  ├─ phase 1: for each file           read → parse by extension → RuleContext
  ├─ gatherTokenColors(root,cfg,cssSources)   once, after walk
  ├─ phase 2: for each context        activeRules(cfg) → findings
  ├─ suppress inline `fringe-ignore` → applyBaseline(fringe.baseline.json)
  ├─ prioritize(findings, sources, critical)    priority, cluster, fixability, clusters[]
  └─ counts → score(counts, weights, files)   → CheckResult (+ clusters, baselined?, suppressed?)
```

**Parsing tiers** (the anti-false-positive strategy):

- **Tier 1 (first-class):** JSX/TSX via real AST — attribute-exact checks (FR-201…207, 209, slop class rules). HTML via parse5 — same `Elem` shape, `class`/`onclick` casing handled per rule. CSS/SCSS via PostCSS — declaration-exact checks (FR-205 CSS leg, FR-304, FR-368 CSS leg, FR-301 CSS counting).
- **Tier 2 (best-effort):** `.vue/.svelte/.astro` templates get source-text rules only (dark patterns, FR-208, FR-215) with empty IR — coverage without over-claiming.
- Unparseable files: `parse-skip:` → `skipped[]`, never a crash.

## 4. Intermediate representation

Rules are pure functions over a deliberately narrow IR — this is what keeps 36 rules independently testable and the maintenance burden flat:

```ts
Elem     { tag, attrs: Record<string,string>, text, loc, parentTag?, parentClass? }
CssDecl  { prop, value, selector, loc }
RuleContext { file, source, elems: Elem[], css: CssDecl[], tokenColors: string[] }
Rule     { id, rung: 2|3, severity, check(ctx): Finding[] }
Finding  { rule, severity, wcag?, message, hint, loc: {file,line,col} }
```

Conventions that matter: attribute values as written (`className` in JSX, `class` in HTML; valueless attrs → `'true'`; non-literal expressions → `'{…}'`: present but unknowable, so name/label rules don't flag `title={t('x')}`; `inLabel` marks any `<label>` ancestor); `text` = trimmed direct text children (JSX recurses into child elements after the Plan-2 fix wave); parent linkage = nearest ancestor element (fragments pass through); `source` always present so text rules work on every tier.

## 5. Severity, scoring, and gating

| Severity | Count | Gates (exit code / hook block)? | Examples |
|---|---|---|---|
| `error` | 8 | **Yes** | FR-201 alt, FR-205 focus, FR-206 onClick-div |
| `review` | 13 | No | FR-208 states heuristic, FR-210…215 |
| `signal` | 15 | No | FR-301 tokens, FR-361…369 slop |

Health: penalty = `(10·e + 3·r + 1·s) × 10 / max(files, 10)` (weights in config); score = `100 − penalty` up to a penalty of 75, then decays as `25·75/penalty` so big repos never pin at 0. Repos under 10 files score exactly as before. The score is **calibrated**, not arbitrary: three committed fixture apps pin the bands (clean 100/zero findings, reference 34 in 25–40, slop 82 in 75–85) — any weight or rule change that moves a band outside tolerance fails CI (`.github/workflows/ci.yml` runs `pnpm test`).

**Agent-loop test (real, `claude -p` + `fringe init`).** First run: the hook fired but the agent ignored it — `fringe/hook.v1` exits 1 with non-Claude JSON, which Claude Code never feeds back. Fix: `--claude-hook` emits `{"decision":"block","reason"}` on exit 0. Second run: the agent received the block, fixed both unlabeled inputs with `aria-label`, and the project ended at 0 errors. One task, one run: evidence the loop works, not a rate.

## 6. Data contracts

**`fringe/check.v1`** (`--json`): `{ schema, stack, files, skipped, findings[{rule,severity,wcag?,message,hint,loc}], counts, score }`

**`fringe/plan.v1`** (`plan --json`): `{ schema, score, counts, batches[{id: P0..P3, title, why, items[{cluster fields, lines, recipe, avoid}], more}] }`.

**Claude Code hook** (`--claude-hook`): nothing when clean; with errors `{"decision":"block","reason":"…"}` on exit 0 — the only form Claude Code feeds back to the agent. **`fringe/hook.v1`** (`--hook`, single line, for CI; exits 1, ignored by Claude Code): `{ schema, errors, review, signals, block: errors>0, reason }` — `reason` names the top finding (`FR-201: … (file:line)`); deterministic ordering (severity rank → file → line).

**Ledger record** (`.fringe/ledger.jsonl`, one JSON per line, append-only):
```json
{ "id": "uuid", "ts": "ISO-8601", "stack": {…}, "files": 12,
  "counts": {"error":0,"review":1,"signal":3}, "score": 94,
  "byRule": {"FR-203":2}, "suppressed": 1,
  "tokenSource": "css-vars",                       // present when configured
  "manifest": { "flows": [ { "action": "cut", "what": "export tab", "evidence": "0 uses in analytics (90d)" } ] },
  "shots": [] }                                     // v2 reservation, unwritten
```

**Agent manifest** (`.fringe/manifest.json`, written by the agent before `--record`): `{ flows: [{ action: 'cut'|'kept', what: string, evidence: string }] }` — the rung-1 *judged* data. Missing/invalid → stderr warning, record continues.

## 7. Error handling & resilience posture

- Unknown flags → stderr warning, ignored. Extra paths → accepted, first wins. Unknown command → exit 2 with hint.
- Internal failures (unreadable root, invalid config, unexpected throw) → one-line stderr, exit 2 — never a stack trace in the agent's face, never conflated with "findings" (exit 1).
- Parse failures → skip + report. Read failures → skip. Tolerant ledger reader counts corrupt lines. `process.exitCode` instead of `process.exit` so piped JSON never truncates.

## 8. Extension recipe — adding a rule

1. Fixtures `fixtures/rules/FR-XXX/{pass,fail}.tsx` (`.css` for CSS legs).
2. Failing test via shared `expectRule` (asserts 0 findings on pass; ≥1 with rule id + severity + loc on fail).
3. `src/rules/frXXX.ts` — pure `check(ctx)`, severity per the rung's contract (rung-2 structural = `error` only if AST-exact; heuristics = `review`; taste = `signal`).
4. Register in `registry.ts` (ID order); tag `wcag` if a criterion applies.
5. If the rule can fire on the reference/slop apps, regenerate goldens and verify by eye; keep calibration bands green.

## 9. Performance & accepted deviations

Honest, documented deviations (tracked for follow-up, not hidden):

- **Sequential parse, no per-file timeout** (spec §3 aspirational): measured fast on fixture-scale and mid-size repos; revisit if real-repo scans exceed seconds.
- **Two-phase contexts retained in memory** (`check.ts`): all `RuleContext`s held simultaneously (source + IR for the whole repo) because token gathering needs the CSS walk first. Fine at v0.1 scale; the tracked restructure is a CSS pre-pass + streaming rule phase. A code comment marks this at the structure.

- **Score saturation (fixed).** Dogfooding showed five of six real projects scoring 0 under the old linear, size-blind penalty. The per-10-files penalty and soft decay now give 12–100 on the same repos.
- **Real-repo false positives fixed (v0.1.1):** `aria-pressed` missing from the allowlist, dynamic `{expr}` children/`title` read as empty, label-wrapped and `hidden` inputs flagged, HTML links wrapping `<div>text</div>` read as nameless. Error-severity false positives dropped about 40% on one app (174 → 1 on pointvault).

## 10. Roadmap architecture

- **Shipped from the original Plan 3/4:** `fringe open` (minimal), the skill, `init`. **Still planned:**
- **Plan 3 — full dashboard:** `packages/dashboard` (Vite + React), served by `fringe open` (tiny local server reading the project ledger) and `fringe board` (cross-project via `~/.config/fringe/projects.json`). Layout approved by mockup: stat strip (health/errors/review/signals/states%), ladder board (three rung columns, judged/verified footed), task story drawer (manifest cuts with evidence, verified results, diff, re-run, handoff Markdown export). The dashboard's own empty/loading/error states are a demo of the product's philosophy.
- **Adapters (only if wanted):** the skill (`packages/cli/skill/SKILL.md`) is plain Markdown and already usable on any platform that reads skill/AGENTS files; per-platform copies would be generated from it by a script with a CI freshness check. Slash commands (`/fringe`, `/fringe-review`) are unbuilt.

## 11. References

- Design spec (historical, v2.1): [superpowers/specs/2026-10-20-fringe-design.md](superpowers/specs/2026-10-20-fringe-design.md)
- Executed plans: [Plan 1 — CLI core](superpowers/plans/2026-10-20-fringe-1-cli-core.md) · [Plan 2 — rung 3 + slop](superpowers/plans/2026-10-20-fringe-2-rung3-slop.md)
- Package README (full rule table, config, hook wiring): [../packages/cli/README.md](../packages/cli/README.md)
- Decisions: [decisions.md](decisions.md) · Test architecture: [test-strategy.md](test-strategy.md)
