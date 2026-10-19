import type { CheckResult } from '../types.js';
export function toJson(r: CheckResult): string {
  return JSON.stringify({ schema: 'fringe/check.v1', ...r }, null, 2);
}
