# Fringe Plan 2 — Rung 3, Slop Catalog, Tokens, WCAG Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `fringe check` with the rung-3 polish layer: 5 token/scale/contrast rules (FR-301–305), a 9-rule slop catalog (FR-361–369), the FR-215 generic-error-copy review, WCAG 2.1 criterion tags on a11y findings, token-source declaration, a slop-app golden snapshot, and the score-calibration corpus.

**Architecture:** Same rule pipeline as Plan 1 (pure rules over `RuleContext`). Two IR extensions: `Elem` gains `parentTag`/`parentClass` (enables structural slop rules) and `RuleContext` gains `tokenColors` (project-wide palette gathered once in `check.ts` from the declared token source). New `src/color.ts` utility powers FR-304. All rung-3 rules are severity `signal` except FR-215 (`review`) per spec §3.

**Tech Stack:** unchanged — TypeScript strict, ESM, Node ≥ 18, vitest, zero new runtime deps.

## Global Constraints (inherited + new)

- All Plan-1 constraints still bind: TS strict, ESM `.js` imports, Node ≥ 18 engines, package `@fringetool/cli` (bin `fringe`), TDD per task (failing test → implement → pass → commit), pristine test output, run tests from `packages/cli` via `pnpm vitest run <file>` / `pnpm test`.
- Runtime deps remain exactly `@babel/parser@^7`, `postcss`, `parse5`. No new deps.
- Rule severities: rung 3 = `signal` (informational); FR-215 = `review`. Rung-2 rules and severities must not change behavior (golden regression rules, Task 13).
- `Finding` gains optional `wcag?: string` (criterion id like `"1.1.1"`); `Elem` gains optional `parentTag?: string; parentClass?: string`; `RuleContext` gains `tokenColors: string[]`; `FringeConfig` gains optional `tokenSource?: { kind: 'css-vars' | 'theme-factory' | 'design-tokens-json'; path?: string }`. Exact shapes in Task interfaces; later tasks use these names verbatim.
- Fixtures live at repo `fixtures/rules/<FR-XXX>/{pass,fail}.tsx` (`.css` where the rule is CSS-leg) using the shared `tests/helpers.ts` (`expectRule`/`fixture`/`ctxOf`/`FIXTURES`). New rules follow the established rule-file shape (see `packages/cli/src/rules/fr205.ts`).
- Every rule task: fixtures first, failing test via `expectRule`, implementation, register in `registry.ts` (ID order), full suite green, commit `feat(cli): <rule ids> ...`.
- Health score weights unchanged: `100 − (10×error + 3×review + 1×signal)` — new signals move scores; Task 13/14 pin the new expected values.

## File Structure (final state of this plan)

```
packages/cli/src/
  types.ts                      Elem +parentTag/parentClass; RuleContext +tokenColors; Finding +wcag; FringeConfig +tokenSource
  color.ts                      NEW — parse color strings, relative luminance, contrast ratio
  tokens.ts                     NEW — gather project token colors per tokenSource
  check.ts                      gather tokenColors once; pass into RuleContext
  config.ts                     parse/validate tokenSource
  rules/fr301.ts … fr305.ts     NEW rung-3 rules
  rules/fr215.ts                NEW generic error copy
  rules/fr361.ts … fr369.ts     NEW slop catalog
  rules/registry.ts             grows to 29 rules
  parse/jsx.ts, parse/html.ts   parent linkage
fixtures/
  rules/FR-301..FR-369, FR-215/ per-rule pass/fail
  slop-app/                     NEW rung-3 golden app
  calibration/clean-app/        NEW zero-violation app
packages/cli/tests/
  color.test.ts tokens.test.ts rules-rung3-*.test.ts rules-slop-*.test.ts fr215.test.ts
  wcag.test.ts slop-golden.test.ts calibration.test.ts
```

---

### Task 1: Elem parent linkage

**Files:**
- Modify: `packages/cli/src/types.ts` (Elem), `packages/cli/src/parse/jsx.ts`, `packages/cli/src/parse/html.ts`
- Test: `packages/cli/tests/parent-link.test.ts`

**Interfaces:**
- Produces: `Elem.parentTag?: string; parentClass?: string` — tag and `className`/`class` attr of the nearest ancestor JSXElement/HTML element; absent (undefined) for top-level elements. Later tasks (FR-363) consume `parentClass`.
- Existing Elem consumers unaffected (optional fields).

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseJsx } from '../src/parse/jsx.js';
import { parseHtml } from '../src/parse/html.js';

describe('parent linkage', () => {
  it('jsx attaches parent tag and class', () => {
    const els = parseJsx('a.tsx', 'const x = <div className="card"><button className="btn">Go</button></div>;');
    const btn = els.find((e) => e.tag === 'button')!;
    expect(btn.parentTag).toBe('div');
    expect(btn.parentClass).toBe('card');
    expect(els.find((e) => e.tag === 'div')!.parentTag).toBeUndefined();
  });
  it('html attaches parent tag and class', () => {
    const els = parseHtml('a.html', '<div class="card"><a href="#">x</a></div>');
    expect(els.find((e) => e.tag === 'a')!.parentClass).toBe('card');
  });
});
```

- [ ] **Step 2: Verify fail** — `pnpm vitest run tests/parent-link.test.ts` → FAIL (`parentTag` undefined).
- [ ] **Step 3: Implement.** In `jsx.ts`: thread a parent through the walker — replace the bare `walkNode(node)` recursion with `walkNode(node, parent?: { tag: string; attrs: Record<string, string> })`; when pushing an `Elem`, set `parentTag: parent?.tag, parentClass: parent?.attrs?.className` (skip when undefined so the fields are absent). Recursive calls pass `{ tag, attrs }` for JSXElement nodes and the existing parent otherwise. In `html.ts`: same with `attrs.class`. Add the two optional fields to `Elem` in `types.ts`.
- [ ] **Step 4: Verify pass + full suite green** (existing parser tests unaffected).
- [ ] **Step 5: Commit** — `git commit -am "feat(cli): Elem parent linkage for structural rules"`

### Task 2: Color utilities

**Files:**
- Create: `packages/cli/src/color.ts`
- Test: `packages/cli/tests/color.test.ts`

**Interfaces:**
- Produces: `parseColor(s: string): { r: number; g: number; b: number } | null` — accepts `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()` (percentages in hsl); trims whitespace; case-insensitive; null when unparseable.
- `relativeLuminance({r,g,b}): number` (WCAG formula: sRGB linearization then `0.2126R+0.7152G+0.0722B`).
- `contrastRatio(a, b): number` — `(L1+0.05)/(L2+0.05)` with L1 ≥ L2.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseColor, contrastRatio, relativeLuminance } from '../src/color.js';

describe('color utils', () => {
  it('parses hex and rgb forms', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('rgb(0, 128, 255)')).toEqual({ r: 0, g: 128, b: 255 });
    expect(parseColor('rgba(0,128,255,1)')).toEqual({ r: 0, g: 128, b: 255 });
    expect(parseColor('hsl(240, 100%, 50%)')).toEqual({ r: 0, g: 0, b: 255 });
    expect(parseColor('var(--x)')).toBeNull();
    expect(parseColor('red')).toBeNull(); // v1: named colors unsupported, honestly
  });
  it('WCAG contrast anchors', () => {
    expect(contrastRatio(parseColor('#000000')!, parseColor('#ffffff')!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseColor('#777777')!, parseColor('#ffffff')!)).toBeCloseTo(4.48, 1);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 2: Verify fail** → FAIL.
- [ ] **Step 3: Implement** — regex parsers per form; hsl→rgb conversion; `relativeLuminance` per WCAG 2.x formula (`c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4` on each normalized channel); `contrastRatio` as specified. Pure functions, no deps.
- [ ] **Step 4: Verify pass; full suite.**
- [ ] **Step 5: Commit** — `git commit -am "feat(cli): WCAG color utilities"`

### Task 3: Token source (config + gathering + RuleContext)

**Files:**
- Modify: `packages/cli/src/types.ts` (RuleContext + FringeConfig), `packages/cli/src/config.ts`, `packages/cli/src/check.ts`
- Create: `packages/cli/src/tokens.ts`
- Test: `packages/cli/tests/tokens.test.ts`, extend `tests/config.test.ts`

**Interfaces:**
- Produces:
  - `FringeConfig.tokenSource?: { kind: 'css-vars' | 'theme-factory' | 'design-tokens-json'; path?: string }` — validated by `loadConfig` (kind must be one of the three; path required for `design-tokens-json`; invalid → thrown Error mentioning `fringe.config.json`).
  - `gatherTokenColors(root: string, cfg: FringeConfig, cssSources: Array<{ file: string; source: string }>): string[]` — token color VALUES found: for `css-vars`/`theme-factory`, every `--*` custom-property declaration in the project's CSS/SCSS files whose value `parseColor` accepts; for `design-tokens-json`, recursive walk of the JSON at `path` collecting `$value` strings that parse as colors. Deduped.
  - `RuleContext.tokenColors: string[]` — filled by `check.ts` (gathered once before the file loop; empty array when no tokens found).
- `check.ts` change: collect `cssSources` during the existing walk (CSS files' `{file, source}`), call `gatherTokenColors` after the walk, pass `tokenColors` into every `RuleContext`.

- [ ] **Step 1: Failing tests** — `tokens.test.ts`: css-vars fixture (a temp dir with `styles.css` containing `--brand: #0b5fff; --pad: 16px;` → gather returns `['#0b5fff']`); design-tokens-json fixture (temp JSON `{"color": {"brand": {"$value": "#ff0000"}}, "space": {"1": {"$value": "4px"}}}` at path → `['#ff0000']`); no-token dir → `[]`. Config test: valid tokenSource parses through; `kind: 'nope'` throws mentioning `fringe.config.json`; `design-tokens-json` without path throws.
- [ ] **Step 2: Verify fail** → FAIL.
- [ ] **Step 3: Implement** — `tokens.ts` per interfaces (regex `/--[\w-]+\s*:\s*([^;}]+)/g` over CSS sources, filter by `parseColor !== null`, collect the VALUE string as written, dedupe); config validation in `loadConfig`'s validation block; `check.ts` wiring as described.
- [ ] **Step 4: Verify pass; full suite (existing check tests need `tokenColors: []` default — update RuleContext literals in tests/helpers.ts `ctxOf` to include `tokenColors: []`).**
- [ ] **Step 5: Commit** — `git commit -am "feat(cli): token source declaration and gathering"`

### Task 4: FR-304 contrast rule

**Files:**
- Create: `packages/cli/src/rules/fr304.ts`; register.
- Test + fixtures: `fixtures/rules/FR-304/{pass,fail}.css`, `tests/rules-rung3-core.test.ts`

- [ ] **Step 1: Fixtures** — pass: `/* ok */ .a { color: #333333; background-color: #ffffff }\n.b { color: #777777; background-color: #ffffff }` — wait, `#777` on white is 4.48 — use `#767676` (4.54:1, the canonical AA edge) for pass; fail: `.a { color: #999999; background-color: #ffffff }` (2.85:1). Final: pass = `#333333` on `#ffffff` and `#767676` on `#ffffff`; fail = `#999999` on `#ffffff`.
- [ ] **Step 2: Failing test** via `expectRule(fr304, 'FR-304')` (CSS ctx helper like fr205's `cssCtxOf`, copied locally into the new test file) + assert the finding message contains the computed ratio and severity `'signal'` and `wcag === '1.4.3'` (tag lands in Task 12 — write the assertion then; for now assert severity).
- [ ] **Step 3: Implement** — group `ctx.css` by selector; when one selector's decls contain `color: X` and (`background-color: Y` or `background` whose value parses as a color) with both `parseColor` non-null → `contrastRatio` < 4.5 → one finding per selector: message `contrast ${x} on ${y} is ${ratio}:1 (< 4.5:1)`, hint `darken the text or lighten the background to reach AA 4.5:1`, loc = color decl loc. Skip when either color has alpha < 1 (can't compute over unknown backdrop).
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-304 contrast rule`

### Task 5: FR-301 token adoption

**Files:**
- Create: `packages/cli/src/rules/fr301.ts`; register.
- Fixtures: `fixtures/rules/FR-301/{pass,fail}.tsx`; test in `tests/rules-rung3-core.test.ts`

- [ ] **Step 1: Fixtures** — pass: `<button className="bg-slate-900 text-slate-50">Go</button>` (Tailwind palette classes = token usage, zero hardcoded). fail: `<div className="bg-[#0b5fff] text-[#333333] border-[#e5e7eb] rounded-xl p-4">Card</div>` (3 arbitrary hex, 0 tokens).
- [ ] **Step 2: Failing test** — `expectRule(fr301, 'FR-301')` with `ctxOf` extended locally to pass `tokenColors: ['#0b5fff']`; fail case asserts exactly 1 file-level finding, severity `signal`.
- [ ] **Step 3: Implement** — count in the file: `hardcoded` = occurrences of Tailwind arbitrary color utilities `/\b(?:bg|text|border|from|to|via|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g` over `ctx.source` plus CSS `color`-ish declarations (`color|background|border.*color` props) whose value `parseColor` accepts; `tokenUses` = occurrences of `/var\(--/` plus Tailwind palette utilities `/\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g`. Finding (single, file-level) when `hardcoded > 3 && hardcoded > tokenUses`: message `${hardcoded} hardcoded colors vs ${tokenUses} token uses in this file`, hint `use design tokens / Tailwind palette instead of raw hex (tokenSource: ${ctx.tokenColors.length} colors found)`, loc line 1.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-301 token adoption rule`

### Task 6: FR-302/303 off-scale rules

**Files:**
- Create: `packages/cli/src/rules/fr302.ts`, `fr303.ts`; register both.
- Fixtures: `fixtures/rules/FR-302/{pass,fail}.tsx`, `FR-303/{pass,fail}.tsx`; test in `tests/rules-rung3-core.test.ts`

- [ ] **Step 1: Fixtures** — FR-302 pass: `<p className="text-base">Hi</p>`; fail: `<p className="text-[17px]">Hi</p>`. FR-303 pass: `<div className="p-4">x</div>`; fail: `<div className="p-[13px] gap-[9px]">x</div>`.
- [ ] **Step 2: Failing tests** via `expectRule` ×2 (assert severity `signal`).
- [ ] **Step 3: Implement** — FR-302: per-elem, className matches `/\btext-\[[^\]]+\]/` → finding `font size off the type scale: ${match}`, hint `use the type scale (text-xs..text-6xl) or extend the theme`. FR-303: same for `/\b(?:p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|gap|w|h)-\[[^\]]+\]/` → `spacing/dimension off the scale: ${match}`, hint `use spacing scale utilities (1 unit = 0.25rem) or extend the theme`.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-302/303 scale rules`

### Task 7: FR-305 hit areas

**Files:**
- Create: `packages/cli/src/rules/fr305.ts`; register.
- Fixtures: `fixtures/rules/FR-305/{pass,fail}.tsx`; test in `tests/rules-rung3-core.test.ts`

- [ ] **Step 1: Fixtures** — pass: `<button className="text-sm py-2 px-3">Go</button>`; fail: `<a className="text-xs" href="/x">details</a>`.
- [ ] **Step 2: Failing test** — `expectRule(fr305, 'FR-305')`, severity `signal`.
- [ ] **Step 3: Implement** — elems `button`/`a` with className containing `text-xs` and NOT matching `/(?:^|\s)(?:p|py)-([2-9]|10)\b/` → finding `tiny hit area: text-xs interactive element without adequate padding`, hint `add py-2+ padding or a larger text size (WCAG 2.5.8 target size)`, loc = elem loc.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-305 hit-area rule`

### Task 8: Text slop rules — FR-367, FR-368, FR-369

**Files:**
- Create: `packages/cli/src/rules/fr367.ts`, `fr368.ts`, `fr369.ts`; register all.
- Fixtures: `fixtures/rules/FR-367/{pass,fail}.tsx`, `FR-368/{pass,fail}.tsx`, `FR-369/{pass,fail}.tsx`
- Test: `tests/rules-slop-text.test.ts`

- [ ] **Step 1: Fixtures** —
FR-367 pass: `<span className="text-xs">Section</span>`; fail: `<span className="text-xs">01 Discover</span>`
FR-368 pass: `<div className="bg-gradient-to-r from-emerald-500 to-teal-400">x</div>`; fail: `<div className="bg-gradient-to-r from-violet-600 to-indigo-500">x</div>`
FR-369 pass: `<h2>Shipping</h2>`; fail: `<h2>🚀 Shipping</h2>`
- [ ] **Step 2: Failing tests** via `expectRule` ×3, severity `signal`.
- [ ] **Step 3: Implement** —
  - FR-367: elems with `/text-(xs|sm)/` in className AND `/^\d{1,2}\s+\S+/` test on `e.text` → `numbered section label ("01 Discover" style)`, hint `let hierarchy come from typography, not index numbers`.
  - FR-368: per-elem className matching `/bg-gradient-to-\w+/` AND `/from-(violet|purple|indigo|fuchsia)-\d{3,4}/`; plus CSS decls `background.*linear-gradient` whose value matches `/#(8b5cf6|a78bfa|7c3aed|818cf8|6366f1|9333ea|c084fc)/i` → `the purple AI gradient`, hint `pick a palette that isn't the LLM default`.
  - FR-369: elems `/^h[1-6]$/` with `/\p{Extended_Pictographic}/u` test on `e.text` → `emoji in heading`, hint `emoji in headings read as template output; use typography instead`.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-367/368/369 text slop rules`

### Task 9: Class-shape slop rules — FR-361, FR-362, FR-365

**Files:**
- Create: `packages/cli/src/rules/fr361.ts`, `fr362.ts`, `fr365.ts`; register all.
- Fixtures: `fixtures/rules/FR-361/{pass,fail}.tsx`, `FR-362/{pass,fail}.tsx`, `FR-365/{pass,fail}.tsx`
- Test: `tests/rules-slop-shape.test.ts`

- [ ] **Step 1: Fixtures** —
FR-361 pass: `<h1 className="text-4xl font-sans">Title</h1>`; fail: `<h1 className="text-4xl italic font-serif">Title</h1>`
FR-362 pass: `<span className="text-xs uppercase">Docs</span>`; fail: `<span className="text-xs uppercase tracking-widest rounded-full bg-slate-100 px-3">Introducing v2</span>`
FR-365 pass: `<div className="border shadow-sm">x</div>`; fail: `<div className="border shadow-2xl p-6 rounded-xl">x</div>`
- [ ] **Step 2: Failing tests** via `expectRule` ×3, severity `signal`.
- [ ] **Step 3: Implement** —
  - FR-361: className has `/italic/` AND `/(?:font-)?serif/` AND `/text-(3xl|4xl|5xl|6xl)/` → `italic serif display type — the AI-tell headline`, hint `choose a display treatment that isn't italic serif`.
  - FR-362: className has `/uppercase/` AND `/tracking-(widest|wider)/` AND `/rounded-full/` AND text length ≤ 40 → `hero eyebrow chip`, hint `eyebrow chips above headings are a template tell; integrate context into the heading`.
  - FR-365: className matches `/(?:^|\s)border(?:-\d)?\b/` AND `/shadow-(xl|2xl)\b/` → `thin border with wide shadow`, hint `pair elevation with weight: heavier border or tighter shadow`.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-361/362/365 class-shape slop rules`

### Task 10: Structural slop rules — FR-363, FR-364, FR-366

**Files:**
- Create: `packages/cli/src/rules/fr363.ts`, `fr364.ts`, `fr366.ts`; register all.
- Fixtures: `fixtures/rules/FR-363/{pass,fail}.tsx`, `FR-364/{pass,fail}.tsx`, `FR-366/{pass,fail}.tsx`
- Test: `tests/rules-slop-structural.test.ts`

- [ ] **Step 1: Fixtures** —
FR-363 pass: `<div className="rounded-xl border p-4"><p className="rounded-lg bg-slate-50 p-2">x</p></div>` (inner has bg+rounded but no border → not card-in-card by the detector); fail: `<div className="rounded-xl border p-4"><div className="rounded-lg border p-2">x</div></div>`
FR-364 pass: one tile `<div className="rounded-xl bg-slate-100 p-4 flex items-center justify-center"></div>`; fail: three such elements in one file (file-level signal).
FR-366 pass: two chips `<span className="rounded-full px-2 text-xs">beta</span>`; fail: five chips in one file.
- [ ] **Step 2: Failing tests** via `expectRule` ×3, severity `signal` (FR-364/366 assert exactly 1 file-level finding on fail).
- [ ] **Step 3: Implement** —
  - FR-363: cardish = (cls) => `/rounded-(lg|xl|2xl)/.test(cls) && (/(?:^|\s)border/.test(cls) || /shadow-/.test(cls) || /bg-/.test(cls))`; elems where `cardish(cls) && parentClass && cardish(parentClass)` → `card inside a card`, hint `one containment level: let whitespace, not boxes, group content`. Loc = elem loc.
  - FR-364: file-level — count elems with `/rounded-(lg|xl|2xl)/` + `/bg-/` + `/flex/` + text === '' ; ≥ 3 → single finding `icon-tile stack (${n} tiles)`, hint `rows of icon tiles with verb labels are a landing-page tell`, loc line 1.
  - FR-366: file-level — elems with `/rounded-full/` + `/(?:px-2|px-2\.5|text-xs)/` + non-empty text; ≥ 5 → single finding `status-chip soup (${n} chips)`, hint `chips everywhere dilute meaning; reserve them for state`, loc line 1.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-363/364/366 structural slop rules`

### Task 11: FR-215 generic error copy

**Files:**
- Create: `packages/cli/src/rules/fr215.ts`; register (after fr214).
- Fixtures: `fixtures/rules/FR-215/{pass,fail}.tsx`; test `tests/fr215.test.ts`

- [ ] **Step 1: Fixtures** — pass: `{isError ? <p>Couldn't load the list. <button onClick={retry}>Try again</button></p> : null}` wrapped with a fetch marker (`const { data, isError } = useQuery(...)`); fail: same context but `<p>Something went wrong</p>` with no retry/action words.
- [ ] **Step 2: Failing test** — `expectRule(fr215, 'FR-215')` + assert severity `'review'` (not signal).
- [ ] **Step 3: Implement** — file-level: `/(isError|\berror\b|catch)/.test(source)` AND `/something went wrong|an error occurred|oops|whoops/i.test(source)` AND NOT `/(retry|try again|reload|contact support|support team)/i` → single finding `generic error copy with no recovery action`, hint `tell users what failed and give them a next step (retry, link, contact)`, loc line 1.
- [ ] **Step 4: Verify; full suite; commit** — `feat(cli): FR-215 generic error copy rule`

### Task 12: WCAG criterion tags

**Files:**
- Modify: `packages/cli/src/types.ts` (`Finding.wcag?: string`), rule files fr201–207, fr209, fr304, fr305 (attach `wcag` to findings)
- Test: `packages/cli/tests/wcag.test.ts`

**Interfaces:** tags exactly: FR-201→`'1.1.1'`, FR-202→`'4.1.2'`, FR-203→`'3.3.2'`, FR-204→`'1.3.1'`, FR-205→`'2.4.7'`, FR-206→`'2.1.1'`, FR-207→`'2.4.3'`, FR-209→`'4.1.2'`, FR-304→`'1.4.3'`, FR-305→`'2.5.8'`.

- [ ] **Step 1: Failing test** — for each tagged rule, run its fail fixture via `expectRule`-style ctx and assert every finding's `wcag` equals the expected criterion; assert fr208/fr215/slop rules leave `wcag` undefined.
- [ ] **Step 2: Verify fail** → FAIL (`wcag` undefined).
- [ ] **Step 3: Implement** — add `wcag: '<id>'` to each listed rule's finding objects + the optional field in `Finding`.
- [ ] **Step 4: Verify; full suite (golden test unaffected — snapshot uses rule:file:line strings only); commit** — `feat(cli): WCAG 2.1 criterion tags on a11y findings`

### Task 13: Slop app + goldens

**Files:**
- Create: `fixtures/slop-app/package.json`, `src/Landing.tsx`, `styles.css`; `packages/cli/tests/slop-golden.test.ts` + snapshot
- Modify: `packages/cli/tests/golden.test.ts` (regenerate — expected changes below)

**Interfaces:** slop-app plants exactly one trigger for each: FR-301 (≥4 hardcoded hex), FR-302, FR-303, FR-304 (CSS bad pair), FR-305, FR-361, FR-362, FR-363, FR-364 (3 tiles), FR-366 (5 chips), FR-367, FR-368 (Tailwind + CSS legs), FR-369, FR-215 — and is otherwise rung-2 clean.

- [ ] **Step 1: Write slop-app fixtures deliberately** — a realistic "AI landing page" (`Landing.tsx`: purple gradient hero with italic-serif h1 + eyebrow chip, 3 icon tiles, 5 status chips, "01 / 02 / 03" sections, emoji heading, text-[17px], p-[13px], text-xs link, nested cards, border+shadow-2xl card, "Something went wrong" block inside an isError branch, hardcoded hexes) + `styles.css` (`#999999` on `#ffffff` pair, a purple linear-gradient). `package.json` with react+tailwindcss deps.
- [ ] **Step 2: Failing golden test** — `slop-golden.test.ts` mirroring `golden.test.ts` (runCheck over slop-app, snapshot `rule:file:line` + counts + score).
- [ ] **Step 3: Generate with `-u`, then verify BY EYE** — every planted trigger appears (15 rule families listed above; FR-364/366/368 single findings), no rung-2 errors (slop app must be rung-2 clean — if FR-2xx fires, fix the fixture, not the expectation), counts/score recorded. The snapshot is only accepted after this enumeration.
- [ ] **Step 4: Regenerate reference-app golden** — new signal rules may now fire there (e.g. FR-305/Fr-301 candidates). Run `-u`, verify BY EYE: all 8 original findings still present with identical rule:file:line; any additions must be FR-3xx/FR-215 only. Record the additions in the test file as a comment.
- [ ] **Step 5: Full suite; commit** — `test(cli): slop-app golden + reference-app regeneration`

### Task 14: Calibration corpus + README + final verify

**Files:**
- Create: `fixtures/calibration/clean-app/package.json`, `src/App.tsx` (rung-2 clean AND rung-3 clean: tailwind palette classes only, no arbitrary values, no gradient/serif/chips, real states handling); `packages/cli/tests/calibration.test.ts`
- Modify: `packages/cli/README.md`

- [ ] **Step 1: Failing calibration test**

```ts
import { describe, it, expect } from 'vitest';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';

describe('score calibration', () => {
  it('clean app scores ≥ 95', async () => {
    const r = await runCheck(join(FIXTURES, 'calibration', 'clean-app'), loadConfig(join(FIXTURES, 'calibration', 'clean-app')));
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(r.findings).toEqual([]);
  });
  it('reference app stays in the 25–40 band', async () => {
    const root = join(FIXTURES, 'reference-app');
    const r = await runCheck(root, loadConfig(root));
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(r.score).toBeLessThanOrEqual(40);
  });
  it('slop app stays in the 0–25 band', async () => {
    const root = join(FIXTURES, 'slop-app');
    const r = await runCheck(root, loadConfig(root));
    expect(r.score).toBeLessThanOrEqual(25);
  });
});
```

- [ ] **Step 2: Verify fail** (clean-app missing) → create the clean-app fixture → iterate until the clean case has zero findings and the suite is green. If clean-app trips a rule unexpectedly, fix the FIXTURE (the bands are the contract).
- [ ] **Step 3: README update** — rules table extended with FR-301–305, FR-215, FR-361–369 (severities + WCAG tags where present); new "Token sources" section (`tokenSource` kinds with config example); note that contrast (FR-304) checks CSS pairs only in v1.
- [ ] **Step 4: Full verify** — `pnpm test` (all green), `pnpm build`, smoke: `node dist/bin.js check` against slop-app (expect exit 0 — signals don't block — with the slop findings listed) and against reference-app (exit 1 unchanged, rung-2 errors still gate). Record both outputs in the report.
- [ ] **Step 5: Commit** — `feat(cli): calibration corpus, README rung-3 docs`

---

## Self-Review (completed)

- **Spec coverage:** §3 rung-3 table → Tasks 4–10 (FR-301–305, FR-361–369); FR-215 → Task 11; WCAG tags (§3 output note) → Task 12; tokenSource (§3) → Task 3; calibration corpus (§8) → Task 14; slop catalog public-anchor docs pages are site content, out of CLI scope (Plan 4 README/site). Deferred to Plan 3/4 unchanged: dashboard, skill, adapters, publish.
- **Plan-1 accepted deviations carried:** parallel parse + per-file timeout remains an accepted deviation (sequential scan measured fast; revisit if real-repo scans exceed seconds); package.json metadata before publish (Plan 4).
- **Placeholder scan:** all rules fully specified with regex/conditions, messages, hints, severities; fixtures enumerated with exact contents or exact trigger conditions (slop-app enumerated rule-by-rule).
- **Type consistency:** `tokenColors` threaded Task 3 → 5; `parentTag/parentClass` Task 1 → 10; `wcag` Task 12 list matches FR ids; registry grows by explicit imports per task; `ctxOf` in helpers gains `tokenColors: []` (Task 3) so all rule fixtures keep working.
