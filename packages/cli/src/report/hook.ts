import type { CheckResult, Finding, Severity } from '../types.js';

const RANK: Record<Severity, number> = { error: 0, review: 1, signal: 2 };

/** Highest-severity finding first (ties by file/line), or undefined if none. */
function topFinding(r: CheckResult): Finding | undefined {
  return [...r.findings].sort((a, b) => {
    if (RANK[a.severity] !== RANK[b.severity]) return RANK[a.severity] - RANK[b.severity];
    if (a.loc.file !== b.loc.file) return a.loc.file < b.loc.file ? -1 : 1;
    return a.loc.line - b.loc.line;
  })[0];
}

/** Single-line `fringe/hook.v1` JSON for pre-commit/CI gate consumers. */
export function toHook(r: CheckResult): string {
  const top = topFinding(r);
  const reason = top
    ? `${top.rule}: ${top.message} (${top.loc.file}:${top.loc.line})`
    : 'no findings';
  return JSON.stringify({
    schema: 'fringe/hook.v1',
    errors: r.counts.error,
    review: r.counts.review,
    signals: r.counts.signal,
    block: r.counts.error > 0,
    reason,
  });
}
