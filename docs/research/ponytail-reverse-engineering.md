# Ponytail — Reverse Engineering

**Source:** `github.com/dietrichgebert/ponytail` @ `09c434a` (v5.3.2), cloned and read 2026-10-21. MIT.
**Purpose:** mechanism-level understanding to inform Fringe Plans 3–4 (band, adapters) and the Bangs (content) sibling.

## 0. The model in one paragraph

Ponytail is **~500 words of prompt** (`skills/ponytail/SKILL.md` ≡ `AGENTS.md` + frontmatter + a levels table) wrapped in four engineering layers that turn a prompt into a product: **delivery** (hooks that inject it into 20+ agent hosts, with per-host quirks), **measurement** (a plugin-UI "band" that computes cost/tokens/time *and* a reuse metric via lightweight static analysis, persisted to CSV, rendered as a server-less HTML board), **validation** (a rigorous headless benchmark harness; every rule change is A/B-tested against the previous version), and **hardening** (a thousand issues' worth of never-block, cross-platform robustness). Roughly: 2% prompt, 98% making the prompt reliable, visible, and installable.

## 1. Layer 1 — The prompt (what actually changes agent behavior)

Five load-bearing mechanisms, in the order they execute:

| Mechanism | Text | Why it works |
|---|---|---|
| **Scope by blast radius** | "Read the task and the code it touches. List every place your change must reach… That is scope. Extra features are not." | Redefines scope as the real change's reach, not the imaginable feature space |
| **The ladder** — ordered search, first rung that fully works wins | 1 need to exist? 2 already in codebase? 3 stdlib/platform? 4 installed dep? 5 one glanceable line? 6 minimum code | An algorithm, not advice; rung 1 forces *naming* cuts in one line |
| **Never-cut floors** | validation at trust boundaries, data-loss handling, security, accessibility, hardware calibration, anything asked for | Makes laziness safe; the part most YAGNI prompts omit |
| **Risk-keyed test trigger** | "Lazy code without its check is unfinished": branch, loop, parser, money/security, new script/app → one small test or assert | A cheap classifier for "risky logic" — the exact thing the 98% benchmark measures |
| **Mandatory disclosure** | "End your reply with one or two lines: what you skipped or did not check, and any risk" | A forcing function: cutting silently becomes impossible |

Secondary: `shortcut: <the limit>, <when to upgrade>` comment protocol (collected by `/ponytail-debt`); "grep every caller, fix the root cause once"; "between equal options, the one correct on edge cases"; "a one-liner that needs decoding is not short."

**The author's own map of what's load-bearing** is in `scripts/check-rule-copies.js` — a canary list of phrases that must survive verbatim in both SKILL.md and AGENTS.md: `in this codebase` (#217), `grep every caller` (#245), `never about the change itself`, `shortcut: <the limit>, <when to upgrade>`, `correct on edge cases`, `Lazy code without its check is unfinished`, and each never-cut carve-out. Issue numbers show rules were *added from user reports*.

**Levels are textual filtering, not separate prompts.** The levels table rows (`| **lite** |`…) and worked examples (`- lite: "…"`) are keyed by mode name; `ponytail-instructions.js` filters SKILL.md line-by-line at injection time. One source, three intensities. Fallback: if SKILL.md is unreadable, an inlined copy of AGENTS.md.

## 2. Layer 2 — Delivery (how 500 words reach 20 hosts)

### 2.1 Hook wiring (Claude Code & Codex share `claude-codex-hooks.json`)

| Event | Script | Does |
|---|---|---|
| `SessionStart` (startup\|resume\|clear\|compact) | `ponytail-activate.js` | writes mode flag file (`~/.claude/.ponytail-active`), emits the level-filtered ruleset as hidden context, **appends a codebase map**, nudges statusline setup once; on `compact` keeps the live level instead of resetting |
| `SubagentStart` | `ponytail-subagent.js` | injects the ruleset into subagents too |
| `UserPromptSubmit` | `ponytail-mode-tracker.js` | **parses `/ponytail …` out of the raw prompt text**: switches level (flag file), `default <mode>` persists to config, `band on\|off\|import`, detects natural-language deactivation ("stop ponytail", "normal mode"); Qoder (no SessionStart) gets the ruleset injected every prompt |

Cursor and Copilot wire the same two scripts to their `sessionStart`/`beforeSubmitPrompt`-style events. Cursor with an always-on rule file gets a one-line notice instead of a second ruleset copy (#817) — hooks can't override rules there.

### 2.2 The codebase map (`ponytail-map.js`) — the unsung piece

A **2000-character regex index** of top-level functions/classes/exports per folder (`git ls-files` + one regex per language; tests/vendored/generated skipped; shared dirs — utils/lib/services/components/hooks — listed first when the budget is tight), run with a 3 s timeout, fail-open. Injected at session start so ladder rung 2 ("already in this codebase?") costs the agent **zero search**. The agent cannot reuse what it doesn't know exists; this is what makes the reuse rung real. Self-annotated: *"regex, not a parser… tree-sitter is the upgrade."*

### 2.3 State & control

- Mode = a flag file per host config dir (`.ponytail-active` containing lite/full/ultra); `off` clears it. Default via `~/.config/ponytail/config.json` or `PONYTAIL_DEFAULT_MODE`.
- A **statusline badge** (`[PONYTAIL]`, `[PONYTAIL:ULTRA]`) reads the flag; the script is *copied into the config dir* because the plugin cache dir is versioned and deleted on update (#1032).
- `/ponytail-review` is deliberately **not** a level — matching it once latched a bogus "review" mode for whole sessions (#736).

### 2.4 Two-tier adapter model, verified not generated

| Tier | Hosts | Gets |
|---|---|---|
| Skill-capable (hooks + commands) | Claude Code, Codex, Copilot CLI, OpenCode (npm `main`), Pi, Hermes (Python `__init__.py`), Qoder, Kimi, Grok, Devin, OpenClaw, Gemini | ruleset injection + `/ponytail*` commands + level switching |
| Instruction-only | Cursor `.mdc`, Windsurf, Cline, Kiro steering, Copilot instructions, `.agents/rules`, Qoder rules | the always-on AGENTS.md body |

**Sync is a drift test, not generation**: `check-rule-copies.js` byte-compares seven compact copies against AGENTS.md (frontmatter stripped) and asserts the canary phrases exist in SKILL.md and AGENTS.md. Comment: *"Upgrade path: generate the copies from SKILL.md if this ever misses a real drift."* `check-versions.js` pins version numbers across manifests. Codex commands are TOML (`commands/*.toml`) with a compressed prompt. 22 `node:test` files test adapters and hooks themselves (plugin manifests, Windows hook behavior, gemini extension, uninstall).

## 3. Layer 3 — Measurement (the band & board)

Built on the **Claude Code plugin-UI SDK** (`import { atom, read, update } from 'claude-code'`; `hooks/band/register.tsx` loaded via `claude-band.json` `"modules"`; requires Claude Code ≥ 2.1.290). Not a hook — a module with event subscriptions:

| Event | Computes |
|---|---|
| `session.start` / `command.run` (new session after `/clear`) | project, session id, cost baseline, **`git grep` of definitions → map of known names** |
| `tool.call` for `Edit`/`Write` | `addedLines(before, after)` → `callsIn()` = existing names the new code calls (**reused**) vs new definitions (**created**); `duplicateOf()` = new def whose normalized name matches an existing one (`format_price` vs `formatPrice` → re-invention); **removed**; **openCallers** (callers of touched functions not yet updated) |
| `tool.call` for Bash matching a test-runner regex | parses pass/fail counts; `tests.state` ∈ none/pass/fail/**stale** (stale when code changed after the last run) |
| `turn.complete` | `$.session.usage()` → cost, tokens (input/output/cacheRead/cacheWrite), turn cost sparkline (last 20), agent busy time, main model (grep of transcript), session title (transcript `custom-title` records); **upserts the task's CSV row**; optional webhook |

**Reuse% = reused / (reused + created)**, undefined below 3 (shortcut-annotated). This is lightweight static analysis — ponytail measures *process quality*, not only economy.

**Storage:** `~/.config/ponytail/band/<project>.csv`, one row per session, header `key,started,project,name,cost_usd,turns,agent_minutes,tokens_total,tokens_output,reuse_pct,reused,new,callers_open,tests,level,model`. `band import` backfills from past transcripts in a detached process.
**Board:** `boardHtml()` — a **single self-contained HTML page** (inline CSS/SVG/script, no server, no network) built from the CSVs.
**Privacy:** nothing leaves the machine unless a webhook URL is set (https-only except localhost; token in system keychain; task names optional).

## 4. Layer 4 — Validation

**Agentic benchmark** (`benchmarks/agentic/`, results `2026-10-07-agentic.md`): headless `claude -p` with `--plugin-dir`, Opus 5.5, 39 tasks × 5 runs × 3 arms (Ponytail 5, v4.13, none) = 585 sessions, arms interleaved task-by-task so drift hits all equally; fresh temp folder per session with CLAUDE.md/memory off; **Bash disabled** ("measures what the agent writes, not what it can debug"); transcripts inspected to prove injection. Tasks: 12 feature tickets on a real FastAPI+React repo (scored on `git diff`), 18 surgical tasks with **hidden checks** (security/privacy/refunds/renames), 9 open-scope builds. Statistics: per-task median → ratio vs baseline → geometric mean with 95% bootstrap CI; sign tests for "better on X of Y". A gzip "code information" metric guards against line-golfing; a blind Opus **completeness judge** (self-tested) checks shorter code still does the whole job.

**Governance:** *"every change to the rules had to beat the current version in a paired run, one change at a time"* — rule edits are A/B tested. The README retracts its own earlier single-shot numbers as overstated (#126) and links independent benchmarks with caveats.

**Earlier harness:** promptfoo configs (single-shot, three models, `loc.js` deterministic LOC metric, `correctness.js`, `behavior.yaml`) vs the "caveman" competitor — kept for history.

## 5. Layer 5 — Hardening (the invisible 98%)

Patterns repeated across every hook: the **never-block contract** (stdin `end`/`error`/1 s ref'd fallback timer — Windows PowerShell wrappers swallow piped JSON and hung sessions, #443/#790); UTF-8 BOM stripping; EPIPE silenced; silent-fail everywhere ("flag is best-effort"); `isShellSafe()` so config paths with metacharacters never reach a shell snippet (#200); versioned-cache-dir deletion handled by copying scripts out (#1032); 3 s map budget inside the 15 s hook limit (#1079, #1157); one-JSON-per-invocation discipline on hosts that choke on two.

## 6. Distribution & release

npm `@dietrichgebert/ponytail` (OpenCode plugin is the `main`; files whitelist ships hooks/skills/adapters); GitHub Actions **trusted publishing via OIDC** with provenance, tests gate publish; i18n READMEs (es/ja/ko/zh-CN); `examples/` are before/after showcases (335-line date picker → 10 lines) doubling as marketing; authenticity warning (only this repo / this npm name; never ships binaries).

## 7. What's load-bearing, ranked

1. The ladder as an ordered search + "that is scope" (the behavior change).
2. Never-cut floors (what keeps it safe).
3. Mandatory disclosure line (what keeps it honest).
4. The codebase map (what makes reuse real).
5. The band's reuse/duplicate/stale-test metrics (what makes the value visible — and partly *verified*).
6. The benchmark + paired A/B governance (what makes it credible).
7. Everything else: distribution breadth and hardening (what makes it adoptable).

## 8. Corrections to earlier Fringe-side analysis

- **Wrong:** "the band measures only proxy economics." **Right:** it also measures reuse, re-invention, open callers, and test staleness via static analysis — it verifies ladder rungs 2 and the test rule at runtime. Fringe's verified/judged idea is not a gap ponytail lacks entirely; it is a *generalization* of what the band already does for reuse.
- **Wrong (planned):** adapters should be *generated* by a build script. **Ponytail's reality:** hand-maintained copies + a CI drift test + phrase canaries, with generation explicitly deferred. Cheaper, and good enough at 20 hosts.
- **Underweighted:** the codebase map. A reuse-first rule without an index of what exists is aspirational.

## 9. Implications for Fringe (Plans 3–4)

- **Band, not just dashboard.** The plugin-UI SDK (`tool.call` on Edit/Write, `turn.complete`) lets a *Fringe band* run `fringe check --hook` after each edit and show health / errors / rung coverage live above the prompt — the dashboard's stat strip, in-session. Plan 3 should include it.
- **Adopt the drift-test adapter model** for Plan 4 with canary invariants (Rule Zero phrasing, never-skip list) — defer generation.
- **Textual level filtering**: write SKILL.md with a levels table keyed `lite/full/ultra` and filter at injection; one source.
- **A content/UI "map" analog**: inject a design-token/component index at session start so rung 3 "use the existing token/component" costs no search.
- **A/B every rule-text change** against the previous skill version in a headless harness; retract overstated numbers publicly.
- **Never-block hooks**: copy the stdin/timer/BOM/EPIPE discipline verbatim.

## 10. Implications for Bangs (content sibling)

- The skill is the heart (ladder + floors + disclosure), delivered by the same hook plumbing; the checker verifies it — skill and checker together from Plan 1.
- Content ladder analog of rung 2 "already in this codebase": **"already said in this piece / already in the corpus"** — needs a *content map* (headings/claims index) injected at session start.
- `claim: <assertion>, <how to verify>` mirrors `shortcut:`; `/bangs-debt` collects unverified claims.
- Band metrics for writing: words cut, reading time, slop density, source coverage, duplicate-claim detection — economy plus quality.
