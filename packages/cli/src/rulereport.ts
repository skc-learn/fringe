import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCheck } from './check.js';
import { loadConfig } from './config.js';
import { readLedger } from './ledger.js';
import { walk } from './walk.js';
import { ALL_RULES } from './rules/registry.js';

export interface RuleRow { rule: string; severity: string; open: number; baselined: number; silenced: number; overridden: number; trend?: string }

/** Per rule in this repo: how many findings are open, accepted into the baseline, or silenced inline. A rule that is mostly overridden is a candidate to retune, disable or report as a false positive. */
export async function ruleReport(root: string): Promise<RuleRow[]> {
  const cfg = loadConfig(root);
  const result = await runCheck(root, cfg, false); // baseline off, so baselined findings still count as "open" here, then we split them out below
  const baselinedBy = new Map<string, number>();
  const bl = join(root, 'fringe.baseline.json');
  if (existsSync(bl)) { try { for (const k of JSON.parse(readFileSync(bl, 'utf8')) as string[]) baselinedBy.set(k.split('|')[0], (baselinedBy.get(k.split('|')[0]) ?? 0) + 1); } catch { /* corrupt baseline is reported by check */ } }
  const silencedBy = new Map<string, number>();
  for (const f of walk(root, cfg)) {
    let src = ''; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/fringe-ignore\s+((?:FR-\d+[\s,]*)+)/g)) for (const id of m[1].match(/FR-\d+/g) ?? []) silencedBy.set(id, (silencedBy.get(id) ?? 0) + 1);
  }
  const rawBy = new Map<string, number>();
  for (const f of result.findings) rawBy.set(f.rule, (rawBy.get(f.rule) ?? 0) + 1);
  const { records } = readLedger(root);
  const first = records[0]?.byRule, last = records[records.length - 1]?.byRule;
  return ALL_RULES.map((r) => {
    const baselined = Math.min(baselinedBy.get(r.id) ?? 0, rawBy.get(r.id) ?? 0), silenced = silencedBy.get(r.id) ?? 0;
    const open = (rawBy.get(r.id) ?? 0) - baselined;
    const trend = records.length >= 2 && first && last ? `${first[r.id] ?? 0} -> ${last[r.id] ?? 0}` : undefined;
    return { rule: r.id, severity: r.severity, open, baselined, silenced, overridden: baselined + silenced, ...(trend ? { trend } : {}) };
  }).filter((x) => x.open + x.baselined + x.silenced > 0).sort((a, b) => b.overridden - a.overridden || b.open - a.open);
}

export function rulesToText(rows: RuleRow[]): string {
  if (rows.length === 0) return 'No findings, baselined entries or suppressions: nothing to report per rule.';
  const hasTrend = rows.some((r) => r.trend);
  const head = ['rule', 'severity', 'open', 'baselined', 'silenced', ...(hasTrend ? ['ledger trend'] : [])];
  const body = rows.map((r) => [r.rule, r.severity, String(r.open), String(r.baselined), String(r.silenced), ...(hasTrend ? [r.trend ?? '-'] : [])]);
  const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (c: string[]) => c.map((x, i) => x.padEnd(w[i])).join('  ').trimEnd();
  const noisy = rows.filter((r) => r.overridden >= 5 && r.overridden / (r.open + r.overridden) >= 0.5);
  return [line(head), ...body.map(line),
    ...(noisy.length ? ['', `Mostly overridden here (${noisy.map((r) => r.rule).join(', ')}): the rule may not suit this repo. Check a few silenced cases; if they are wrong findings, disable the rule in fringe.config.json or report a false positive.`] : [])].join('\n');
}
