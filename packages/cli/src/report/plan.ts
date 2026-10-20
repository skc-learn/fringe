import { GUIDANCE } from '../guidance.js';
import type { CheckResult, Cluster } from '../types.js';

export interface PlanItem extends Cluster { lines: number[]; recipe?: string; avoid?: string }
export interface Batch { id: 'P0' | 'P1' | 'P2' | 'P3'; title: string; why: string; items: PlanItem[]; more: number }

const TITLES: Record<Batch['id'], [string, string]> = {
  P0: ['Fix first', 'errors in shared components or critical paths: one fix clears many uses'],
  P1: ['Then the other errors', 'blocking problems; mechanical fixes first'],
  P2: ['Review', 'heuristics that need your judgment'],
  P3: ['Polish', 'advice only; never blocks'],
};

/** Orders a result's clusters into fix batches. Pure: same result in, same plan out. */
export function buildPlan(r: CheckResult, limit = 15): Batch[] {
  const lines = new Map<string, number[]>();
  for (const f of r.findings) if (f.cluster) lines.set(f.cluster, [...(lines.get(f.cluster) ?? []), f.loc.line]);
  const sev = new Map(r.findings.map((f) => [f.cluster, f.severity]));
  const items: PlanItem[] = (r.clusters ?? []).map((c) => ({ ...c, lines: lines.get(c.id) ?? [], recipe: GUIDANCE[c.rule]?.recipe, avoid: GUIDANCE[c.rule]?.avoid }));
  const mechFirst = (a: PlanItem, b: PlanItem) => (a.fixability === b.fixability ? 0 : a.fixability === 'mechanical' ? -1 : 1) || b.priority - a.priority;
  const pick = (id: Batch['id']): PlanItem[] => items.filter((c) => {
    const s = sev.get(c.id);
    if (id === 'P0') return s === 'error' && (c.rootCause === 'shared component' || c.critical);
    if (id === 'P1') return s === 'error' && !(c.rootCause === 'shared component' || c.critical);
    return s === (id === 'P2' ? 'review' : 'signal');
  }).sort(id === 'P1' ? mechFirst : (a, b) => b.priority - a.priority);
  return (['P0', 'P1', 'P2', 'P3'] as const).map((id) => {
    const all = pick(id);
    return { id, title: TITLES[id][0], why: TITLES[id][1], items: all.slice(0, limit), more: Math.max(0, all.length - limit) };
  }).filter((b) => b.items.length > 0);
}

export function toPlanJson(r: CheckResult, limit?: number): string {
  return JSON.stringify({ schema: 'fringe/plan.v1', score: r.score, counts: r.counts, batches: buildPlan(r, limit) }, null, 2);
}

export function toPlanMarkdown(r: CheckResult, target: string, limit?: number): string {
  const batches = buildPlan(r, limit);
  const head = `# Fringe fix plan\n\nhealth ${r.score}/100 · ${r.counts.error} errors · ${r.counts.review} review · ${r.counts.signal} signals`;
  if (batches.length === 0) return `${head}\n\nNothing to fix.`;
  const out = [head];
  for (const b of batches) {
    out.push(`\n## ${b.id} · ${b.title}\n_${b.why}_`);
    const shown = new Set<string>();
    for (const c of b.items) {
      const tags = [c.rootCause === 'shared component' ? `shared component, imported by ${c.importedBy} files` : '', c.critical ? 'critical path' : '', `${c.fixability} fix`].filter(Boolean);
      out.push(`\n### ${c.rule} · ×${c.count} · ${c.file} (${tags.join('; ')})`);
      out.push(`Lines: ${c.lines.slice(0, 8).join(', ')}${c.lines.length > 8 ? ', …' : ''}`);
      if (c.recipe && !shown.has(c.rule)) { shown.add(c.rule); out.push(`Fix: ${c.recipe}${c.avoid ? `\nAvoid: ${c.avoid}` : ''}`); }
      else if (c.recipe) out.push(`Fix: as for ${c.rule} above (\`fringe explain ${c.rule}\`).`);
    }
    if (b.more) out.push(`\n…and ${b.more} more in this batch (raise --limit).`);
  }
  out.push(`\nAfter each batch, verify: \`fringe check ${target}\``);
  return out.join('\n');
}
