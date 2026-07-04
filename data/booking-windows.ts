export interface BookingWindow {
  id: string;
  routeSlug: string;
  label: string;
  weeksBeforeDeparture: { min: number; max: number };
  guidance: string;
}

/**
 * Structured booking-window guidance, additive to (not a replacement for)
 * each route's bookingWindowNote prose in data/routes.ts. Only added where
 * that prose already states explicit week/month numbers — seeded here by
 * restructuring those numbers, not inventing new ones. Routes whose booking
 * advice is calendar-seasonal rather than weeks-before-departure (e.g.
 * "Feb–Apr is better value than Diwali season") keep relying on prose only.
 */
export const bookingWindows: BookingWindow[] = [
  {
    id: 'man-lhe-steady',
    routeSlug: 'manchester-lahore',
    label: 'Outside Eid and UK summer holidays',
    weeksBeforeDeparture: { min: 8, max: 10 },
    guidance: 'Fares hold reasonably steady in this window.',
  },
  {
    id: 'man-lhe-eid-risk',
    routeSlug: 'manchester-lahore',
    label: 'Within 3 weeks of Eid',
    weeksBeforeDeparture: { min: 0, max: 3 },
    guidance: 'Expect a sharp price jump — this is the window to avoid if your dates are flexible.',
  },
  {
    id: 'man-lhe-eid-recommended',
    routeSlug: 'manchester-lahore',
    label: 'Recommended booking window for fixed Eid dates',
    weeksBeforeDeparture: { min: 12, max: 20 },
    guidance: 'Book 3+ months ahead if your Eid travel dates are fixed.',
  },
  {
    id: 'bhx-isb-eid-recommended',
    routeSlug: 'birmingham-islamabad',
    label: 'Recommended booking window ahead of Eid',
    weeksBeforeDeparture: { min: 8, max: 13 },
    guidance: '2–3 months ahead of Eid, this route tends to hold marginally more availability than the newer Birmingham–Lahore service.',
  },
  {
    id: 'man-khi-eid-wedding-recommended',
    routeSlug: 'manchester-karachi',
    label: 'Recommended booking window ahead of Eid or wedding season',
    weeksBeforeDeparture: { min: 8, max: 13 },
    guidance: "Book 2–3 months ahead of Eid or wedding season while PIA's expanded UK schedule is still settling.",
  },
];

export function getBookingWindowsByRoute(routeSlug: string) {
  return bookingWindows.filter((w) => w.routeSlug === routeSlug);
}
