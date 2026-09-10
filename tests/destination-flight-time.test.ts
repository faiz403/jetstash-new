import { describe, expect, it } from 'vitest';
import { getDestinationBySlug } from '@/data/destinations';
import { getDestinationFlightTimeFromUK } from '@/lib/destination-flight-time';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Trust fix (7 Sept 2026, independent audit): getDestinationFlightTimeFromUK()
 * used to patch exactly one specific risk — a "direct from Manchester" claim
 * surviving after that Manchester route went service-ended. It did nothing
 * when the named airport had NO canonical Route record at all, which let two
 * live public claims assert an unsupported current direct service: Karachi
 * ("8h 30m direct from London Heathrow", /pakistan) and Madinah ("6h 15m
 * direct from London Heathrow", /gulf) — no london-heathrow-karachi or
 * london-heathrow-madinah Route exists anywhere in data/routes.ts.
 *
 * These tests deliberately compare against getEffectiveRoutePresentation()
 * and real Route-record existence — the same evidence the route pages
 * themselves use — rather than hardcoding expected strings alone, so they
 * keep failing correctly if any of these routes' verification state changes
 * again. Synthetic destination objects (spread from a real one with only
 * flightTimeFromUK overridden) are used to exercise branches — service-ended
 * append, connecting/unverified fail-closed — that no current real
 * destination's PRIMARY claimed airport happens to trigger.
 */

const NOW_ISO = '2026-09-06';

describe('1. Unsupported claims fail closed — the actual defect this fix closes', () => {
  it('Karachi: "direct from London Heathrow" fails closed — no london-heathrow-karachi Route exists', () => {
    const karachi = getDestinationBySlug('karachi')!;
    expect(karachi.flightTimeFromUK).toBe('8h 30m direct from London Heathrow'); // confirms the defect is still present in the untouched data field
    expect(getRouteByAirportAndDestination('london-heathrow', 'karachi')).toBeUndefined();
    const summary = getDestinationFlightTimeFromUK(karachi, NOW_ISO);
    expect(summary).not.toContain('8h 30m direct from London Heathrow');
    expect(summary).not.toMatch(/\bdirect\b/i);
    expect(summary).toBe('Flight time from London Heathrow not yet confirmed.');
  });

  it('Madinah: "direct from London Heathrow" fails closed — no london-heathrow-madinah Route exists', () => {
    const madinah = getDestinationBySlug('madinah')!;
    expect(madinah.flightTimeFromUK).toBe('6h 15m direct from London Heathrow');
    expect(getRouteByAirportAndDestination('london-heathrow', 'madinah')).toBeUndefined();
    const summary = getDestinationFlightTimeFromUK(madinah, NOW_ISO);
    expect(summary).not.toContain('6h 15m direct from London Heathrow');
    expect(summary).not.toMatch(/\bdirect\b/i);
    expect(summary).toBe('Flight time from London Heathrow not yet confirmed.');
  });
});

describe('2. Genuinely verified direct claims are preserved unchanged', () => {
  it('Lahore: manchester-lahore is genuinely verified direct — wording unchanged', () => {
    const lahore = getDestinationBySlug('lahore')!;
    const route = getRouteByAirportAndDestination('manchester', 'lahore')!;
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status).toBe('direct');
    expect(getDestinationFlightTimeFromUK(lahore, NOW_ISO)).toBe(lahore.flightTimeFromUK);
  });

  it('Islamabad: manchester-islamabad is genuinely verified direct — wording unchanged', () => {
    const islamabad = getDestinationBySlug('islamabad')!;
    const route = getRouteByAirportAndDestination('manchester', 'islamabad')!;
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status).toBe('direct');
    expect(getDestinationFlightTimeFromUK(islamabad, NOW_ISO)).toBe(islamabad.flightTimeFromUK);
  });

  it('Amritsar: london-gatwick-amritsar is genuinely verified direct — wording unchanged', () => {
    const amritsar = getDestinationBySlug('amritsar')!;
    const route = getRouteByAirportAndDestination('london-gatwick', 'amritsar')!;
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status).toBe('direct');
    expect(getDestinationFlightTimeFromUK(amritsar, NOW_ISO)).toBe(amritsar.flightTimeFromUK);
  });

  it('claims with no single specific airport identified (Dubai\'s "most UK airports") pass through unchanged', () => {
    const dubai = getDestinationBySlug('dubai')!;
    expect(dubai.flightTimeFromUK).toBe('7h direct from most UK airports');
    expect(getDestinationFlightTimeFromUK(dubai, NOW_ISO)).toBe(dubai.flightTimeFromUK);
  });

  it('claims naming no airport at all (no "direct from X" clause) pass through unchanged', () => {
    const dhaka = getDestinationBySlug('dhaka')!;
    expect(dhaka.flightTimeFromUK).not.toMatch(/direct\s+from/i);
    expect(getDestinationFlightTimeFromUK(dhaka, NOW_ISO)).toBe(dhaka.flightTimeFromUK);
  });
});

describe('3. Existing service-ended handling (Delhi/Mumbai) remains correct', () => {
  it('suppresses the ended Manchester–Delhi direct claim — already correctly worded by destinations.ts itself', () => {
    const summary = getDestinationFlightTimeFromUK(getDestinationBySlug('delhi')!, '2026-09-03');
    expect(summary).toBe('8h 45m direct from London Heathrow; former Manchester direct service ended');
  });

  it('derives the ended Manchester–Mumbai status instead of storing it in destination copy', () => {
    // Integration reconciliation (7 Sept 2026): the neutral secondary
    // clause is REPLACED by canonically-derived wording, not appended
    // alongside it — resolveSecondaryOriginReferences() in
    // lib/destination-flight-time.ts resolves this explicit secondary
    // Manchester mention against the real manchester-mumbai Route's
    // effective presentation, rather than the raw string ever asserting
    // its own lifecycle fact.
    const destination = getDestinationBySlug('mumbai')!;
    expect(destination.flightTimeFromUK).toBe('9h direct from London Heathrow; Manchester options vary by route');
    expect(destination.flightTimeFromUK).not.toMatch(/service ended/i);
    expect(getDestinationFlightTimeFromUK(destination, '2026-09-03')).toBe(
      '9h direct from London Heathrow; Manchester direct service ended',
    );
  });

  it('preserves the destination fallback before service-ended evidence is effective', () => {
    const destination = getDestinationBySlug('mumbai')!;
    expect(getDestinationFlightTimeFromUK(destination, '2026-08-25')).toBe(destination.flightTimeFromUK);
  });

  it('keeps destination route cards on the same service-ended status as the route guides', () => {
    for (const slug of ['delhi', 'mumbai']) {
      const entry = getDestinationFlightGuideEntries(getDestinationBySlug(slug)!, '2026-09-03').find(
        (item) => item.routeSlug === `manchester-${slug}`,
      );
      expect(entry?.routeStatus, slug).toBe('service-ended');
    }
  });

  it('the general append-on-service-ended behaviour still fires when the ended airport IS the primary claimed one (synthetic case, since no real destination currently exercises this branch)', () => {
    const mumbai = getDestinationBySlug('mumbai')!;
    const synthetic = { ...mumbai, flightTimeFromUK: '9h direct from Manchester' };
    const summary = getDestinationFlightTimeFromUK(synthetic, '2026-09-03');
    expect(summary).toBe('9h; Manchester direct service ended');
  });

  it('the secondary-reference ended status comes from getEffectiveRoutePresentation(), not from any pre-2026-08-31 date, matching the real manchester-mumbai withdrawal-announced/service-ended ledger', () => {
    const mumbai = getDestinationBySlug('mumbai')!;
    const route = getRouteByAirportAndDestination('manchester', 'mumbai')!;
    // Before the ledger's currentClaimValidBefore boundary, the route is
    // still presented as direct — the secondary clause must stay untouched.
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-08-25').status).not.toBe('service-ended');
    expect(getDestinationFlightTimeFromUK(mumbai, '2026-08-25')).toBe(mumbai.flightTimeFromUK);
    // After it, the same ledger reports service-ended, and only then does
    // the secondary clause resolve into ended wording.
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, '2026-09-03').status).toBe('service-ended');
    expect(getDestinationFlightTimeFromUK(mumbai, '2026-09-03')).toBe(
      '9h direct from London Heathrow; Manchester direct service ended',
    );
  });

  it('does not invent "service ended" wording for a secondary reference whose real Route is merely connecting, not ended', () => {
    // manchester-jeddah is a genuinely connecting (isDirect: false) Route —
    // never service-ended — so a synthetic secondary mention of Manchester
    // against Jeddah must be left exactly as written, not upgraded to an
    // ended-service claim the ledger never made.
    const jeddah = getDestinationBySlug('jeddah')!;
    const manchesterJeddah = getRouteByAirportAndDestination('manchester', 'jeddah')!;
    expect(getEffectiveRoutePresentation(manchesterJeddah, routeStatusEvents, '2026-09-03').status).toBe('connecting');
    const synthetic = {
      ...jeddah,
      flightTimeFromUK: `${jeddah.flightTimeFromUK}; Manchester options vary by route`,
    };
    expect(getDestinationFlightTimeFromUK(synthetic, '2026-09-03')).toBe(
      `${jeddah.flightTimeFromUK}; Manchester options vary by route`,
    );
  });

  it('a secondary city mention with no canonical Route to this destination is never treated as lifecycle evidence', () => {
    const mumbai = getDestinationBySlug('mumbai')!;
    // Leeds Bradford has no direct or connecting Route to Mumbai at all.
    expect(getRouteByAirportAndDestination('leeds-bradford', 'mumbai')).toBeUndefined();
    const synthetic = {
      ...mumbai,
      flightTimeFromUK: '9h direct from London Heathrow; Leeds Bradford options vary by route',
    };
    // No Route exists for Leeds Bradford here, so the clause must pass
    // through completely unchanged — not resolved, not stripped, not
    // flagged as unsupported.
    expect(getDestinationFlightTimeFromUK(synthetic, '2026-09-03')).toBe(
      '9h direct from London Heathrow; Leeds Bradford options vary by route',
    );
  });
});

describe('4. Connecting/unverified routes with an existing Route record also fail closed (synthetic cases)', () => {
  it('a "direct" claim against a genuinely connecting route fails closed', () => {
    const karachi = getDestinationBySlug('karachi')!;
    const synthetic = { ...karachi, flightTimeFromUK: '9h direct from Manchester' };
    const route = getRouteByAirportAndDestination('manchester', 'karachi')!;
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status).toBe('connecting');
    expect(getDestinationFlightTimeFromUK(synthetic, NOW_ISO)).toBe('Flight time from Manchester Airport not yet confirmed.');
  });

  it('a "direct" claim against a genuinely unverified route fails closed', () => {
    const ahmedabad = getDestinationBySlug('ahmedabad')!;
    const synthetic = { ...ahmedabad, flightTimeFromUK: '9h 40m direct from London Gatwick' };
    const route = getRouteByAirportAndDestination('london-gatwick', 'ahmedabad')!;
    expect(getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO).status).toBe('unverified');
    expect(getDestinationFlightTimeFromUK(synthetic, NOW_ISO)).toBe('Flight time from London Gatwick not yet confirmed.');
  });
});

describe('5. No route, verification or fare data changed by this fix', () => {
  it('the routes this fix depends on are unchanged', () => {
    expect(getRouteByAirportAndDestination('manchester', 'karachi')?.isDirect).toBe(false);
    expect(getRouteByAirportAndDestination('birmingham', 'madinah')?.isDirect).toBe(false);
    expect(getRouteByAirportAndDestination('manchester', 'madinah')?.isDirect).toBe(false);
    expect(getRouteByAirportAndDestination('manchester', 'lahore')?.isDirect).toBe(true);
    expect(getRouteByAirportAndDestination('manchester', 'islamabad')?.isDirect).toBe(true);
    expect(getRouteByAirportAndDestination('london-gatwick', 'amritsar')?.isDirect).toBe(true);
  });
});

describe('6. data/destinations.ts remains untouched by this fix', () => {
  it('Karachi and Madinah still store their original, unmodified flightTimeFromUK strings', () => {
    expect(getDestinationBySlug('karachi')!.flightTimeFromUK).toBe('8h 30m direct from London Heathrow');
    expect(getDestinationBySlug('madinah')!.flightTimeFromUK).toBe('6h 15m direct from London Heathrow');
  });
});
