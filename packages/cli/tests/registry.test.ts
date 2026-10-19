import { describe, it, expect } from 'vitest';
import { ALL_RULES, activeRules } from '../src/rules/registry.js';
import { DEFAULT_CONFIG } from '../src/config.js';

describe('registry', () => {
  it('has unique ids', () => {
    const ids = ALL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('filters disabled', () => {
    const r = activeRules({ ...DEFAULT_CONFIG, disable: [ALL_RULES[0]?.id ?? 'FR-999'] });
    expect(r.some((x) => x.id === ALL_RULES[0]?.id)).toBe(false);
  });
});
