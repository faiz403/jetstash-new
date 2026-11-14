import { describe, expect, it } from 'vitest';
import { getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

/**
 * Birmingham-Amritsar check on 14 November 2026 (review due 21 November). Birmingham Airport's page and FlightAware's AI118 records
 * support the nonstop service, but Air India's own route-page schedule listed no nonstop for 14-20 November. Under the cadence policy
 * (docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md) contradictory evidence is never administratively extended: the record
 * is NOT re-dated, so it still expires on its existing date and fails closed. Only a caution and a dated note are added.
 */
const route = getRouteBySlug('birmingham-amritsar')!;

describe('Birmingham-Amritsar, 14 November 2026 check (not re-dated)', () => {
  it('keeps its existing verification and review dates', () => {
    expect(route.verification?.verifiedDate).toBe('2026-10-22');
    expect(route.verification?.reviewDueDate).toBe('2026-11-21');
  });

  it('stays direct through the existing review date and fails closed the day after', () => {
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-21').status).toBe('direct');
    const after = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-22');
    expect(after.status).toBe('unverified');
    expect(after.frequency).toBeNull();
  });

  it('records the unresolved conflict and the rule against renewing on it', () => {
    const note = route.verification?.note ?? '';
    expect(note).toContain('deliberately NOT re-dated');
    expect(note).toMatch(/lists no nonstop in either direction for 14 to 20 November/);
    expect(note).toMatch(/disagreement is unresolved/);
    expect(note).toMatch(/classify DISPUTED with the policy's 14-day review reminder rather than renew/);
  });

  it('adds the public caution without a day pattern or weekly count', () => {
    expect(route.frequency).toContain('does not always list the nonstop');
    expect(route.frequency).not.toMatch(/\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?s?\b/i);
    expect(route.frequency).not.toMatch(/\b(\d+|one|two|three|four|five|six|seven)x?\b.{0,14}\b(a|per|each) week\b|\bweekly\b/i);
  });

  it('leaves the durations as Air India\'s 22 October published figures and says they were not re-checked', () => {
    expect(route.flightTime).toContain('10h 35m out and 12h 35m back');
    expect(route.verification?.note).toMatch(/were not re-checked and remain Air India's 22 October published figures/);
  });
});
