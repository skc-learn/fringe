import type { Rule } from '../types.js';

const ERROR_MARKER = /(isError|\berror\b|catch)/;
const GENERIC_COPY = /something went wrong|an error occurred|oops|whoops/i;
const RECOVERY = /(retry|try again|reload|contact support|support team)/i;

export const fr215: Rule = {
  id: 'FR-215', rung: 2, severity: 'review',
  check: (ctx) => {
    if (ERROR_MARKER.test(ctx.source) && GENERIC_COPY.test(ctx.source) && !RECOVERY.test(ctx.source)) {
      return [{ rule: 'FR-215', severity: 'review' as const, message: 'generic error copy with no recovery action', hint: 'tell users what failed and give them a next step (retry, link, contact)', loc: { file: ctx.file, line: 1, col: 0 } }];
    }
    return [];
  },
};
