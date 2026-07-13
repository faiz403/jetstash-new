import { describe, it, expect } from 'vitest';
import { getDisplayDirectness, getAirlineDisplayStatus, getAirlineVerification, getRouteBySlug } from '@/data/routes';
import { getFareRangeSummary, isPubliclyPublishable, type FareObservation } from '@/data/fare-observations';
import { deals, hasTrackedFare } from '@/data/deals';

const FIXED_TODAY = '2026-07-13';

describe('getDisplayDirectness — a route must never show Direct without a current, verified record', () => {
  it('a route with isDirect: true but no verification record renders as unverified, never direct', () => {
    // birmingham-islamabad was deliberately left with a conflicting-evidence
    // 'unverified' record during this Truth Reset pass — confirms the
    // fallback path (isDirect true + non-'verified' status) demotes it.
    const route = getRouteBySlug('birmingham-islamabad')!;
    expect(route.isDirect).toBe(true);
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('unverified');
  });

  it('manchester-karachi is downgraded to unverified after the Truth Reset correction', () => {
    const route = getRouteBySlug('manchester-karachi')!;
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('unverified');
  });

  it('a route with a current, primary-sourced verified record shows direct', () => {
    // manchester-lahore/islamabad were downgraded to 'unverified' after the
    // founder rejected their secondary-source-only evidence; manchester-mumbai
    // is genuinely primary-sourced (IndiGo's own press releases) so it's the
    // correct fixture for "verified means direct" now.
    const route = getRouteBySlug('manchester-mumbai')!;
    expect(route.verification?.status).toBe('verified');
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('direct');
  });

  it('an expired verification (reviewDueDate in the past) falls back to unverified', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    const farFuture = '2099-01-01'; // past any reviewDueDate this dataset will ever set
    expect(getDisplayDirectness(route, farFuture)).toBe('unverified');
  });

  it('manchester-lahore and manchester-islamabad are verified again — genuine primary sources (Manchester Airport\'s own media centre) were found and supersede the earlier secondary-only downgrade', () => {
    // Round 1 of the founder's correction downgraded these to 'unverified'
    // because the only evidence at the time was secondary aviation-news
    // reporting. Round 2 supplied qualifying official sources (Manchester
    // Airport's own press releases confirming both launches), so they are
    // 'verified' again — but for directness/airline/start-date only; no
    // frequency claim is published for either, since no official schedule
    // was found (see the routes' own verification notes).
    expect(getRouteBySlug('manchester-lahore')!.verification?.status).toBe('verified');
    expect(getRouteBySlug('manchester-islamabad')!.verification?.status).toBe('verified');
  });

  it('a genuinely connecting route (isDirect: false) always shows connecting, verification or not', () => {
    const route = getRouteBySlug('leeds-bradford-amritsar')!;
    expect(route.isDirect).toBe(false);
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('connecting');
  });
});

describe('Fare-observation completeness gating (TR-002) — Verified Check must not render for an incomplete observation', () => {
  const complete: FareObservation = {
    id: 'test-complete',
    routeSlug: 'test-route',
    cabin: 'Economy',
    observedDate: '2026-06-01',
    price: 500,
    priceNote: 'return, per person',
    source: 'Test Airline',
    departureDate: '2026-08-01',
    returnDate: '2026-08-15',
  };

  it('an observation with both departureDate and returnDate is publishable', () => {
    expect(isPubliclyPublishable(complete)).toBe(true);
  });

  it('an observation missing returnDate is not publishable', () => {
    const { returnDate, ...rest } = complete;
    expect(isPubliclyPublishable(rest as FareObservation)).toBe(false);
  });

  it('an observation missing departureDate is not publishable', () => {
    const { departureDate, ...rest } = complete;
    expect(isPubliclyPublishable(rest as FareObservation)).toBe(false);
  });

  it('an observation with neither date is not publishable', () => {
    const { departureDate, returnDate, ...rest } = complete;
    expect(isPubliclyPublishable(rest as FareObservation)).toBe(false);
  });

  it('getFareRangeSummary returns null for manchester-lahore Economy — every current real observation predates the date-completeness requirement', () => {
    // This is the disclosed, intentional consequence of TR-002 recorded in
    // docs/LAUNCH_BLOCKERS.md — locking it in as a test means a future
    // change can't silently start showing incomplete fares again without
    // this test failing first.
    expect(getFareRangeSummary('manchester-lahore', 'Economy')).toBeNull();
  });
});

describe('Deal counts (TR-004) — a card with no tracked fare must not count as one', () => {
  it('no current deal has a tracked fare, since no fare observation in the dataset is publicly complete yet', () => {
    // Same intentional, disclosed consequence as above, at the Deals-page level.
    const trackedCount = deals.filter(hasTrackedFare).length;
    expect(trackedCount).toBe(0);
  });

  it('hasTrackedFare returns false for a deal whose airport-destination pair has no Route entry at all', () => {
    const dealWithNoRoute = deals.find((d) => d.fromAirportSlug === 'london-heathrow' && d.toDestinationSlug === 'islamabad');
    expect(dealWithNoRoute).toBeDefined();
    expect(hasTrackedFare(dealWithNoRoute!)).toBe(false);
  });

  it('the two previously-live London Heathrow–Karachi (British Airways) deals are no longer in the public array', () => {
    const stillPresent = deals.some((d) => d.id === 'lhr-khi-economy' || d.id === 'lhr-khi-business');
    expect(stillPresent).toBe(false);
  });
});

describe('Route.airlineSlugs — TR-010, revised three times after successive primary-source re-checks', () => {
  it('London Heathrow–Jeddah lists Saudia and British Airways, but only British Airways is individually verified', () => {
    // TR-010 originally removed British Airways based on secondary aviation-
    // news reporting only (Head for Points et al). Round 1 restored BA but
    // marked the whole route 'unverified'. Round 2 verified the route overall
    // on BA's live destination page. Round 3 (this founder correction) split
    // the claim per airline: BA's own page proves BA, not Saudia — a route
    // must never treat one airline's evidence as covering another.
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(route.airlineSlugs).toContain('saudia');
    expect(route.airlineSlugs).toContain('british-airways');
    expect(getAirlineDisplayStatus(route, 'british-airways', FIXED_TODAY)).toBe('verified');
    expect(getAirlineDisplayStatus(route, 'saudia', FIXED_TODAY)).toBe('unverified');
  });

  it('the route still shows Direct overall, because at least one airline (BA) has current verified evidence', () => {
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('direct');
  });
});

describe('Per-airline verification (founder correction) — one airline\'s evidence must never verify another', () => {
  it('a route with 3 airlines, all independently sourced, verifies each on its own record', () => {
    const route = getRouteBySlug('london-heathrow-mumbai')!;
    expect(getAirlineDisplayStatus(route, 'british-airways', FIXED_TODAY)).toBe('verified');
    expect(getAirlineDisplayStatus(route, 'air-india', FIXED_TODAY)).toBe('verified');
    expect(getAirlineDisplayStatus(route, 'virgin-atlantic', FIXED_TODAY)).toBe('verified');
  });

  it('an airline with no verification record on a route is unverified, even though other airlines on the same route are verified', () => {
    // london-heathrow-jeddah: BA is verified, Saudia has an explicit
    // 'unverified' record. This proves the two don't bleed into each other.
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(getAirlineVerification(route, 'saudia')?.status).toBe('unverified');
    expect(getAirlineDisplayStatus(route, 'saudia', FIXED_TODAY)).toBe('unverified');
  });

  it('an airline entirely absent from airlineVerifications is unverified by default, not silently inherited from the route', () => {
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(getAirlineVerification(route, 'not-a-real-airline')).toBeUndefined();
    expect(getAirlineDisplayStatus(route, 'not-a-real-airline', FIXED_TODAY)).toBe('unverified');
  });

  it('BA\'s Mumbai frequency claim was removed from public copy — the previous "3 daily BA" figure is not reconfirmed by any current source', () => {
    const route = getRouteBySlug('london-heathrow-mumbai')!;
    expect(route.frequency).not.toMatch(/BA alone runs multiple flights daily/);
    expect(route.frequency).not.toMatch(/three daily/i);
  });
});

describe('Section 5 (founder correction) — Verification pending is a distinct third state, never Direct nor Connecting', () => {
  const disputedRoutes = ['manchester-karachi', 'birmingham-lahore', 'birmingham-islamabad'];

  it('unverified never renders Direct', () => {
    for (const slug of disputedRoutes) {
      const route = getRouteBySlug(slug)!;
      expect(getDisplayDirectness(route, FIXED_TODAY)).not.toBe('direct');
    }
  });

  it('unverified never renders Connecting', () => {
    for (const slug of disputedRoutes) {
      const route = getRouteBySlug(slug)!;
      expect(getDisplayDirectness(route, FIXED_TODAY)).not.toBe('connecting');
      expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('unverified');
    }
  });

  it('Connecting requires evidence that no direct service currently operates — none of the 3 disputed routes were flipped to isDirect: false to force a false "Connecting" label', () => {
    // This codebase's standing rule (Truth Reset, Section 1): a route under
    // genuine dispute stays isDirect: true with an 'unverified' record,
    // precisely so that "we don't know" can never masquerade as the
    // evidenced claim "we know there's no direct service." Flipping
    // isDirect to false without evidence would be exactly that masquerade.
    for (const slug of disputedRoutes) {
      const route = getRouteBySlug(slug)!;
      expect(route.isDirect).toBe(true);
    }
    // A genuinely uncontested connecting route, by contrast, correctly
    // shows 'connecting' — that's the evidenced case this gate protects.
    const uncontested = getRouteBySlug('leeds-bradford-amritsar')!;
    expect(uncontested.isDirect).toBe(false);
    expect(getDisplayDirectness(uncontested, FIXED_TODAY)).toBe('connecting');
  });

  it('Direct requires current, unexpired evidence — an expired review date falls back to unverified, never stays Direct', () => {
    const route = getRouteBySlug('manchester-mumbai')!;
    expect(getDisplayDirectness(route, '2026-08-01')).toBe('direct'); // before reviewDueDate
    expect(getDisplayDirectness(route, '2099-01-01')).toBe('unverified'); // long past reviewDueDate
  });
});
