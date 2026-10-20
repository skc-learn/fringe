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
}

export interface Elem {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  loc: Loc;
  /** Tag of the nearest ancestor element; absent for top-level elements. */
  parentTag?: string;
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
}

export interface Rule {
  id: string;
  rung: 2 | 3;
  severity: Severity;
  check(ctx: RuleContext): Finding[];
}

export interface FringeConfig {
  ignore: string[];
  disable: string[];
  weights: { error: number; review: number; signal: number };
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
}

export interface StackInfo {
  jsx: boolean;
  tailwind: boolean;
  vue: boolean;
  svelte: boolean;
  html: boolean;
}
