import { describe, it, expect } from 'vitest';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';

describe('reference app golden', () => {
  it('matches snapshot', async () => {
    const root = join(FIXTURES, 'reference-app');
    const result = await runCheck(root, loadConfig(root));
    expect({ counts: result.counts, score: result.score, rules: result.findings.map((f) => `${f.rule}:${f.loc.file.split('/').pop()}:${f.loc.line}`) }).toMatchSnapshot();
  });
});
