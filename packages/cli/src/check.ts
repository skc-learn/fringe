import { readFileSync } from 'node:fs';
import type { CheckResult, Counts, FringeConfig, RuleContext } from './types.js';
import { loadConfig } from './config.js';
import { detectStack } from './detect.js';
import { walk } from './walk.js';
import { parseJsx } from './parse/jsx.js';
import { parseHtml } from './parse/html.js';
import { parseCss } from './parse/css.js';
import { activeRules } from './rules/registry.js';
import { score } from './score.js';
import { gatherTokenColors } from './tokens.js';
import { applyBaseline } from './baseline.js';
import { suppressedIds } from './suppress.js';
import { prioritize } from './prioritize.js';

export async function runCheck(root: string, cfg: FringeConfig = loadConfig(root), useBaseline = true, only?: Set<string>): Promise<CheckResult> {
  // Two-phase by design: walk+parse everything first, then run rules over the contexts.
  // ACCEPTED DEVIATION (memory profile): every RuleContext — including its full source
  // string — is retained until the run completes, because the token gather needs all CSS
  // sources before any rule runs. On very large roots this holds the whole corpus in
  // memory. The tracked follow-up is a restructure to a pre-pass CSS read (one walk for
  // CSS/tokens, then a streaming per-file rule pass) so contexts can be dropped as they
  // are checked. Behavior is unchanged by this note.
  const stack = detectStack(root);
  const files = walk(root, cfg);
  const rules = activeRules(cfg);
  const findings = [] as CheckResult['findings'];
  const skipped: string[] = [];
  const cssSources: Array<{ file: string; source: string }> = [];
  const contexts: RuleContext[] = [];
  for (const file of files) {
    let source = '';
    try { source = readFileSync(file, 'utf8'); } catch { skipped.push(file); continue; }
    const ctx: RuleContext = { file, source, elems: [], css: [], tokenColors: [] };
    try {
      if (/\.(jsx|tsx|js|ts)$/.test(file)) ctx.elems = parseJsx(file, source);
      else if (/\.html$/.test(file)) ctx.elems = parseHtml(file, source);
      else if (/\.(css|scss)$/.test(file)) {
        ctx.css = parseCss(file, source);
        cssSources.push({ file, source });
      }
    } catch (e) {
      if ((e as Error).message.startsWith('parse-skip')) { skipped.push(file); continue; }
      throw e;
    }
    contexts.push(ctx);
  }
  // Gathered once after the walk (css sources are only fully known then), shared by every context.
  const tokenColors = gatherTokenColors(root, cfg, cssSources);
  for (const ctx of contexts) ctx.tokenColors = tokenColors;
  for (const ctx of contexts) {
    if (only && !only.has(ctx.file)) continue; // whole tree is still parsed (tokens need it); only these files are judged
    for (const rule of rules) findings.push(...rule.check(ctx));
  }
  const lines = new Map(contexts.map((c) => [c.file, c.source.split('\n')]));
  const live = findings.filter((f) => !suppressedIds(lines.get(f.loc.file) ?? [], f.loc.line).has(f.rule));
  const suppressed = findings.length - live.length;
  const { fresh, known } = useBaseline ? applyBaseline(root, live) : { fresh: live, known: 0 };
  const counts: Counts = { error: 0, review: 0, signal: 0 };
  for (const f of fresh) counts[f.severity]++;
  const ranked = prioritize(fresh, new Map(contexts.map((c) => [c.file, c.source])), root, cfg.critical ?? []);
  return { stack, files: only ? only.size : files.length, skipped, findings: ranked.findings, clusters: ranked.clusters, counts, score: score(counts, cfg.weights, only ? only.size : files.length), ...(known ? { baselined: known } : {}), ...(suppressed ? { suppressed } : {}) };
}
