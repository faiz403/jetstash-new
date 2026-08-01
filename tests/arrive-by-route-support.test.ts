import { describe, it, expect } from 'vitest';
import { routes } from '@/data/routes';
import { getArriveByRouteSupport, SUPPORTED_ROUTE_SLUGS, isSupportedRouteSlug } from '@/lib/arrive-by/route-support';
import { getAirportTimeZone, getDestinationTimeZone } from '@/lib/arrive-by/timezones';

const NOW = '2026-08-01T00:00:00.000Z';

describe('req 21: initial route data is derived from existing JetStash sources', () => {
  it('every supported route slug is a real entry in data/routes.ts', () => {
    for (const slug of SUPPORTED_ROUTE_SLUGS) {
      const route = routes.find((r) => r.slug === slug);
      expect(route, `${slug} should exist in data/routes.ts`).toBeDefined();
    }
  });

  it('every supported route has a real, mapped timezone for both its origin airport and destination — no route is supported without one', () => {
    for (const slug of SUPPORTED_ROUTE_SLUGS) {
      const route = routes.find((r) => r.slug === slug)!;
      expect(getAirportTimeZone(route.airportSlug), `${slug} origin timezone`).not.toBeNull();
      expect(getDestinationTimeZone(route.destinationSlug), `${slug} destination timezone`).not.toBeNull();
    }
  });

  it('routeFlightTimeText is the real route.flightTime value, verbatim, never rewritten', () => {
    const route = routes.find((r) => r.slug === 'manchester-lahore')!;
    const support = getArriveByRouteSupport('manchester', 'lahore', '2026-09-14', NOW);
    expect(support.supported).toBe(true);
    if (support.supported) expect(support.routeFlightTimeText).toBe(route.flightTime);
  });

  it('isSupportedRouteSlug agrees exactly with the SUPPORTED_ROUTE_SLUGS list', () => {
    for (const slug of SUPPORTED_ROUTE_SLUGS) expect(isSupportedRouteSlug(slug)).toBe(true);
    expect(isSupportedRouteSlug('manchester-karachi')).toBe(false); // a real route, but not in the Stage 1 set
    expect(isSupportedRouteSlug('not-a-real-route')).toBe(false);
  });
});

describe('journey-type derivation is always fresh, never cached', () => {
  it('Manchester-Lahore is direct well before its verification review date', () => {
    const support = getArriveByRouteSupport('manchester', 'lahore', '2026-08-05', '2026-08-01T00:00:00.000Z');
    expect(support.supported).toBe(true);
    if (support.supported) {
      expect(support.journeyType).toBe('direct');
      expect(support.blockedForTravelDate).toBe(false);
    }
  });

  it('Manchester-Dhaka is connecting while its verification is current', () => {
    const support = getArriveByRouteSupport('manchester', 'dhaka', '2026-08-10', '2026-08-01T00:00:00.000Z');
    expect(support.supported).toBe(true);
    if (support.supported) expect(support.journeyType).toBe('connecting');
  });
});

describe('withdrawal-boundary handling', () => {
  it('Manchester-Delhi is treated on exactly the same honest footing as Manchester-Mumbai (both withdrawal-announced, effective 2026-08-31)', () => {
    const delhi = getArriveByRouteSupport('manchester', 'delhi', '2026-09-10', NOW);
    const mumbai = getArriveByRouteSupport('manchester', 'mumbai', '2026-09-10', NOW);
    expect(delhi.supported && mumbai.supported).toBe(true);
    if (delhi.supported && mumbai.supported) {
      expect(delhi.blockedForTravelDate).toBe(true);
      expect(mumbai.blockedForTravelDate).toBe(true);
      expect(delhi.journeyType).toBe('verification-pending');
      expect(mumbai.journeyType).toBe('verification-pending');
    }
  });

  it('a travel date before the withdrawal boundary is not blocked, but the warning is preserved', () => {
    const support = getArriveByRouteSupport('manchester', 'mumbai', '2026-08-20', NOW);
    expect(support.supported).toBe(true);
    if (support.supported) {
      expect(support.blockedForTravelDate).toBe(false);
      expect(support.routeWarning).not.toBeNull();
    }
  });

  it('a travel date exactly on the boundary date is treated as blocked, not as still-current', () => {
    const support = getArriveByRouteSupport('manchester', 'mumbai', '2026-08-31', NOW);
    expect(support.supported).toBe(true);
    if (support.supported) expect(support.blockedForTravelDate).toBe(true);
  });
});

describe('unsupported destination/origin distinction', () => {
  it('distinguishes "we do not support this destination" from "not from this origin"', () => {
    const noDestination = getArriveByRouteSupport('manchester', 'istanbul', '2026-09-14', NOW);
    expect(noDestination).toEqual({ supported: false, reason: 'unsupported-destination' });

    const wrongOrigin = getArriveByRouteSupport('birmingham', 'lahore', '2026-09-14', NOW);
    expect(wrongOrigin).toEqual({ supported: false, reason: 'unsupported-origin-for-destination' });
  });
});
