import { describe, it, expect } from 'vitest';
import { getDisplayDirectness, getAirlineDisplayStatus, getAirlineVerification, getRouteBySlug, getRouteByAirportAndDestination, getDealAirlineDisplayStatus, getRoutePresentation } from '@/data/routes';
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
const RESOLUTION_TODAY = '2026-07-28';

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
    expect(getDisplayDirectness(route, RESOLUTION_TODAY)).toBe('connecting');
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
    currency: 'GBP',
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

  it('an observation without source currency is not publishable', () => {
    const { currency, ...rest } = complete;
    expect(currency).toBe('GBP');
    expect(isPubliclyPublishable(rest as FareObservation)).toBe(false);
  });

  it('getFareRangeSummary derives the exact dated Manchester–Lahore weekly series, now including the 18 August Weekly Full Fare Refresh #1 check', () => {
    const range = getFareRangeSummary('manchester-lahore', 'Economy', FIXED_TODAY);
    expect(range).not.toBeNull();
    expect(range!.count).toBe(5);
    expect(range!.min).toBe(574);
    expect(range!.max).toBe(638);
    expect(range!.earliestDate).toBe('2026-07-28');
    expect(range!.latestDate).toBe('2026-08-18');
    expect(range!.sources).toEqual(['Etihad', 'Turkish Airlines']);
    expect(range!.observedDirectness).toBe('connecting');
  });
});

describe('Deal counts (TR-004) — a card with no tracked fare must not count as one', () => {
  it('counts exactly the deals with fully dated observations', () => {
    const trackedDeals = deals.filter((d) => hasTrackedFare(d, FIXED_TODAY));
    // umrah-package-jed and umrah-package-extended are deliberately excluded:
    // both are bundled flight+hotel products (isBundledProductDeal), and the
    // archive currently only logs flight-only fares for their routes — never
    // evidence for a package price. See data/deals.ts's hasTrackedFare and
    // isBundledProductDeal doc comments (product-integrity fix, August 2026).
    // man-dxb-economy joined this list 6 August 2026 (Route Completion
    // Batch 1's manual founder-action fare check, obs-man-dxb-economy-20260806-8w-v1)
    // — isObservationPublishable() doesn't gate on freshness relative to
    // FIXED_TODAY, only on date-completeness and route status, so this
    // fixed-date test genuinely does track it now, same as production.
    // The 7 man-*-economy entries after lhr-bom-economy joined the same day
    // (Batch A's customer-visibility audit fix) - each backed by a real
    // Batch A observation with nowhere to render before these Deal entries
    // were added; see FARE_OBSERVATION_ARCHIVE.md's audit addendum.
    // lhr-doh-economy and lgw-amd-economy (Fare Coverage Expansion Batch B,
    // 6 August 2026) already existed as Deal entries but had no publishable
    // observation behind them until this batch - no new Deal needed, just a
    // fresh fare. The 8 entries after them are Batch B's brand-new Deal
    // entries, each backed by a real Batch B observation with nowhere to
    // render before now - see FARE_COVERAGE_BATCH_B.md.
    // lgw-amd-economy dropped out of this list on 18 August 2026: Route
    // Verification Refresh Batch 1's correction reclassified
    // london-gatwick-ahmedabad unverified (DISPUTED) after a fresh check
    // found current Air India surfaces genuinely conflict on which London
    // airport this service uses. isObservationPublishable() correctly fails
    // closed — the observation is still preserved in the archive, it just
    // can no longer render publicly, exactly per data/fare-observations.ts's
    // own doc comment. See docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md.
    expect(trackedDeals.map((d) => d.id)).toEqual([
      'man-lhe-economy',
      'lhr-del-economy',
      'bhx-atq-economy',
      'man-dxb-economy',
      'lhr-doh-economy',
      'man-dlm-flight',
      'man-bjv-flight',
      'lgw-adb-flight',
      'lgw-aga-flight',
      'lhr-cmn-flight',
      'lgw-tng-flight',
      'man-bcn-flight',
      'lhr-bom-economy',
      'man-ath-economy',
      'man-fco-economy',
      'man-isb-economy',
      'man-del-economy',
      'man-bom-economy',
      'man-amd-economy',
      'man-atq-economy',
      'man-doh-economy',
      'man-med-economy',
      'lhr-blr-economy',
      'man-jed-economy',
      'bhx-bom-economy',
      'bhx-med-economy',
      'man-dac-economy',
      'lba-atq-economy',
      'lba-isb-economy',
      'lgw-atq-economy',
    ]);
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
  it('London Heathrow–Jeddah lists Saudia and British Airways, each with independent current evidence', () => {
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
    expect(getAirlineDisplayStatus(route, 'saudia', FIXED_TODAY)).toBe('verified');
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
    // London Heathrow–Jeddah now has independent BA and Saudia records;
    // this absent fixture still proves that one record cannot bleed into another.
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(getAirlineVerification(route, 'not-a-real-airline')).toBeUndefined();
    expect(getAirlineDisplayStatus(route, 'not-a-real-airline', FIXED_TODAY)).toBe('unverified');
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

describe('FARE-001 pilot — historic examples stay private; only fully dated, evidenced observations publish', () => {
  it('keeps historic observations and appends every editorial observation batch, including the 18 August Weekly Full Fare Refresh #1 batch', () => {
    expect(fareObservations).toHaveLength(204);
  });

  it('keeps every historic observation incomplete and private', () => {
    const incomplete = fareObservations.filter((o) => !isPubliclyPublishable(o));
    expect(incomplete).toHaveLength(20);
    for (const o of incomplete) {
      expect(isPubliclyPublishable(o), `observation ${o.id}`).toBe(false);
    }
  });

  it('publishes the exact dated observations from every completed priority-route batch', () => {
    const published = fareObservations.filter(isPubliclyPublishable);
    expect(published.map((o) => o.id)).toEqual([
      'obs-man-lhe-economy-20260728-8w-v1',
      'obs-man-isb-economy-20260728-8w-v1',
      'obs-lhr-del-economy-20260728-8w-v1',
      'obs-bhx-atq-economy-20260728-8w-v1',
      'obs-lhr-jed-economy-20260728-8w-v1',
      'obs-man-lhe-economy-20260804-8w-v1',
      'obs-man-isb-economy-20260804-8w-v1',
      'obs-lhr-del-economy-20260804-8w-v1',
      'obs-bhx-atq-economy-20260804-8w-v1',
      'obs-lhr-jed-economy-20260804-8w-v1',
      'obs-man-med-economy-20260805-8w-v1',
      'obs-man-doh-economy-20260805-8w-v1',
      'obs-man-dxb-economy-20260806-8w-v1',
      'obs-man-lhe-economy-20260806-8w-v1',
      'obs-man-isb-economy-20260806-8w-v1',
      'obs-man-del-economy-20260806-8w-v1',
      'obs-man-bom-economy-20260806-8w-v1',
      'obs-man-amd-economy-20260806-8w-v1',
      'obs-man-atq-economy-20260806-8w-v1',
      'obs-man-doh-economy-20260806-8w-v1',
      'obs-man-med-economy-20260806-8w-v1',
      'obs-bhx-atq-economy-20260806-8w-v1',
      // Fare Coverage Expansion Batch B (6 August 2026, run after RIS-001) -
      // see FARE_COVERAGE_BATCH_B.md.
      'obs-lhr-doh-economy-20260806-8w-v1',
      'obs-lgw-amd-economy-20260806-8w-v1',
      'obs-lhr-blr-economy-20260806-8w-v1',
      'obs-man-jed-economy-20260806-8w-v1',
      'obs-bhx-bom-economy-20260806-8w-v1',
      'obs-bhx-med-economy-20260806-8w-v1',
      'obs-man-dac-economy-20260806-8w-v1',
      'obs-lba-atq-economy-20260806-8w-v1',
      'obs-lba-isb-economy-20260806-8w-v1',
      'obs-lgw-atq-economy-20260806-8w-v1',
      'obs-man-isb-economy-20260810-tk-621-v1',
      'obs-man-isb-economy-20260810-tk-626-v1',
      'obs-man-isb-economy-20260810-ey-645-v1',
      'obs-man-lhe-economy-20260811-8w-v1',
      'obs-man-isb-economy-20260811-8w-v1',
      'obs-lhr-del-economy-20260811-8w-v1',
      'obs-bhx-atq-economy-20260811-8w-v1',
      'obs-lhr-jed-economy-20260811-8w-v1',
      'obs-man-ist-economy-20260813-8w-v1',
      'obs-man-ayt-economy-20260813-8w-v1',
      'obs-man-dlm-economy-20260813-8w-v1',
      'obs-man-bod-economy-20260813-8w-v1',
      'obs-man-izm-economy-20260813-8w-v1',
      'obs-man-rak-economy-20260813-8w-v1',
      'obs-man-aga-economy-20260813-8w-v1',
      'obs-bhx-ist-economy-20260813-8w-v1',
      'obs-bhx-ayt-economy-20260813-8w-v1',
      'obs-bhx-dlm-economy-20260813-8w-v1',
      'obs-bhx-bod-economy-20260813-8w-v1',
      'obs-lba-ayt-economy-20260813-8w-v1',
      'obs-lba-dlm-economy-20260813-8w-v1',
      'obs-bhx-del-economy-20260813-8w-v1',
      'obs-bhx-amd-economy-20260813-8w-v1',
      'obs-bhx-dxb-economy-20260813-8w-v1',
      'obs-bhx-doh-economy-20260813-8w-v1',
      'obs-bhx-jed-economy-20260813-8w-v1',
      'obs-gla-dxb-economy-20260813-8w-v1',
      'obs-edi-dxb-economy-20260813-8w-v1',
      'obs-ncl-dxb-economy-20260813-8w-v1',
      'obs-brs-fao-economy-20260813-8w-v1',
      'obs-man-fao-economy-20260813-8w-v1',
      'obs-bhx-fao-economy-20260813-8w-v1',
      'obs-lba-fao-economy-20260813-8w-v1',
      'obs-brs-dlm-economy-20260813-8w-v1',
      'obs-gla-ayt-economy-20260813-8w-v1',
      'obs-lhr-bom-economy-20260813-8w-v1',
      'obs-lhr-lhe-economy-20260813-8w-v1',
      'obs-lhr-dxb-economy-20260813-8w-v1',
      'obs-lgw-dxb-economy-20260813-8w-v1',
      'obs-gla-dlm-economy-20260813-8w-v1',
      'obs-brs-ayt-economy-20260813-8w-v1',
      'obs-ncl-dlm-economy-20260813-8w-v1',
      'obs-brs-rak-economy-20260813-8w-v1',
      'obs-bhx-aga-economy-20260813-8w-v1',
      'obs-man-bcn-economy-20260813-8w-v1',
      'obs-man-rom-economy-20260813-8w-v1',
      'obs-bhx-ath-economy-20260813-8w-v1',
      'obs-lgw-bod-economy-20260814-8w-v1',
      'obs-lgw-fao-economy-20260814-8w-v1',
      'obs-lgw-bcn-economy-20260814-8w-v1',
      'obs-bhx-rom-economy-20260814-8w-v1',
      'obs-man-ath-economy-20260814-8w-v1',
      'obs-bhx-bcn-economy-20260814-8w-v1',
      'obs-brs-bcn-economy-20260814-8w-v1',
      'obs-lba-bcn-economy-20260814-8w-v1',
      'obs-lgw-rom-economy-20260814-8w-v1',
      'obs-lgw-ath-economy-20260814-8w-v1',
      'obs-lgw-dlm-economy-20260814-8w-v1',
      'obs-lgw-ayt-economy-20260814-8w-v1',
      'obs-brs-rom-economy-20260814-8w-v1',
      'obs-gla-bod-economy-20260814-8w-v1',
      'obs-lgw-rak-economy-20260814-8w-v1',
      'obs-lhr-cmn-economy-20260814-8w-v1',
      'obs-lgw-adb-economy-20260814-8w-v1',
      'obs-lgw-aga-economy-20260814-8w-v1',
      'obs-lgw-tng-economy-20260814-8w-v1',
      'obs-lgw-saw-economy-20260814-8w-v1',
      'obs-bhx-aga-economy-20260818-8w-v1',
      'obs-bhx-amd-economy-20260818-8w-v1',
      'obs-bhx-atq-economy-20260818-8w-v1',
      'obs-bhx-ayt-economy-20260818-8w-v1',
      'obs-bhx-ath-economy-20260818-8w-v1',
      'obs-bhx-bcn-economy-20260818-8w-v1',
      'obs-bhx-bjv-economy-20260818-8w-v1',
      'obs-bhx-dlm-economy-20260818-8w-v1',
      'obs-bhx-del-economy-20260818-8w-v1',
      'obs-bhx-doh-economy-20260818-8w-v1',
      'obs-bhx-dxb-economy-20260818-8w-v1',
      'obs-bhx-fao-economy-20260818-8w-v1',
      'obs-bhx-isb-economy-20260818-8w-v1',
      'obs-bhx-ist-economy-20260818-8w-v1',
      'obs-bhx-jed-economy-20260818-8w-v1',
      'obs-bhx-lhe-economy-20260818-8w-v1',
      'obs-bhx-med-economy-20260818-8w-v1',
      'obs-bhx-bom-economy-20260818-8w-v1',
      'obs-bhx-fco-economy-20260818-8w-v1',
      'obs-brs-ayt-economy-20260818-8w-v1',
      'obs-brs-bcn-economy-20260818-8w-v1',
      'obs-brs-dlm-economy-20260818-8w-v1',
      'obs-brs-fao-economy-20260818-8w-v1',
      'obs-brs-rak-economy-20260818-8w-v1',
      'obs-brs-fco-economy-20260818-8w-v1',
      'obs-edi-dxb-economy-20260818-8w-v1',
      'obs-gla-ayt-economy-20260818-8w-v1',
      'obs-gla-dlm-economy-20260818-8w-v1',
      'obs-gla-dxb-economy-20260818-8w-v1',
      'obs-lba-atq-economy-20260818-8w-v1',
      'obs-lba-ayt-economy-20260818-8w-v1',
      'obs-lba-bcn-economy-20260818-8w-v1',
      'obs-lba-dlm-economy-20260818-8w-v1',
      'obs-lba-fao-economy-20260818-8w-v1',
      'obs-lgw-aga-economy-20260818-8w-v1',
      'obs-lgw-amd-economy-20260818-8w-v1',
      'obs-lgw-atq-economy-20260818-8w-v1',
      'obs-lgw-ayt-economy-20260818-8w-v1',
      'obs-lgw-ath-economy-20260818-8w-v1',
      'obs-lgw-bcn-economy-20260818-8w-v1',
      'obs-lgw-bjv-economy-20260818-8w-v1',
      'obs-lgw-dlm-economy-20260818-8w-v1',
      'obs-lgw-dxb-economy-20260818-8w-v1',
      'obs-lgw-fao-economy-20260818-8w-v1',
      'obs-lgw-ist-economy-20260818-8w-v1',
      'obs-lgw-adb-economy-20260818-8w-v1',
      'obs-lgw-rak-economy-20260818-8w-v1',
      'obs-lgw-fco-economy-20260818-8w-v1',
      'obs-lgw-tng-economy-20260818-8w-v1',
      'obs-lhr-blr-economy-20260818-8w-v1',
      'obs-lhr-cmn-economy-20260818-8w-v1',
      'obs-lhr-del-economy-20260818-8w-v1',
      'obs-lhr-dac-economy-20260818-8w-v1',
      'obs-lhr-doh-economy-20260818-8w-v1',
      'obs-lhr-dxb-economy-20260818-8w-v1',
      'obs-lhr-jed-economy-20260818-8w-v1',
      'obs-lhr-lhe-economy-20260818-8w-v1',
      'obs-lhr-bom-economy-20260818-8w-v1',
      'obs-lhr-zyl-economy-20260818-8w-v1',
      'obs-man-aga-economy-20260818-8w-v1',
      'obs-man-amd-economy-20260818-8w-v1',
      'obs-man-atq-economy-20260818-8w-v1',
      'obs-man-ayt-economy-20260818-8w-v1',
      'obs-man-ath-economy-20260818-8w-v1',
      'obs-man-bcn-economy-20260818-8w-v1',
      'obs-man-bjv-economy-20260818-8w-v1',
      'obs-man-dlm-economy-20260818-8w-v1',
      'obs-man-del-economy-20260818-8w-v1',
      'obs-man-dac-economy-20260818-8w-v1',
      'obs-man-doh-economy-20260818-8w-v1',
      'obs-man-dxb-economy-20260818-8w-v1',
      'obs-man-fao-economy-20260818-8w-v1',
      'obs-man-isb-economy-20260818-8w-v1',
      'obs-man-ist-economy-20260818-8w-v1',
      'obs-man-adb-economy-20260818-8w-v1',
      'obs-man-jed-economy-20260818-8w-v1',
      'obs-man-khi-economy-20260818-8w-v1',
      'obs-man-lhe-economy-20260818-8w-v1',
      'obs-man-med-economy-20260818-8w-v1',
      'obs-man-rak-economy-20260818-8w-v1',
      'obs-man-bom-economy-20260818-8w-v1',
      'obs-man-fco-economy-20260818-8w-v1',
      'obs-man-zyl-economy-20260818-8w-v1',
      'obs-ncl-dlm-economy-20260818-8w-v1',
      'obs-ncl-dxb-economy-20260818-8w-v1',
    ]);
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'obs-man-lhe-economy-20260728-8w-v1',
        routeSlug: 'manchester-lahore',
        cabin: 'Economy',
        observedDate: '2026-07-28',
        price: 578,
        source: 'Etihad',
        observedVia: 'google-flights',
        currency: 'GBP',
        baggage: 'not stated; optional charges may apply',
        departureDate: '2026-09-22',
        returnDate: '2026-10-06',
      }),
    ]));
    const newEntries = [
      ['obs-man-isb-economy-20260728-8w-v1', 'manchester-islamabad', 562, 'Etihad'],
      ['obs-lhr-del-economy-20260728-8w-v1', 'london-heathrow-delhi', 432, 'IndiGo (operated under lease from Norse)'],
      ['obs-bhx-atq-economy-20260728-8w-v1', 'birmingham-amritsar', 733, 'KLM and IndiGo'],
      ['obs-lhr-jed-economy-20260728-8w-v1', 'london-heathrow-jeddah', 575, 'Royal Jordanian'],
    ] as const;
    for (const [id, routeSlug, price, source] of newEntries) {
      expect(published.find((o) => o.id === id)).toEqual(expect.objectContaining({ routeSlug, price, source, observedVia: 'google-flights', currency: 'GBP', baggage: 'not stated; optional charges may apply', departureDate: '2026-09-22', returnDate: '2026-10-06' }));
    }
    const secondBatchEntries = [
      ['obs-man-lhe-economy-20260804-8w-v1', 'manchester-lahore', 620, 'Etihad'],
      ['obs-man-isb-economy-20260804-8w-v1', 'manchester-islamabad', 621, 'Turkish Airlines'],
      ['obs-lhr-del-economy-20260804-8w-v1', 'london-heathrow-delhi', 456, 'IndiGo (operated under lease from Norse)'],
      ['obs-bhx-atq-economy-20260804-8w-v1', 'birmingham-amritsar', 829, 'Air France and Air India'],
      ['obs-lhr-jed-economy-20260804-8w-v1', 'london-heathrow-jeddah', 487, 'Etihad'],
    ] as const;
    for (const [id, routeSlug, price, source] of secondBatchEntries) {
      expect(published.find((o) => o.id === id)).toEqual(expect.objectContaining({ routeSlug, price, source, observedDate: '2026-08-04', observedVia: 'google-flights', currency: 'GBP', baggage: 'not stated; optional charges may apply', observationReason: 'routine-weekly', departureDate: '2026-09-29', returnDate: '2026-10-13' }));
    }
    const tripComEntries = [
      ['obs-man-med-economy-20260805-8w-v1', 'manchester-madinah', 473, 'Pegasus Airlines and AJet'],
      ['obs-man-doh-economy-20260805-8w-v1', 'manchester-doha', 411, 'Pegasus Airlines'],
    ] as const;
    for (const [id, routeSlug, price, source] of tripComEntries) {
      expect(published.find((o) => o.id === id)).toEqual(expect.objectContaining({ routeSlug, price, source, observedDate: '2026-08-05', observedVia: 'trip.com', currency: 'GBP', baggage: 'not stated', observationReason: 'routine-weekly', departureDate: '2026-09-30', returnDate: '2026-10-14' }));
    }
  });

  it('keeps Heathrow-Mumbai’s historic currency-incomplete observation private while using the fresh complete observations', () => {
    const historic = fareObservations.find((observation) => observation.id === 'obs-lhr-bom-economy-2');
    expect(historic?.currency).toBeUndefined();
    // 2026-08-18: Weekly Full Fare Refresh #1 added a second complete
    // observation (Etihad, £450), alongside the existing 13 August one
    // (Gulf Air, £424).
    expect(getFareRangeSummary('london-heathrow-mumbai', 'Economy', FIXED_TODAY)).toMatchObject({ count: 2, min: 424, max: 450 });
  });

  it('keeps all other historic-only routes out of public fare output', () => {
    // birmingham-mumbai was the original example here - Fare Coverage
    // Expansion Batch B (6 August 2026, a later, separate initiative) gave
    // it a genuine, complete observation, so it's no longer historic-only.
    // Swapped for manchester-karachi, whose only observation
    // (obs-man-khi-economy-1) remains undated and incomplete, and which
    // Batch B deliberately excluded from its own queue (unverified
    // directness - see FARE_COVERAGE_BATCH_B.md §2).
    expect(getFareRangeSummary('manchester-karachi', 'Economy', FIXED_TODAY)).toBeNull();
    expect(getLatestPublishableObservation('manchester-karachi', FIXED_TODAY)).toBeUndefined();
  });

  it('keeps every deal without a complete observation untracked', () => {
    const observedRouteSlugs = new Set(fareObservations.filter((o) => !isPubliclyPublishable(o)).map((o) => o.routeSlug));
    const affectedDeals = deals.filter((d) => {
      const route = getRouteByAirportAndDestination(d.fromAirportSlug, d.toDestinationSlug);
      return route && observedRouteSlugs.has(route.slug);
    });
    expect(affectedDeals.length).toBeGreaterThan(0); // sanity: this set is non-empty
    for (const deal of affectedDeals) {
      // umrah-package-jed and umrah-package-extended need no exclusion here:
      // isBundledProductDeal keeps them untracked regardless of observation
      // completeness, so the general assertion below already holds for them.
      // man-dxb-economy excluded since 6 August 2026: Route Completion
      // Batch 1's manual founder-action fare check
      // (obs-man-dxb-economy-20260806-8w-v1) is genuinely complete, so this
      // deal is correctly tracked now, alongside the other exclusions below
      // whose routes also gained a complete observation earlier. The 7
      // man-*-economy Batch A Deal entries (added the same day as the
      // customer-visibility audit fix) are excluded for the same reason -
      // each has a genuinely complete, dated observation behind it.
      // lhr-doh-economy and lgw-amd-economy (Fare Coverage Expansion Batch
      // B, 6 August 2026) already existed but had no complete observation
      // until this batch; the 8 entries after them are Batch B's own new
      // Deal entries, each backed by a genuinely complete observation - see
      // FARE_COVERAGE_BATCH_B.md.
      if (
        [
          'lhr-bom-economy',
          'man-lhe-economy',
          'lhr-del-economy',
          'bhx-atq-economy',
          'man-dxb-economy',
          'man-isb-economy',
          'man-del-economy',
          'man-bom-economy',
          'man-amd-economy',
          'man-atq-economy',
          'man-doh-economy',
          'man-med-economy',
          'lhr-doh-economy',
          'lgw-amd-economy',
          'lhr-blr-economy',
          'man-jed-economy',
          'bhx-bom-economy',
          'bhx-med-economy',
          'man-dac-economy',
          'lba-atq-economy',
          'lba-isb-economy',
          'lgw-atq-economy',
        ].includes(deal.id)
      )
        continue;
      expect(hasTrackedFare(deal, FIXED_TODAY), deal.id).toBe(false);
    }
  });
});

describe('getDealAirlineLabel (TR-010, final correction) — a deal/search card must never assert an airline as confirmed independently of that airline\'s own verification record', () => {
  it('1. Jeddah cards display Saudia now that Saudia has independent current evidence', () => {
    const jed1 = deals.find((d) => d.id === 'umrah-package-jed')!;
    const jed2 = deals.find((d) => d.id === 'lhr-jed-business')!;
    expect(jed1.airline).toBe('Saudia'); // the underlying curation field is unchanged — the fix is in what's *shown*
    expect(jed2.airline).toBe('Saudia');
    expect(getDealAirlineLabel(jed1, FIXED_TODAY)).toBe('Saudia');
    expect(getDealAirlineLabel(jed2, FIXED_TODAY)).toBe('Saudia');
  });

  it('2. BA evidence and Saudia evidence remain independently gated on the same route', () => {
    const route = getRouteBySlug('london-heathrow-jeddah')!;
    expect(getDealAirlineDisplayStatus(route, 'british-airways', FIXED_TODAY)).toBe('verified');
    expect(getDealAirlineDisplayStatus(route, 'saudia', FIXED_TODAY)).toBe('verified');
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

  it('4. a newly verified Manchester-Dubai airline displays as confirmed', () => {
    const unverified = deals.find((d) => d.id === 'man-dxb-economy')!; // Manchester–Dubai, Emirates, no verification record at all
    const label = getDealAirlineLabel(unverified, FIXED_TODAY);
    expect(label).toBe('Emirates');
    expect(label).not.toBe('Verification pending');
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

  it('every Saudia-named deal reflects its route-specific evidence state (Jeddah verified, Madinah pending)', () => {
    const saudiaDeals = deals.filter((d) => d.airline === 'Saudia');
    expect(saudiaDeals.length).toBeGreaterThan(0);
    for (const deal of saudiaDeals) {
      const expected = deal.id === 'umrah-package-jed' || deal.id === 'lhr-jed-business'
        ? 'Saudia'
        : deal.id === 'lhr-med-business'
          ? undefined
          : 'Verification pending';
      expect(getDealAirlineLabel(deal, FIXED_TODAY), deal.id).toBe(expected);
    }
  });
});

describe('Resolved route evidence sweep (July 2026)', () => {
  // london-gatwick-ahmedabad was removed from this list on 18 August 2026:
  // Route Verification Refresh Batch 1's correction reclassified it
  // unverified (DISPUTED) after a fresh check found current Air India
  // surfaces genuinely conflict on which London airport the service uses.
  // It is deliberately no longer expected to resolve to 'direct' — see its
  // own coverage in tests/route-verification-review-visibility.test.ts and
  // docs/project-control/ROUTE_VERIFICATION_CADENCE_POLICY.md.
  const resolvedDirect = [
    'london-heathrow-delhi', 'manchester-dubai', 'london-heathrow-doha', 'manchester-doha',
    'glasgow-dubai', 'edinburgh-dubai', 'newcastle-dubai', 'london-gatwick-amritsar',
  ] as const;

  it('clears the pending state only where a current official source now supports direct service', () => {
    for (const slug of resolvedDirect) {
      const route = getRouteBySlug(slug)!;
      expect(route, slug).toBeDefined();
      expect(getDisplayDirectness(route, RESOLUTION_TODAY), slug).toBe('direct');
      expect(getRoutePresentation(route, RESOLUTION_TODAY).status, slug).toBe('direct');
    }
  });

  it('corrects Birmingham-Amritsar to a sourced connecting shape instead of showing pending direct service', () => {
    const route = getRouteBySlug('birmingham-amritsar')!;
    expect(route.isDirect).toBe(false);
    expect(getDisplayDirectness(route, RESOLUTION_TODAY)).toBe('connecting');
    expect(getRoutePresentation(route, RESOLUTION_TODAY).status).toBe('connecting');
  });

  it('keeps only genuinely unresolved PIA disputes pending rather than inventing a resolution', () => {
    for (const slug of ['manchester-karachi', 'birmingham-lahore', 'birmingham-islamabad'] as const) {
      const route = getRouteBySlug(slug)!;
      expect(getDisplayDirectness(route, RESOLUTION_TODAY), slug).toBe('unverified');
    }
  });
});
