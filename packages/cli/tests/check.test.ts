import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';

describe('runCheck', () => {
  it('runs rules over a temp project and reports structure', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-chk-'));
    writeFileSync(join(d, 'App.tsx'), 'export default () => <div><img src="a.png" /></div>;');
    const res = await runCheck(d, loadConfig(d));
    expect(res.files).toBe(1);
    expect(res.stack.jsx).toBe(true);
    expect(res.counts).toEqual({ error: 0, review: 0, signal: 0 }); // no rules registered yet
    expect(res.skipped).toEqual([]);
  });
  it('skips unparseable files without crashing', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-chk-'));
    writeFileSync(join(d, 'bad.tsx'), 'export ~~ nope');
    const res = await runCheck(d, loadConfig(d));
    expect(res.skipped).toHaveLength(1);
  });
});
