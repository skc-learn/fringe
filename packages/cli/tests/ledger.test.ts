import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendRecord, readLedger } from '../src/ledger.js';
import type { LedgerRecord } from '../src/ledger.js';
import { runCli } from '../src/index.js';

const rec: LedgerRecord = { id: 't1', ts: '2026-10-20T00:00:00Z', stack: { jsx: true, tailwind: true, vue: false, svelte: false, html: false }, files: 2, counts: { error: 0, review: 1, signal: 0 }, score: 97 };

describe('ledger', () => {
  it('appends and reads back', () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-led-'));
    appendRecord(d, rec);
    const { records, corrupt } = readLedger(d);
    expect(records).toEqual([rec]);
    expect(corrupt).toBe(0);
  });
  it('tolerates corrupt lines', () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-led-'));
    appendRecord(d, rec);
    const p = join(d, '.fringe'); mkdirSync(p, { recursive: true });
    appendFileSync(join(p, 'ledger.jsonl'), 'not json\n');
    const { records, corrupt } = readLedger(d);
    expect(records).toHaveLength(1);
    expect(corrupt).toBe(1);
  });
  it('returns empty result when no ledger exists', () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-led-'));
    const { records, corrupt } = readLedger(d);
    expect(records).toEqual([]);
    expect(corrupt).toBe(0);
  });
});

describe('runCli --record', () => {
  it('appends a record built from the check result', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-rec-'));
    const code = await runCli(['check', '--record'], { cwd: d, log: () => {} });
    expect(code).toBe(0);
    const { records, corrupt } = readLedger(d);
    expect(corrupt).toBe(0);
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(Number.isNaN(Date.parse(r.ts))).toBe(false);
    expect(r.files).toBe(0);
    expect(r.counts).toEqual({ error: 0, review: 0, signal: 0 });
    expect(r.score).toBe(100);
    expect(r.stack).toEqual({ jsx: false, tailwind: false, vue: false, svelte: false, html: false });
  });
  it('embeds manifest when --manifest points at valid JSON', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-rec-'));
    const m = join(d, 'manifest.json');
    writeFileSync(m, JSON.stringify({ flows: [{ action: 'cut', what: 'hero carousel', evidence: 'FR-203 findings 2,5' }] }));
    await runCli(['check', '--record', '--manifest', m], { cwd: d, log: () => {} });
    const { records } = readLedger(d);
    expect(records[0].manifest?.flows).toEqual([{ action: 'cut', what: 'hero carousel', evidence: 'FR-203 findings 2,5' }]);
  });
  it('records tokenSource kind when fringe.config.json declares one', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-rec-'));
    writeFileSync(join(d, 'fringe.config.json'), JSON.stringify({ tokenSource: { kind: 'css-vars' } }));
    await runCli(['check', '--record'], { cwd: d, log: () => {} });
    const { records } = readLedger(d);
    expect(records[0].tokenSource).toBe('css-vars');
  });
  it('omits tokenSource entirely when no config declares one', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-rec-'));
    await runCli(['check', '--record'], { cwd: d, log: () => {} });
    const raw = readFileSync(join(d, '.fringe', 'ledger.jsonl'), 'utf8');
    expect(raw).not.toContain('tokenSource');
  });
  it('warns to stderr and continues when manifest is missing', async () => {
    const d = mkdtempSync(join(tmpdir(), 'fringe-rec-'));
    const errs: string[] = [];
    await runCli(['check', '--record', '--manifest', join(d, 'nope.json')], { cwd: d, log: () => {}, err: (s) => errs.push(s) });
    expect(errs.join('\n')).toMatch(/nope\.json/);
    const { records } = readLedger(d);
    expect(records).toHaveLength(1);
    expect(records[0].manifest).toBeUndefined();
  });
});
