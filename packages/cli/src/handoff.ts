import { relative } from 'node:path';
import { buildPlan, toPlanMarkdown } from './report/plan.js';
import type { Batch } from './report/plan.js';
import type { CheckResult, Counts, Finding } from './types.js';

/** A self-contained work order for another agent (or CI), plus what is needed to prove it was done. */
export interface Handoff {
  schema: 'fringe/handoff.v1';
  createdAt: string;
  /** Absolute project root; `verify` re-runs against it from anywhere. */
  root: string;
  /** What `check` / `plan` were pointed at (relative to where handoff ran). */
  target: string;
  /** Absolute path when the hand-off covers a single file. */
  only?: string;
  scan?: { url: string; statesFile?: string; modes: string[] };
  score: number;
  counts: Counts;
  /** Findings silenced by `fringe-ignore` when the handoff was made; verify reports any increase. */
  suppressed: number;
  /** Fingerprints of every finding at hand-off time, so verify can tell fixed from introduced. */
  fingerprints: string[];
  batches: Batch[];
  prompt: string;
}

export interface Verify {
  schema: 'fringe/verify.v1';
  status: 'complete' | 'partial' | 'regressed';
  score: { before: number; after: number };
  errors: { before: number; fixed: number; remaining: number; introduced: number };
  review: { remaining: number; introduced: number };
  introduced: Array<{ rule: string; where: string; message: string }>;
  remaining: Array<{ rule: string; where: string; message: string }>;
  /** Findings silenced since the hand-off: a human should look at these. */
  newSuppressions: number;
}

const fp = (root: string, f: Finding) => `${f.rule}|${f.loc.file.startsWith('/') ? relative(root, f.loc.file) : f.loc.file}|${f.message}`;
const where = (root: string, f: Finding) => `${f.loc.file.startsWith('/') ? relative(root, f.loc.file) : f.loc.file}${f.loc.line > 1 || !f.target ? `:${f.loc.line}` : ''}${f.target ? ` ${f.target}` : ''}`;

const RULES = [
  'Fix the problems in the order given. Re-run `fringe verify` after each batch; stop only when it says `status: complete`.',
  'Do not change the visual design or behavior; fix the underlying problem (labels, names, contrast, focus), not the symptom.',
  'Do not silence a rule to get green. A `fringe-ignore FR-xxx` comment is only for a genuine false positive; list every one you add, with the reason, in your final message. `verify` reports how many were added.',
  'Prefer fixing a shared component once over its many uses.',
  'If a finding needs a design or content decision you cannot make, leave it and say so in your final message instead of guessing.',
];

export function buildHandoff(result: CheckResult, meta: { root: string; target: string; only?: string; scan?: Handoff['scan'] }, limit = 15): Handoff {
  const batches = buildPlan(result, limit);
  const verifyCmd = 'fringe verify';
  const prompt = [
    '# Fix the UX problems Fringe found',
    '',
    `You are taking over from another agent or a CI job. Fringe found ${result.counts.error} error(s), ${result.counts.review} review item(s) and ${result.counts.signal} polish item(s) in \`${meta.target}\` (health ${result.score}/100).`,
    'Your goal: no errors left, and nothing new introduced.',
    '',
    '## Rules',
    ...RULES.map((r) => `- ${r}`),
    '',
    '## Definition of done',
    'Commands: use `fringe` if it is on the PATH, otherwise `npx -y @fringetools/cli` in its place.',
    `Run \`${verifyCmd}\` (it re-checks everything this hand-off covers). You are done when it prints \`status: complete\` and exits 0. If it prints \`regressed\`, you broke something: fix what it lists as introduced first.`,
    '',
    toPlanMarkdown(result, meta.target, limit).replace(/^# Fringe fix plan\n\n/, '## The work\n\n'),
  ].join('\n');
  return {
    schema: 'fringe/handoff.v1', createdAt: new Date().toISOString(), root: meta.root, target: meta.target, ...(meta.only ? { only: meta.only } : {}), ...(meta.scan ? { scan: meta.scan } : {}),
    score: result.score, counts: result.counts, suppressed: result.suppressed ?? 0,
    fingerprints: result.findings.map((f) => fp(meta.root, f)), batches, prompt,
  };
}

/** Compares a fresh result with the hand-off: what got fixed, what is left, what the receiving agent broke or silenced. */
export function verifyHandoff(h: Handoff, now: CheckResult): Verify {
  const left = new Map<string, number>();
  for (const k of h.fingerprints) left.set(k, (left.get(k) ?? 0) + 1);
  const introduced: Finding[] = [];
  const remaining: Finding[] = [];
  for (const f of now.findings) {
    const k = fp(h.root, f), n = left.get(k) ?? 0;
    if (n > 0) { left.set(k, n - 1); remaining.push(f); } else introduced.push(f);
  }
  const errs = (fs: Finding[]) => fs.filter((f) => f.severity === 'error');
  const row = (f: Finding) => ({ rule: f.rule, where: where(h.root, f), message: f.message });
  const remainingErrors = errs(remaining).length, introducedErrors = errs(introduced).length;
  return {
    schema: 'fringe/verify.v1',
    status: introducedErrors > 0 ? 'regressed' : remainingErrors === 0 ? 'complete' : 'partial',
    score: { before: h.score, after: now.score },
    errors: { before: h.counts.error, fixed: h.counts.error - remainingErrors, remaining: remainingErrors, introduced: introducedErrors },
    review: { remaining: remaining.filter((f) => f.severity === 'review').length, introduced: introduced.filter((f) => f.severity === 'review').length },
    introduced: introduced.filter((f) => f.severity !== 'signal').map(row).slice(0, 20),
    remaining: errs(remaining).map(row).slice(0, 20),
    newSuppressions: Math.max(0, (now.suppressed ?? 0) - h.suppressed),
  };
}

export function verifyToMarkdown(v: Verify): string {
  const out = [`status: ${v.status}`, `health ${v.score.before} -> ${v.score.after}`, `errors: ${v.errors.fixed} of ${v.errors.before} fixed, ${v.errors.remaining} remaining, ${v.errors.introduced} introduced`];
  if (v.review.introduced) out.push(`review items introduced: ${v.review.introduced}`);
  if (v.introduced.length) out.push('', 'Introduced since the hand-off (fix these first):', ...v.introduced.map((x) => `- ${x.rule} ${x.where}: ${x.message}`));
  if (v.remaining.length) out.push('', 'Errors still to fix:', ...v.remaining.slice(0, 10).map((x) => `- ${x.rule} ${x.where}: ${x.message}`), ...(v.remaining.length > 10 ? [`- …and ${v.remaining.length - 10} more`] : []));
  if (v.newSuppressions) out.push('', `Needs human review: ${v.newSuppressions} finding(s) were silenced with fringe-ignore since the hand-off.`);
  return out.join('\n');
}
