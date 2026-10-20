import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Counts, StackInfo } from './types.js';

/** One JSONL line in `<root>/.fringe/ledger.jsonl`. Optional fields are schema reservations. */
export interface LedgerRecord {
  id: string;
  ts: string;
  stack: StackInfo;
  files: number;
  counts: Counts;
  score: number;
  /** Findings per rule id and suppressions, so per-rule fixed-vs-silenced trends can be read later. */
  byRule?: Record<string, number>;
  suppressed?: number;
  tokenSource?: 'css-vars' | 'theme-factory' | 'design-tokens-json';
  shots?: string[];
  manifest?: { flows: Array<{ action: 'cut' | 'kept'; what: string; evidence: string }> };
}

export function ledgerPath(root: string): string {
  return join(root, '.fringe', 'ledger.jsonl');
}

export function appendRecord(root: string, rec: LedgerRecord): void {
  mkdirSync(join(root, '.fringe'), { recursive: true });
  appendFileSync(ledgerPath(root), JSON.stringify(rec) + '\n');
}

/** Tolerant reader: skips unparseable lines and reports how many were skipped. */
export function readLedger(root: string): { records: LedgerRecord[]; corrupt: number } {
  let raw: string;
  try { raw = readFileSync(ledgerPath(root), 'utf8'); } catch { return { records: [], corrupt: 0 }; }
  const records: LedgerRecord[] = [];
  let corrupt = 0;
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try { records.push(JSON.parse(line) as LedgerRecord); } catch { corrupt++; }
  }
  return { records, corrupt };
}
