import { relative } from 'node:path';
import { GUIDANCE } from '../guidance.js';
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

/** Claude Code PostToolUse contract: `{"decision":"block","reason"}` on exit 0 is what reaches the agent (fringe/hook.v1 exit-1 JSON never does). Empty string = stay silent. */
export function toClaudeHook(r: CheckResult, root: string): string {
  const errs = r.findings.filter((f) => f.severity === 'error');
  if (errs.length === 0) return '';
  const shown = errs.slice(0, 8).map((f) => `- ${f.rule} ${relative(root, f.loc.file)}:${f.loc.line} — ${f.message} (${f.hint})`);
  const shownRules = [...new Set(errs.slice(0, 8).map((f) => f.rule))];
  const recipes = shownRules.map((id) => {
    const g = GUIDANCE[id];
    return g ? `- ${id}: ${g.recipe}${g.avoid ? ` Avoid: ${g.avoid}` : ''}` : '';
  }).filter(Boolean);
  const more = errs.length > shown.length ? `\n…and ${errs.length - shown.length} more (run \`fringe check\`).` : '';
  return JSON.stringify({
    decision: 'block',
    reason: `Fringe found ${errs.length} accessibility error(s). Fix them before finishing:\n${shown.join('\n')}${more}\nHow to fix them well:\n${recipes.join('\n')}\nUse a fringe-ignore comment only for a genuine false positive, and say so.`,
  });
}
