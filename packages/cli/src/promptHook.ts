import { PATTERNS, sourcesOf } from './patterns.js';

// Order matters: the most specific component wins when several words appear, and at most two playbooks are injected.
const TRIGGERS: Array<[string, RegExp]> = [
  ['carousel', /carousel|slider|slideshow|image gallery/i],
  ['tabs', /\btabs?\b|tabbed/i],
  ['modal', /\bmodal|dialog|pop-?up|lightbox/i],
  ['datepicker', /date ?picker|calendar|date (input|range)/i],
  ['accordion', /accordion|collapsible|expandable|\bfaq\b/i],
  ['toast', /toast|snackbar|notification banner|alert banner/i],
  ['upload', /upload|file (input|picker)|attachment/i],
  ['drag-and-drop', /drag|drop ?zone|reorder|sortable|kanban/i],
  ['rich-text', /rich[- ]?text|wysiwyg|text editor|markdown editor/i],
  ['chat', /\bchat|messag(e|ing) (list|thread|ui)|conversation/i],
  ['table', /\btables?\b|data ?grid|spreadsheet/i],
  ['checkout', /checkout|payment|billing|credit card/i],
  ['auth', /sign[- ]?(in|up)|log[- ]?in|register|authenticat|forgot password|password reset/i],
  ['pricing', /pricing|plans? (page|comparison)|subscription (page|plans?)/i],
  ['settings', /settings|preferences|account page/i],
  ['dashboard', /dashboard|analytics (page|view)|stat cards?/i],
  ['onboarding', /onboarding|walkthrough|product tour|welcome flow/i],
  ['empty-state', /empty state|no (results|data) (state|view)/i],
  ['search', /\bsearch|autocomplete|typeahead/i],
  ['navigation', /navbar|nav ?bar|navigation|sidebar|menu|breadcrumb/i],
  ['form', /\bforms?\b|input field|contact form|signup form/i],
];
// Words like table, search, settings, chat and form are everyday backend words too ("add a column to the users table", "search the logs",
// "a settings flag for the CLI"). Those playbooks only fire when the request also sounds like UI work; unmistakable UI components always fire.
const AMBIGUOUS = new Set(['table', 'search', 'settings', 'chat', 'form', 'dashboard', 'auth', 'pricing', 'checkout', 'navigation', 'upload']);
const UI_CUE = /\b(component|page|screen|ui|ux|frontend|front-end|react|vue|svelte|angular|next\.?js|tailwind|jsx|tsx|html|css|button|modal|layout|widget|view|widgets)\b|\.(tsx|jsx|vue|svelte|html|css)\b/i;
const BACKEND_CUE = /\b(database|sql|postgres|mysql|migration|schema|orm|api|endpoint|cli|command[- ]line|script|backend|server|query|docker|kubernetes|logs?|cron|worker|queue)\b/i;
const BUILD = /\b(create|build|add|make|implement|write|design|develop|generate|scaffold|set up|put together)\b/i;

/** Which playbooks apply to what the user just asked for. Only building requests match: "fix the parser" or "explain this" never do. */
export function matchPlaybooks(prompt: string, max = 2): string[] {
  if (!BUILD.test(prompt)) return [];
  const ui = UI_CUE.test(prompt);
  if (BACKEND_CUE.test(prompt) && !ui) return [];
  return TRIGGERS.filter(([name, re]) => re.test(prompt) && (ui || !AMBIGUOUS.has(name))).map(([name]) => name).slice(0, max);
}

/** The text the agent receives: the checklist, each line marked as checked by Fringe or left to the agent. */
export function playbookContext(names: string[]): string {
  const blocks = names.map((n) => {
    const p = PATTERNS[n];
    const lines = p.items.map((i) => `- ${i.text} [${i.rules ? `Fringe checks: ${i.rules.join(', ')}` : 'yours to get right'}]`);
    const src = sourcesOf(n)[0];
    return `${p.title}: build it like this\n${lines.join('\n')}${src ? `\n(based on ${src})` : ''}`;
  });
  return `Fringe playbook${names.length > 1 ? 's' : ''} for what you are about to build. Follow it while you write the code; Fringe will check the "Fringe checks" items after each edit, and the rest are yours to get right (say in your final message how you handled them).\n\n${blocks.join('\n\n')}`;
}

/** Claude Code UserPromptSubmit hook: reads the hook's JSON from stdin, prints the additional context (or nothing). */
export function promptHookOutput(stdin: string): string {
  let prompt = '';
  try { prompt = String(JSON.parse(stdin).prompt ?? ''); } catch { prompt = stdin; }
  const names = matchPlaybooks(prompt);
  if (names.length === 0) return '';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: playbookContext(names) } });
}
