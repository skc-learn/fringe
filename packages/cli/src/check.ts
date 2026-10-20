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

export async function runCheck(root: string, cfg: FringeConfig = loadConfig(root)): Promise<CheckResult> {
  const stack = detectStack(root);
  const files = walk(root, cfg);
  const rules = activeRules(cfg);
  const findings = [] as CheckResult['findings'];
  const skipped: string[] = [];
  const counts: Counts = { error: 0, review: 0, signal: 0 };
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
    for (const rule of rules) for (const f of rule.check(ctx)) { findings.push(f); counts[f.severity]++; }
  }
  return { stack, files: files.length, skipped, findings, counts, score: score(counts, cfg.weights) };
}
