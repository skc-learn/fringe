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
  baselined?: number;
}

export interface StackInfo {
  jsx: boolean;
  tailwind: boolean;
  vue: boolean;
  svelte: boolean;
  html: boolean;
}
