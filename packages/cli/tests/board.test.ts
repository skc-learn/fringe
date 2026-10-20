import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderBoard, startBoard } from '../src/board.js';
import { appendRecord } from '../src/ledger.js';
import { runCli } from '../src/index.js';

const rec = (what: string) => ({
  id: 'x', ts: '2026-01-01T00:00:00Z', stack: { frameworks: [], css: [] } as never, files: 2,
  counts: { error: 1, review: 0, signal: 0 }, score: 90,
  manifest: { flows: [{ action: 'cut' as const, what, evidence: 'none' }] },
});

describe('board', () => {
  it('escapes ledger text so a manifest cannot inject markup', () => {
    expect(renderBoard([rec('<script>alert(1)</script>')])).not.toContain('<script>alert');
  });
  it('shows an empty state with the next step', () => {
    expect(renderBoard([])).toContain('fringe check --record');
  });
  it('serves the ledger over HTTP on loopback', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fringe-board-'));
    appendRecord(dir, rec('export tab'));
    const server = await startBoard(dir, 0);
    const addr = server.address() as { address: string; port: number };
    const html = await (await fetch(`http://127.0.0.1:${addr.port}`)).text();
    server.close(); rmSync(dir, { recursive: true, force: true });
    expect(addr.address).toBe('127.0.0.1');
    expect(html).toContain('export tab');
  });
  it('--help exits 0', async () => {
    const out: string[] = [];
    expect(await runCli(['--help'], { log: (s) => out.push(s) })).toBe(0);
    expect(out[0]).toContain('fringe open');
  });
});
