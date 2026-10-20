import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/index.js';

const dirs: string[] = [];
function mk(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'fringe-plan-')); dirs.push(d);
  for (const [n, c] of Object.entries(files)) { mkdirSync(join(d, n, '..'), { recursive: true }); writeFileSync(join(d, n), c); }
  return d;
}
const plan = async (args: string[]) => { const out: string[] = []; const code = await runCli(['plan', ...args], { log: (s) => out.push(s), err: () => {} }); return { code, out: out.join('\n') }; };
const inputTsx = 'export const Input = () => <input />;';
const users = Object.fromEntries(['A', 'B', 'C'].map((n) => [`src/${n}.tsx`, `import { Input } from './ui/Input';\nexport default () => <Input />;`]));

describe('fringe plan', () => {
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
  it('puts the shared component first, then other errors, with the recipe once', async () => {
    const d = mk({ 'package.json': '{}', 'src/ui/Input.tsx': inputTsx, ...users, 'src/lonely.tsx': 'export default () => <img src="a.png" />;' });
    const { code, out } = await plan([d]);
    expect(code).toBe(0); // planning never gates
    expect(out.indexOf('## P0')).toBeGreaterThan(-1);
    expect(out.indexOf('## P0')).toBeLessThan(out.indexOf('## P1'));
    expect(out).toMatch(/P0[\s\S]*FR-203 · ×1 · src\/ui\/Input\.tsx \(shared component, imported by 3 files/);
    expect(out).toMatch(/P1[\s\S]*FR-201 · ×1 · src\/lonely\.tsx/);
    expect(out.match(/Fix: visible/g)).toBeNull(); // recipe text is the rule's, not hard-coded
    expect(out).toContain('label');
  });
  it('--json has a versioned shape; a clean project says nothing to fix', async () => {
    const d = mk({ 'package.json': '{}', 'ok.html': '<p>ok</p>' });
    expect((await plan([d])).out).toContain('Nothing to fix.');
    const bad = mk({ 'package.json': '{}', 'a.html': '<img src="x.png">' });
    const j = JSON.parse((await plan([bad, '--json'])).out);
    expect(j.schema).toBe('fringe/plan.v1');
    expect(j.batches[0].items[0]).toMatchObject({ rule: 'FR-201', count: 1, lines: [1] });
  });
  it('--limit caps a batch and says how many were left out', async () => {
    const many = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}.html`, '<img src="x.png">']));
    const d = mk({ 'package.json': '{}', ...many });
    const { out } = await plan([d, '--limit', '2']);
    expect(out).toContain('and 3 more in this batch');
  });
});
