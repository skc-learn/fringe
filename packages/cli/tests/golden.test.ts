import { describe, it, expect } from 'vitest';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';

// Regenerated after the rung-3/slop rules went live (task 13). Verified by eye:
// all 8 original findings remain with identical rule:file:line — FR-201:App.tsx:15,
// FR-204:App.tsx:17, FR-204:App.tsx:19, FR-206:App.tsx:24, FR-207:App.tsx:25,
// FR-212:Pricing.tsx:8, FR-214:Pricing.tsx:7, FR-205:styles.css:7.
// ADDITIONS: none. Audited each new rule against these fixtures: no arbitrary
// utilities (FR-302/303) or hex-dominated files (FR-301: styles.css has a single
// hardcoded color), no complete low-contrast color+background pair (FR-304), no
// text-xs interactive (FR-305), no slop shapes (FR-361..369), and no error-marker
// copy for FR-215. Snapshot byte-identical to the pre-rung-3 golden.

describe('reference app golden', () => {
  it('matches snapshot', async () => {
    const root = join(FIXTURES, 'reference-app');
    const result = await runCheck(root, loadConfig(root));
    expect({ counts: result.counts, score: result.score, rules: result.findings.map((f) => `${f.rule}:${f.loc.file.split('/').pop()}:${f.loc.line}`) }).toMatchSnapshot();
  });
});
