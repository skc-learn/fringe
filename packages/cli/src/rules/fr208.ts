import type { Rule } from '../types.js';

const FETCH = /useQuery|useSWR|useMutation|useFetcher|useInfiniteQuery|\bfetch\(|axios|createResource|loader/i;
const STATES = /isLoading|isPending|isError|isFetching|loading|empty|isEmpty|\berror\b|\bcatch\b|skeleton|spinner|fallback|onError|Suspense/i;

export const fr208: Rule = {
  id: 'FR-208', rung: 2, severity: 'review',
  check: (ctx) => {
    if (!FETCH.test(ctx.source) || STATES.test(ctx.source)) return [];
    return [{ rule: 'FR-208', severity: 'review' as const, message: `data is fetched but no loading/empty/error handling found`, hint: `render loading, empty, and error states — heuristic, verify by hand`, loc: { file: ctx.file, line: 1, col: 0 } }];
  },
};
