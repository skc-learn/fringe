import { ALL_RULES } from './rules/registry.js';

/** How to fix each rule's finding well, kept apart from the rules so they stay pure functions over the IR. */
export interface Guidance {
  /** Who is hurt, in one sentence. */
  why: string;
  /** The preferred fix. */
  recipe: string;
  /** The tempting fix that passes but is worse. */
  avoid?: string;
  example?: { before: string; after: string };
  /** mechanical: one obvious edit. judgment: needs a design or content decision. */
  fixability: 'mechanical' | 'judgment';
}

export const GUIDANCE: Record<string, Guidance> = {
  'FR-201': {
    why: 'A screen reader announces an image with no alt as its file name, or skips it.',
    recipe: 'Informative image: describe its purpose, not its look (alt="Order #4521 receipt"). Decorative image: alt="".',
    avoid: 'alt="image", alt="photo", or the file name.',
    example: { before: '<img src="/hero.png" />', after: '<img src="/hero.png" alt="Team reviewing a dashboard" />' },
    fixability: 'judgment',
  },
  'FR-202': {
    why: 'A button or link with no text is announced as just "button" or "link".',
    recipe: 'Put visible text inside it. For an icon-only control, add aria-label naming the action and aria-hidden="true" on the icon.',
    avoid: 'title alone (not reliably announced) or an aria-label that repeats the icon name ("cross").',
    example: { before: '<button><CloseIcon /></button>', after: '<button aria-label="Close dialog"><CloseIcon aria-hidden="true" /></button>' },
    fixability: 'mechanical',
  },
  'FR-203': {
    why: 'A form field with no label is announced without a name, and the placeholder vanishes as soon as the user types.',
    recipe: 'Add a visible <label htmlFor> bound to the input id. Use aria-label only where a visible label is genuinely wrong for the design (e.g. a search box beside a magnifier button).',
    avoid: 'Placeholder as the only label; aria-label when a visible label would fit.',
    example: { before: '<input id="email" placeholder="Email" />', after: '<label htmlFor="email">Email</label>\n<input id="email" />' },
    fixability: 'mechanical',
  },
  'FR-204': {
    why: 'Screen reader users navigate by headings; skipped levels or several h1s break the outline.',
    recipe: 'Use one h1 per page, then h2, h3 in order. Choose the level by structure and style it with CSS.',
    avoid: 'Picking h3 because it looks smaller.',
    fixability: 'mechanical',
  },
  'FR-205': {
    why: 'Keyboard users cannot see where focus is when the outline is removed.',
    recipe: 'Keep a visible focus style. Replace outline-none with focus-visible:outline-2 focus-visible:outline-offset-2 (or a :focus-visible rule with a visible outline).',
    avoid: 'outline: none with no replacement; styling :focus only for mouse users.',
    fixability: 'mechanical',
  },
  'FR-206': {
    why: 'A clickable div is not reachable by keyboard and has no role for assistive technology.',
    recipe: 'Use a <button> (or <a href> for navigation). Only if that is impossible, add role="button", tabIndex={0} and Enter/Space key handlers.',
    avoid: 'role="button" without keyboard handlers.',
    example: { before: '<div onClick={open}>Open</div>', after: '<button type="button" onClick={open}>Open</button>' },
    fixability: 'mechanical',
  },
  'FR-207': {
    why: 'A positive tabIndex pulls the element out of the natural order and makes focus jump unpredictably.',
    recipe: 'Use tabIndex={0} (join the natural order) or -1 (focusable by script only), and fix the order by moving the element in the DOM.',
    avoid: 'tabIndex={1}, {2}... to force an order.',
    fixability: 'mechanical',
  },
  'FR-208': {
    why: 'Data that loads, comes back empty or fails leaves the user staring at nothing.',
    recipe: 'Render three states next to the data: loading (skeleton or spinner with a text label), empty (what to do next), error (what failed and a retry).',
    avoid: 'A spinner with no failure path.',
    fixability: 'judgment',
  },
  'FR-209': {
    why: 'A misspelled aria-* attribute is ignored, so the intended name or state never reaches the user.',
    recipe: 'Correct the attribute name against the ARIA spec (aria-labelledby, aria-describedby, aria-expanded...).',
    example: { before: '<input aria-labeledby="h" />', after: '<input aria-labelledby="h" />' },
    fixability: 'mechanical',
  },
  'FR-210': {
    why: 'A fake countdown pressures users into rushed decisions.',
    recipe: 'State the real deadline as a date, or remove the urgency wording.',
    fixability: 'judgment',
  },
  'FR-211': {
    why: 'A pre-checked consent box opts people in without a decision.',
    recipe: 'Leave consent boxes unchecked and make the choice explicit.',
    fixability: 'mechanical',
  },
  'FR-212': {
    why: 'Guilt-trip wording on the decline option manipulates the choice.',
    recipe: 'Make both options neutral ("No thanks").',
    fixability: 'judgment',
  },
  'FR-213': {
    why: 'Infinite scroll with no way to stop traps keyboard users and buries the footer.',
    recipe: 'Offer a "Load more" button or pagination, and keep the footer reachable.',
    fixability: 'judgment',
  },
  'FR-214': {
    why: '"Free", then a price later, erodes trust.',
    recipe: 'Show the full price up front, including recurring cost.',
    fixability: 'judgment',
  },
  'FR-215': {
    why: '"Something went wrong" tells the user nothing about what to do next.',
    recipe: 'Say what failed in plain words and give a next step: retry, a link, or a way to contact support.',
    fixability: 'judgment',
  },
  'FR-216': {
    why: 'The wrong input type gives the wrong keyboard on phones and skips built-in validation; no autocomplete blocks password managers and autofill.',
    recipe: 'Use type="email" / "tel" / "password", and set autoComplete (email, tel, current-password, new-password, name).',
    avoid: 'type="text" for everything.',
    example: { before: '<input type="text" name="email" />', after: '<input type="email" name="email" autoComplete="email" />' },
    fixability: 'mechanical',
  },
  'FR-217': {
    why: 'Screen reader users browse a list of links out of context, so "click here" says nothing; href="#" links go nowhere.',
    recipe: 'Name the destination or action in the link text. Use a <button> for an action, a real URL for navigation.',
    avoid: '"click here", "read more", or href="#" with an onClick.',
    example: { before: '<a href="#" onClick={save}>Save</a>', after: '<button type="button" onClick={save}>Save</button>' },
    fixability: 'mechanical',
  },
  'FR-218': {
    why: 'A missing lang makes screen readers use the wrong voice; a missing title leaves the tab and the page unnamed; a viewport that blocks zoom shuts out low-vision users.',
    recipe: 'Set <html lang="en"> (the real language), add a unique <title>, and remove user-scalable=no / maximum-scale=1 from the viewport meta.',
    avoid: 'Blocking zoom to "fix" a layout problem.',
    fixability: 'mechanical',
  },
  'FR-219': {
    why: 'Motion can trigger nausea or distraction for some users, and they can ask their system to reduce it.',
    recipe: 'Wrap the animation in @media (prefers-reduced-motion: no-preference), or disable it under (prefers-reduced-motion: reduce).',
    fixability: 'mechanical',
  },
  'FR-220': {
    why: 'Sound that starts on its own startles users and talks over a screen reader; browsers block it anyway.',
    recipe: 'Start muted and show controls, or play only after a user action.',
    fixability: 'mechanical',
  },
  'FR-221': {
    why: 'A hover-only reaction cannot be reached with a keyboard or a touchscreen.',
    recipe: 'Do the same on focus (onFocus/onBlur) and on tap/click, and make the element focusable.',
    fixability: 'mechanical',
  },
  'FR-222': {
    why: 'Lorem ipsum and TODO text that ships makes the product look unfinished.',
    recipe: 'Replace it with real copy before release.',
    fixability: 'judgment',
  },
  'FR-301': {
    why: 'Hardcoded colors drift from the design system and make theming painful.',
    recipe: 'Use the project tokens (CSS variables or palette utilities) instead of literal hex values.',
    fixability: 'mechanical',
  },
  'FR-302': {
    why: 'Off-scale font sizes break the type rhythm.',
    recipe: 'Use the type scale (text-sm, text-base, ...) or add the size to the theme.',
    fixability: 'mechanical',
  },
  'FR-303': {
    why: 'Off-scale spacing makes layouts inconsistent.',
    recipe: 'Use the spacing scale (p-4, gap-2, ...) or extend the theme.',
    fixability: 'mechanical',
  },
  'FR-304': {
    why: 'Low contrast text is hard to read for many people, and unreadable in sunlight.',
    recipe: 'Raise the contrast to at least 4.5:1 for body text (3:1 for large text) by darkening the text or lightening the background.',
    fixability: 'judgment',
  },
  'FR-305': {
    why: 'Tiny hit areas are hard to tap, especially for people with motor impairments.',
    recipe: 'Give interactive elements at least 24x24px (44x44px on touch) with padding, not just font size.',
    fixability: 'mechanical',
  },
  'FR-361': {
    why: 'Italic serif display headlines are a recognisable AI-generated look.',
    recipe: 'Choose type from the project design system for headlines.',
    fixability: 'judgment',
  },
  'FR-362': {
    why: 'The uppercase eyebrow chip above a headline is a recognisable AI-generated look.',
    recipe: 'Drop the chip or fold the content into the heading or subheading.',
    fixability: 'judgment',
  },
  'FR-363': {
    why: 'Cards nested in cards add visual noise and hide hierarchy.',
    recipe: 'Flatten: use spacing and one border level.',
    fixability: 'judgment',
  },
  'FR-364': {
    why: 'A stack of icon tiles is a recognisable AI-generated layout.',
    recipe: 'Replace with content that carries information, or vary the structure.',
    fixability: 'judgment',
  },
  'FR-365': {
    why: 'A thin border with a wide shadow signals elevation inconsistently.',
    recipe: 'Pick one: a border for flat surfaces or a soft shadow for raised ones.',
    fixability: 'judgment',
  },
  'FR-366': {
    why: 'Many status chips make a page read as noise.',
    recipe: 'Keep chips that carry state the user acts on; merge or drop the rest.',
    fixability: 'judgment',
  },
  'FR-367': {
    why: '"01 Discover" style labels are a recognisable AI-generated look.',
    recipe: 'Use plain section headings.',
    fixability: 'judgment',
  },
  'FR-368': {
    why: 'The violet/indigo gradient is a recognisable AI-generated look.',
    recipe: 'Use the project brand colors.',
    fixability: 'judgment',
  },
  'FR-369': {
    why: 'Emoji in headings read as decoration and can be announced noisily.',
    recipe: 'Remove the emoji, or put a real icon beside the heading with aria-hidden.',
    fixability: 'judgment',
  },
};

/** `fringe explain [id]`: one rule's full guidance, or a one-line index of all rules. */
export function renderExplain(id?: string): string | undefined {
  if (!id) return ALL_RULES.map((r) => `${r.id}  ${r.severity.padEnd(6)} ${GUIDANCE[r.id].why}`).join('\n');
  const rule = ALL_RULES.find((r) => r.id === id.toUpperCase());
  if (!rule) return undefined;
  const g = GUIDANCE[rule.id];
  const out = [`${rule.id} · ${rule.severity} · ${g.fixability} fix`, `Why:     ${g.why}`, `Fix:     ${g.recipe}`];
  if (g.avoid) out.push(`Avoid:   ${g.avoid}`);
  if (g.example) out.push('Before:  ' + g.example.before.replace(/\n/g, '\n         '), 'After:   ' + g.example.after.replace(/\n/g, '\n         '));
  return out.join('\n');
}

/** Rule ids a playbook may cite: static rules, plus the runtime ids that belong to `fringe scan`. */
export const knownRule = (id: string) => ALL_RULES.some((r) => r.id === id) || /^FR-40[0-5]$/.test(id);
