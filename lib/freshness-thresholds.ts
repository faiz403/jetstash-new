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

/**
 * A fare observation whose travel departs fewer than this many calendar days
 * after today is never promoted as a current headline, secondary,
 * Standout, Book-By or deal-card price (17 Oct 2026). An old check for a
 * flight leaving this week is not a planning signal. Measured from the
 * observation's own departureDate, never its observedDate; the observation
 * stays visible in dated history displays.
 */
export const MIN_PROMOTED_DEPARTURE_LEAD_DAYS = 14;
/**
 * Conservative safety margin added to the 14-day guard (founder-approved
 * Option A, 17 Oct 2026). Pages evaluate `nowIso` as the UTC date at render
 * time, but a visitor sees the page on their UK date, which can be one day
 * later: 00:00–01:00 BST is still the previous UTC date, and an ISR page
 * (revalidate 6h) rendered late in the day is served after UK midnight.
 * Requiring 15 days at render keeps every page served within ~23 hours of
 * rendering at 14+ UK calendar days. Known trade-off: a fare exactly 14 UK
 * calendar days before departure can be excluded.
 */
export const PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS = 1;
/** The departure guard applies from this date; earlier dates keep their previous semantics (same convention as LOWEST_FARE_POLICY_START_DATE). */
export const PROMOTED_DEPARTURE_GUARD_START_DATE = '2026-10-17';

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

/**
 * True when a fare's departure is at least MIN_PROMOTED_DEPARTURE_LEAD_DAYS +
 * PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS (15) calendar days after `nowIso`,
 * so it is still 14+ days away on the visitor's UK date. A missing departure
 * date never qualifies — no date is inferred. Always true before
 * PROMOTED_DEPARTURE_GUARD_START_DATE.
 */
export function meetsPromotedDepartureLeadTime(departureDate: string | undefined, nowIso: string): boolean {
  if (nowIso < PROMOTED_DEPARTURE_GUARD_START_DATE) return true;
  if (!departureDate) return false;
  return daysBetweenIso(nowIso, departureDate) >= MIN_PROMOTED_DEPARTURE_LEAD_DAYS + PROMOTED_DEPARTURE_SAFETY_MARGIN_DAYS;
}

/** Date-only day-count between two ISO dates, immune to timezone/DST edges — same approach as lib/booking-intelligence.ts. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const toUtcNoon = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
  return Math.round((toUtcNoon(toIso) - toUtcNoon(fromIso)) / 86_400_000);
}
