import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { planArriveBy } from '@/lib/arrive-by/engine';
import {
  ARRIVE_BY_SERVICE_ENDED_WITH_ALTERNATIVES_WARNING,
  SUPPORTED_ROUTE_SLUGS,
  getArriveByRouteSupport,
  getServiceEndedRouteWarning,
} from '@/lib/arrive-by/route-support';
import { buildServiceEndedPresentation, getRouteBySlug } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import type { ArriveByInput } from '@/lib/arrive-by/types';

/**
 * Arrive By trust correction (6 November 2026, CEO-approved wording). For a service-ended route that carries evidenced
 * connecting-alternative data, the route warning used to be the canonical `presentation.summary`, which ends "See below for the current
 * connecting journey and how to check today's price". Arrive By has no section below, and no connecting journey has been checked live.
 * Only the warning wording changes: canonical statuses, summaries, route evidence and Arrive By calculations are untouched.
 */
const APPROVED =
  'The former direct service has ended. Connecting alternatives may be available, but JetStash has not checked live flight availability. Check current flights, stops and journey times for your dates before booking.';
const LATER = '2026-11-06T00:00:00.000Z'; // after the 31 August 2026 IndiGo withdrawals: Manchester-Delhi and Manchester-Mumbai are service-ended
const FALSE_CLAIMS = /See below|\bbelow\b|current connecting journey|how to check today's price|connecting flights available|still possible|is bookable/i;

function input(destinationSlug: string, overrides: Partial<ArriveByInput> = {}): ArriveByInput {
  return {
    originAirportSlug: 'manchester',
    destinationSlug,
    requiredArrivalDateLocal: '2026-12-20',
    requiredArrivalTimeLocal: '14:00',
    deadlineStrictness: 'flexible',
    baggage: 'hand-luggage-only',
    ...overrides,
  };
}

describe('Arrive By service-ended route warning', () => {
  it('uses exactly the approved wording', () => {
    expect(ARRIVE_BY_SERVICE_ENDED_WITH_ALTERNATIVES_WARNING).toBe(APPROVED);
  });

  it.each(['delhi', 'mumbai'])('Manchester-%s: route support returns the approved wording for the service-ended journey', (destination) => {
    const support = getArriveByRouteSupport('manchester', destination, '2026-12-20', LATER);
    expect(support.supported).toBe(true);
    if (!support.supported) return;
    expect(support.journeyType).toBe('service-ended');
    expect(support.blockedForTravelDate).toBe(true);
    expect(support.routeWarning).toBe(APPROVED);
  });

  it.each(['delhi', 'mumbai'])('Manchester-%s: the planner result carries the same wording and no false claim', (destination) => {
    const result = planArriveBy(input(destination), LATER);
    expect(result.state).toBe('route_verification_required');
    if (result.state !== 'route_verification_required') return;
    expect(result.journeyType).toBe('service-ended');
    expect(result.routeWarning).toBe(APPROVED);
    expect(result.routeWarning).not.toMatch(FALSE_CLAIMS);
    expect(result.routeWarning).toMatch(/may be available/);
    expect(result.routeWarning).toMatch(/has not checked live flight availability/);
    expect(result.routeWarning).toMatch(/before booking/);
  });

  it('the wording no longer implies a current, verified connecting journey or refers to a section below', () => {
    expect(APPROVED).not.toMatch(FALSE_CLAIMS);
  });

  it('canonical status, summary and headline are NOT edited: only Arrive By\'s warning differs', () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const route = getRouteBySlug(slug)!;
      const p = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-06');
      expect(p.status).toBe('service-ended');
      expect(p.canShowConnectingAlternative).toBe(true);
      expect(p.statusHeadline).toBe('Former direct service ended · connecting flights available');
      expect(p.summary).toContain('See below for the current connecting journey and how to check today\'s price.');
      expect(p.summary).not.toBe(APPROVED);
    }
  });

  describe('fail-closed behaviour', () => {
    it('a service-ended route WITHOUT evidenced connecting-alternative data keeps the canonical fail-closed summary', () => {
      const withoutEvidence = buildServiceEndedPresentation({ ...getRouteBySlug('manchester-delhi')!, connectingAlternative: undefined });
      expect(withoutEvidence.canShowConnectingAlternative).toBe(false);
      const warning = getServiceEndedRouteWarning(withoutEvidence);
      expect(warning).toBe(withoutEvidence.summary);
      expect(warning).toMatch(/Check current options directly with airlines before booking/);
      expect(warning).not.toBe(APPROVED);
      expect(warning).not.toMatch(/may be available|connecting/i);
    });

    it('the helper returns the approved wording only when connecting-alternative evidence exists', () => {
      expect(getServiceEndedRouteWarning({ canShowConnectingAlternative: true, summary: 'canonical' })).toBe(APPROVED);
      expect(getServiceEndedRouteWarning({ canShowConnectingAlternative: false, summary: 'canonical' })).toBe('canonical');
    });

    it('other statuses are untouched: no supported route that is not service-ended carries the approved wording', () => {
      let checked = 0;
      for (const slug of SUPPORTED_ROUTE_SLUGS) {
        const route = getRouteBySlug(slug)!;
        const status = getEffectiveRoutePresentation(route, routeStatusEvents, '2026-11-06').status;
        if (status === 'service-ended') continue;
        const [airport, destination] = [route.airportSlug, route.destinationSlug];
        const support = getArriveByRouteSupport(airport, destination, '2026-12-20', LATER);
        expect(support.supported, slug).toBe(true); // a supported route must never be rejected here, or this loop would assert nothing
        if (!support.supported) continue;
        expect(support.routeWarning ?? '', slug).not.toBe(APPROVED);
        checked++;
      }
      expect(checked).toBeGreaterThanOrEqual(3); // Lahore, Islamabad, Dubai and Dhaka are not service-ended
    });

    const WITHDRAWAL_HEADLINE = 'IndiGo direct service withdrawal announced, effective 31 August 2026';
    const BEFORE_WITHDRAWAL = '2026-08-01T00:00:00.000Z'; // Manchester-Mumbai is still direct, withdrawal announced for 31 August

    it('a travel date BEFORE a future boundary keeps the exact ledger headline and plans normally, never the approved sentence', () => {
      const early = getArriveByRouteSupport('manchester', 'mumbai', '2026-08-20', BEFORE_WITHDRAWAL);
      expect(early.supported).toBe(true);
      if (!early.supported) return;
      expect(early.journeyType).toBe('direct');
      expect(early.blockedForTravelDate).toBe(false);
      expect(early.routeWarning).toBe(WITHDRAWAL_HEADLINE);
      expect(early.routeWarning).not.toBe(APPROVED);
    });

    it('a travel date ON OR AFTER a future boundary (the blocked branch) keeps the ledger wording, never the approved sentence', () => {
      const blocked = getArriveByRouteSupport('manchester', 'mumbai', '2026-09-05', BEFORE_WITHDRAWAL);
      expect(blocked.supported).toBe(true);
      if (!blocked.supported) return;
      expect(blocked.journeyType).toBe('verification-pending');
      expect(blocked.blockedForTravelDate).toBe(true);
      expect(blocked.routeWarning).toBe(`Your required arrival date falls on or after the date this service's operator named for a change. ${WITHDRAWAL_HEADLINE}`);
      expect(blocked.routeWarning).not.toBe(APPROVED);
      expect(blocked.routeWarning).not.toMatch(FALSE_CLAIMS);
    });
  });

  it('only the warning string changed in route-support.ts: no calculation, status or data edit, and no "See below" remains in Arrive By code', () => {
    const full = readFileSync(join(process.cwd(), 'lib/arrive-by/route-support.ts'), 'utf8');
    const src = full.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // comments quote the old sentence to explain the change
    expect(src).toContain('routeWarning: getServiceEndedRouteWarning(presentation)');
    expect(src).not.toMatch(/See below/);
    // the other two canonical-summary branches (verification pending / unspecified) still use the summary
    expect(src.match(/routeWarning: presentation\.summary/g)?.length).toBe(2);
  });
});
