import type { Rule, FringeConfig } from '../types.js';

export const ALL_RULES: Rule[] = [];

export function activeRules(cfg: FringeConfig): Rule[] {
  return ALL_RULES.filter((r) => !cfg.disable.includes(r.id));
}
