import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readLedger } from './ledger.js';
import type { LedgerRecord } from './ledger.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Pure HTML for the ledger: newest run first, with the agent's judged flow cuts under each run. */
export function renderBoard(records: LedgerRecord[], corrupt = 0): string {
  const rows = [...records].reverse().map((r) => {
    const flows = (r.manifest?.flows ?? [])
      .map((f) => `<li>${esc(f.action)}: ${esc(f.what)} <small>(${esc(f.evidence)}) — judged</small></li>`).join('');
    return `<tr><td>${esc(r.ts)}</td><td>${r.score}</td><td>${r.counts.error}</td><td>${r.counts.review}</td><td>${r.counts.signal}</td>` +
      `<td>${r.files}</td><td>${r.suppressed ?? 0}</td><td>${flows ? `<ul>${flows}</ul>` : ''}</td></tr>`;
  }).join('');
  const body = records.length === 0
    ? '<p>No runs yet. Run <code>fringe check --record</code> and reload.</p>'
    : `<table><tr><th>When</th><th>Health</th><th>Errors</th><th>Review</th><th>Signals</th><th>Files</th><th>Suppressed</th><th>Flow cuts</th></tr>${rows}</table>`;
  const warn = corrupt ? `<p>${corrupt} unreadable ledger line(s) skipped.</p>` : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Fringe ledger</title>` +
    `<style>body{font:16px system-ui;margin:2rem;max-width:70rem}td,th{padding:.4rem .8rem;text-align:left;vertical-align:top}</style>` +
    `<h1>Fringe ledger</h1>${warn}${body}</html>`;
}

/** Serves the project's ledger on loopback only; re-reads on every request so reload shows new runs. */
export function startBoard(root: string, port: number): Promise<Server> {
  const server = createServer((_req, res) => {
    const { records, corrupt } = readLedger(root);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderBoard(records, corrupt));
  });
  return new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', () => ok(server)); });
}
