import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FringeConfig } from './types.js';

export const DEFAULT_CONFIG: FringeConfig = {
  // Both forms: `dist/**` matches only at the root, `**/dist/**` matches nested build output (e.g. frontend/dist).
  ignore: ['node_modules/**', 'dist/**', 'build/**', 'out/**', 'coverage/**', '**/dist/**', '**/build/**', '**/out/**', '**/coverage/**', '.fringe/**', '*.min.*'],
  disable: [],
  weights: { error: 10, review: 3, signal: 1 },
};

const TOKEN_SOURCE_KINDS = ['css-vars', 'theme-factory', 'design-tokens-json'] as const;

export function loadConfig(root: string): FringeConfig {
  try {
    const raw = readFileSync(join(root, 'fringe.config.json'), 'utf8');
    const user = JSON.parse(raw) as Partial<FringeConfig>;
    const cfg: FringeConfig = {
      ignore: Array.isArray(user.ignore) ? user.ignore : [...DEFAULT_CONFIG.ignore],
      disable: Array.isArray(user.disable) ? user.disable : [...DEFAULT_CONFIG.disable],
      weights: { ...DEFAULT_CONFIG.weights, ...(user.weights ?? {}) },
    };
    validateWeights(cfg.weights);
    if (user.critical !== undefined) {
      if (!Array.isArray(user.critical) || user.critical.some((g) => typeof g !== 'string')) throw new Error('fringe.config.json: critical must be an array of glob strings');
      cfg.critical = user.critical;
    }
    if (user.tokenSource !== undefined) {
      cfg.tokenSource = validateTokenSource(user.tokenSource);
    }
    return cfg;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(DEFAULT_CONFIG);
    if (e instanceof SyntaxError) throw new Error('fringe.config.json: invalid JSON');
    throw e;
  }
}

function validateTokenSource(ts: NonNullable<FringeConfig['tokenSource']>): NonNullable<FringeConfig['tokenSource']> {
  let problem: string | null = null;
  if (!ts || typeof ts !== 'object' || !TOKEN_SOURCE_KINDS.includes(ts.kind as (typeof TOKEN_SOURCE_KINDS)[number])) {
    problem = `tokenSource.kind must be one of: ${TOKEN_SOURCE_KINDS.join(', ')}`;
  } else if (ts.kind === 'design-tokens-json' && (typeof ts.path !== 'string' || ts.path.trim() === '')) {
    problem = 'tokenSource.path is required when kind is design-tokens-json';
  }
  if (problem) throw new Error('fringe.config.json: ' + problem);
  return ts;
}

function validateWeights(weights: FringeConfig['weights']): void {
  try {
    for (const k of ['error', 'review', 'signal'] as const) {
      if (typeof weights[k] !== 'number' || Number.isNaN(weights[k]))
        throw new Error(`weights.${k} must be a number`);
    }
  } catch (e: unknown) {
    // Re-throw so the message carries the config file name (per brief note).
    throw new Error('fringe.config.json: ' + (e instanceof Error ? e.message : String(e)));
  }
}
