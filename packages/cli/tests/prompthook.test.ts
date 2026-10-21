import { describe, it, expect } from 'vitest';
import { matchPlaybooks, playbookContext, promptHookOutput } from '../src/promptHook.js';
import { runCli } from '../src/index.js';
import { PATTERNS } from '../src/patterns.js';

describe('playbook prompt hook', () => {
  it('matches building requests to the right playbook, most specific first, at most two', () => {
    expect(matchPlaybooks('Create src/Carousel.tsx: a React image carousel with 4 slides')).toEqual(['carousel']);
    expect(matchPlaybooks('Build a tabbed settings page with a data table')).toEqual(['tabs', 'table']);
    expect(matchPlaybooks('add a login form with a search box and a modal')).toEqual(['modal', 'auth']);
    expect(matchPlaybooks('Create a pricing page')).toEqual(['pricing']);
  });
  it('stays silent for anything that is not building UI', () => {
    for (const p of ['fix the bug in the table parser', 'why is the login slow?', 'refactor the carousel code', 'explain how tabs work', 'run the tests']) expect(matchPlaybooks(p), p).toEqual([]);
    expect(matchPlaybooks('create a database migration')).toEqual([]);
  });
  it('every trigger names a real playbook', () => {
    for (const p of ['carousel', 'tabs', 'modal', 'datepicker', 'accordion', 'toast', 'upload', 'drag', 'rich text', 'chat', 'table', 'checkout', 'sign in', 'pricing', 'settings', 'dashboard', 'onboarding', 'empty state', 'search', 'navbar', 'form'])
      for (const n of matchPlaybooks(`create a ${p} component`, 3)) expect(PATTERNS[n], `${p} -> ${n}`).toBeDefined();
  });
  it('the context separates what Fringe checks from what the agent must get right, and stays short', () => {
    const c = playbookContext(['tabs']);
    expect(c).toMatch(/\[Fringe checks: FR-209\]/);
    expect(c).toMatch(/\[yours to get right\]/);
    expect(c).toContain('based on https://www.w3.org/');
    expect(playbookContext(['auth', 'checkout']).length).toBeLessThan(4500);
  });
  it('emits the Claude Code UserPromptSubmit shape from the hook JSON, and nothing otherwise', () => {
    const out = JSON.parse(promptHookOutput(JSON.stringify({ prompt: 'Create src/Tabs.tsx: a tabbed panel' })));
    expect(out.hookSpecificOutput).toMatchObject({ hookEventName: 'UserPromptSubmit' });
    expect(out.hookSpecificOutput.additionalContext).toContain('Tabs: build it like this');
    expect(promptHookOutput(JSON.stringify({ prompt: 'fix the typo' }))).toBe('');
    expect(promptHookOutput('not json at all')).toBe('');
  });
  it('the hook-prompt command prints it, exits 0, and never throws on bad input', async () => {
    const out: string[] = [];
    expect(await runCli(['hook-prompt'], { log: (s) => out.push(s), stdin: JSON.stringify({ prompt: 'build a carousel' }) })).toBe(0);
    expect(out.join('')).toContain('additionalContext');
    expect(await runCli(['hook-prompt'], { log: () => {}, stdin: '' })).toBe(0);
  });
});
