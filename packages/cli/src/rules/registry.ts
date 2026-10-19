import type { Rule, FringeConfig } from '../types.js';
import { fr201 } from './fr201.js';
import { fr202 } from './fr202.js';
import { fr203 } from './fr203.js';
import { fr204 } from './fr204.js';
import { fr209 } from './fr209.js';

export const ALL_RULES: Rule[] = [];

ALL_RULES.push(fr201, fr202, fr203, fr204, fr209);

export function activeRules(cfg: FringeConfig): Rule[] {
  return ALL_RULES.filter((r) => !cfg.disable.includes(r.id));
}
