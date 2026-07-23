import { describe, it, expect } from 'vitest';
import { getRouteBySlug, type AirlineVerification } from '@/data/routes';
import { getEffectiveRoutePresentation, getRouteStatusCopy } from '@/lib/route-status-copy';
import { getRouteStatus } from '@/data/routes';
import { routeStatusEvents, type RouteStatusEvent, type SourceRef } from '@/data/route-status-events';
import { getDealAirlineLabel, getDealDirectnessLabel } from '@/data/deals';
import { buildFlagshipStatusCopy } from '@/lib/flagship-status-copy';

/**
 * Route Status V1 final audit round 2 §3 — a verified-direct route carrying
 * a 'service-ended' or 'status-reverification-pending' notice for one
 * airline must suppress THAT airline everywhere (effective presentation,
 * deal card, homepage flagship copy) while the route stays verified-direct
 * on another airline's own evidence, and the affected airline's own notice
 * + citation must still be visible.
 *
 * These tests temporarily mutate the real, shared `manchester-lahore` route
 * record (normally a real, sole-PIA-operator route) and the real
 * `routeStatusEvents` array to give it a genuine two-airline scenario,
 * always restoring both in a `finally` block so no other test file is
 * affected — the same technique tests/legacy-gate-suppression.test.ts uses.
 */

const FIXED_TODAY = '2026-07-23';
const SOURCE: SourceRef = { publisher: 'Test Publisher', url: 'https://example.com/source', accessedAt: FIXED_TODAY };

function freshVerification(airlineSlug: string): AirlineVerification {
  return {
    airlineSlug,
    status: 'verified',
    sourceName: `${airlineSlug} own booking system`,
    verifiedDate: FIXED_TODAY,
    reviewDueDate: '2027-01-01',
    effectivePeriod: 'Current at access',
    supportedClaim: 'Confirms direct operation.',
  };
}

function withTwoAirlineFixture(events: RouteStatusEvent[], run: (route: ReturnType<typeof getRouteBySlug>) => void) {
  const route = getRouteBySlug('manchester-lahore')!;
  expect(route.airlineSlugs).toEqual(['pia']); // sanity: real route, sole PIA operator today
  const originalAirlineSlugs = [...route.airlineSlugs];
  const originalAirlineVerifications = route.airlineVerifications;

  route.airlineSlugs = ['pia', 'emirates'];
  route.airlineVerifications = [freshVerification('pia'), freshVerification('emirates')];
  for (const e of events) (routeStatusEvents as RouteStatusEvent[]).push(e);

  try {
    run(route);
  } finally {
    route.airlineSlugs = originalAirlineSlugs;
    route.airlineVerifications = originalAirlineVerifications;
    for (const e of events) {
      const idx = (routeStatusEvents as RouteStatusEvent[]).indexOf(e);
      if (idx !== -1) (routeStatusEvents as RouteStatusEvent[]).splice(idx, 1);
    }
  }
}

describe('final audit round 2 §3 — verified-direct multi-airline route suppresses a service-ended airline everywhere', () => {
  it('PIA service-ended, Emirates fresh: effective presentation, deal labels, and homepage copy all agree PIA is suppressed, Emirates is not, and PIA\'s notice+citation stay visible', () => {
    const ended: RouteStatusEvent = {
      id: 'fixture-airline-suppression-ended',
      routeSlug: 'manchester-lahore',
      serviceId: 'fixture-pia-ended-service',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'service-ended',
      verifiedOccurrence: true,
      effectiveFrom: '2026-07-01',
      currentClaimValidBefore: '2027-01-01',
      headline: 'PIA service ended (fixture)',
      explanation: 'Fixture: PIA direct service ended.',
      sources: [SOURCE],
      verifiedAt: FIXED_TODAY,
    };

    withTwoAirlineFixture([ended], (route) => {
      const result = getRouteStatus(route!, routeStatusEvents, FIXED_TODAY)!;
      expect(result.status).toBe('verified-direct'); // remains direct, on Emirates' evidence

      const presentation = getEffectiveRoutePresentation(route!, routeStatusEvents, FIXED_TODAY);
      expect(presentation.status).toBe('direct');
      expect(presentation.airlineSlugs).toContain('emirates');
      expect(presentation.airlineSlugs).not.toContain('pia'); // suppressed

      const viewModel = getRouteStatusCopy(route!, result, routeStatusEvents, FIXED_TODAY);
      expect(viewModel.kind).toBe('verified-direct');
      if (viewModel.kind === 'verified-direct') {
        const piaNotice = viewModel.serviceNotices.find((n) => n.airlineSlug === 'pia');
        expect(piaNotice, 'PIA\'s ended notice must remain visible').toBeDefined();
        expect(piaNotice!.kind).toBe('service-ended');
        expect(piaNotice!.citations.length).toBeGreaterThan(0); // its own citation
      }

      expect(getDealDirectnessLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore' }, FIXED_TODAY)).toBe('Direct flight');
      expect(getDealAirlineLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore', airline: 'PIA' }, FIXED_TODAY)).toBe('Verification pending');
      expect(getDealAirlineLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore', airline: 'Emirates' }, FIXED_TODAY)).toBe('Emirates');

      const flagshipCopy = buildFlagshipStatusCopy('manchester-lahore', routeStatusEvents, FIXED_TODAY);
      expect(flagshipCopy.routeDetail).toContain('Emirates');
      expect(flagshipCopy.routeDetail).not.toMatch(/\bPIA\b/);
      expect(flagshipCopy.routeDetail).not.toContain('Pakistan International Airlines');
    });
  });

  it('PIA status-reverification-pending (transition boundary reached, Emirates fresh): the equivalent exclusion holds', () => {
    const plan: RouteStatusEvent = {
      id: 'fixture-airline-suppression-transition',
      routeSlug: 'manchester-lahore',
      serviceId: 'fixture-pia-transition-service',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-01-01',
      effectiveFrom: '2026-06-01', // already reached relative to FIXED_TODAY — transition-boundary
      currentClaimValidBefore: '2026-06-01',
      headline: 'PIA withdrawal announced (fixture)',
      explanation: 'Fixture: PIA announced a withdrawal, now past its effective date.',
      sources: [SOURCE],
      verifiedAt: FIXED_TODAY,
    };

    withTwoAirlineFixture([plan], (route) => {
      const result = getRouteStatus(route!, routeStatusEvents, FIXED_TODAY)!;
      expect(result.status).toBe('verified-direct');

      const presentation = getEffectiveRoutePresentation(route!, routeStatusEvents, FIXED_TODAY);
      expect(presentation.status).toBe('direct');
      expect(presentation.airlineSlugs).toContain('emirates');
      expect(presentation.airlineSlugs).not.toContain('pia');

      const viewModel = getRouteStatusCopy(route!, result, routeStatusEvents, FIXED_TODAY);
      expect(viewModel.kind).toBe('verified-direct');
      if (viewModel.kind === 'verified-direct') {
        const piaNotice = viewModel.serviceNotices.find((n) => n.airlineSlug === 'pia');
        expect(piaNotice).toBeDefined();
        expect(piaNotice!.kind).toBe('status-reverification-pending');
        expect(piaNotice!.citations.length).toBeGreaterThan(0);
      }

      expect(getDealAirlineLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore', airline: 'PIA' }, FIXED_TODAY)).toBe('Verification pending');
      expect(getDealAirlineLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore', airline: 'Emirates' }, FIXED_TODAY)).toBe('Emirates');

      const flagshipCopy = buildFlagshipStatusCopy('manchester-lahore', routeStatusEvents, FIXED_TODAY);
      expect(flagshipCopy.routeDetail).toContain('Emirates');
      expect(flagshipCopy.routeDetail).not.toMatch(/\bPIA\b/);
    });
  });

  it('a pre-boundary withdrawal-announced notice does NOT suppress the airline — it stays in the effective presentation', () => {
    const plan: RouteStatusEvent = {
      id: 'fixture-airline-suppression-preboundary',
      routeSlug: 'manchester-lahore',
      serviceId: 'fixture-pia-preboundary-service',
      scope: { kind: 'airline', airlineSlug: 'pia' },
      type: 'withdrawal-announced',
      announcedAt: '2026-06-01',
      effectiveFrom: '2026-12-01', // still future relative to FIXED_TODAY — pre-boundary
      currentClaimValidBefore: '2026-12-01',
      headline: 'PIA withdrawal announced, pre-boundary (fixture)',
      explanation: 'Fixture: PIA announced a future withdrawal, not yet reached.',
      sources: [SOURCE],
      verifiedAt: FIXED_TODAY,
    };

    withTwoAirlineFixture([plan], (route) => {
      const result = getRouteStatus(route!, routeStatusEvents, FIXED_TODAY)!;
      expect(result.status).toBe('verified-direct');
      const presentation = getEffectiveRoutePresentation(route!, routeStatusEvents, FIXED_TODAY);
      expect(presentation.airlineSlugs).toContain('emirates');
      expect(presentation.airlineSlugs).toContain('pia'); // retained — pre-boundary, not suppressed

      expect(getDealAirlineLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'lahore', airline: 'PIA' }, FIXED_TODAY)).toBe('PIA');
    });
  });
});
