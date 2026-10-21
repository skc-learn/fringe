import { basename, extname, relative } from 'node:path';
import { GUIDANCE } from './guidance.js';
import { globToRegex } from './walk.js';
import type { Cluster, Finding } from './types.js';

// priority = tier + wcag level + critical path + blast radius. Tiers are 600 apart and the adders sum to < 600,
// so any error outranks any review, and any review outranks any signal, whatever else is true.
export const TIER = { error: 1000, review: 400, signal: 100 } as const;
const WCAG_A = new Set(['1.1.1', '1.3.1', '2.1.1', '2.4.3', '3.3.2', '4.1.2']);
const WCAG_AA = new Set(['1.4.3', '2.4.7', '2.5.8']);
const CRITICAL_BONUS = 40;
const SHARED_FROM = 3; // imported by this many files = a shared component, fix it once

/** WCAG conformance level bonus: A +30, AA +15. */
export const wcagBonus = (wcag?: string) => (wcag && WCAG_A.has(wcag) ? 30 : wcag && WCAG_AA.has(wcag) ? 15 : 0);

const IMPORT = /(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;

/** shortcut: matches importers by file base name, so two files named Input.tsx share a count. Upgrade to real module resolution if that misleads. */
function importerCounts(sources: Map<string, string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const src of sources.values()) {
    const seen = new Set<string>();
    for (const m of src.matchAll(IMPORT)) seen.add(basename(m[1], extname(m[1])));
    for (const b of seen) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return counts;
}

export function prioritize(findings: Finding[], sources: Map<string, string>, root: string, critical: string[]): { findings: Finding[]; clusters: Cluster[] } {
  const crit = critical.map(globToRegex);
  const importers = importerCounts(sources);
  const clusters = new Map<string, Cluster>();
  const out = findings.map((f) => {
    const rel = relative(root, f.loc.file);
    const blast = Math.min(20, 4 * Math.log2(1 + (importers.get(basename(rel, extname(rel))) ?? 0)));
    const level = f.wcag && WCAG_A.has(f.wcag) ? 30 : f.wcag && WCAG_AA.has(f.wcag) ? 15 : 0;
    const priority = Math.round(TIER[f.severity] + level + (crit.some((r) => r.test(rel)) ? CRITICAL_BONUS : 0) + blast);
    const id = `${f.rule}@${rel}`;
    const by = importers.get(basename(rel, extname(rel))) ?? 0;
    const c = clusters.get(id) ?? { id, rule: f.rule, file: rel, count: 0, priority: 0, fixability: GUIDANCE[f.rule]?.fixability ?? 'judgment', rootCause: by >= SHARED_FROM ? 'shared component' : 'local', importedBy: by, critical: crit.some((r) => r.test(rel)) } as Cluster;
    c.count++; c.priority = Math.max(c.priority, priority);
    clusters.set(id, c);
    return { ...f, priority, cluster: id, fixability: c.fixability };
  });
  // Repetition raises a cluster a little (one fix clears many), never across a severity tier.
  for (const c of clusters.values()) c.priority += Math.round(Math.min(15, 3 * Math.log2(c.count)));
  return { findings: out, clusters: [...clusters.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)) };
}
