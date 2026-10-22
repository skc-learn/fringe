// src/pluginHook.ts
import { realpathSync } from "fs";
import { isAbsolute as isAbsolute2, join as join8, relative as relative6 } from "path";

// src/check.ts
import { readFileSync as readFileSync5 } from "fs";

// src/config.ts
import { readFileSync } from "fs";
import { join } from "path";
var DEFAULT_CONFIG = {
  // Both forms: `dist/**` matches only at the root, `**/dist/**` matches nested build output (e.g. frontend/dist).
  ignore: ["node_modules/**", "dist/**", "build/**", "out/**", "coverage/**", "**/dist/**", "**/build/**", "**/out/**", "**/coverage/**", ".fringe/**", "*.min.*"],
  disable: [],
  weights: { error: 10, review: 3, signal: 1 }
};
var TOKEN_SOURCE_KINDS = ["css-vars", "theme-factory", "design-tokens-json"];
function loadConfig(root) {
  try {
    const raw = readFileSync(join(root, "fringe.config.json"), "utf8");
    const user = JSON.parse(raw);
    const cfg = {
      ignore: Array.isArray(user.ignore) ? user.ignore : [...DEFAULT_CONFIG.ignore],
      disable: Array.isArray(user.disable) ? user.disable : [...DEFAULT_CONFIG.disable],
      weights: { ...DEFAULT_CONFIG.weights, ...user.weights ?? {} }
    };
    validateWeights(cfg.weights);
    if (user.critical !== void 0) {
      if (!Array.isArray(user.critical) || user.critical.some((g) => typeof g !== "string")) throw new Error("fringe.config.json: critical must be an array of glob strings");
      cfg.critical = user.critical;
    }
    if (user.tokenSource !== void 0) {
      cfg.tokenSource = validateTokenSource(user.tokenSource);
    }
    return cfg;
  } catch (e) {
    if (e.code === "ENOENT") return structuredClone(DEFAULT_CONFIG);
    if (e instanceof SyntaxError) throw new Error("fringe.config.json: invalid JSON");
    throw e;
  }
}
function validateTokenSource(ts) {
  let problem = null;
  if (!ts || typeof ts !== "object" || !TOKEN_SOURCE_KINDS.includes(ts.kind)) {
    problem = `tokenSource.kind must be one of: ${TOKEN_SOURCE_KINDS.join(", ")}`;
  } else if (ts.kind === "design-tokens-json" && (typeof ts.path !== "string" || ts.path.trim() === "")) {
    problem = "tokenSource.path is required when kind is design-tokens-json";
  }
  if (problem) throw new Error("fringe.config.json: " + problem);
  return ts;
}
function validateWeights(weights) {
  try {
    for (const k of ["error", "review", "signal"]) {
      if (typeof weights[k] !== "number" || Number.isNaN(weights[k]))
        throw new Error(`weights.${k} must be a number`);
    }
  } catch (e) {
    throw new Error("fringe.config.json: " + (e instanceof Error ? e.message : String(e)));
  }
}

// src/detect.ts
import { readdirSync, readFileSync as readFileSync2 } from "fs";
import { join as join2 } from "path";
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", "out", "coverage"]);
function findFile(dir, match, depth) {
  if (depth > 6) return false;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    if (e.isDirectory()) {
      if (findFile(join2(dir, e.name), match, depth + 1)) return true;
    } else if (match(e.name)) return true;
  }
  return false;
}
function detectStack(root) {
  let deps = {};
  try {
    const pkg = JSON.parse(readFileSync2(join2(root, "package.json"), "utf8"));
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
  }
  const has = (...names) => names.some((n) => deps[n]);
  return {
    jsx: has("react", "react-dom", "preact", "solid-js") || findFile(root, (n) => n.endsWith(".jsx") || n.endsWith(".tsx"), 0),
    tailwind: has("tailwindcss"),
    vue: has("vue", "nuxt"),
    svelte: has("svelte"),
    html: findFile(root, (n) => n.endsWith(".html"), 0)
  };
}

// src/walk.ts
import { readdirSync as readdirSync2 } from "fs";
import { join as join3, relative } from "path";
var EXTS = [".jsx", ".tsx", ".js", ".ts", ".html", ".css", ".vue", ".svelte", ".astro", ".scss"];
function globToRegex(g) {
  const esc = g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\0/g, ".*");
  return new RegExp("^" + esc + "$");
}
function walk(root, cfg) {
  const ignores = cfg.ignore.map(globToRegex);
  const out = [];
  const rec = (dir, depth) => {
    if (depth > 12) return;
    for (const e of readdirSync2(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join3(dir, e.name);
      const rel = relative(root, p);
      if (e.isDirectory()) rec(p, depth + 1);
      else if (EXTS.some((x) => e.name.endsWith(x)) && !ignores.some((r) => r.test(rel))) out.push(p);
    }
  };
  rec(root, 0);
  return out;
}

// src/parse/jsx.ts
import { Parser } from "acorn";
import { tsPlugin } from "@sveltejs/acorn-typescript";
var TSX = Parser.extend(tsPlugin({ jsx: true }));
var TS = Parser.extend(tsPlugin({ jsx: false }));
function parseProgram(file2, source) {
  const order = /\.(ts|mts|cts)$/.test(file2) ? [TS, TSX] : [TSX, TS];
  let first;
  for (const P of order) {
    for (const sourceType of ["module", "script"]) {
      try {
        return P.parse(source, { ecmaVersion: "latest", sourceType, locations: true });
      } catch (e) {
        first ??= e;
      }
    }
  }
  throw first;
}
function attrValue(v) {
  if (v == null) return "true";
  if (v.type === "Literal" && typeof v.value === "string") return v.value;
  if (v.type === "JSXExpressionContainer" && v.expression?.type === "Literal" && typeof v.expression.value === "string") return v.expression.value;
  return "{\u2026}";
}
function collectText(node) {
  let t = "";
  for (const c of node.children ?? []) {
    if (c.type === "JSXText") t += c.value;
    else if (c.type === "JSXExpressionContainer" && c.expression?.type === "Literal" && typeof c.expression.value === "string") t += c.expression.value;
    else if (c.type === "JSXExpressionContainer" && c.expression?.type !== "JSXEmptyExpression") t += "{\u2026}";
    else if (c.type === "JSXElement") t += collectText(c);
  }
  return t.trim();
}
function parseJsx(file2, source) {
  let ast;
  try {
    ast = parseProgram(file2, source);
  } catch (e) {
    throw new Error(`parse-skip: ${e.message}`);
  }
  const elems = [];
  (function walkNode(node, parent) {
    if (!node || typeof node.type !== "string") return;
    let nextParent = parent;
    if (node.type === "JSXElement") {
      const nameNode = node.openingElement.name;
      const tag = nameNode.type === "JSXIdentifier" ? nameNode.name : `${nameNode.object?.name ?? ""}.${nameNode.property?.name ?? ""}`;
      const attrs = {};
      for (const a of node.openingElement.attributes) {
        if (a.type === "JSXAttribute") attrs[a.name.name] = attrValue(a.value);
      }
      const el = { tag, attrs, text: collectText(node), loc: { file: file2, line: node.loc?.start.line ?? 0, col: node.loc?.start.column ?? 0 } };
      if (parent) el.parentTag = parent.tag;
      if (parent?.inLabel) el.inLabel = true;
      if (parent?.attrs?.className !== void 0) el.parentClass = parent.attrs.className;
      elems.push(el);
      nextParent = { tag, attrs, inLabel: tag === "label" || parent?.inLabel };
    }
    for (const k of Object.keys(node)) {
      const c = node[k];
      if (Array.isArray(c)) c.forEach((x) => typeof x === "object" && x && typeof x.type === "string" && walkNode(x, nextParent));
      else if (c && typeof c === "object" && typeof c.type === "string") walkNode(c, nextParent);
    }
  })(ast);
  return elems;
}

// src/parse/html.ts
import { parse } from "parse5";
var textOf = (n) => n.nodeName === "#text" ? n.value : (n.childNodes ?? []).map(textOf).join("");
function parseHtml(file2, source) {
  const doc = parse(source, { sourceCodeLocationInfo: true });
  const elems = [];
  (function walkNode(node, parent) {
    if (node?.tagName) {
      const attrs = {};
      for (const a of node.attrs ?? []) attrs[a.name] = a.value;
      const text = textOf(node).trim();
      const el = { tag: node.tagName, attrs, text, loc: { file: file2, line: node.sourceCodeLocation?.startLine ?? 0, col: node.sourceCodeLocation?.startCol ?? 0 } };
      if (parent) el.parentTag = parent.tag;
      if (parent?.inLabel) el.inLabel = true;
      if (parent?.attrs?.class !== void 0) el.parentClass = parent.attrs.class;
      elems.push(el);
      for (const c of node.childNodes ?? []) walkNode(c, { tag: node.tagName, attrs, inLabel: node.tagName === "label" || parent?.inLabel });
      return;
    }
    for (const c of node?.childNodes ?? []) walkNode(c, parent);
  })(doc);
  return elems;
}

// src/parse/css.ts
import postcss from "postcss";
function parseCss(file2, source) {
  const decls = [];
  const rec = (node, selector) => {
    for (const child of node.nodes ?? []) {
      if (child.type === "decl") {
        decls.push({ prop: child.prop, value: String(child.value), selector, loc: { file: file2, line: child.source?.start?.line ?? 0, col: child.source?.start?.column ?? 0 } });
      } else if (child.type === "rule" || child.type === "atrule") {
        rec(child, child.type === "rule" ? child.selector : selector);
      }
    }
  };
  try {
    rec(postcss.parse(source), "");
  } catch (e) {
    throw new Error(`parse-skip: ${e.message}`);
  }
  return decls;
}

// src/rules/fr201.ts
var fr201 = {
  id: "FR-201",
  rung: 2,
  severity: "error",
  check: (ctx) => ctx.elems.filter((e) => e.tag === "img" && e.attrs.alt === void 0).map((e) => ({ rule: "FR-201", severity: "error", message: `<img> missing alt text`, hint: `add alt="description" (or alt="" if decorative)`, loc: e.loc, wcag: "1.1.1" }))
};

// src/rules/fr202.ts
var NAME_ATTRS = ["aria-label", "aria-labelledby", "title"];
var fr202 = {
  id: "FR-202",
  rung: 2,
  severity: "error",
  check: (ctx) => ctx.elems.filter((e) => ["button", "a"].includes(e.tag) && e.attrs["aria-hidden"] !== "true").filter((e) => !e.text && !NAME_ATTRS.some((a) => e.attrs[a])).map((e) => ({ rule: "FR-202", severity: "error", message: `<${e.tag}> has no accessible name`, hint: `add text content or aria-label`, loc: e.loc, wcag: "4.1.2" }))
};

// src/rules/fr203.ts
var fr203 = {
  id: "FR-203",
  rung: 2,
  severity: "error",
  check: (ctx) => ctx.elems.filter((e) => e.tag === "input" && e.attrs.type !== "hidden" && !e.inLabel && e.attrs.hidden === void 0).filter((e) => {
    const labeled = e.attrs["aria-label"] || e.attrs["aria-labelledby"] || e.attrs.id && new RegExp(`(htmlFor|for)=["'\`{]${e.attrs.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`}]`).test(ctx.source);
    return !labeled;
  }).map((e) => ({ rule: "FR-203", severity: "error", message: `input not associated with a label`, hint: `add id + <label htmlFor>, or aria-label`, loc: e.loc, wcag: "3.3.2" }))
};

// src/rules/fr204.ts
var fr204 = {
  id: "FR-204",
  rung: 2,
  severity: "error",
  check: (ctx) => {
    const out = [];
    let prev = 0;
    let seenH1 = false;
    for (const e of ctx.elems.filter((el) => /^h[1-6]$/.test(el.tag))) {
      const lvl = Number(e.tag[1]);
      if (lvl === 1 && seenH1) out.push({ rule: "FR-204", severity: "error", message: `multiple <h1> in file`, hint: `use one h1 per page`, loc: e.loc, wcag: "1.3.1" });
      if (lvl === 1) seenH1 = true;
      if (prev && lvl > prev + 1) out.push({ rule: "FR-204", severity: "error", message: `heading skips from h${prev} to h${lvl}`, hint: `don't skip heading levels for visual size`, loc: e.loc, wcag: "1.3.1" });
      if (!prev || lvl <= prev + 1) prev = lvl;
    }
    return out;
  }
};

// src/rules/fr205.ts
var fr205 = {
  id: "FR-205",
  rung: 2,
  severity: "error",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (/\boutline-(none|0)\b/.test(cls) && !cls.includes("focus-visible:"))
        out.push({ rule: "FR-205", severity: "error", message: `outline removed without focus-visible alternative`, hint: `add focus-visible:outline-* or a custom focus ring`, loc: e.loc, wcag: "2.4.7" });
    }
    for (const d of ctx.css) {
      if (d.prop === "outline" && /^(none|0)/.test(d.value) && !d.selector.includes(":focus-visible") && !ctx.source.includes(":focus-visible"))
        out.push({ rule: "FR-205", severity: "error", message: `outline: none without :focus-visible alternative`, hint: `add a :focus-visible rule with visible outline`, loc: d.loc, wcag: "2.4.7" });
    }
    return out;
  }
};

// src/rules/fr206.ts
var fr206 = {
  id: "FR-206",
  rung: 2,
  severity: "error",
  check: (ctx) => {
    const out = [];
    const isBackdrop = (i) => {
      const next = ctx.elems[i + 1], me = ctx.elems[i];
      return !!next && next.parentTag === me.tag && next.loc.line >= me.loc.line && (/^(alert)?dialog$/.test(next.attrs.role ?? "") || next.attrs["aria-modal"] === "true");
    };
    for (const e of ctx.elems.filter((el, i) => ["div", "span"].includes(el.tag) && (el.attrs.onClick ?? el.attrs.onclick) !== void 0 && el.attrs.role === void 0 && (el.attrs.tabIndex ?? el.attrs.tabindex) === void 0 && !isBackdrop(i))) {
      out.push({ rule: "FR-206", severity: "error", message: `onClick on non-interactive <${e.tag}>`, hint: `use a <button>/<a> or add role and tabIndex`, loc: e.loc, wcag: "2.1.1" });
    }
    return out;
  }
};

// src/rules/fr207.ts
var JSX_FORM = /tabIndex=\{\s*(\d+)\s*\}/g;
var HTML_FORM = /tabindex=["']([1-9]\d*)["']/gi;
var fr207 = {
  id: "FR-207",
  rung: 2,
  severity: "error",
  check: (ctx) => {
    const out = [];
    ctx.source.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(JSX_FORM)) {
        if (Number(m[1]) > 0)
          out.push({ rule: "FR-207", severity: "error", message: `tabIndex=${m[1]} > 0 disrupts natural tab order`, hint: `use tabIndex={0} and place in DOM order`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 }, wcag: "2.4.3" });
      }
      for (const m of line.matchAll(HTML_FORM)) {
        out.push({ rule: "FR-207", severity: "error", message: `tabIndex=${m[1]} > 0 disrupts natural tab order`, hint: `use tabIndex={0} and place in DOM order`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 }, wcag: "2.4.3" });
      }
    });
    return out;
  }
};

// src/rules/fr208.ts
var FETCH = /useQuery|useSWR|useMutation|useFetcher|useInfiniteQuery|\bfetch\(|axios|createResource|loader/i;
var STATES = /isLoading|isPending|isError|isFetching|loading|empty|isEmpty|\berror\b|\bcatch\b|skeleton|spinner|fallback|onError|Suspense/i;
var fr208 = {
  id: "FR-208",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    if (!FETCH.test(ctx.source) || STATES.test(ctx.source)) return [];
    return [{ rule: "FR-208", severity: "review", message: `data is fetched but no loading/empty/error handling found`, hint: `render loading, empty, and error states \u2014 heuristic, verify by hand`, loc: { file: ctx.file, line: 1, col: 0 } }];
  }
};

// src/rules/fr209.ts
var VALID_ARIA = /* @__PURE__ */ new Set(["aria-label", "aria-labelledby", "aria-describedby", "aria-hidden", "aria-expanded", "aria-controls", "aria-current", "aria-live", "aria-disabled", "aria-invalid", "aria-required", "aria-selected", "aria-checked", "aria-valuenow", "aria-orientation", "aria-placeholder", "aria-pressed", "aria-roledescription", "aria-atomic", "aria-relevant", "aria-dropeffect", "aria-grabbed", "aria-level", "aria-multiline", "aria-multiselectable", "aria-readonly", "aria-sort", "aria-valuemax", "aria-valuemin", "aria-valuetext", "aria-busy", "aria-colcount", "aria-rowcount", "aria-details", "aria-errormessage", "aria-flowto", "aria-owns", "aria-posinset", "aria-setsize", "aria-modal", "aria-activedescendant", "aria-haspopup", "aria-autocomplete", "aria-keyshortcuts", "aria-colspan", "aria-colindex", "aria-rowspan", "aria-rowindex", "aria-description", "aria-braillelabel", "aria-brailleroledescription"]);
var fr209 = {
  id: "FR-209",
  rung: 2,
  severity: "error",
  check: (ctx) => ctx.elems.flatMap((e) => Object.keys(e.attrs).filter((a) => a.startsWith("aria-") && !VALID_ARIA.has(a)).map((a) => ({ rule: "FR-209", severity: "error", message: `unknown aria attribute '${a}'`, hint: `check spelling against the ARIA spec`, loc: e.loc, wcag: "4.1.2" })))
};

// src/rules/fr210.ts
var fr210 = {
  id: "FR-210",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    const out = [];
    ctx.source.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/(hurry|expires?|offer ends|ending soon)[^<>\n]{0,60}\d{1,2}:\d{2}/gi)) {
        out.push({ rule: "FR-210", severity: "review", message: `urgency wording paired with a countdown ('${m[0]}') pressures rushed decisions`, hint: `avoid manufactured urgency \u2014 state the plain expiry instead of a ticking clock`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  }
};

// src/rules/fr211.ts
var CHECKED_INPUT = /<input[^>]*type=["']checkbox["'][^>]*defaultChecked[^>]*>/;
var CONSENT_ID = /id=["'][^"']*(?:consent|agree|terms|subscribe|opt[- ]?in)/i;
var CONSENT_ANY = /consent|agree|terms|subscribe|opt[- ]?in/i;
var fr211 = {
  id: "FR-211",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    const out = [];
    ctx.source.split("\n").forEach((line, i) => {
      const m = line.match(CHECKED_INPUT);
      const hit = m ? CONSENT_ID.test(m[0]) || CONSENT_ANY.test(ctx.source) : /defaultChecked/.test(line) && CONSENT_ANY.test(ctx.source);
      if (!hit) return;
      const col = m?.index ?? Math.max(line.indexOf("defaultChecked"), 0);
      out.push({ rule: "FR-211", severity: "review", message: `pre-checked checkbox near consent/agreement wording may trick users into opting in`, hint: `leave consent checkboxes unchecked by default`, loc: { file: ctx.file, line: i + 1, col } });
    });
    return out;
  }
};

// src/rules/fr212.ts
var fr212 = {
  id: "FR-212",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    const out = [];
    ctx.source.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/no thanks[^<>\n]{0,50}(hate|don'?t (want|like|need)|prefer paying|pay full|miss out)/gi)) {
        out.push({ rule: "FR-212", severity: "review", message: `decline option shames the user ('${m[0]}')`, hint: `make declining a neutral choice \u2014 no guilt-tripping copy`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  }
};

// src/rules/fr213.ts
var TRIGGER = /(infinite[- ]?scroll|load[- ]?more.{0,40}scroll|IntersectionObserver)/i;
var OPT_OUT = /load more|loadMore|show more/i;
var fr213 = {
  id: "FR-213",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    if (OPT_OUT.test(ctx.source)) return [];
    const out = [];
    ctx.source.split("\n").forEach((line, i) => {
      const m = line.match(TRIGGER);
      if (m && out.length === 0)
        out.push({ rule: "FR-213", severity: "review", message: `infinite scroll with no visible 'load more'/'show more' opt-out`, hint: `offer pagination or an explicit load-more control so users can stop`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
    });
    return out;
  }
};

// src/rules/fr214.ts
var fr214 = {
  id: "FR-214",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    const out = [];
    ctx.source.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/(free|\$0)[^<>\n]{0,30}(then|after|later)[^<>\n]{0,30}\$\d+/gi)) {
        out.push({ rule: "FR-214", severity: "review", message: `price framed as free but a cost follows ('${m[0]}')`, hint: `show the full price up front \u2014 drip pricing erodes trust`, loc: { file: ctx.file, line: i + 1, col: m.index ?? 0 } });
      }
    });
    return out;
  }
};

// src/rules/fr215.ts
var ERROR_MARKER = /(isError|\berror\b|catch)/;
var GENERIC_COPY = /something went wrong|an error occurred|oops|whoops/i;
var RECOVERY = /(retry|try again|reload|contact support|support team)/i;
var fr215 = {
  id: "FR-215",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    if (ERROR_MARKER.test(ctx.source) && GENERIC_COPY.test(ctx.source) && !RECOVERY.test(ctx.source)) {
      return [{ rule: "FR-215", severity: "review", message: "generic error copy with no recovery action", hint: "tell users what failed and give them a next step (retry, link, contact)", loc: { file: ctx.file, line: 1, col: 0 } }];
    }
    return [];
  }
};

// src/rules/fr216.ts
var NOT_TEXT = /* @__PURE__ */ new Set(["hidden", "checkbox", "radio", "submit", "button", "file", "range", "color", "image", "reset"]);
var short = (s = "") => s.length <= 24 ? s : "";
var cat = (a) => `${a.name ?? ""} ${a.id ?? ""} ${short(a.placeholder)} ${short(a["aria-label"])}`.toLowerCase();
var fr216 = {
  id: "FR-216",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      if (e.tag !== "input" || e.attrs.type === "{\u2026}") continue;
      const type = (e.attrs.type ?? "text").toLowerCase();
      if (NOT_TEXT.has(type)) continue;
      const hint = cat(e.attrs);
      if (/search|filter|find/.test(hint)) continue;
      const flag = (message, h) => out.push({ rule: "FR-216", severity: "review", message, hint: h, loc: e.loc });
      if (/e-?mail/.test(hint) && type !== "email") flag(`email field is type="${type}"`, 'use type="email" so phones show the right keyboard and the browser validates');
      else if (/\b(tel|phone|mobile)\b/.test(hint) && type !== "tel") flag(`phone field is type="${type}"`, 'use type="tel" for the numeric keypad');
      if (type === "password" && e.attrs.autocomplete === void 0 && e.attrs.autoComplete === void 0) flag("password field without autocomplete", 'add autoComplete="current-password" or "new-password" so password managers work');
    }
    return out;
  }
};

// src/rules/fr217.ts
var VAGUE = /^(click here|here|read more|more|link|this link)$/i;
var fr217 = {
  id: "FR-217",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      if (e.tag !== "a") continue;
      const href = e.attrs.href ?? "";
      if (VAGUE.test(e.text) && !e.attrs["aria-label"] && !e.attrs["aria-labelledby"])
        out.push({ rule: "FR-217", severity: "review", message: `link text "${e.text}" says nothing out of context`, hint: 'name the destination or action ("Read the pricing guide"); screen reader users list links on their own', loc: e.loc });
      if (href === "#" || /^javascript:/i.test(href))
        out.push({ rule: "FR-217", severity: "review", message: `link with href="${href.slice(0, 11)}" goes nowhere`, hint: "use a <button> for an action, or a real URL for navigation", loc: e.loc });
    }
    return out;
  }
};

// src/rules/fr218.ts
var fr218 = {
  id: "FR-218",
  rung: 2,
  severity: "review",
  check: (ctx) => {
    if (!/<html[\s>]/i.test(ctx.source)) return [];
    const out = [];
    const html = ctx.elems.find((e) => e.tag === "html");
    if (html && html.attrs.lang === void 0)
      out.push({ rule: "FR-218", severity: "review", message: "<html> has no lang attribute", hint: 'add lang="en" (or the page language) so screen readers pick the right voice', loc: html.loc, wcag: "3.1.1" });
    if (!/<title[\s>]/i.test(ctx.source) && html && /<head[\s>]/i.test(ctx.source))
      out.push({ rule: "FR-218", severity: "review", message: "page has no <title>", hint: "add a unique, descriptive <title>: it is the first thing a screen reader announces and the browser tab label", loc: html.loc, wcag: "2.4.2" });
    for (const m of ctx.elems.filter((e) => e.tag === "meta" && e.attrs.name === "viewport")) {
      if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(m.attrs.content ?? ""))
        out.push({ rule: "FR-218", severity: "review", message: "viewport meta blocks pinch-zoom", hint: "remove user-scalable=no / maximum-scale=1: low-vision users rely on zoom", loc: m.loc, wcag: "1.4.4" });
    }
    return out;
  }
};

// src/rules/fr219.ts
var fr219 = {
  id: "FR-219",
  rung: 3,
  severity: "review",
  check: (ctx) => {
    if (!/@keyframes/.test(ctx.source) || /prefers-reduced-motion/.test(ctx.source)) return [];
    const d = ctx.css.find((x) => x.prop === "animation" || x.prop === "animation-name");
    if (!d) return [];
    return [{ rule: "FR-219", severity: "review", message: "animation defined with no prefers-reduced-motion handling", hint: "wrap it in @media (prefers-reduced-motion: no-preference), or turn it off under (prefers-reduced-motion: reduce)", loc: d.loc }];
  }
};

// src/rules/fr220.ts
var fr220 = {
  id: "FR-220",
  rung: 2,
  severity: "review",
  check: (ctx) => ctx.elems.filter((e) => (e.tag === "video" || e.tag === "audio") && (e.attrs.autoPlay !== void 0 || e.attrs.autoplay !== void 0) && e.attrs.muted === void 0).map((e) => ({ rule: "FR-220", severity: "review", message: `<${e.tag}> autoplays with sound`, hint: "start muted (and offer controls), or wait for a user action; browsers block it anyway and it startles screen reader users", loc: e.loc, wcag: "1.4.2" }))
};

// src/rules/fr221.ts
var HOVER = ["onMouseEnter", "onMouseOver", "onmouseenter", "onmouseover"];
var FOCUS = ["onFocus", "onfocus"];
var PRESS = ["onClick", "onclick", "onTouchStart", "ontouchstart"];
var fr221 = {
  id: "FR-221",
  rung: 2,
  severity: "review",
  check: (ctx) => ctx.elems.filter((e) => HOVER.some((h) => e.attrs[h] !== void 0) && !FOCUS.some((f) => e.attrs[f] !== void 0) && !PRESS.some((p) => e.attrs[p] !== void 0)).map((e) => ({ rule: "FR-221", severity: "review", message: `<${e.tag}> reacts to hover only`, hint: "mirror it on focus (onFocus/onBlur) and tap: keyboard and touch users cannot hover", loc: e.loc, wcag: "1.4.13" }))
};

// src/rules/fr222.ts
var FILLER = /\blorem ipsum\b|\b(TODO|FIXME|TBD)\b|\[(insert|your)[^\]]*\]/i;
var fr222 = {
  id: "FR-222",
  rung: 3,
  severity: "signal",
  check: (ctx) => ctx.elems.filter((e) => FILLER.test(e.text) || FILLER.test(e.attrs.placeholder ?? "") || FILLER.test(e.attrs["aria-label"] ?? "")).map((e) => ({ rule: "FR-222", severity: "signal", message: "placeholder or unfinished text in the UI", hint: "replace lorem ipsum / TODO / [insert ...] with real copy before shipping", loc: e.loc }))
};

// src/color.ts
var clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n)));
function splitArgs(argStr) {
  const [colorPart] = argStr.split("/");
  const values = colorPart.trim().split(/[\s,]+/).filter(Boolean);
  if (values.length < 3 || values.length > 4) return null;
  return { values: values.slice(0, 3) };
}
function numericChannel(v) {
  const m = v.match(/^([+-]?\d*\.?\d+)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] ? n / 100 * 255 : n;
}
function hslChannel(v, isHue) {
  const m = v.match(/^([+-]?\d*\.?\d+)(deg|%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isHue ? n : n / 100;
}
function hslToRgb(h, s, l) {
  const hue = (h % 360 + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(hue / 60 % 2 - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) };
}
function parseColor(input) {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  const rgb = s.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const args = splitArgs(rgb[1]);
    if (!args) return null;
    const nums = args.values.map(numericChannel);
    if (nums.some((n) => n === null)) return null;
    const [r, g, b] = nums;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }
  const hsl = s.match(/^hsla?\(([^)]*)\)$/);
  if (hsl) {
    const args = splitArgs(hsl[1]);
    if (!args) return null;
    const hue = hslChannel(args.values[0], true);
    const sat = hslChannel(args.values[1], false);
    const lig = hslChannel(args.values[2], false);
    if (hue === null || sat === null || lig === null) return null;
    return hslToRgb(hue, Math.min(1, Math.max(0, sat)), Math.min(1, Math.max(0, lig)));
  }
  return null;
}
function relativeLuminance({ r, g, b }) {
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [l1, l2] = la >= lb ? [la, lb] : [lb, la];
  return (l1 + 0.05) / (l2 + 0.05);
}

// src/rules/fr301.ts
var ARBITRARY_TW = /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;
var PALETTE_TW = /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
var COLOR_PROP = /color|^background$|border/;
var count = (source, re) => (source.match(re) ?? []).length;
var fr301 = {
  id: "FR-301",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const hardcoded = count(ctx.source, ARBITRARY_TW) + ctx.css.filter((d) => !d.prop.startsWith("--") && COLOR_PROP.test(d.prop) && parseColor(d.value) !== null).length;
    const tokenRefs = count(ctx.source, /var\(--/g) + count(ctx.source, PALETTE_TW);
    if (!(hardcoded > 3 && hardcoded > tokenRefs)) return [];
    return [{
      rule: "FR-301",
      severity: "signal",
      message: `${hardcoded} hardcoded colors vs ${tokenRefs} token uses in this file`,
      hint: `use design tokens / Tailwind palette instead of raw hex (tokenSource: ${ctx.tokenColors.length} colors found)`,
      loc: { file: ctx.file, line: 1, col: 0 }
    }];
  }
};

// src/rules/fr302.ts
var ARBITRARY_SIZE = /\btext-\[(?!#|color:)[^\]]+\]/g;
var fr302 = {
  id: "FR-302",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      for (const m of cls.matchAll(ARBITRARY_SIZE))
        out.push({
          rule: "FR-302",
          severity: "signal",
          message: `font size off the type scale: ${m[0]}`,
          hint: `use the type scale (text-xs..text-6xl) or extend the theme`,
          loc: e.loc
        });
    }
    return out;
  }
};

// src/rules/fr303.ts
var ARBITRARY_SPACE = /\b(?:p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|gap|w|h)-\[[^\]]+\]/g;
var fr303 = {
  id: "FR-303",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      for (const m of cls.matchAll(ARBITRARY_SPACE))
        out.push({
          rule: "FR-303",
          severity: "signal",
          message: `spacing/dimension off the scale: ${m[0]}`,
          hint: `use spacing scale utilities (1 unit = 0.25rem) or extend the theme`,
          loc: e.loc
        });
    }
    return out;
  }
};

// src/rules/fr304.ts
function translucent(raw) {
  const s = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{8}$/.test(s)) return parseInt(s.slice(7, 9), 16) < 255;
  const fn = s.match(/^(?:rgba?|hsla?)\(([^)]*)\)$/);
  if (!fn) return false;
  const [colorPart, slashAlpha] = fn[1].split("/");
  const alpha = slashAlpha !== void 0 ? slashAlpha.trim() : colorPart.trim().split(/[\s,]+/).filter(Boolean)[3];
  if (alpha === void 0) return false;
  const m = alpha.match(/^([+-]?\d*\.?\d+)(%)?$/);
  if (!m) return false;
  const n = parseFloat(m[1]);
  return (m[2] ? n / 100 : n) < 1;
}
var fr304 = {
  id: "FR-304",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    const bySelector = /* @__PURE__ */ new Map();
    for (const d of ctx.css) {
      const group = bySelector.get(d.selector) ?? [];
      group.push(d);
      bySelector.set(d.selector, group);
    }
    for (const [selector, decls] of bySelector) {
      if (!selector) continue;
      const last = (prop) => {
        const matches = decls.filter((d) => d.prop === prop);
        return matches[matches.length - 1];
      };
      const colorDecl = last("color");
      const bgDecl = last("background-color") ?? decls.filter((d) => d.prop === "background" && parseColor(d.value) !== null).pop();
      if (!colorDecl || !bgDecl) continue;
      if (translucent(colorDecl.value) || translucent(bgDecl.value)) continue;
      const fg = parseColor(colorDecl.value);
      const bg = parseColor(bgDecl.value);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5)
        out.push({
          rule: "FR-304",
          severity: "signal",
          message: `contrast ${colorDecl.value.trim()} on ${bgDecl.value.trim()} is ${ratio.toFixed(1)}:1 (< 4.5:1)`,
          hint: `darken the text or lighten the background to reach AA 4.5:1`,
          loc: colorDecl.loc,
          wcag: "1.4.3"
        });
    }
    return out;
  }
};

// src/rules/fr305.ts
var TINY_TEXT = /\btext-xs\b/;
var ADEQUATE_PADDING = /(?:^|\s)(?:p|py)-([2-9]|10)\b/;
var fr305 = {
  id: "FR-305",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      if (e.tag !== "button" && e.tag !== "a") continue;
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!TINY_TEXT.test(cls) || ADEQUATE_PADDING.test(cls)) continue;
      out.push({
        rule: "FR-305",
        severity: "signal",
        message: `tiny hit area: text-xs interactive element without adequate padding`,
        hint: `add py-2+ padding or a larger text size (WCAG 2.5.8 target size)`,
        loc: e.loc,
        wcag: "2.5.8"
      });
    }
    return out;
  }
};

// src/rules/fr361.ts
var ITALIC = /\bitalic\b/;
var SERIF = /\b(?:font-)?serif\b/;
var DISPLAY_SIZE = /\btext-(?:3xl|4xl|5xl|6xl)\b/;
var fr361 = {
  id: "FR-361",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!ITALIC.test(cls) || !SERIF.test(cls) || !DISPLAY_SIZE.test(cls)) continue;
      out.push({
        rule: "FR-361",
        severity: "signal",
        message: `italic serif display type \u2014 the AI-tell headline`,
        hint: `choose a display treatment that isn't italic serif`,
        loc: e.loc
      });
    }
    return out;
  }
};

// src/rules/fr362.ts
var UPPERCASE = /\buppercase\b/;
var TRACKING = /\btracking-(?:widest|wider)\b/;
var PILL = /\brounded-full\b/;
var MAX_TEXT_LENGTH = 40;
var fr362 = {
  id: "FR-362",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!UPPERCASE.test(cls) || !TRACKING.test(cls) || !PILL.test(cls)) continue;
      if (e.text.trim().length > MAX_TEXT_LENGTH) continue;
      out.push({
        rule: "FR-362",
        severity: "signal",
        message: `hero eyebrow chip`,
        hint: `eyebrow chips above headings are a template tell; integrate context into the heading`,
        loc: e.loc
      });
    }
    return out;
  }
};

// src/rules/fr363.ts
var CARD_ROUNDING = /rounded-(lg|xl|2xl)/;
var BORDER_TOKEN = /(?:^|\s)border/;
var SURFACE = /shadow-|bg-/;
var cardish = (cls) => CARD_ROUNDING.test(cls) && (BORDER_TOKEN.test(cls) || SURFACE.test(cls));
var fr363 = {
  id: "FR-363",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!cardish(cls) || !e.parentClass || !cardish(e.parentClass)) continue;
      out.push({
        rule: "FR-363",
        severity: "signal",
        message: `card inside a card`,
        hint: `one containment level: let whitespace, not boxes, group content`,
        loc: e.loc
      });
    }
    return out;
  }
};

// src/rules/fr364.ts
var TILE_ROUNDING = /rounded-(lg|xl|2xl)/;
var isTile = (cls, text) => TILE_ROUNDING.test(cls) && /bg-/.test(cls) && /flex/.test(cls) && text === "";
var fr364 = {
  id: "FR-364",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    let n = 0;
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (isTile(cls, e.text)) n++;
    }
    if (n < 3) return [];
    return [{
      rule: "FR-364",
      severity: "signal",
      message: `icon-tile stack (${n} tiles)`,
      hint: `rows of icon tiles with verb labels are a landing-page tell`,
      loc: { file: ctx.file, line: 1, col: 0 }
    }];
  }
};

// src/rules/fr366.ts
var PILL2 = /rounded-full/;
var CHIP_SIZE = /(?:px-2|px-2\.5|text-xs)/;
var isChip = (cls, text) => PILL2.test(cls) && CHIP_SIZE.test(cls) && text !== "";
var fr366 = {
  id: "FR-366",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    let n = 0;
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (isChip(cls, e.text)) n++;
    }
    if (n < 5) return [];
    return [{
      rule: "FR-366",
      severity: "signal",
      message: `status-chip soup (${n} chips)`,
      hint: `chips everywhere dilute meaning; reserve them for state`,
      loc: { file: ctx.file, line: 1, col: 0 }
    }];
  }
};

// src/rules/fr365.ts
var THIN_BORDER = /(?:^|\s)border(?!-0\b)(?:-[1-9])?\b/;
var WIDE_SHADOW = /\bshadow-(?:xl|2xl)\b/;
var fr365 = {
  id: "FR-365",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!THIN_BORDER.test(cls) || !WIDE_SHADOW.test(cls)) continue;
      out.push({
        rule: "FR-365",
        severity: "signal",
        message: `thin border with wide shadow`,
        hint: `pair elevation with weight: heavier border or tighter shadow`,
        loc: e.loc
      });
    }
    return out;
  }
};

// src/rules/fr367.ts
var SMALL_TEXT = /\btext-(?:xs|sm)\b/;
var NUMBERED_LABEL = /^\d{1,2}\s+\S+/;
var fr367 = {
  id: "FR-367",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!SMALL_TEXT.test(cls) || !NUMBERED_LABEL.test(e.text)) continue;
      out.push({
        rule: "FR-367",
        severity: "signal",
        message: `numbered section label ("01 Discover" style)`,
        hint: `let hierarchy come from typography, not index numbers`,
        loc: e.loc
      });
    }
    return out;
  }
};

// src/rules/fr368.ts
var GRADIENT_UTILITY = /\bbg-gradient-to-\w+/;
var PURPLE_STOP = /\bfrom-(?:violet|purple|indigo|fuchsia)-\d{3,4}\b/;
var PURPLE_HEX = /#(?:8b5cf6|a78bfa|7c3aed|818cf8|6366f1|9333ea|c084fc)/i;
var BACKGROUND_PROP = /^background(?:-image)?$/;
var fr368 = {
  id: "FR-368",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      const cls = e.attrs.className ?? e.attrs.class ?? "";
      if (!GRADIENT_UTILITY.test(cls) || !PURPLE_STOP.test(cls)) continue;
      out.push({
        rule: "FR-368",
        severity: "signal",
        message: `the purple AI gradient`,
        hint: `pick a palette that isn't the LLM default`,
        loc: e.loc
      });
    }
    for (const d of ctx.css) {
      if (!BACKGROUND_PROP.test(d.prop) || !/linear-gradient/i.test(d.value) || !PURPLE_HEX.test(d.value)) continue;
      out.push({
        rule: "FR-368",
        severity: "signal",
        message: `the purple AI gradient`,
        hint: `pick a palette that isn't the LLM default`,
        loc: d.loc
      });
    }
    return out;
  }
};

// src/rules/fr369.ts
var HEADING = /^h[1-6]$/;
var EMOJI = /\p{Extended_Pictographic}/u;
var fr369 = {
  id: "FR-369",
  rung: 3,
  severity: "signal",
  check: (ctx) => {
    const out = [];
    for (const e of ctx.elems) {
      if (!HEADING.test(e.tag) || !EMOJI.test(e.text)) continue;
      out.push({
        rule: "FR-369",
        severity: "signal",
        message: `emoji in heading`,
        hint: `emoji in headings read as template output; use typography instead`,
        loc: e.loc
      });
    }
    return out;
  }
};

// src/rules/registry.ts
var ALL_RULES = [];
ALL_RULES.push(fr201, fr202, fr203, fr204, fr205, fr206, fr207, fr208, fr209, fr210, fr211, fr212, fr213, fr214, fr215, fr216, fr217, fr218, fr219, fr220, fr221, fr222, fr301, fr302, fr303, fr304, fr305, fr361, fr362, fr363, fr364, fr366, fr365, fr367, fr368, fr369);
function activeRules(cfg) {
  return ALL_RULES.filter((r) => !cfg.disable.includes(r.id));
}

// src/score.ts
var BASELINE_FILES = 10;
var KNEE = 75;
function score(counts, weights, files = BASELINE_FILES) {
  const raw = counts.error * weights.error + counts.review * weights.review + counts.signal * weights.signal;
  const penalty = raw * BASELINE_FILES / Math.max(files, BASELINE_FILES);
  return Math.round(penalty <= KNEE ? 100 - penalty : (100 - KNEE) * KNEE / penalty);
}

// src/tokens.ts
import { readFileSync as readFileSync3 } from "fs";
import { isAbsolute, join as join4 } from "path";
var CSS_VAR_RE = /--[\w-]+\s*:\s*([^;}]+)/g;
function gatherTokenColors(root, cfg, cssSources) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (raw) => {
    const value = raw.trim();
    if (!value || seen.has(value) || parseColor(value) === null) return;
    seen.add(value);
    out.push(value);
  };
  const kind = cfg.tokenSource?.kind;
  if (kind === "design-tokens-json") {
    const rel = cfg.tokenSource?.path ?? "";
    const file2 = isAbsolute(rel) ? rel : join4(root, rel);
    let json;
    try {
      json = JSON.parse(readFileSync3(file2, "utf8"));
    } catch {
      return out;
    }
    collectJsonColors(json, add);
    return out;
  }
  if (kind !== "css-vars" && kind !== "theme-factory") return out;
  for (const { source } of cssSources) {
    for (const m of source.matchAll(CSS_VAR_RE)) add(m[1]);
  }
  return out;
}
function collectJsonColors(node, add) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonColors(item, add);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "$value" && typeof value === "string") add(value);
    else collectJsonColors(value, add);
  }
}

// src/baseline.ts
import { existsSync, readFileSync as readFileSync4, writeFileSync } from "fs";
import { join as join5, relative as relative2 } from "path";
var path = (root) => join5(root, "fringe.baseline.json");
var keyOf = (root, f) => `${f.rule}|${relative2(root, f.loc.file)}|${f.message}`;
function applyBaseline(root, findings) {
  if (!existsSync(path(root))) return { fresh: findings, known: 0 };
  let keys;
  try {
    keys = JSON.parse(readFileSync4(path(root), "utf8"));
    if (!Array.isArray(keys)) throw 0;
  } catch {
    throw new Error("fringe.baseline.json is not a JSON array \u2014 rerun with --update-baseline");
  }
  const left = /* @__PURE__ */ new Map();
  for (const k of keys) left.set(k, (left.get(k) ?? 0) + 1);
  const fresh = findings.filter((f) => {
    const k = keyOf(root, f), n = left.get(k) ?? 0;
    if (n > 0) {
      left.set(k, n - 1);
      return false;
    }
    return true;
  });
  return { fresh, known: findings.length - fresh.length };
}

// src/suppress.ts
var MARK = /fringe-ignore\s+((?:FR-\d+[\s,]*)+)/;
function suppressedIds(lines, line) {
  const ids = /* @__PURE__ */ new Set();
  for (const l of [lines[line - 1], lines[line - 2]]) {
    const m = l && MARK.exec(l);
    if (m) for (const id of m[1].match(/FR-\d+/g) ?? []) ids.add(id);
  }
  return ids;
}

// src/prioritize.ts
import { basename, extname, relative as relative3 } from "path";

// src/guidance.ts
var GUIDANCE = {
  "FR-201": {
    why: "A screen reader announces an image with no alt as its file name, or skips it.",
    recipe: 'Informative image: describe its purpose, not its look (alt="Order #4521 receipt"). Decorative image: alt="".',
    avoid: 'alt="image", alt="photo", or the file name.',
    example: { before: '<img src="/hero.png" />', after: '<img src="/hero.png" alt="Team reviewing a dashboard" />' },
    fixability: "judgment"
  },
  "FR-202": {
    why: 'A button or link with no text is announced as just "button" or "link".',
    recipe: 'Put visible text inside it. For an icon-only control, add aria-label naming the action and aria-hidden="true" on the icon.',
    avoid: 'title alone (not reliably announced) or an aria-label that repeats the icon name ("cross").',
    example: { before: "<button><CloseIcon /></button>", after: '<button aria-label="Close dialog"><CloseIcon aria-hidden="true" /></button>' },
    fixability: "mechanical"
  },
  "FR-203": {
    why: "A form field with no label is announced without a name, and the placeholder vanishes as soon as the user types.",
    recipe: "Add a visible <label htmlFor> bound to the input id. Use aria-label only where a visible label is genuinely wrong for the design (e.g. a search box beside a magnifier button).",
    avoid: "Placeholder as the only label; aria-label when a visible label would fit.",
    example: { before: '<input id="email" placeholder="Email" />', after: '<label htmlFor="email">Email</label>\n<input id="email" />' },
    fixability: "mechanical"
  },
  "FR-204": {
    why: "Screen reader users navigate by headings; skipped levels or several h1s break the outline.",
    recipe: "Use one h1 per page, then h2, h3 in order. Choose the level by structure and style it with CSS.",
    avoid: "Picking h3 because it looks smaller.",
    fixability: "mechanical"
  },
  "FR-205": {
    why: "Keyboard users cannot see where focus is when the outline is removed.",
    recipe: "Keep a visible focus style. Replace outline-none with focus-visible:outline-2 focus-visible:outline-offset-2 (or a :focus-visible rule with a visible outline).",
    avoid: "outline: none with no replacement; styling :focus only for mouse users.",
    fixability: "mechanical"
  },
  "FR-206": {
    why: "A clickable div is not reachable by keyboard and has no role for assistive technology.",
    recipe: 'Use a <button> (or <a href> for navigation). Only if that is impossible, add role="button", tabIndex={0} and Enter/Space key handlers.',
    avoid: 'role="button" without keyboard handlers.',
    example: { before: "<div onClick={open}>Open</div>", after: '<button type="button" onClick={open}>Open</button>' },
    fixability: "mechanical"
  },
  "FR-207": {
    why: "A positive tabIndex pulls the element out of the natural order and makes focus jump unpredictably.",
    recipe: "Use tabIndex={0} (join the natural order) or -1 (focusable by script only), and fix the order by moving the element in the DOM.",
    avoid: "tabIndex={1}, {2}... to force an order.",
    fixability: "mechanical"
  },
  "FR-208": {
    why: "Data that loads, comes back empty or fails leaves the user staring at nothing.",
    recipe: "Render three states next to the data: loading (skeleton or spinner with a text label), empty (what to do next), error (what failed and a retry).",
    avoid: "A spinner with no failure path.",
    fixability: "judgment"
  },
  "FR-209": {
    why: "A misspelled aria-* attribute is ignored, so the intended name or state never reaches the user.",
    recipe: "Correct the attribute name against the ARIA spec (aria-labelledby, aria-describedby, aria-expanded...).",
    example: { before: '<input aria-labeledby="h" />', after: '<input aria-labelledby="h" />' },
    fixability: "mechanical"
  },
  "FR-210": {
    why: "A fake countdown pressures users into rushed decisions.",
    recipe: "State the real deadline as a date, or remove the urgency wording.",
    fixability: "judgment"
  },
  "FR-211": {
    why: "A pre-checked consent box opts people in without a decision.",
    recipe: "Leave consent boxes unchecked and make the choice explicit.",
    fixability: "mechanical"
  },
  "FR-212": {
    why: "Guilt-trip wording on the decline option manipulates the choice.",
    recipe: 'Make both options neutral ("No thanks").',
    fixability: "judgment"
  },
  "FR-213": {
    why: "Infinite scroll with no way to stop traps keyboard users and buries the footer.",
    recipe: 'Offer a "Load more" button or pagination, and keep the footer reachable.',
    fixability: "judgment"
  },
  "FR-214": {
    why: '"Free", then a price later, erodes trust.',
    recipe: "Show the full price up front, including recurring cost.",
    fixability: "judgment"
  },
  "FR-215": {
    why: '"Something went wrong" tells the user nothing about what to do next.',
    recipe: "Say what failed in plain words and give a next step: retry, a link, or a way to contact support.",
    fixability: "judgment"
  },
  "FR-216": {
    why: "The wrong input type gives the wrong keyboard on phones and skips built-in validation; no autocomplete blocks password managers and autofill.",
    recipe: 'Use type="email" / "tel" / "password", and set autoComplete (email, tel, current-password, new-password, name).',
    avoid: 'type="text" for everything.',
    example: { before: '<input type="text" name="email" />', after: '<input type="email" name="email" autoComplete="email" />' },
    fixability: "mechanical"
  },
  "FR-217": {
    why: 'Screen reader users browse a list of links out of context, so "click here" says nothing; href="#" links go nowhere.',
    recipe: "Name the destination or action in the link text. Use a <button> for an action, a real URL for navigation.",
    avoid: '"click here", "read more", or href="#" with an onClick.',
    example: { before: '<a href="#" onClick={save}>Save</a>', after: '<button type="button" onClick={save}>Save</button>' },
    fixability: "mechanical"
  },
  "FR-218": {
    why: "A missing lang makes screen readers use the wrong voice; a missing title leaves the tab and the page unnamed; a viewport that blocks zoom shuts out low-vision users.",
    recipe: 'Set <html lang="en"> (the real language), add a unique <title>, and remove user-scalable=no / maximum-scale=1 from the viewport meta.',
    avoid: 'Blocking zoom to "fix" a layout problem.',
    fixability: "mechanical"
  },
  "FR-219": {
    why: "Motion can trigger nausea or distraction for some users, and they can ask their system to reduce it.",
    recipe: "Wrap the animation in @media (prefers-reduced-motion: no-preference), or disable it under (prefers-reduced-motion: reduce).",
    fixability: "mechanical"
  },
  "FR-220": {
    why: "Sound that starts on its own startles users and talks over a screen reader; browsers block it anyway.",
    recipe: "Start muted and show controls, or play only after a user action.",
    fixability: "mechanical"
  },
  "FR-221": {
    why: "A hover-only reaction cannot be reached with a keyboard or a touchscreen.",
    recipe: "Do the same on focus (onFocus/onBlur) and on tap/click, and make the element focusable.",
    fixability: "mechanical"
  },
  "FR-222": {
    why: "Lorem ipsum and TODO text that ships makes the product look unfinished.",
    recipe: "Replace it with real copy before release.",
    fixability: "judgment"
  },
  "FR-301": {
    why: "Hardcoded colors drift from the design system and make theming painful.",
    recipe: "Use the project tokens (CSS variables or palette utilities) instead of literal hex values.",
    fixability: "mechanical"
  },
  "FR-302": {
    why: "Off-scale font sizes break the type rhythm.",
    recipe: "Use the type scale (text-sm, text-base, ...) or add the size to the theme.",
    fixability: "mechanical"
  },
  "FR-303": {
    why: "Off-scale spacing makes layouts inconsistent.",
    recipe: "Use the spacing scale (p-4, gap-2, ...) or extend the theme.",
    fixability: "mechanical"
  },
  "FR-304": {
    why: "Low contrast text is hard to read for many people, and unreadable in sunlight.",
    recipe: "Raise the contrast to at least 4.5:1 for body text (3:1 for large text) by darkening the text or lightening the background.",
    fixability: "judgment"
  },
  "FR-305": {
    why: "Tiny hit areas are hard to tap, especially for people with motor impairments.",
    recipe: "Give interactive elements at least 24x24px (44x44px on touch) with padding, not just font size.",
    fixability: "mechanical"
  },
  "FR-361": {
    why: "Italic serif display headlines are a recognisable AI-generated look.",
    recipe: "Choose type from the project design system for headlines.",
    fixability: "judgment"
  },
  "FR-362": {
    why: "The uppercase eyebrow chip above a headline is a recognisable AI-generated look.",
    recipe: "Drop the chip or fold the content into the heading or subheading.",
    fixability: "judgment"
  },
  "FR-363": {
    why: "Cards nested in cards add visual noise and hide hierarchy.",
    recipe: "Flatten: use spacing and one border level.",
    fixability: "judgment"
  },
  "FR-364": {
    why: "A stack of icon tiles is a recognisable AI-generated layout.",
    recipe: "Replace with content that carries information, or vary the structure.",
    fixability: "judgment"
  },
  "FR-365": {
    why: "A thin border with a wide shadow signals elevation inconsistently.",
    recipe: "Pick one: a border for flat surfaces or a soft shadow for raised ones.",
    fixability: "judgment"
  },
  "FR-366": {
    why: "Many status chips make a page read as noise.",
    recipe: "Keep chips that carry state the user acts on; merge or drop the rest.",
    fixability: "judgment"
  },
  "FR-367": {
    why: '"01 Discover" style labels are a recognisable AI-generated look.',
    recipe: "Use plain section headings.",
    fixability: "judgment"
  },
  "FR-368": {
    why: "The violet/indigo gradient is a recognisable AI-generated look.",
    recipe: "Use the project brand colors.",
    fixability: "judgment"
  },
  "FR-369": {
    why: "Emoji in headings read as decoration and can be announced noisily.",
    recipe: "Remove the emoji, or put a real icon beside the heading with aria-hidden.",
    fixability: "judgment"
  }
};

// src/prioritize.ts
var TIER = { error: 1e3, review: 400, signal: 100 };
var WCAG_A = /* @__PURE__ */ new Set(["1.1.1", "1.3.1", "2.1.1", "2.4.3", "3.3.2", "4.1.2"]);
var WCAG_AA = /* @__PURE__ */ new Set(["1.4.3", "2.4.7", "2.5.8"]);
var CRITICAL_BONUS = 40;
var SHARED_FROM = 3;
var IMPORT = /(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;
function importerCounts(sources) {
  const counts = /* @__PURE__ */ new Map();
  for (const src of sources.values()) {
    const seen = /* @__PURE__ */ new Set();
    for (const m of src.matchAll(IMPORT)) seen.add(basename(m[1], extname(m[1])));
    for (const b of seen) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return counts;
}
function prioritize(findings, sources, root, critical) {
  const crit = critical.map(globToRegex);
  const importers = importerCounts(sources);
  const clusters = /* @__PURE__ */ new Map();
  const out = findings.map((f) => {
    const rel = relative3(root, f.loc.file);
    const blast = Math.min(20, 4 * Math.log2(1 + (importers.get(basename(rel, extname(rel))) ?? 0)));
    const level = f.wcag && WCAG_A.has(f.wcag) ? 30 : f.wcag && WCAG_AA.has(f.wcag) ? 15 : 0;
    const priority = Math.round(TIER[f.severity] + level + (crit.some((r) => r.test(rel)) ? CRITICAL_BONUS : 0) + blast);
    const id = `${f.rule}@${rel}`;
    const by = importers.get(basename(rel, extname(rel))) ?? 0;
    const c = clusters.get(id) ?? { id, rule: f.rule, file: rel, count: 0, priority: 0, fixability: GUIDANCE[f.rule]?.fixability ?? "judgment", rootCause: by >= SHARED_FROM ? "shared component" : "local", importedBy: by, critical: crit.some((r) => r.test(rel)) };
    c.count++;
    c.priority = Math.max(c.priority, priority);
    clusters.set(id, c);
    return { ...f, priority, cluster: id, fixability: c.fixability };
  });
  for (const c of clusters.values()) c.priority += Math.round(Math.min(15, 3 * Math.log2(c.count)));
  return { findings: out, clusters: [...clusters.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)) };
}

// src/check.ts
async function runCheck(root, cfg = loadConfig(root), useBaseline = true, only, lean = false) {
  const stack = detectStack(root);
  const files = walk(root, cfg);
  const rules = activeRules(cfg);
  const findings = [];
  const skipped = [];
  const cssSources = [];
  const contexts = [];
  const toParse = lean && only && !cfg.tokenSource ? files.filter((f) => only.has(f)) : files;
  for (const file2 of toParse) {
    let source = "";
    try {
      source = readFileSync5(file2, "utf8");
    } catch {
      skipped.push(file2);
      continue;
    }
    const ctx = { file: file2, source, elems: [], css: [], tokenColors: [] };
    try {
      if (/\.(jsx|tsx|js|ts)$/.test(file2)) ctx.elems = parseJsx(file2, source);
      else if (/\.html$/.test(file2)) ctx.elems = parseHtml(file2, source);
      else if (/\.(css|scss)$/.test(file2)) {
        ctx.css = parseCss(file2, source);
        cssSources.push({ file: file2, source });
      }
    } catch (e) {
      if (e.message.startsWith("parse-skip")) {
        skipped.push(file2);
        continue;
      }
      throw e;
    }
    contexts.push(ctx);
  }
  const tokenColors = gatherTokenColors(root, cfg, cssSources);
  for (const ctx of contexts) ctx.tokenColors = tokenColors;
  for (const ctx of contexts) {
    if (only && !only.has(ctx.file)) continue;
    for (const rule of rules) findings.push(...rule.check(ctx));
  }
  const lines = new Map(contexts.map((c) => [c.file, c.source.split("\n")]));
  const live = findings.filter((f) => !suppressedIds(lines.get(f.loc.file) ?? [], f.loc.line).has(f.rule));
  const suppressed = findings.length - live.length;
  const { fresh, known } = useBaseline ? applyBaseline(root, live) : { fresh: live, known: 0 };
  const counts = { error: 0, review: 0, signal: 0 };
  for (const f of fresh) counts[f.severity]++;
  const ranked = prioritize(fresh, new Map(contexts.map((c) => [c.file, c.source])), root, cfg.critical ?? []);
  return { stack, files: only ? only.size : files.length, skipped, findings: ranked.findings, clusters: ranked.clusters, counts, score: score(counts, cfg.weights, only ? only.size : files.length), ...known ? { baselined: known } : {}, ...suppressed ? { suppressed } : {} };
}

// src/receipts.ts
import { readFileSync as readFileSync6, renameSync, writeFileSync as writeFileSync3 } from "fs";
import { join as join7, relative as relative4 } from "path";

// src/state.ts
import { existsSync as existsSync2, mkdirSync, writeFileSync as writeFileSync2 } from "fs";
import { join as join6 } from "path";
function fringeDir(root) {
  const dir = join6(root, ".fringe");
  mkdirSync(dir, { recursive: true });
  const ignore = join6(dir, ".gitignore");
  if (!existsSync2(ignore)) writeFileSync2(ignore, "*\n");
  return dir;
}

// src/receipts.ts
var file = (root) => join7(root, ".fringe", "last.json");
function readState(root) {
  try {
    const p = JSON.parse(readFileSync6(file(root), "utf8"));
    return p && typeof p === "object" && !Array.isArray(p) ? p : void 0;
  } catch {
    return void 0;
  }
}
function receipts(root, findings, scope) {
  const errs = findings.filter((f) => f.severity === "error");
  const cur = {};
  for (const f of errs) (cur[relative4(root, f.loc.file)] ??= []).push(keyOf(root, f));
  const scoped = scope ? new Set(scope.map((s) => relative4(root, s))) : void 0;
  const prevState = readState(root);
  try {
    const next = { ...scoped ? prevState : void 0 };
    for (const k of scoped ?? Object.keys({ ...prevState, ...cur })) {
      if (cur[k]?.length) next[k] = cur[k];
      else delete next[k];
    }
    const tmp = `${file(root)}.${process.pid}.tmp`;
    fringeDir(root);
    writeFileSync3(tmp, JSON.stringify(next));
    renameSync(tmp, file(root));
  } catch {
  }
  if (!prevState) return void 0;
  const left = /* @__PURE__ */ new Map();
  for (const [f, keys] of Object.entries(prevState)) if (!scoped || scoped.has(f)) for (const k of keys) left.set(k, (left.get(k) ?? 0) + 1);
  const inScope = errs.filter((f) => !scoped || scoped.has(relative4(root, f.loc.file)));
  const introduced = inScope.filter((f) => {
    const k = keyOf(root, f), n = left.get(k) ?? 0;
    if (n > 0) {
      left.set(k, n - 1);
      return false;
    }
    return true;
  });
  return { introduced, fixed: [...left.values()].reduce((a, b) => a + b, 0) };
}

// src/report/hook.ts
import { relative as relative5 } from "path";
function toClaudeHook(r, root, history) {
  const all = r.findings.filter((f) => f.severity === "error");
  if (all.length === 0) return "";
  const fresh = new Set(history?.introduced);
  const errs = [...all.filter((f) => fresh.has(f)), ...all.filter((f) => !fresh.has(f))];
  const note = history && (history.introduced.length > 0 || history.fixed > 0) ? `Your last edit introduced ${history.introduced.length} new error(s)${history.fixed ? ` and fixed ${history.fixed}` : ""}; ${errs.length} failing in total. New ones are marked NEW.
` : "";
  const shown = errs.slice(0, 8).map((f) => `- ${fresh.has(f) ? "NEW " : ""}${f.rule} ${relative5(root, f.loc.file)}:${f.loc.line} \u2014 ${f.message} (${f.hint})`);
  const shownRules = [...new Set(errs.slice(0, 8).map((f) => f.rule))];
  const recipes = shownRules.map((id) => {
    const g = GUIDANCE[id];
    return g ? `- ${id}: ${g.recipe}${g.avoid ? ` Avoid: ${g.avoid}` : ""}` : "";
  }).filter(Boolean);
  const more = errs.length > shown.length ? `
\u2026and ${errs.length - shown.length} more (run \`fringe check\`).` : "";
  return JSON.stringify({
    decision: "block",
    reason: `${note}Fringe found ${errs.length} accessibility error(s). Fix them before finishing:
${shown.join("\n")}${more}
How to fix them well:
${recipes.join("\n")}
Use a fringe-ignore comment only for a genuine false positive, and say so.`
  });
}

// src/patterns.ts
var APG = "https://www.w3.org/WAI/ARIA/apg/patterns";
var WCAG = "https://www.w3.org/WAI/WCAG22/Understanding";
var SOURCES = {
  form: [`${WCAG}/labels-or-instructions.html`, `${WCAG}/error-identification.html`, "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill"],
  auth: [`${WCAG}/accessible-authentication-minimum.html`, "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill"],
  checkout: [`${WCAG}/error-prevention-legal-financial-data.html`, "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill"],
  table: [`${APG}/table/`],
  search: [`${APG}/combobox/`, "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/"],
  tabs: [`${APG}/tabs/`],
  accordion: [`${APG}/accordion/`],
  toast: [`${APG}/alert/`, `${WCAG}/status-messages.html`],
  upload: [`${WCAG}/error-identification.html`, `${WCAG}/status-messages.html`],
  datepicker: [`${APG}/dialog-modal/examples/datepicker-dialog/`],
  onboarding: [`${WCAG}/content-on-hover-or-focus.html`],
  modal: [`${APG}/dialog-modal/`],
  navigation: [`${WCAG}/bypass-blocks.html`, "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/"],
  "data-view": [`${WCAG}/status-messages.html`],
  dashboard: [`${WCAG}/use-of-color.html`, `${WCAG}/non-text-content.html`, `${WCAG}/reflow.html`],
  settings: [`${WCAG}/status-messages.html`, `${WCAG}/labels-or-instructions.html`],
  carousel: [`${APG}/carousel/`, `${WCAG}/pause-stop-hide.html`],
  "drag-and-drop": [`${WCAG}/dragging-movements.html`],
  "rich-text": [`${APG}/toolbar/`],
  chat: [`${WCAG}/status-messages.html`]
};
var sourcesOf = (name) => SOURCES[name] ?? [];
var PATTERNS = {
  form: {
    title: "Form",
    items: [
      { text: "Every field has a visible <label> bound with htmlFor/id", rules: ["FR-203"] },
      { text: "Right input type and autocomplete (email, tel, current-password, new-password, name) (Fringe checks email, phone and password fields)", rules: ["FR-216"] },
      { text: "Required fields are marked in text, not by color alone" },
      { text: "Errors appear next to the field in words, linked with aria-describedby and aria-invalid; focus moves to the first error on submit" },
      { text: "The submit button shows a pending state and cannot be double-submitted" },
      { text: "Input is kept when an error occurs; validation runs on blur, not on every keystroke" }
    ]
  },
  modal: {
    title: "Modal dialog",
    items: [
      { text: 'role="dialog" with aria-modal="true" and a name (aria-labelledby the title)', rules: ["FR-209"] },
      { text: "Focus moves in on open, stays trapped inside, and returns to the trigger on close" },
      { text: "A visible Close button with an accessible name, and Escape closes", rules: ["FR-202"] },
      { text: "Clicking the backdrop may close it but is never the only way", rules: ["FR-206"] },
      { text: "The page behind is inert and does not scroll" }
    ]
  },
  navigation: {
    title: "Navigation",
    items: [
      { text: "Links use real hrefs and describe the destination", rules: ["FR-217"] },
      { text: "A <nav> landmark (labelled if there are several), one <main>, and a skip-to-content link" },
      { text: 'The current page is marked with aria-current="page"' },
      { text: "Menus open by keyboard and tap, not by hover alone", rules: ["FR-221"] },
      { text: "Focus is always visible", rules: ["FR-205"] },
      { text: "Tap targets are large enough", rules: ["FR-305"] }
    ]
  },
  auth: {
    title: "Sign in and sign up",
    items: [
      { text: "Every field has a visible <label> bound with htmlFor/id (no placeholder-only fields)", rules: ["FR-203"] },
      { text: "Right input types and autocomplete: username or email, current-password (sign in), new-password (sign up), one-time-code for codes (Fringe checks email, phone and password fields)", rules: ["FR-216"] },
      { text: "Social and single-sign-on buttons carry text naming the provider, not just a logo", rules: ["FR-202"] },
      { text: '"Forgot password" is a real link with descriptive text', rules: ["FR-217"] },
      { text: "Password rules are shown before typing, not only after a failure; the user can reveal the password with a named toggle" },
      { text: 'A failed sign-in says "email or password is incorrect" (never which one), keeps the email, and moves focus to the message' },
      { text: "The submit button shows a pending state and cannot be double-submitted; pasting a password is allowed" },
      { text: "The page has a title and a language (checked on full HTML pages), and keyboard focus never gets stuck (checked by scan)", rules: ["FR-218", "FR-401"] },
      { text: "The whole flow, including the reveal toggle and any code entry, works with the keyboard alone" }
    ]
  },
  checkout: {
    title: "Checkout and payment",
    items: [
      { text: "Every field has a visible label", rules: ["FR-203"] },
      { text: "Address and card fields use the standard autocomplete tokens (name, street-address, postal-code, cc-number, cc-exp, cc-csc)" },
      { text: "The full price, including shipping, tax and any recurring cost, is visible before the pay button", rules: ["FR-214"] },
      { text: "No pre-checked marketing or consent boxes", rules: ["FR-211"] },
      { text: "No fake countdowns or manufactured urgency", rules: ["FR-210"] },
      { text: "Declining an upsell or add-on is a neutral choice with neutral wording", rules: ["FR-212"] },
      { text: "A payment failure says what failed in plain words, keeps the cart and the entered details, and offers a retry", rules: ["FR-215"] },
      { text: 'The pay button states the action and amount ("Pay $42.00"), shows a pending state, and cannot charge twice' },
      { text: "Order-summary changes (quantity, coupon, shipping) are announced to screen readers (aria-live)" },
      { text: "Progress through the steps is shown, and going back never loses what was entered" },
      { text: "Before the final payment the user can review and correct the order (WCAG 3.3.4 for financial transactions)" },
      { text: "Tap targets are large enough on a phone", rules: ["FR-305"] }
    ]
  },
  table: {
    title: "Data table",
    items: [
      { text: "A real <table> with <th> headers (scope set) and a caption or accessible name" },
      { text: "Sortable headers are buttons, and the sorted column carries aria-sort" },
      { text: 'Row-action icon buttons have names ("Delete invoice 1042"), and each row checkbox is labelled', rules: ["FR-202", "FR-203"] },
      { text: "Loading, empty (with a next step) and error (with a retry) states", rules: ["FR-208", "FR-215"] },
      { text: "Filters and the search box are labelled", rules: ["FR-203"] },
      { text: "A wide table scrolls inside its own container instead of making the whole page scroll sideways at 320px", rules: ["FR-404"] },
      { text: "Updated results after a filter or sort are announced (aria-live), and keyboard focus is not lost" }
    ]
  },
  search: {
    title: "Search",
    items: [
      { text: "The search field has a label", rules: ["FR-203"] },
      { text: 'The form is marked as a search landmark (role="search"), and Enter submits' },
      { text: "The submit button has a name", rules: ["FR-202"] },
      { text: "A clear button, if any, has a name", rules: ["FR-202"] },
      { text: 'Suggestions use the combobox pattern (role="combobox", aria-expanded, aria-controls, aria-activedescendant); Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "The number of results is announced (aria-live) after a search or filter" },
      { text: '"No results" says what to try next instead of showing an empty page' },
      { text: "The search term stays in the field and in the URL, so back and reload keep it" },
      { text: "Controls are large enough to tap", rules: ["FR-305"] }
    ]
  },
  tabs: {
    title: "Tabs",
    items: [
      { text: 'role="tablist", "tab" and "tabpanel", with aria-selected on the active tab and aria-controls linking tab to panel; Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "Tabs are real buttons, not clickable divs", rules: ["FR-206"] },
      { text: "Never a positive tabindex", rules: ["FR-207"] },
      { text: "Arrow keys move between tabs, Tab moves into the panel, and only the active tab is in the tab order" },
      { text: "The active tab is shown by more than color" },
      { text: "Focus is always visible", rules: ["FR-205"] },
      { text: "Hidden panels are not reachable by keyboard or screen reader" },
      { text: "Tabs that change the page address are links, not tabs" }
    ]
  },
  accordion: {
    title: "Accordion and disclosure",
    items: [
      { text: "The header is a <button> inside a heading (and the only thing inside it), not a clickable div", rules: ["FR-206"] },
      { text: "aria-expanded on the button and aria-controls pointing at the panel; Fringe checks the spelling of the ARIA attributes", rules: ["FR-209"] },
      { text: "Heading levels fit the page outline", rules: ["FR-204"] },
      { text: "Enter and Space toggle it; focus stays on the button" },
      { text: "Focus is always visible", rules: ["FR-205"] },
      { text: "The open or closed state is shown by more than color or a rotating icon alone" }
    ]
  },
  toast: {
    title: "Toast, alert and banner",
    items: [
      { text: 'Status messages use role="status" (polite) and urgent errors role="alert"; they are in the page before they fill with text' },
      { text: "It stays long enough to read (longer for longer text), pauses on hover and focus, and errors do not auto-dismiss" },
      { text: "The dismiss button has a name", rules: ["FR-202"] },
      { text: "An error is also shown where it happened (inline), not only in a toast" },
      { text: "It never steals keyboard focus" },
      { text: "Text has enough contrast against the toast background", rules: ["FR-400"] },
      { text: "Slide-in animations respect reduced motion", rules: ["FR-219"] }
    ]
  },
  upload: {
    title: "File upload",
    items: [
      { text: 'The control has a name (a real <input type="file"> with a label, or a button that opens it)', rules: ["FR-202", "FR-203"] },
      { text: "Allowed types and the size limit are stated before the user chooses a file" },
      { text: "Drag and drop is an extra, never the only way" },
      { text: 'Progress is announced (role="progressbar" with a value, or aria-live text)' },
      { text: "A wrong type or too-large file gets a specific message and a way to retry", rules: ["FR-215"] },
      { text: 'Per-file remove and replace buttons say which file ("Remove invoice.pdf")', rules: ["FR-202"] },
      { text: "Image previews have alt text", rules: ["FR-201"] }
    ]
  },
  datepicker: {
    title: "Date picker",
    items: [
      { text: "Use the native date input where it fits; otherwise typing a date is always possible beside the calendar" },
      { text: "The field has a label", rules: ["FR-203"] },
      { text: "The label states the expected format" },
      { text: 'Each calendar day has an accessible name with the weekday and month, not just the number ("Tuesday 21 October 2026"), and the month and year buttons have names', rules: ["FR-202"] },
      { text: "Left and Right arrows move by day and Up and Down by week, Page Up and Page Down by month (with Shift, by year); only one day is in the Tab sequence" },
      { text: "Escape closes the calendar and returns focus to the button that opened it" },
      { text: "Unavailable dates are explained, not only greyed out" },
      { text: "Day buttons are large enough to tap", rules: ["FR-305"] }
    ]
  },
  onboarding: {
    title: "Onboarding and tours",
    items: [
      { text: "Every step can be skipped, and the flow can be resumed later" },
      { text: 'Progress is shown ("Step 2 of 4")' },
      { text: "Ask only for what is needed now; ask for permissions in context, not up front" },
      { text: "Tooltips and tour steps do not depend on hover alone", rules: ["FR-221"] },
      { text: "Tour steps open and close by keyboard, and Escape closes them" },
      { text: "No pre-checked consent and no manufactured urgency", rules: ["FR-211", "FR-210"] },
      { text: "No placeholder or unfinished copy ships", rules: ["FR-222"] },
      { text: "Animations respect reduced motion", rules: ["FR-219"] },
      { text: "The flow reflows to a 320px screen without sideways scrolling", rules: ["FR-404"] }
    ]
  },
  "empty-state": {
    title: "Empty state",
    items: [
      { text: "The empty case is handled with its own rendering, not a blank area", rules: ["FR-208"] },
      { text: "It says what the area is for and gives one clear next action" },
      { text: 'First-use empty and filtered-to-nothing read differently ("Add your first item" vs "Clear filters")' },
      { text: 'A load failure has its own message with a next step and is never shown as "no data"', rules: ["FR-215"] },
      { text: "The action is a real button or link", rules: ["FR-206", "FR-217"] },
      { text: "Illustrations have an alt attribute: empty if decorative, a description if meaningful", rules: ["FR-201"] },
      { text: "The heading level fits the outline", rules: ["FR-204"] },
      { text: "The copy is finished: no lorem ipsum or TODO", rules: ["FR-222"] }
    ]
  },
  pricing: {
    title: "Pricing and plan pages",
    items: [
      { text: "The full price, including the billing period, taxes and any recurring cost, sits next to each plan", rules: ["FR-214"] },
      { text: "No fake countdowns or invented scarcity", rules: ["FR-210"] },
      { text: "No pre-selected add-ons or pre-checked consent", rules: ["FR-211"] },
      { text: "Downgrading, skipping and cancelling use neutral wording", rules: ["FR-212"] },
      { text: 'Each plan button says which plan ("Choose Pro"), so a list of buttons is not eight copies of "Get started"' },
      { text: "The comparison is a real table with headers, and the selected or recommended plan is shown by more than color" },
      { text: "Cancelling is as easy to find and do as signing up was" },
      { text: "Banner and badge text has enough contrast on its background", rules: ["FR-400"] },
      { text: "No placeholder copy ships", rules: ["FR-222"] }
    ]
  },
  settings: {
    title: "Settings page",
    items: [
      { text: "Every control has a visible label, and related controls are grouped under a heading or fieldset legend", rules: ["FR-203", "FR-204"] },
      { text: 'Toggles expose their state (role="switch" with aria-checked, or a checkbox) and the state is not shown by color alone; Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "Either a save button with clear confirmation, or instant saving with visible feedback; the page says which" },
      { text: 'Success and failure of a save are announced (role="status" or "alert")' },
      { text: "Destructive actions (delete account) are set apart, confirmed with specific wording, and undoable where possible" },
      { text: "Leaving with unsaved changes asks first" },
      { text: "The keyboard order follows the visual order (no positive tabindex)", rules: ["FR-207"] }
    ]
  },
  dashboard: {
    title: "Dashboard",
    items: [
      { text: "One h1, with sections as headings in order", rules: ["FR-204"] },
      { text: "Each chart or metric has a text equivalent (a table or a sentence), and values are not conveyed by color alone" },
      { text: "Clickable stat cards are real links or buttons", rules: ["FR-206"] },
      { text: "Every widget handles loading, empty and error on its own", rules: ["FR-208", "FR-215"] },
      { text: "Refresh, filter and settings icon buttons have names", rules: ["FR-202"] },
      { text: "Auto-refresh does not steal focus or reset filters, and announces changes politely" },
      { text: "Cards stack to one column on a 320px screen without sideways scrolling", rules: ["FR-404"] },
      { text: "Text and chart labels keep their contrast in dark mode", rules: ["FR-400"] }
    ]
  },
  carousel: {
    title: "Carousel",
    items: [
      { text: "If it rotates by itself, there is a button to stop and restart it, early in the tab order" },
      { text: "Rotation stops when keyboard focus enters the carousel and does not restart unless the user asks; it also stops while the pointer hovers over it" },
      { text: 'Previous, next and slide-picker controls are buttons with names ("Next slide", "Slide 2 of 5")', rules: ["FR-202"] },
      { text: 'The carousel is a labelled region (role="region", aria-roledescription="carousel") and each slide is labelled "2 of 5"; Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "Slides that are not showing are hidden from screen readers and the keyboard, not just moved off-screen" },
      { text: "Changes of slide are announced politely when the user changes them, and not at all while it rotates by itself" },
      { text: "Slide images have alt text", rules: ["FR-201"] },
      { text: "Sliding animations respect reduced motion", rules: ["FR-219"] },
      { text: "Controls are large enough to tap", rules: ["FR-305"] }
    ]
  },
  "drag-and-drop": {
    title: "Drag and drop",
    items: [
      { text: 'Every drag has an alternative that needs only a single click or tap: "Move up", "Move to\u2026" buttons or a menu (WCAG 2.5.7)' },
      { text: "A keyboard way to do the same: pick up with Space or Enter, move with the arrow keys, drop with Space, cancel with Escape" },
      { text: 'The drag handle is a real button with a name ("Reorder Task 3")', rules: ["FR-202"] },
      { text: 'Pick-up, movement and drop are announced ("Task 3 moved to position 2 of 5") through a live region' },
      { text: "Handles are not revealed by hover alone", rules: ["FR-221"] },
      { text: "Focus is visible on the handle and the item", rules: ["FR-205"] },
      { text: "Items that react to clicks are buttons or links, not clickable divs", rules: ["FR-206"] },
      { text: "Drop targets are shown by more than color" }
    ]
  },
  "rich-text": {
    title: "Rich-text editor",
    items: [
      { text: 'The toolbar is a labelled role="toolbar", its buttons have names and show their on/off state with aria-pressed (Fringe checks the names and the spelling of the attribute)', rules: ["FR-202", "FR-209"] },
      { text: "Arrow keys move between toolbar buttons and only one is in the Tab sequence" },
      { text: 'The editing area has an accessible name and role="textbox" with aria-multiline' },
      { text: "Tab leaves the editor (or the page documents how), so focus never gets stuck", rules: ["FR-401"] },
      { text: "Inserted images ask for alt text, and what the editor outputs has it", rules: ["FR-201"] },
      { text: 'Inserted links ask for link text, and the output avoids "click here"', rules: ["FR-217"] },
      { text: 'Autosave and save errors are announced (role="status" or "alert")' },
      { text: "Pasted content is cleaned before it is stored or shown" },
      { text: "Undo and redo are available from the keyboard and as buttons" }
    ]
  },
  chat: {
    title: "Chat and messaging",
    items: [
      { text: 'The message list is a live log (role="log"): new messages are announced politely without moving focus' },
      { text: "The message box has a label, and the send button has a name", rules: ["FR-203", "FR-202"] },
      { text: "The page says whether Enter sends or adds a new line (and Shift+Enter does the other)" },
      { text: "A typing or streaming indicator does not re-announce the whole message with every update" },
      { text: "Who sent each message, and when, is available as text, not by alignment or color alone" },
      { text: "A failed send shows what failed and a retry", rules: ["FR-215"] },
      { text: 'New messages do not yank the view if the user scrolled up; a "jump to latest" control is offered' },
      { text: "Links inside messages have descriptive text", rules: ["FR-217"] },
      { text: "Entrance animations respect reduced motion", rules: ["FR-219"] }
    ]
  },
  "data-view": {
    title: "Data view (list, table, dashboard)",
    items: [
      { text: "A loading state with a text label, an empty state that says what to do next, and an error state with a retry", rules: ["FR-208", "FR-215"] },
      { text: "Layout does not jump when data arrives (reserve the space)" },
      { text: "Async updates are announced (aria-live) when the user did not trigger them" },
      { text: "Table headers use <th> and a caption or accessible name" }
    ]
  }
};

// src/promptHook.ts
var TRIGGERS = [
  ["carousel", /carousel|slider|slideshow|image gallery/i],
  ["tabs", /\btabs?\b|tabbed/i],
  ["modal", /\bmodal|dialog|pop-?up|lightbox/i],
  ["datepicker", /date ?picker|calendar|date (input|range)/i],
  ["accordion", /accordion|collapsible|expandable|\bfaq\b/i],
  ["toast", /toast|snackbar|notification banner|alert banner/i],
  ["upload", /upload|file (input|picker)|attachment/i],
  ["drag-and-drop", /drag|drop ?zone|reorder|sortable|kanban/i],
  ["rich-text", /rich[- ]?text|wysiwyg|text editor|markdown editor/i],
  ["chat", /\bchat|messag(e|ing) (list|thread|ui)|conversation/i],
  ["table", /\btables?\b|data ?grid|spreadsheet/i],
  ["checkout", /checkout|payment|billing|credit card/i],
  ["auth", /sign[- ]?(in|up)|log[- ]?in|register|authenticat|forgot password|password reset/i],
  ["pricing", /pricing|plans? (page|comparison)|subscription (page|plans?)/i],
  ["settings", /settings|preferences|account page/i],
  ["dashboard", /dashboard|analytics (page|view)|stat cards?/i],
  ["onboarding", /onboarding|walkthrough|product tour|welcome flow/i],
  ["empty-state", /empty state|no (results|data) (state|view)/i],
  ["search", /\bsearch|autocomplete|typeahead/i],
  ["navigation", /navbar|nav ?bar|navigation|sidebar|menu|breadcrumb/i],
  ["form", /\bforms?\b|input field|contact form|signup form/i]
];
var AMBIGUOUS = /* @__PURE__ */ new Set(["table", "search", "settings", "chat", "form", "dashboard", "auth", "pricing", "checkout", "navigation", "upload"]);
var UI_CUE = /\b(component|page|screen|ui|ux|frontend|front-end|react|vue|svelte|angular|next\.?js|tailwind|jsx|tsx|html|css|button|modal|layout|widget|view|widgets)\b|\.(tsx|jsx|vue|svelte|html|css)\b/i;
var BACKEND_CUE = /\b(database|sql|postgres|mysql|migration|schema|orm|api|endpoint|cli|command[- ]line|script|backend|server|query|docker|kubernetes|logs?|cron|worker|queue)\b/i;
var BUILD = /\b(create|build|add|make|implement|write|design|develop|generate|scaffold|set up|put together)\b/i;
function matchPlaybooks(prompt, max = 2) {
  if (!BUILD.test(prompt)) return [];
  const ui = UI_CUE.test(prompt);
  if (BACKEND_CUE.test(prompt) && !ui) return [];
  return TRIGGERS.filter(([name, re]) => re.test(prompt) && (ui || !AMBIGUOUS.has(name))).map(([name]) => name).slice(0, max);
}
function playbookContext(names) {
  const blocks = names.map((n) => {
    const p = PATTERNS[n];
    const lines = p.items.map((i) => `- ${i.text} [${i.rules ? `Fringe checks: ${i.rules.join(", ")}` : "yours to get right"}]`);
    const src = sourcesOf(n)[0];
    return `${p.title}: build it like this
${lines.join("\n")}${src ? `
(based on ${src})` : ""}`;
  });
  return `Fringe playbook${names.length > 1 ? "s" : ""} for what you are about to build. Follow it while you write the code; Fringe will check the "Fringe checks" items after each edit, and the rest are yours to get right (say in your final message how you handled them).

${blocks.join("\n\n")}`;
}
function promptHookOutput(stdin) {
  let prompt = "";
  try {
    prompt = String(JSON.parse(stdin).prompt ?? "");
  } catch {
    prompt = stdin;
  }
  const names = matchPlaybooks(prompt);
  if (names.length === 0) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: playbookContext(names) } });
}

// src/pluginHook.ts
var readStdin = () => new Promise((ok) => {
  if (process.stdin.isTTY) return ok("");
  let d = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => d += c);
  process.stdin.on("end", () => ok(d));
});
function editedFile(stdin, cwd) {
  try {
    const p = JSON.parse(stdin)?.tool_input?.file_path;
    if (typeof p !== "string") return void 0;
    const rel = relative6(realpathSync(cwd), realpathSync(p));
    return rel && !rel.startsWith("..") && !isAbsolute2(rel) ? join8(cwd, rel) : void 0;
  } catch {
    return void 0;
  }
}
async function main(argv, cwd, log) {
  try {
    if (argv[0] === "check") {
      const cfg = loadConfig(cwd);
      const file2 = editedFile(await readStdin(), cwd);
      const only = file2 ? /* @__PURE__ */ new Set([file2]) : void 0;
      const result = await runCheck(cwd, cfg, true, only, true);
      const out = toClaudeHook(result, cwd, receipts(cwd, result.findings, file2 ? [file2] : void 0));
      if (out) log(out);
    } else if (argv[0] === "hook-prompt") {
      const out = promptHookOutput(await readStdin());
      if (out) log(out);
    }
  } catch {
  }
}
if (process.argv[1] && /pluginHook\.(m?js|ts)$/.test(process.argv[1])) await main(process.argv.slice(2), process.cwd(), (s) => console.log(s));
export {
  main
};
