import { ALL_RULES } from './rules/registry.js';

/** Best-practice checklists per component type. An item names the rules that verify it; no rules = judged by the agent, with evidence. */
export interface Item { text: string; rules?: string[] }
export const PATTERNS: Record<string, { title: string; items: Item[] }> = {
  form: {
    title: 'Form',
    items: [
      { text: 'Every field has a visible <label> bound with htmlFor/id', rules: ['FR-203'] },
      { text: 'Right input type and autocomplete (email, tel, current-password, new-password, name) (Fringe checks email, phone and password fields)', rules: ['FR-216'] },
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
  auth: {
    title: 'Sign in and sign up',
    items: [
      { text: 'Every field has a visible <label> bound with htmlFor/id (no placeholder-only fields)', rules: ['FR-203'] },
      { text: 'Right input types and autocomplete: username or email, current-password (sign in), new-password (sign up), one-time-code for codes (Fringe checks email, phone and password fields)', rules: ['FR-216'] },
      { text: 'Social and single-sign-on buttons carry text naming the provider, not just a logo', rules: ['FR-202'] },
      { text: '"Forgot password" is a real link with descriptive text', rules: ['FR-217'] },
      { text: 'Password rules are shown before typing, not only after a failure; the user can reveal the password with a named toggle' },
      { text: 'A failed sign-in says "email or password is incorrect" (never which one), keeps the email, and moves focus to the message' },
      { text: 'The submit button shows a pending state and cannot be double-submitted; pasting a password is allowed' },
      { text: 'The page has a title and a language (checked on full HTML pages), and keyboard focus never gets stuck (checked by scan)', rules: ['FR-218', 'FR-401'] },
      { text: 'The whole flow, including the reveal toggle and any code entry, works with the keyboard alone' },
    ],
  },
  checkout: {
    title: 'Checkout and payment',
    items: [
      { text: 'Every field has a visible label', rules: ['FR-203'] },
      { text: 'Address and card fields use the standard autocomplete tokens (name, street-address, postal-code, cc-number, cc-exp, cc-csc)' },
      { text: 'The full price, including shipping, tax and any recurring cost, is visible before the pay button', rules: ['FR-214'] },
      { text: 'No pre-checked marketing or consent boxes', rules: ['FR-211'] },
      { text: 'No fake countdowns or manufactured urgency', rules: ['FR-210'] },
      { text: 'Declining an upsell or add-on is a neutral choice with neutral wording', rules: ['FR-212'] },
      { text: 'A payment failure says what failed in plain words, keeps the cart and the entered details, and offers a retry', rules: ['FR-215'] },
      { text: 'The pay button states the action and amount ("Pay $42.00"), shows a pending state, and cannot charge twice' },
      { text: 'Order-summary changes (quantity, coupon, shipping) are announced to screen readers (aria-live)' },
      { text: 'Progress through the steps is shown, and going back never loses what was entered' },
      { text: 'Tap targets are large enough on a phone', rules: ['FR-305'] },
    ],
  },
  table: {
    title: 'Data table',
    items: [
      { text: 'A real <table> with <th> headers (scope set) and a caption or accessible name' },
      { text: 'Sortable headers are buttons, and the sorted column carries aria-sort' },
      { text: 'Row-action icon buttons have names ("Delete invoice 1042"), and each row checkbox is labelled', rules: ['FR-202', 'FR-203'] },
      { text: 'Loading, empty (with a next step) and error (with a retry) states', rules: ['FR-208', 'FR-215'] },
      { text: 'Filters and the search box are labelled', rules: ['FR-203'] },
      { text: 'A wide table scrolls inside its own container instead of making the whole page scroll sideways at 320px', rules: ['FR-404'] },
      { text: 'Updated results after a filter or sort are announced (aria-live), and keyboard focus is not lost' },
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
  // FR-400..405 come from `fringe scan` (a running page), the rest from the static check.
  const mark = (i: Item) => (i.rules ? `[verified${i.rules.every((r) => /^FR-40[0-5]$/.test(r)) ? ' by scan' : ''}: ${i.rules.join(', ')}]` : '[judged]');
  return [`${p.title}: build it like this`, ...p.items.map((i) => `- ${i.text}  ${mark(i)}`),
    '', 'verified = Fringe checks it; judged = you decide, so state your evidence in the final message.'].join('\n');
}

export const patternRuleIds = () => [...new Set(Object.values(PATTERNS).flatMap((p) => p.items.flatMap((i) => i.rules ?? [])))];
export const knownRule = (id: string) => ALL_RULES.some((r) => r.id === id) || /^FR-40[0-5]$/.test(id); // runtime ids belong to `fringe scan`
