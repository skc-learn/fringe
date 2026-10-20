import { describe, it, expect } from 'vitest';
import { runCheck } from '../src/check.js';
import { loadConfig } from '../src/config.js';
import { join } from 'node:path';
import { FIXTURES } from './helpers.js';

// Golden over fixtures/slop-app — a realistic "AI landing page" planting exactly one
// trigger per listed rule. Verified by eye against the snapshot (see task-13 report):
// every planted rule appears, no other rung-2 findings besides the planted FR-215
// review, and FR-364/366 are single findings (FR-368 is one finding per leg:
// Tailwind gradient in Landing.tsx, CSS gradient in styles.css).
//
// Verified enumeration (16 findings = 15 signal + 1 review, score 82):
//   FR-215:Landing.tsx:1   "Something went wrong." in the isError branch, no recovery copy
//   FR-301:Landing.tsx:1   13 hardcoded hex utilities vs 1 token use (file-level)
//   FR-302:Landing.tsx:25  hero subtitle text-[17px]
//   FR-303:Landing.tsx:92  p-[13px] + gap-[9px] on the stat row (one finding per utility)
//   FR-305:Landing.tsx:101 footer link text-xs without py-2+
//   FR-361:Landing.tsx:22  h1 italic font-serif text-4xl
//   FR-362:Landing.tsx:19  eyebrow chip (rounded-full uppercase tracking-widest, 20 chars)
//   FR-363:Landing.tsx:90  rounded-lg bg-[#eef2ff] card inside the rounded-2xl shadow-2xl card
//   FR-364:Landing.tsx:1   icon-tile stack (3 empty flex tiles; single file-level finding)
//   FR-366:Landing.tsx:1   status-chip soup (5 labeled pills; single file-level finding)
//   FR-367:Landing.tsx:44  "01 Discover" text-xs kicker
//   FR-368:Landing.tsx:18  bg-gradient-to-r from-violet-600 to-[#a78bfa] (Tailwind leg)
//   FR-368:styles.css:8    linear-gradient(135deg, #8b5cf6, #a78bfa) (CSS leg)
//   FR-369:Landing.tsx:78  emoji h2
//   FR-304:styles.css:2    color #999999 on background-color #ffffff (2.8:1)
// The app is otherwise rung-2 clean: img has alt, all buttons/links have text,
// single h1 with no heading skips, no onClick-div/tabIndex/outline-none patterns.

describe('slop app golden', () => {
  it('matches snapshot', async () => {
    const root = join(FIXTURES, 'slop-app');
    const result = await runCheck(root, loadConfig(root));
    expect({ counts: result.counts, score: result.score, rules: result.findings.map((f) => `${f.rule}:${f.loc.file.split('/').pop()}:${f.loc.line}`) }).toMatchSnapshot();
  });
});
