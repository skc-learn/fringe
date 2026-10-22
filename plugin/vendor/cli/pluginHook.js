// src/patterns.ts
var APG = "https://www.w3.org/WAI/ARIA/apg/patterns";
var WCAG = "https://www.w3.org/WAI/WCAG22/Understanding";
var SOURCES = {
  form: [`${WCAG}/labels-or-instructions.html`, `${WCAG}/error-identification.html`, "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill"],
  auth: [`${WCAG}/accessible-authentication-minimum.html`, "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill"],
  checkout: [`${WCAG}/error-prevention-legal-financial-data.html`, "https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill"],
  table: [`${APG}/table/`],
  search: [`${APG}/combobox/`, "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/"],
  tabs: [`${APG}/tabs/`],
  accordion: [`${APG}/accordion/`],
  toast: [`${APG}/alert/`, `${WCAG}/status-messages.html`],
  upload: [`${WCAG}/error-identification.html`, `${WCAG}/status-messages.html`],
  datepicker: [`${APG}/dialog-modal/examples/datepicker-dialog/`],
  onboarding: [`${WCAG}/content-on-hover-or-focus.html`],
  modal: [`${APG}/dialog-modal/`],
  navigation: [`${WCAG}/bypass-blocks.html`, "https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/"],
  "data-view": [`${WCAG}/status-messages.html`],
  dashboard: [`${WCAG}/use-of-color.html`, `${WCAG}/non-text-content.html`, `${WCAG}/reflow.html`],
  settings: [`${WCAG}/status-messages.html`, `${WCAG}/labels-or-instructions.html`],
  carousel: [`${APG}/carousel/`, `${WCAG}/pause-stop-hide.html`],
  "drag-and-drop": [`${WCAG}/dragging-movements.html`],
  "rich-text": [`${APG}/toolbar/`],
  chat: [`${WCAG}/status-messages.html`]
};
var sourcesOf = (name) => SOURCES[name] ?? [];
var PATTERNS = {
  form: {
    title: "Form",
    items: [
      { text: "Every field has a visible <label> bound with htmlFor/id", rules: ["FR-203"] },
      { text: "Right input type and autocomplete (email, tel, current-password, new-password, name) (Fringe checks email, phone and password fields)", rules: ["FR-216"] },
      { text: "Required fields are marked in text, not by color alone" },
      { text: "Errors appear next to the field in words, linked with aria-describedby and aria-invalid; focus moves to the first error on submit" },
      { text: "The submit button shows a pending state and cannot be double-submitted" },
      { text: "Input is kept when an error occurs; validation runs on blur, not on every keystroke" }
    ]
  },
  modal: {
    title: "Modal dialog",
    items: [
      { text: 'role="dialog" with aria-modal="true" and a name (aria-labelledby the title)', rules: ["FR-209"] },
      { text: "Focus moves in on open, stays trapped inside, and returns to the trigger on close" },
      { text: "A visible Close button with an accessible name, and Escape closes", rules: ["FR-202"] },
      { text: "Clicking the backdrop may close it but is never the only way", rules: ["FR-206"] },
      { text: "The page behind is inert and does not scroll" }
    ]
  },
  navigation: {
    title: "Navigation",
    items: [
      { text: "Links use real hrefs and describe the destination", rules: ["FR-217"] },
      { text: "A <nav> landmark (labelled if there are several), one <main>, and a skip-to-content link" },
      { text: 'The current page is marked with aria-current="page"' },
      { text: "Menus open by keyboard and tap, not by hover alone", rules: ["FR-221"] },
      { text: "Focus is always visible", rules: ["FR-205"] },
      { text: "Tap targets are large enough", rules: ["FR-305"] }
    ]
  },
  auth: {
    title: "Sign in and sign up",
    items: [
      { text: "Every field has a visible <label> bound with htmlFor/id (no placeholder-only fields)", rules: ["FR-203"] },
      { text: "Right input types and autocomplete: username or email, current-password (sign in), new-password (sign up), one-time-code for codes (Fringe checks email, phone and password fields)", rules: ["FR-216"] },
      { text: "Social and single-sign-on buttons carry text naming the provider, not just a logo", rules: ["FR-202"] },
      { text: '"Forgot password" is a real link with descriptive text', rules: ["FR-217"] },
      { text: "Password rules are shown before typing, not only after a failure; the user can reveal the password with a named toggle" },
      { text: 'A failed sign-in says "email or password is incorrect" (never which one), keeps the email, and moves focus to the message' },
      { text: "The submit button shows a pending state and cannot be double-submitted; pasting a password is allowed" },
      { text: "The page has a title and a language (checked on full HTML pages), and keyboard focus never gets stuck (checked by scan)", rules: ["FR-218", "FR-401"] },
      { text: "The whole flow, including the reveal toggle and any code entry, works with the keyboard alone" }
    ]
  },
  checkout: {
    title: "Checkout and payment",
    items: [
      { text: "Every field has a visible label", rules: ["FR-203"] },
      { text: "Address and card fields use the standard autocomplete tokens (name, street-address, postal-code, cc-number, cc-exp, cc-csc)" },
      { text: "The full price, including shipping, tax and any recurring cost, is visible before the pay button", rules: ["FR-214"] },
      { text: "No pre-checked marketing or consent boxes", rules: ["FR-211"] },
      { text: "No fake countdowns or manufactured urgency", rules: ["FR-210"] },
      { text: "Declining an upsell or add-on is a neutral choice with neutral wording", rules: ["FR-212"] },
      { text: "A payment failure says what failed in plain words, keeps the cart and the entered details, and offers a retry", rules: ["FR-215"] },
      { text: 'The pay button states the action and amount ("Pay $42.00"), shows a pending state, and cannot charge twice' },
      { text: "Order-summary changes (quantity, coupon, shipping) are announced to screen readers (aria-live)" },
      { text: "Progress through the steps is shown, and going back never loses what was entered" },
      { text: "Before the final payment the user can review and correct the order (WCAG 3.3.4 for financial transactions)" },
      { text: "Tap targets are large enough on a phone", rules: ["FR-305"] }
    ]
  },
  table: {
    title: "Data table",
    items: [
      { text: "A real <table> with <th> headers (scope set) and a caption or accessible name" },
      { text: "Sortable headers are buttons, and the sorted column carries aria-sort" },
      { text: 'Row-action icon buttons have names ("Delete invoice 1042"), and each row checkbox is labelled', rules: ["FR-202", "FR-203"] },
      { text: "Loading, empty (with a next step) and error (with a retry) states", rules: ["FR-208", "FR-215"] },
      { text: "Filters and the search box are labelled", rules: ["FR-203"] },
      { text: "A wide table scrolls inside its own container instead of making the whole page scroll sideways at 320px", rules: ["FR-404"] },
      { text: "Updated results after a filter or sort are announced (aria-live), and keyboard focus is not lost" }
    ]
  },
  search: {
    title: "Search",
    items: [
      { text: "The search field has a label", rules: ["FR-203"] },
      { text: 'The form is marked as a search landmark (role="search"), and Enter submits' },
      { text: "The submit button has a name", rules: ["FR-202"] },
      { text: "A clear button, if any, has a name", rules: ["FR-202"] },
      { text: 'Suggestions use the combobox pattern (role="combobox", aria-expanded, aria-controls, aria-activedescendant); Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "The number of results is announced (aria-live) after a search or filter" },
      { text: '"No results" says what to try next instead of showing an empty page' },
      { text: "The search term stays in the field and in the URL, so back and reload keep it" },
      { text: "Controls are large enough to tap", rules: ["FR-305"] }
    ]
  },
  tabs: {
    title: "Tabs",
    items: [
      { text: 'role="tablist", "tab" and "tabpanel", with aria-selected on the active tab and aria-controls linking tab to panel; Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "Tabs are real buttons, not clickable divs", rules: ["FR-206"] },
      { text: "Never a positive tabindex", rules: ["FR-207"] },
      { text: "Arrow keys move between tabs, Tab moves into the panel, and only the active tab is in the tab order" },
      { text: "The active tab is shown by more than color" },
      { text: "Focus is always visible", rules: ["FR-205"] },
      { text: "Hidden panels are not reachable by keyboard or screen reader" },
      { text: "Tabs that change the page address are links, not tabs" }
    ]
  },
  accordion: {
    title: "Accordion and disclosure",
    items: [
      { text: "The header is a <button> inside a heading (and the only thing inside it), not a clickable div", rules: ["FR-206"] },
      { text: "aria-expanded on the button and aria-controls pointing at the panel; Fringe checks the spelling of the ARIA attributes", rules: ["FR-209"] },
      { text: "Heading levels fit the page outline", rules: ["FR-204"] },
      { text: "Enter and Space toggle it; focus stays on the button" },
      { text: "Focus is always visible", rules: ["FR-205"] },
      { text: "The open or closed state is shown by more than color or a rotating icon alone" }
    ]
  },
  toast: {
    title: "Toast, alert and banner",
    items: [
      { text: 'Status messages use role="status" (polite) and urgent errors role="alert"; they are in the page before they fill with text' },
      { text: "It stays long enough to read (longer for longer text), pauses on hover and focus, and errors do not auto-dismiss" },
      { text: "The dismiss button has a name", rules: ["FR-202"] },
      { text: "An error is also shown where it happened (inline), not only in a toast" },
      { text: "It never steals keyboard focus" },
      { text: "Text has enough contrast against the toast background", rules: ["FR-400"] },
      { text: "Slide-in animations respect reduced motion", rules: ["FR-219"] }
    ]
  },
  upload: {
    title: "File upload",
    items: [
      { text: 'The control has a name (a real <input type="file"> with a label, or a button that opens it)', rules: ["FR-202", "FR-203"] },
      { text: "Allowed types and the size limit are stated before the user chooses a file" },
      { text: "Drag and drop is an extra, never the only way" },
      { text: 'Progress is announced (role="progressbar" with a value, or aria-live text)' },
      { text: "A wrong type or too-large file gets a specific message and a way to retry", rules: ["FR-215"] },
      { text: 'Per-file remove and replace buttons say which file ("Remove invoice.pdf")', rules: ["FR-202"] },
      { text: "Image previews have alt text", rules: ["FR-201"] }
    ]
  },
  datepicker: {
    title: "Date picker",
    items: [
      { text: "Use the native date input where it fits; otherwise typing a date is always possible beside the calendar" },
      { text: "The field has a label", rules: ["FR-203"] },
      { text: "The label states the expected format" },
      { text: 'Each calendar day has an accessible name with the weekday and month, not just the number ("Tuesday 21 October 2026"), and the month and year buttons have names', rules: ["FR-202"] },
      { text: "Left and Right arrows move by day and Up and Down by week, Page Up and Page Down by month (with Shift, by year); only one day is in the Tab sequence" },
      { text: "Escape closes the calendar and returns focus to the button that opened it" },
      { text: "Unavailable dates are explained, not only greyed out" },
      { text: "Day buttons are large enough to tap", rules: ["FR-305"] }
    ]
  },
  onboarding: {
    title: "Onboarding and tours",
    items: [
      { text: "Every step can be skipped, and the flow can be resumed later" },
      { text: 'Progress is shown ("Step 2 of 4")' },
      { text: "Ask only for what is needed now; ask for permissions in context, not up front" },
      { text: "Tooltips and tour steps do not depend on hover alone", rules: ["FR-221"] },
      { text: "Tour steps open and close by keyboard, and Escape closes them" },
      { text: "No pre-checked consent and no manufactured urgency", rules: ["FR-211", "FR-210"] },
      { text: "No placeholder or unfinished copy ships", rules: ["FR-222"] },
      { text: "Animations respect reduced motion", rules: ["FR-219"] },
      { text: "The flow reflows to a 320px screen without sideways scrolling", rules: ["FR-404"] }
    ]
  },
  "empty-state": {
    title: "Empty state",
    items: [
      { text: "The empty case is handled with its own rendering, not a blank area", rules: ["FR-208"] },
      { text: "It says what the area is for and gives one clear next action" },
      { text: 'First-use empty and filtered-to-nothing read differently ("Add your first item" vs "Clear filters")' },
      { text: 'A load failure has its own message with a next step and is never shown as "no data"', rules: ["FR-215"] },
      { text: "The action is a real button or link", rules: ["FR-206", "FR-217"] },
      { text: "Illustrations have an alt attribute: empty if decorative, a description if meaningful", rules: ["FR-201"] },
      { text: "The heading level fits the outline", rules: ["FR-204"] },
      { text: "The copy is finished: no lorem ipsum or TODO", rules: ["FR-222"] }
    ]
  },
  pricing: {
    title: "Pricing and plan pages",
    items: [
      { text: "The full price, including the billing period, taxes and any recurring cost, sits next to each plan", rules: ["FR-214"] },
      { text: "No fake countdowns or invented scarcity", rules: ["FR-210"] },
      { text: "No pre-selected add-ons or pre-checked consent", rules: ["FR-211"] },
      { text: "Downgrading, skipping and cancelling use neutral wording", rules: ["FR-212"] },
      { text: 'Each plan button says which plan ("Choose Pro"), so a list of buttons is not eight copies of "Get started"' },
      { text: "The comparison is a real table with headers, and the selected or recommended plan is shown by more than color" },
      { text: "Cancelling is as easy to find and do as signing up was" },
      { text: "Banner and badge text has enough contrast on its background", rules: ["FR-400"] },
      { text: "No placeholder copy ships", rules: ["FR-222"] }
    ]
  },
  settings: {
    title: "Settings page",
    items: [
      { text: "Every control has a visible label, and related controls are grouped under a heading or fieldset legend", rules: ["FR-203", "FR-204"] },
      { text: 'Toggles expose their state (role="switch" with aria-checked, or a checkbox) and the state is not shown by color alone; Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "Either a save button with clear confirmation, or instant saving with visible feedback; the page says which" },
      { text: 'Success and failure of a save are announced (role="status" or "alert")' },
      { text: "Destructive actions (delete account) are set apart, confirmed with specific wording, and undoable where possible" },
      { text: "Leaving with unsaved changes asks first" },
      { text: "The keyboard order follows the visual order (no positive tabindex)", rules: ["FR-207"] }
    ]
  },
  dashboard: {
    title: "Dashboard",
    items: [
      { text: "One h1, with sections as headings in order", rules: ["FR-204"] },
      { text: "Each chart or metric has a text equivalent (a table or a sentence), and values are not conveyed by color alone" },
      { text: "Clickable stat cards are real links or buttons", rules: ["FR-206"] },
      { text: "Every widget handles loading, empty and error on its own", rules: ["FR-208", "FR-215"] },
      { text: "Refresh, filter and settings icon buttons have names", rules: ["FR-202"] },
      { text: "Auto-refresh does not steal focus or reset filters, and announces changes politely" },
      { text: "Cards stack to one column on a 320px screen without sideways scrolling", rules: ["FR-404"] },
      { text: "Text and chart labels keep their contrast in dark mode", rules: ["FR-400"] }
    ]
  },
  carousel: {
    title: "Carousel",
    items: [
      { text: "If it rotates by itself, there is a button to stop and restart it, early in the tab order" },
      { text: "Rotation stops when keyboard focus enters the carousel and does not restart unless the user asks; it also stops while the pointer hovers over it" },
      { text: 'Previous, next and slide-picker controls are buttons with names ("Next slide", "Slide 2 of 5")', rules: ["FR-202"] },
      { text: 'The carousel is a labelled region (role="region", aria-roledescription="carousel") and each slide is labelled "2 of 5"; Fringe checks the spelling of the ARIA attributes', rules: ["FR-209"] },
      { text: "Slides that are not showing are hidden from screen readers and the keyboard, not just moved off-screen" },
      { text: "Changes of slide are announced politely when the user changes them, and not at all while it rotates by itself" },
      { text: "Slide images have alt text", rules: ["FR-201"] },
      { text: "Sliding animations respect reduced motion", rules: ["FR-219"] },
      { text: "Controls are large enough to tap", rules: ["FR-305"] }
    ]
  },
  "drag-and-drop": {
    title: "Drag and drop",
    items: [
      { text: 'Every drag has an alternative that needs only a single click or tap: "Move up", "Move to\u2026" buttons or a menu (WCAG 2.5.7)' },
      { text: "A keyboard way to do the same: pick up with Space or Enter, move with the arrow keys, drop with Space, cancel with Escape" },
      { text: 'The drag handle is a real button with a name ("Reorder Task 3")', rules: ["FR-202"] },
      { text: 'Pick-up, movement and drop are announced ("Task 3 moved to position 2 of 5") through a live region' },
      { text: "Handles are not revealed by hover alone", rules: ["FR-221"] },
      { text: "Focus is visible on the handle and the item", rules: ["FR-205"] },
      { text: "Items that react to clicks are buttons or links, not clickable divs", rules: ["FR-206"] },
      { text: "Drop targets are shown by more than color" }
    ]
  },
  "rich-text": {
    title: "Rich-text editor",
    items: [
      { text: 'The toolbar is a labelled role="toolbar", its buttons have names and show their on/off state with aria-pressed (Fringe checks the names and the spelling of the attribute)', rules: ["FR-202", "FR-209"] },
      { text: "Arrow keys move between toolbar buttons and only one is in the Tab sequence" },
      { text: 'The editing area has an accessible name and role="textbox" with aria-multiline' },
      { text: "Tab leaves the editor (or the page documents how), so focus never gets stuck", rules: ["FR-401"] },
      { text: "Inserted images ask for alt text, and what the editor outputs has it", rules: ["FR-201"] },
      { text: 'Inserted links ask for link text, and the output avoids "click here"', rules: ["FR-217"] },
      { text: 'Autosave and save errors are announced (role="status" or "alert")' },
      { text: "Pasted content is cleaned before it is stored or shown" },
      { text: "Undo and redo are available from the keyboard and as buttons" }
    ]
  },
  chat: {
    title: "Chat and messaging",
    items: [
      { text: 'The message list is a live log (role="log"): new messages are announced politely without moving focus' },
      { text: "The message box has a label, and the send button has a name", rules: ["FR-203", "FR-202"] },
      { text: "The page says whether Enter sends or adds a new line (and Shift+Enter does the other)" },
      { text: "A typing or streaming indicator does not re-announce the whole message with every update" },
      { text: "Who sent each message, and when, is available as text, not by alignment or color alone" },
      { text: "A failed send shows what failed and a retry", rules: ["FR-215"] },
      { text: 'New messages do not yank the view if the user scrolled up; a "jump to latest" control is offered' },
      { text: "Links inside messages have descriptive text", rules: ["FR-217"] },
      { text: "Entrance animations respect reduced motion", rules: ["FR-219"] }
    ]
  },
  "data-view": {
    title: "Data view (list, table, dashboard)",
    items: [
      { text: "A loading state with a text label, an empty state that says what to do next, and an error state with a retry", rules: ["FR-208", "FR-215"] },
      { text: "Layout does not jump when data arrives (reserve the space)" },
      { text: "Async updates are announced (aria-live) when the user did not trigger them" },
      { text: "Table headers use <th> and a caption or accessible name" }
    ]
  }
};

// src/promptHook.ts
var TRIGGERS = [
  ["carousel", /carousel|slider|slideshow|image gallery/i],
  ["tabs", /\btabs?\b|tabbed/i],
  ["modal", /\bmodal|dialog|pop-?up|lightbox/i],
  ["datepicker", /date ?picker|calendar|date (input|range)/i],
  ["accordion", /accordion|collapsible|expandable|\bfaq\b/i],
  ["toast", /toast|snackbar|notification banner|alert banner/i],
  ["upload", /upload|file (input|picker)|attachment/i],
  ["drag-and-drop", /drag|drop ?zone|reorder|sortable|kanban/i],
  ["rich-text", /rich[- ]?text|wysiwyg|text editor|markdown editor/i],
  ["chat", /\bchat|messag(e|ing) (list|thread|ui)|conversation/i],
  ["table", /\btables?\b|data ?grid|spreadsheet/i],
  ["checkout", /checkout|payment|billing|credit card/i],
  ["auth", /sign[- ]?(in|up)|log[- ]?in|register|authenticat|forgot password|password reset/i],
  ["pricing", /pricing|plans? (page|comparison)|subscription (page|plans?)/i],
  ["settings", /settings|preferences|account page/i],
  ["dashboard", /dashboard|analytics (page|view)|stat cards?/i],
  ["onboarding", /onboarding|walkthrough|product tour|welcome flow/i],
  ["empty-state", /empty state|no (results|data) (state|view)/i],
  ["search", /\bsearch|autocomplete|typeahead/i],
  ["navigation", /navbar|nav ?bar|navigation|sidebar|menu|breadcrumb/i],
  ["form", /\bforms?\b|input field|contact form|signup form/i]
];
var AMBIGUOUS = /* @__PURE__ */ new Set(["table", "search", "settings", "chat", "form", "dashboard", "auth", "pricing", "checkout", "navigation", "upload"]);
var UI_CUE = /\b(component|page|screen|ui|ux|frontend|front-end|react|vue|svelte|angular|next\.?js|tailwind|jsx|tsx|html|css|button|modal|layout|widget|view|widgets)\b|\.(tsx|jsx|vue|svelte|html|css)\b/i;
var BACKEND_CUE = /\b(database|sql|postgres|mysql|migration|schema|orm|api|endpoint|cli|command[- ]line|script|backend|server|query|docker|kubernetes|logs?|cron|worker|queue)\b/i;
var BUILD = /\b(create|build|add|make|implement|write|design|develop|generate|scaffold|set up|put together)\b/i;
function matchPlaybooks(prompt, max = 2) {
  if (!BUILD.test(prompt)) return [];
  const ui = UI_CUE.test(prompt);
  if (BACKEND_CUE.test(prompt) && !ui) return [];
  return TRIGGERS.filter(([name, re]) => re.test(prompt) && (ui || !AMBIGUOUS.has(name))).map(([name]) => name).slice(0, max);
}
function playbookContext(names) {
  const blocks = names.map((n) => {
    const p = PATTERNS[n];
    const lines = p.items.map((i) => `- ${i.text} [${i.rules ? `Fringe checks: ${i.rules.join(", ")}` : "yours to get right"}]`);
    const src = sourcesOf(n)[0];
    return `${p.title}: build it like this
${lines.join("\n")}${src ? `
(based on ${src})` : ""}`;
  });
  return `Fringe playbook${names.length > 1 ? "s" : ""} for what you are about to build. Follow it while you write the code; Fringe will check the "Fringe checks" items after each edit, and the rest are yours to get right (say in your final message how you handled them).

${blocks.join("\n\n")}`;
}
function promptHookOutput(stdin) {
  let prompt = "";
  try {
    prompt = String(JSON.parse(stdin).prompt ?? "");
  } catch {
    prompt = stdin;
  }
  const names = matchPlaybooks(prompt);
  if (names.length === 0) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: playbookContext(names) } });
}

// src/pluginHook.ts
var readStdin = () => new Promise((ok) => {
  if (process.stdin.isTTY) return ok("");
  let d = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => d += c);
  process.stdin.on("end", () => ok(d));
});
async function main(argv, log) {
  try {
    if (argv[0] === "hook-prompt") {
      const out = promptHookOutput(await readStdin());
      if (out) log(out);
    }
  } catch {
  }
}
if (process.argv[1] && /pluginHook\.(m?js|ts)$/.test(process.argv[1])) await main(process.argv.slice(2), (s) => console.log(s));
export {
  main
};
