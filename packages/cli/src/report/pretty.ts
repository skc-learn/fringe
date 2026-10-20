import type { CheckResult, Severity, StackInfo } from '../types.js';

const RANK: Record<Severity, number> = { error: 0, review: 1, signal: 2 };

/** Uppercase tag for a finding line, e.g. `[ERROR]`. */
function tag(s: Severity): string {
  return `[${s.toUpperCase()}]`;
}

function stackList(stack: StackInfo): string {
  const keys = Object.keys(stack) as (keyof StackInfo)[];
  const on = keys.filter((k) => stack[k]);
  return on.length > 0 ? on.join(',') : 'none';
}

export function toPretty(r: CheckResult): string {
  const lines: string[] = [
    `fringe · stack ${stackList(r.stack)} · ${r.files} files` +
      (r.skipped.length > 0 ? ` · ${r.skipped.length} skipped` : ''),
  ];

  const sorted = [...r.findings].sort((a, b) => {
    if (RANK[a.severity] !== RANK[b.severity]) return RANK[a.severity] - RANK[b.severity];
    if (a.loc.file !== b.loc.file) return a.loc.file < b.loc.file ? -1 : 1;
    return a.loc.line - b.loc.line;
  });
  for (const f of sorted) {
    lines.push(`${tag(f.severity)} ${f.rule} ${f.loc.file}:${f.loc.line} — ${f.message} (${f.hint})`);
  }

  lines.push(
    `health ${r.score}/100 · ${r.counts.error} errors · ${r.counts.review} review · ${r.counts.signal} signals` + (r.baselined ? ` · ${r.baselined} baselined` : '') + (r.suppressed ? ` · ${r.suppressed} suppressed` : ''),
  );

  if (r.skipped.length > 0) {
    lines.push(
      `legend ${tag('error')} must fix · ${tag('review')} needs judgment · ${tag('signal')} info · skipped: ${r.skipped.join(', ')}`,
    );
  }
  return lines.join('\n');
}
