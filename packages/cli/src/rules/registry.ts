import type { Rule, FringeConfig } from '../types.js';
import { fr201 } from './fr201.js';
import { fr202 } from './fr202.js';
import { fr203 } from './fr203.js';
import { fr204 } from './fr204.js';
import { fr205 } from './fr205.js';
import { fr206 } from './fr206.js';
import { fr207 } from './fr207.js';
import { fr208 } from './fr208.js';
import { fr209 } from './fr209.js';
import { fr210 } from './fr210.js';
import { fr211 } from './fr211.js';
import { fr212 } from './fr212.js';
import { fr213 } from './fr213.js';
import { fr214 } from './fr214.js';
import { fr301 } from './fr301.js';
import { fr302 } from './fr302.js';
import { fr303 } from './fr303.js';
import { fr304 } from './fr304.js';

export const ALL_RULES: Rule[] = [];

ALL_RULES.push(fr201, fr202, fr203, fr204, fr205, fr206, fr207, fr208, fr209, fr210, fr211, fr212, fr213, fr214, fr301, fr302, fr303, fr304);

export function activeRules(cfg: FringeConfig): Rule[] {
  return ALL_RULES.filter((r) => !cfg.disable.includes(r.id));
}
