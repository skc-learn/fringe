import { expectRule } from './helpers.js';
import { fr201 } from '../src/rules/fr201.js';
import { fr202 } from '../src/rules/fr202.js';
import { fr203 } from '../src/rules/fr203.js';
import { fr209 } from '../src/rules/fr209.js';
expectRule(fr201, 'FR-201');
expectRule(fr202, 'FR-202');
expectRule(fr203, 'FR-203');
expectRule(fr209, 'FR-209');
