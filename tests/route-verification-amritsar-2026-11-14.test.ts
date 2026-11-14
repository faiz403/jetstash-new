import { describe, expect, it } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { getDestinationBySlug } from '@/data/destinations';
import { getDestinationFlightTimeFromUK } from '@/lib/destination-flight-time';

/**
 * Birmingham-Amritsar re-verification (14 November 2026, due 21 November). The route-page schedule widget omitted the nonstop for
 * 15-20 November, but Air India's own booking availability (searched one way for specific dates, read only) lists AI118 and AI117
 * as Non-stop on selected dates, so the apparent conflict is resolved and the record is renewed on that fresh primary evidence.
 * The widget is a day-by-day view; its omission is not evidence of cancellation.
 */
const route = getRouteBySlug('birmingham-amritsar')!;

describe('Birmingham-Amritsar re-verification, 14 November 2026', () => {
  it('is re-dated with a 30-day window and stays direct while current', () => {
    expect(route.verification?.status).toBe('verified');
    expect(route.verification?.verifiedDate).toBe('2026-11-14');
    expect(route.verification?.reviewDueDate).toBe('2026-12-14');
    const days = (Date.parse(route.verification!.reviewDueDate) - Date.parse(route.verification!.verifiedDate)) / 86_400_000;
    expect(days).toBe(30);
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-12-14').status).toBe('direct');
  });

  it('fails closed after the new review date', () => {
    const after = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-12-15');
    expect(after.status).toBe('unverified');
    expect(after.frequency).toBeNull();
  });

  it('records the booking-availability evidence, the incomplete widget and the superseded figures', () => {
    const note = route.verification?.note ?? '';
    expect(note).toContain('Re-verification (14 November 2026) after an apparent source conflict was resolved');
    expect(note).toMatch(/booking availability, searched one way for specific dates on 14 November 2026 \(read only, no booking made\)/);
    expect(note).toMatch(/AI118 Birmingham 20:50 to Amritsar 12:30 next day as Non-stop, 10h 10m/);
    expect(note).toMatch(/AI117 Amritsar 13:30 to Birmingham 19:20 as Non-stop, 11h 20m/);
    expect(note).toMatch(/incomplete view, not evidence of cancellation/);
    expect(note).toMatch(/10h 35m and 12h 35m figures were read from the route-page widget on 22 October and are superseded/);
  });

  it('the Amritsar destination flight-time claim shows while the route is direct and fails closed after it expires', () => {
    // The clause must name just the airport ("Direct from Birmingham; ...") so lib/destination-flight-time.ts can check it
    // against the route; a longer phrase silently skipped the guard and survived expiry.
    const amritsar = getDestinationBySlug('amritsar')!;
    expect(getDestinationFlightTimeFromUK(amritsar, '2026-12-14')).toContain('Direct from Birmingham');
    const lapsed = getDestinationFlightTimeFromUK(amritsar, '2026-12-15');
    expect(lapsed).toMatch(/not yet confirmed/);
    expect(lapsed).not.toMatch(/Direct from Birmingham|Air India/);
  });

  it('shows the re-checked durations and makes no weekday or weekly-count claim', () => {
    expect(route.flightTime).toContain('10h 10m out and 11h 20m back');
    expect(route.flightTime).not.toMatch(/10h 35m|12h 35m/);
    const visible = [route.frequency, route.intro, route.bookingWindowNote].join(' ');
    expect(visible).not.toMatch(/monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekly|\b\d+x? (a|per) week\b/i);
    expect(route.frequency).toBe('Nonstop on selected days rather than daily; operating days vary, so confirm your date with Air India');
  });
});
