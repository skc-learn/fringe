import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** `.fringe/` holds local state (run history, hand-offs, saved login sessions). Create it with its own `.gitignore` of `*`, so a stray `git add -A` can never commit a session cookie or a noisy state file. */
export function fringeDir(root: string): string {
  const dir = join(root, '.fringe');
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  return dir;
}
