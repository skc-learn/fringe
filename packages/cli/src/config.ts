import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FringeConfig } from './types.js';

export const DEFAULT_CONFIG: FringeConfig = {
  ignore: ['node_modules/**', 'dist/**', '.fringe/**', '*.min.*'],
  disable: [],
  weights: { error: 10, review: 3, signal: 1 },
};

export function loadConfig(root: string): FringeConfig {
  try {
    const raw = readFileSync(join(root, 'fringe.config.json'), 'utf8');
    const user = JSON.parse(raw) as Partial<FringeConfig>;
    const cfg: FringeConfig = {
      ignore: Array.isArray(user.ignore) ? user.ignore : DEFAULT_CONFIG.ignore,
      disable: Array.isArray(user.disable) ? user.disable : DEFAULT_CONFIG.disable,
      weights: { ...DEFAULT_CONFIG.weights, ...(user.weights ?? {}) },
    };
    validateWeights(cfg.weights);
    return cfg;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG;
    if (e instanceof SyntaxError) throw new Error('fringe.config.json: invalid JSON');
    throw e;
  }
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
