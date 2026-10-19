import { describe, it, expect } from 'vitest';
import { runCli } from '../src/index.js';

describe('runCli', () => {
  it('prints version for --version and exits 0', async () => {
    const logs: string[] = [];
    const code = await runCli(['--version'], { log: (s) => logs.push(s) });
    expect(code).toBe(0);
    expect(logs.join('\n')).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('exits 2 for unknown command', async () => {
    expect(await runCli(['nope'], { log: () => {} })).toBe(2);
  });
});
