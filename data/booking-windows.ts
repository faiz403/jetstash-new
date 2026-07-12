/**
 * Which job a window plays in the Book-By Countdown maths
 * (lib/booking-intelligence.ts):
 *   'recommended' — the route's stated best time to commit; drives the
 *                   route-specific book-by date.
 *   'avoid'       — the stated sharp-rise zone; drives the surge boundary.
 *   'typical'     — background context only; never drives a date.
 */
export type BookingWindowRole = 'recommended' | 'avoid' | 'typical';

export interface BookingWindow {
  id: string;
  routeSlug: string;
  label: string;
  weeksBeforeDeparture: { min: number; max: number };
  guidance: string;
  role: BookingWindowRole;
  /**
   * Peak-period ids (data/peak-periods.ts) this window's advice is about,
   * when the guidance names specific periods (every current 'recommended'
   * entry is explicitly about Eid). lib/booking-intelligence.ts only applies
   * a recommended window to a countdown event whose period matches — an
   * Eid-specific "book 12+ weeks out" must never silently become summer-
   * holiday advice. Omit only for genuinely period-agnostic guidance.
   */
  appliesToPeriodIds?: string[];
}

/**
 * Structured booking-window guidance, additive to (not a replacement for)
 * each route's bookingWindowNote prose in data/routes.ts. Only added where
 * that prose already states explicit week/month numbers — seeded here by
 * restructuring those numbers, not inventing new ones. Routes whose booking
 * advice is calendar-seasonal rather than weeks-before-departure (e.g.
 * "Feb–Apr is better value than Diwali season") keep relying on prose only —
 * for those, the Book-By panel falls back to the universal "fares rise
 * sharply within 3–4 weeks of a peak period" guidance already stated in
 * data/peak-periods.ts, and computes no route-specific recommendation.
 */
export const bookingWindows: BookingWindow[] = [
  {
    id: 'man-lhe-steady',
    routeSlug: 'manchester-lahore',
    label: 'Outside Eid and UK summer holidays',
    weeksBeforeDeparture: { min: 8, max: 10 },
    guidance: 'Fares hold reasonably steady in this window.',
    role: 'typical',
  },
  {
    id: 'man-lhe-eid-risk',
    routeSlug: 'manchester-lahore',
    label: 'Within 3 weeks of Eid',
    weeksBeforeDeparture: { min: 0, max: 3 },
    guidance: 'Expect a sharp price jump. This is the window to avoid if your dates are flexible.',
    role: 'avoid',
    appliesToPeriodIds: ['eid-al-fitr', 'eid-al-adha'],
  },
  {
    id: 'man-lhe-eid-recommended',
    routeSlug: 'manchester-lahore',
    label: 'Recommended booking window for fixed Eid dates',
    weeksBeforeDeparture: { min: 12, max: 20 },
    guidance: 'Book 3+ months ahead if your Eid travel dates are fixed.',
    role: 'recommended',
    appliesToPeriodIds: ['eid-al-fitr', 'eid-al-adha'],
  },
  {
    // Restructured from the route's own bookingWindowNote, which states the
    // pattern "is similar to the Lahore route" — hence the same 12–20 week
    // recommendation, with the note's own sell-out caveat kept visible.
    id: 'man-isb-eid-recommended',
    routeSlug: 'manchester-islamabad',
    label: 'Recommended booking window for fixed Eid dates',
    weeksBeforeDeparture: { min: 12, max: 20 },
    guidance:
      "This route's pattern is similar to Manchester–Lahore: book 3+ months ahead for fixed Eid dates. It also tends to sell out faster than Lahore in peak weeks, because it runs fewer weekly frequencies.",
    role: 'recommended',
    appliesToPeriodIds: ['eid-al-fitr', 'eid-al-adha'],
  },
  {
    id: 'bhx-isb-eid-recommended',
    routeSlug: 'birmingham-islamabad',
    label: 'Recommended booking window ahead of Eid',
    weeksBeforeDeparture: { min: 8, max: 13 },
    guidance: '2 to 3 months ahead of Eid, this route tends to hold marginally more availability than the newer Birmingham to Lahore service.',
    role: 'recommended',
    appliesToPeriodIds: ['eid-al-fitr', 'eid-al-adha'],
  },
  {
    id: 'man-khi-eid-wedding-recommended',
    routeSlug: 'manchester-karachi',
    label: 'Recommended booking window ahead of Eid or wedding season',
    weeksBeforeDeparture: { min: 8, max: 13 },
    guidance: "Book 2 to 3 months ahead of Eid or wedding season while PIA's expanded UK schedule is still settling.",
    role: 'recommended',
    appliesToPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'wedding-season'],
  },
];

export function getBookingWindowsByRoute(routeSlug: string) {
  return bookingWindows.filter((w) => w.routeSlug === routeSlug);
}
