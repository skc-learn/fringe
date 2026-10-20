export type Severity = 'error' | 'review' | 'signal';

/** The only runtime export; everything else in this module is types. */
export const SEVERITIES: readonly Severity[] = ['error', 'review', 'signal'];

export interface Loc {
  file: string;
  line: number;
  col: number;
}

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  hint: string;
  loc: Loc;
  /** WCAG 2.1 success criterion (e.g. '1.1.1') for accessibility findings. */
  wcag?: string;
  /** Set by the priority pass: higher = fix sooner. Tier first (error > review > signal). */
  priority?: number;
  /** `rule@file` cluster this finding belongs to. */
  cluster?: string;
  fixability?: 'mechanical' | 'judgment';
}

/** Findings of one rule in one file: usually one root cause, one fix. */
export interface Cluster {
  id: string;
  rule: string;
  file: string;
  count: number;
  priority: number;
  fixability: 'mechanical' | 'judgment';
  /** 'shared component' when many files import this file: fix it once, not per use. */
  rootCause: 'shared component' | 'local';
  /** Number of files importing this one (by base name). */
  importedBy: number;
  /** File matches a configured `critical` glob. */
  critical: boolean;
}

export interface Elem {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  loc: Loc;
  /** Tag of the nearest ancestor element; absent for top-level elements. */
  parentTag?: string;
  /** Some ancestor is a <label>: the control is implicitly labeled. */
  inLabel?: boolean;
  /** className/class attr of the nearest ancestor element; absent when the ancestor has none. */
  parentClass?: string;
}

export interface CssDecl {
  prop: string;
  value: string;
  selector: string;
  loc: Loc;
}

export interface RuleContext {
  file: string;
  source: string;
  elems: Elem[];
  css: CssDecl[];
  /** Token color values (hex/rgb()/hsl() strings as written); empty when no token source. */
  tokenColors: string[];
}

export interface Rule {
  id: string;
  rung: 2 | 3;
  severity: Severity;
  check(ctx: RuleContext): Finding[];
}

export type TokenSourceKind = 'css-vars' | 'theme-factory' | 'design-tokens-json';

export interface TokenSource {
  kind: TokenSourceKind;
  /** Required for design-tokens-json: path (relative to project root) of the JSON file. */
  path?: string;
}

export interface FringeConfig {
  ignore: string[];
  disable: string[];
  weights: { error: number; review: number; signal: number };
  /** Globs (relative to root) for files whose findings should rank higher, e.g. checkout and auth. */
  critical?: string[];
  tokenSource?: TokenSource;
}

export interface Counts {
  error: number;
  review: number;
  signal: number;
}

export interface CheckResult {
  stack: StackInfo;
  files: number;
  skipped: string[];
  findings: Finding[];
  counts: Counts;
  score: number;
  /** Findings suppressed by fringe.baseline.json; absent when none. */
  clusters?: Cluster[];
  baselined?: number;
  /** Findings silenced by inline `fringe-ignore` comments; shown so suppression is never invisible. */
  suppressed?: number;
}

export interface StackInfo {
  jsx: boolean;
  tailwind: boolean;
  vue: boolean;
  svelte: boolean;
  html: boolean;
}
