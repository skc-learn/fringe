import { ALL_RULES } from './rules/registry.js';

/** Best-practice checklists per component type. An item names the rules that verify it; no rules = judged by the agent, with evidence. */
export interface Item { text: string; rules?: string[] }
export const PATTERNS: Record<string, { title: string; items: Item[] }> = {
  form: {
    title: 'Form',
    items: [
      { text: 'Every field has a visible <label> bound with htmlFor/id', rules: ['FR-203'] },
      { text: 'Right input type and autocomplete (email, tel, current-password, new-password, name)', rules: ['FR-216'] },
      { text: 'Required fields are marked in text, not by color alone' },
      { text: 'Errors appear next to the field in words, linked with aria-describedby and aria-invalid; focus moves to the first error on submit' },
      { text: 'The submit button shows a pending state and cannot be double-submitted' },
      { text: 'Input is kept when an error occurs; validation runs on blur, not on every keystroke' },
    ],
  },
  modal: {
    title: 'Modal dialog',
    items: [
      { text: 'role="dialog" with aria-modal="true" and a name (aria-labelledby the title)', rules: ['FR-209'] },
      { text: 'Focus moves in on open, stays trapped inside, and returns to the trigger on close' },
      { text: 'A visible Close button with an accessible name, and Escape closes', rules: ['FR-202'] },
      { text: 'Clicking the backdrop may close it but is never the only way', rules: ['FR-206'] },
      { text: 'The page behind is inert and does not scroll' },
    ],
  },
  navigation: {
    title: 'Navigation',
    items: [
      { text: 'Links use real hrefs and describe the destination', rules: ['FR-217'] },
      { text: 'A <nav> landmark (labelled if there are several), one <main>, and a skip-to-content link' },
      { text: 'The current page is marked with aria-current="page"' },
      { text: 'Menus open by keyboard and tap, not by hover alone', rules: ['FR-221'] },
      { text: 'Focus is always visible', rules: ['FR-205'] },
      { text: 'Tap targets are large enough', rules: ['FR-305'] },
    ],
  },
  'data-view': {
    title: 'Data view (list, table, dashboard)',
    items: [
      { text: 'A loading state with a text label, an empty state that says what to do next, and an error state with a retry', rules: ['FR-208', 'FR-215'] },
      { text: 'Layout does not jump when data arrives (reserve the space)' },
      { text: 'Async updates are announced (aria-live) when the user did not trigger them' },
      { text: 'Table headers use <th> and a caption or accessible name' },
    ],
  },
};

export function renderPatterns(name?: string): string | undefined {
  if (!name) return Object.entries(PATTERNS).map(([k, p]) => `${k.padEnd(11)} ${p.title}`).join('\n');
  const p = PATTERNS[name.toLowerCase()];
  if (!p) return undefined;
  const mark = (i: Item) => (i.rules ? `[verified: ${i.rules.join(', ')}]` : '[judged]');
  return [`${p.title}: build it like this`, ...p.items.map((i) => `- ${i.text}  ${mark(i)}`),
    '', 'verified = Fringe checks it; judged = you decide, so state your evidence in the final message.'].join('\n');
}

export const patternRuleIds = () => [...new Set(Object.values(PATTERNS).flatMap((p) => p.items.flatMap((i) => i.rules ?? [])))];
export const knownRule = (id: string) => ALL_RULES.some((r) => r.id === id);
