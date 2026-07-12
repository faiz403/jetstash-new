/**
 * Every "how old is too old" threshold on the site, in one place — moved out
 * of `lib/booking-intelligence.ts` (fare-observation freshness) and
 * `lib/founder-insights.ts` (service-change/rule-review windows, previously
 * defined inline in that file) so a future threshold change never has to be
 * hunted down across files. Nothing here changes what counts as fresh today;
 * this only centralises the numbers that already existed.
 *
 * `FareFreshnessState` is the 3-tier model customer-facing fare surfaces use
 * (`deal-card.tsx`, `fare-history-panel.tsx`, `book-by-countdown.tsx`):
 * `'fresh'` renders normally, `'ageing'` still renders normally but is
 * eligible for a caveat sentence, `'stale'` gets visibly de-emphasised
 * (muted styling, explicit "this is old" copy) rather than looking as
 * current as a same-week check — never deleted or hidden, per the
 * append-only/never-fabricate rule (JETSTASH_PRINCIPLES.md §4.3), just
 * visually honest about its age.
 */

/** A fare observation at or below this age renders as current context. */
export const OBSERVATION_FRESH_DAYS = 60;

/** Beyond this age, a fare observation is visibly de-emphasised rather than just caveated. */
export const OBSERVATION_STALE_DAYS = 180;

/** A route service-change date inside this many days gets flagged for founder review. */
export const SERVICE_END_WATCH_DAYS = 90;

/** A Travel Ready Check rule inside this many days of its review date gets flagged for founder review. */
export const RULE_REVIEW_WATCH_DAYS = 30;

export type FareFreshnessState = 'fresh' | 'ageing' | 'stale';

export function getFareFreshnessState(ageDays: number): FareFreshnessState {
  if (ageDays <= OBSERVATION_FRESH_DAYS) return 'fresh';
  if (ageDays <= OBSERVATION_STALE_DAYS) return 'ageing';
  return 'stale';
}

/** Date-only day-count between two ISO dates, immune to timezone/DST edges — same approach as lib/booking-intelligence.ts. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const toUtcNoon = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
  return Math.round((toUtcNoon(toIso) - toUtcNoon(fromIso)) / 86_400_000);
}
