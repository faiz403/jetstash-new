import { describe, it, expect } from 'vitest';
import { getDisplayDirectness, getAirlineDisplayStatus, getAirlineVerification, getRouteBySlug, getRouteByAirportAndDestination, getDealAirlineDisplayStatus } from '@/data/routes';
import {
  getFareRangeSummary,
  getLatestPublishableObservation,
  isPubliclyPublishable,
  fareObservations,
  type FareObservation,
} from '@/data/fare-observations';
import { deals, hasTrackedFare, getDealDirectnessLabel, getDealAirlineLabel } from '@/data/deals';
import { airlines } from '@/data/airlines';

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
    expect(getFareRangeSummary('manchester-lahore', 'Economy', FIXED_TODAY)).toBeNull();
  });
});

describe('Deal counts (TR-004) — a card with no tracked fare must not count as one', () => {
  it('no current deal has a tracked fare, since no fare observation in the dataset is publicly complete yet', () => {
    // Same intentional, disclosed consequence as above, at the Deals-page level.
    const trackedCount = deals.filter((d) => hasTrackedFare(d, FIXED_TODAY)).length;
    expect(trackedCount).toBe(0);
  });

  it('hasTrackedFare returns false for a deal whose airport-destination pair has no Route entry at all', () => {
    const dealWithNoRoute = deals.find((d) => d.fromAirportSlug === 'london-heathrow' && d.toDestinationSlug === 'islamabad');
    expect(dealWithNoRoute).toBeDefined();
    expect(hasTrackedFare(dealWithNoRoute!, FIXED_TODAY)).toBe(false);
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

describe('getDealDirectnessLabel (TR-009, final correction) — a deal/search card must never assert directness independently of the route-verification system', () => {
  it('1. lhr-isb-economy does not display Direct flight — no Route record exists for London Heathrow–Islamabad', () => {
    const deal = deals.find((d) => d.id === 'lhr-isb-economy')!;
    expect(deal).toBeDefined();
    expect(getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug)).toBeUndefined();
    expect(getDealDirectnessLabel(deal, FIXED_TODAY)).toBeUndefined();
  });

  it('2. no matching Route record means no Direct or Connecting tag, for any airport/destination pair', () => {
    const label = getDealDirectnessLabel({ fromAirportSlug: 'not-a-real-airport', toDestinationSlug: 'not-a-real-destination' }, FIXED_TODAY);
    expect(label).toBeUndefined();
    expect(label).not.toBe('Direct flight');
    expect(label).not.toBe('Connecting');
  });

  it('3. an unverified route means no Direct or Connecting tag', () => {
    // manchester-karachi is isDirect: true but unverified (Truth Reset) —
    // must render neither claim, not fall back to "Connecting" either.
    const label = getDealDirectnessLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'karachi' }, FIXED_TODAY);
    expect(label).toBeUndefined();
  });

  it('4. an expired verification means no Direct tag', () => {
    // manchester-mumbai is verified direct before its reviewDueDate, but
    // expires (falls back to unverified) long after it — the deal-level
    // label must track the same expiry, never keep showing Direct flight
    // past the point getDisplayDirectness itself would demote it.
    const label = getDealDirectnessLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'mumbai' }, '2099-01-01');
    expect(label).toBeUndefined();
    expect(label).not.toBe('Direct flight');
  });

  it('5. a currently verified direct route may display Direct flight', () => {
    const label = getDealDirectnessLabel({ fromAirportSlug: 'manchester', toDestinationSlug: 'mumbai' }, FIXED_TODAY);
    expect(label).toBe('Direct flight');
  });

  it('6. a verified connecting route may display Connecting', () => {
    // leeds-bradford-amritsar is a genuinely evidenced connecting route
    // (isDirect: false) — no deal currently references this pair, but the
    // gate function must support it correctly regardless.
    const label = getDealDirectnessLabel({ fromAirportSlug: 'leeds-bradford', toDestinationSlug: 'amritsar' }, FIXED_TODAY);
    expect(label).toBe('Connecting');
  });

  it('7. every current public deal passes the validation — no deal\'s computed directness label ever contradicts getDisplayDirectness for its matched route', () => {
    for (const deal of deals) {
      const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
      const label = getDealDirectnessLabel(deal, FIXED_TODAY);
      if (!route) {
        // No matching Route record — must never claim Direct or Connecting.
        expect(label, `deal ${deal.id} has no matching Route but computed a directness label`).toBeUndefined();
        continue;
      }
      const displayDirectness = getDisplayDirectness(route, FIXED_TODAY);
      if (displayDirectness === 'direct') {
        expect(label, `deal ${deal.id} matches a verified-direct route but doesn't show Direct flight`).toBe('Direct flight');
      } else if (displayDirectness === 'connecting') {
        expect(label, `deal ${deal.id} matches an evidenced-connecting route but doesn't show Connecting`).toBe('Connecting');
      } else {
        expect(label, `deal ${deal.id} matches an unverified route but shows a directness label anyway`).toBeUndefined();
      }
    }
  });

  it('no deal in the public array carries a static tag asserting directness independently — categoryTag is curation-only, never "Direct flight"/"Connecting"', () => {
    for (const deal of deals) {
      expect(deal.categoryTag, `deal ${deal.id}`).not.toBe('Direct flight');
      expect(deal.categoryTag, `deal ${deal.id}`).not.toBe('Connecting');
    }
  });
});

describe('TR-002 direct production audit — enumerate all 18 fare observations, none may be publicly displayable', () => {
  it('exactly 18 observations exist in the append-only log', () => {
    expect(fareObservations.length).toBe(18);
  });

  it('every one of the 18 observations individually fails isPubliclyPublishable (none has both departureDate and returnDate)', () => {
    const incomplete = fareObservations.filter((o) => !isPubliclyPublishable(o));
    expect(incomplete.length).toBe(fareObservations.length);
    for (const o of fareObservations) {
      expect(isPubliclyPublishable(o), `observation ${o.id}`).toBe(false);
    }
  });

  it('getFareRangeSummary returns null for every route+cabin combination present in the 18 observations — none can appear as a price, a Verified Check, or fare history', () => {
    const pairs = new Set(fareObservations.map((o) => `${o.routeSlug}|${o.cabin}`));
    for (const pair of pairs) {
      const [routeSlug, cabin] = pair.split('|') as [string, FareObservation['cabin']];
      expect(getFareRangeSummary(routeSlug, cabin, FIXED_TODAY), `${routeSlug} / ${cabin}`).toBeNull();
    }
  });

  it('getLatestPublishableObservation returns undefined for every route with an incomplete observation — Book-By\'s "last checked fare" cannot surface any of the 18', () => {
    const routeSlugs = new Set(fareObservations.map((o) => o.routeSlug));
    for (const routeSlug of routeSlugs) {
      expect(getLatestPublishableObservation(routeSlug, FIXED_TODAY), routeSlug).toBeUndefined();
    }
  });

  it('no deal in the public array counts as a tracked fare — Deals still reports zero tracked fares', () => {
    const trackedCount = deals.filter((d) => hasTrackedFare(d, FIXED_TODAY)).length;
    expect(trackedCount).toBe(0);
  });

  it('every deal whose route has one of the 18 incomplete observations still resolves to hasTrackedFare === false individually', () => {
    const observedRouteSlugs = new Set(fareObservations.map((o) => o.routeSlug));
    const affectedDeals = deals.filter((d) => {
      const route = getRouteByAirportAndDestination(d.fromAirportSlug, d.toDestinationSlug);
      return route && observedRouteSlugs.has(route.slug);
    });
    expect(affectedDeals.length).toBeGreaterThan(0); // sanity: this set is non-empty
    for (const deal of affectedDeals) {
      expect(hasTrackedFare(deal, FIXED_TODAY), deal.id).toBe(false);
    }
  });
});

describe('getDealAirlineLabel (TR-010, final correction) — a deal/search card must never assert an airline as confirmed independently of that airline\'s own verification record', () => {
  it('1. Jeddah cards do not display Saudia without Saudia evidence', () => {
    const jed1 = deals.find((d) => d.id === 'umrah-package-jed')!;
    const jed2 = deals.find((d) => d.id === 'lhr-jed-business')!;
    expect(jed1.airline).toBe('Saudia'); // the underlying curation field is unchanged — the fix is in what's *shown*
    expect(jed2.airline).toBe('Saudia');
    expect(getDealAirlineLabel(jed1, FIXED_TODAY)).not.toBe('Saudia');
    expect(getDealAirlineLabel(jed2, FIXED_TODAY)).not.toBe('Saudia');
    expect(getDealAirlineLabel(jed1, FIXED_TODAY)).toBe('Verification pending');
    expect(getDealAirlineLabel(jed2, FIXED_TODAY)).toBe('Verification pending');
  });

  it('2. BA evidence does not verify Saudia — the two are independently gated on the same route', () => {
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(getDealAirlineDisplayStatus(route, 'british-airways', FIXED_TODAY)).toBe('verified');
    expect(getDealAirlineDisplayStatus(route, 'saudia', FIXED_TODAY)).toBe('unverified');
    // The route itself still shows Direct (BA's evidence is sufficient for route-level directness),
    // proving directness and airline attribution are tracked as genuinely separate claims.
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('direct');
  });

  it('3. a currently verified airline displays correctly', () => {
    const verifiedDirect = deals.find((d) => d.id === 'man-lhe-economy')!; // Manchester–Lahore, PIA, route-level verified, single-operator fallback applies
    expect(getDealAirlineLabel(verifiedDirect, FIXED_TODAY)).toBe('PIA');
    const perAirlineVerified = deals.find((d) => d.id === 'lhr-bom-economy')!; // Heathrow–Mumbai, British Airways, explicit airlineVerifications entry
    expect(getDealAirlineLabel(perAirlineVerified, FIXED_TODAY)).toBe('British Airways');
  });

  it('4. an unverified airline does not display as confirmed', () => {
    const unverified = deals.find((d) => d.id === 'man-dxb-economy')!; // Manchester–Dubai, Emirates, no verification record at all
    const label = getDealAirlineLabel(unverified, FIXED_TODAY);
    expect(label).not.toBe('Emirates');
    expect(label).toBe('Verification pending');
  });

  it('5. an expired airline claim does not display as current', () => {
    const route = getRouteBySlug('london-heathrow-mumbai')!;
    // British Airways is verified before its reviewDueDate, but the same
    // record must not keep reading as current long after it expires.
    expect(getDealAirlineDisplayStatus(route, 'british-airways', '2026-08-01')).toBe('verified');
    expect(getDealAirlineDisplayStatus(route, 'british-airways', '2099-01-01')).toBe('unverified');
    const deal = deals.find((d) => d.id === 'lhr-bom-economy')!;
    expect(getDealAirlineLabel(deal, '2099-01-01')).toBe('Verification pending');
  });

  it('6. a deal with no Route record cannot assert an operating airline', () => {
    const noRoute = deals.find((d) => d.id === 'lhr-isb-economy')!; // London Heathrow–Islamabad, no matching Route record
    expect(getRouteByAirportAndDestination(noRoute.fromAirportSlug, noRoute.toDestinationSlug)).toBeUndefined();
    expect(getDealAirlineLabel(noRoute, FIXED_TODAY)).toBeUndefined();
  });

  it('7. every public deal passes the airline attribution validation — no deal ever shows its raw airline name unless that exact airline is currently verified on its matched route', () => {
    for (const deal of deals) {
      const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
      const label = getDealAirlineLabel(deal, FIXED_TODAY);
      if (!route) {
        expect(label, `deal ${deal.id} has no matching Route but asserted an airline`).toBeUndefined();
        continue;
      }
      if (label === deal.airline) {
        // Only permissible when this exact airline is independently verified
        // — re-derive via the airline registry + gate directly, to prove no
        // drift between getDealAirlineLabel and the underlying gate function.
        const record = airlines.find((a) => a.name === deal.airline);
        expect(record, `deal ${deal.id}'s airline "${deal.airline}" is not in the airlines.ts registry`).toBeDefined();
        expect(getDealAirlineDisplayStatus(route, record!.slug, FIXED_TODAY), `deal ${deal.id}`).toBe('verified');
      } else {
        expect(label, `deal ${deal.id}`).toBe('Verification pending');
      }
    }
  });

  it('every Saudia-named deal in the current public array is unverified as of this pass (Jeddah and Madinah both) — confirms the systemic sweep caught both, not just the reported Jeddah card', () => {
    const saudiaDeals = deals.filter((d) => d.airline === 'Saudia');
    expect(saudiaDeals.length).toBeGreaterThan(0);
    for (const deal of saudiaDeals) {
      expect(getDealAirlineLabel(deal, FIXED_TODAY), deal.id).not.toBe('Saudia');
    }
  });
});
