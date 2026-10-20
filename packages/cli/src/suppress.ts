const MARK = /fringe-ignore\s+((?:FR-\d+[\s,]*)+)/;

/** A `fringe-ignore FR-123[, FR-456]` comment on the finding's line or the line above silences those rules there. Rule IDs are required: no blanket ignore. */
export function suppressedIds(lines: string[], line: number): Set<string> {
  const ids = new Set<string>();
  for (const l of [lines[line - 1], lines[line - 2]]) {
    const m = l && MARK.exec(l);
    if (m) for (const id of m[1].match(/FR-\d+/g) ?? []) ids.add(id);
  }
  return ids;
}
