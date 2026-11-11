import { describe, expect, it } from 'vitest';
import { getRouteBySlug, isVerificationCurrent } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * 10 November 2026 route verification refresh. Four verifications were due to lapse between 12 and 16 November.
 * Each was re-read against the same official source on 10 November: the three Emirates Scotland/North East
 * Dubai pages (7 flights per week still confirmed, durations now show the current Emirates timetable) and the
 * Gatwick/easyJet Faro pages (unchanged, so only the dates move).
 */
const REFRESHED = [
  { slug: 'glasgow-dubai', outbound: '7h 20m', back: '8h 15m', dueDate: '2027-02-08' },
  { slug: 'edinburgh-dubai', outbound: '7h 15m', back: '8h 15m', dueDate: '2027-02-08' },
  { slug: 'newcastle-dubai', outbound: '7h 10m', back: '7h 55m', dueDate: '2027-02-08' },
] as const;

describe('10 November 2026 route verification refresh', () => {
  it.each(REFRESHED)('$slug carries the 10 November Emirates timetable reading and stays current past 20 November', ({ slug, outbound, back, dueDate }) => {
    const route = getRouteBySlug(slug)!;
    const v = route.verification!;

    expect(v.status).toBe('verified');
    expect(v.sourceUrl).toMatch(/^https:\/\/www\.emirates\.com\//);
    expect(v.verifiedDate).toBe('2026-11-10');
    expect(v.reviewDueDate).toBe(dueDate);
    expect(isVerificationCurrent(v, '2026-11-20')).toBe(true);
    expect(isVerificationCurrent(v, '2026-12-31')).toBe(true);

    expect(route.flightTime).toContain(outbound);
    expect(route.flightTime).toContain(back);
    expect(route.flightTime).toContain('Emirates timetable');
    expect(route.frequency).toContain('7 flights per week');
    expect(v.note).toContain('10 November 2026');
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-20').status).toBe('direct');
  });

  it('london-gatwick-faro was re-read on 10 November and keeps its generic operator and frequency wording', () => {
    const route = getRouteBySlug('london-gatwick-faro')!;
    const v = route.verification!;

    expect(v.status).toBe('verified');
    expect(v.verifiedDate).toBe('2026-11-10');
    expect(v.reviewDueDate).toBe('2026-12-10');
    expect(isVerificationCurrent(v, '2026-11-20')).toBe(true);
    expect(route.frequency).toBe('Gatwick destination information lists Faro; exact operators and frequency vary');
    expect(route.airlineSlugs).toEqual([]);
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-20').status).toBe('direct');
  });

  it('the SEO pilot pages were not touched by this refresh', () => {
    // Their verification evidence stays exactly as recorded before the refresh.
    expect(getRouteBySlug('manchester-islamabad')!.verification!.verifiedDate).toBe('2026-11-03');
    expect(getRouteBySlug('manchester-dubai')!.verification!.verifiedDate).toBe('2026-10-21');
  });
});
