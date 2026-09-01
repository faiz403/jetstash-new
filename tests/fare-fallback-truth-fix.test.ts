import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasCurrentFareSignalAmongRoutes, hasCurrentFareSignalForCabinAmongRoutes } from '@/lib/fare-signal';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { routes, getRoutesByAirport, getRoutesByDestination } from '@/data/routes';
import { getDealsByAirport, getDealsByDestination } from '@/data/deals';
import AirportPage from '@/app/airports/[slug]/page';
import DestinationPage from '@/app/destinations/[slug]/page';

/**
 * Fare fallback truth fix (August 2026) — regression coverage for the
 * confirmed live defect the Tracked Fares discoverability audit (16 August
 * 2026) found: Glasgow, Newcastle and Edinburgh airport pages rendered "we
 * haven't logged a tracked fare" copy purely because they had zero curated
 * Deal records (data/deals.ts), even though each genuinely has a current,
 * publicly-safe Fare Signal on at least one route. "No curated Deal" and
 * "no tracked fare" are separate, unrelated facts and must never be
 * conflated again — see hasCurrentFareSignalAmongRoutes's own doc comment
 * in lib/fare-signal.ts and NoFareFallback's own doc comment in
 * components/ui/no-fare-fallback.tsx.
 */

// Apostrophe-free substrings only — renderToStaticMarkup HTML-escapes "'" as
// the multi-character entity &#x27;, which a single-char regex wildcard
// can't span reliably.
const NO_TRACKED_FARE_PHRASE = /logged a tracked fare/i;
const NEUTRAL_PHRASE = /no curated fare card.*tracked fare evidence is available/i;

const nowIso = new Date().toISOString().slice(0, 10);

describe('hasCurrentFareSignalAmongRoutes — the canonical multi-route check', () => {
  it('is true when at least one route in scope has a current Fare Signal', () => {
    // Manchester-Antalya is a long-standing, consistently fresh route.
    // (Not manchester-dubai: since Fare Signal poor-itinerary suppression,
    // 31 Aug 2026, its only current Economy observation is a confirmed
    // self-transfer, 2-stop-each-way itinerary — see
    // tests/fare-signal-cabin-safety.test.ts and tests/fare-signal.test.ts
    // for the full account.)
    expect(hasCurrentFareSignalAmongRoutes(['manchester-antalya', 'not-a-real-route'], nowIso)).toBe(true);
  });

  it('is false for an empty scope', () => {
    expect(hasCurrentFareSignalAmongRoutes([], nowIso)).toBe(false);
  });

  it('is false when every slug in scope is unreal or has no evidence', () => {
    expect(hasCurrentFareSignalAmongRoutes(['not-a-real-route', 'also-not-real'], nowIso)).toBe(false);
  });

  // The exact three airports the audit named — reproduced directly against
  // real data, not a synthetic fixture, so this fails immediately if the
  // underlying archive ever genuinely loses this evidence.
  it.each(['glasgow', 'newcastle', 'edinburgh'])('%s airport currently has zero curated Deals but a genuine current Fare Signal', (airportSlug) => {
    const routeSlugs = getRoutesByAirport(airportSlug).map((r) => r.slug);
    expect(getDealsByAirport(airportSlug)).toHaveLength(0);
    expect(hasCurrentFareSignalAmongRoutes(routeSlugs, nowIso)).toBe(true);
  });
});

describe('hasCurrentFareSignalForCabinAmongRoutes — cabin-scoped sibling for /business-class', () => {
  it('is true for Economy cabin among routes that include a current Economy fare', () => {
    expect(hasCurrentFareSignalForCabinAmongRoutes(['manchester-antalya'], 'Economy', nowIso)).toBe(true);
  });

  it('is false when no route in scope has evidence for that cabin', () => {
    expect(hasCurrentFareSignalForCabinAmongRoutes(['not-a-real-route'], 'Business', nowIso)).toBe(false);
  });

  // Business Fare Evidence Batch 1 (22 Aug 2026) closed the gap this test
  // used to document ("no route currently has a current Business-cabin Fare
  // Signal at all") for manchester-lahore, london-heathrow-lahore,
  // london-heathrow-doha and manchester-karachi — see
  // data/fare-observations.ts's "Business Fare Evidence Batch 1" block.
  // This guards the business-class page's own check against silently
  // trusting a cabin with no evidence; it must now correctly flip true for
  // scopes that include one of those four routes, and stay false for
  // scopes that genuinely have none.
  //
  // Fare Signal poor-itinerary suppression (31 Aug 2026): 2 of those 4
  // routes' own Business observations are themselves confirmed
  // self-transfer, 2+-stop-per-leg itineraries — manchester-lahore's
  // £3,051 (3/3 stops) and london-heathrow-lahore's Business record — and
  // are now correctly suppressed too, same as their Economy signals.
  // london-heathrow-doha (1/1 stops) and manchester-karachi (1/1 stops)
  // are unaffected; the aggregate check across the whole catalogue still
  // holds true because of those two.
  it('is true for Business cabin among the four routes Business Fare Evidence Batch 1 evidenced — 2 of the 4 individually, 2 more now suppressed by poor-itinerary evidence', () => {
    expect(hasCurrentFareSignalForCabinAmongRoutes(routes.map((r) => r.slug), 'Business', nowIso)).toBe(true);
    expect(hasCurrentFareSignalForCabinAmongRoutes(['manchester-lahore'], 'Business', nowIso)).toBe(false);
    expect(hasCurrentFareSignalForCabinAmongRoutes(['london-heathrow-lahore'], 'Business', nowIso)).toBe(false);
    expect(hasCurrentFareSignalForCabinAmongRoutes(['london-heathrow-doha'], 'Business', nowIso)).toBe(true);
    expect(hasCurrentFareSignalForCabinAmongRoutes(['manchester-karachi'], 'Business', nowIso)).toBe(true);
  });

  it('remains false for Business cabin among a scope that genuinely has none — the gap is closed for exactly these four routes, not globally', () => {
    expect(hasCurrentFareSignalForCabinAmongRoutes(['manchester-istanbul'], 'Business', nowIso)).toBe(false);
  });
});

describe('NoFareFallback — renders the correct claim for each state', () => {
  it('renders the neutral "no curated card, evidence exists elsewhere" copy when hasFareSignalElsewhere is true', () => {
    const html = renderToStaticMarkup(NoFareFallback({ cityLabel: 'Glasgow', hasFareSignalElsewhere: true }));
    expect(html).toMatch(NEUTRAL_PHRASE);
    expect(html).not.toMatch(NO_TRACKED_FARE_PHRASE);
  });

  it('renders the genuine "we haven\'t logged a tracked fare" copy when hasFareSignalElsewhere is false (default)', () => {
    const html = renderToStaticMarkup(NoFareFallback({ cityLabel: 'Sylhet' }));
    expect(html).toMatch(NO_TRACKED_FARE_PHRASE);
    expect(html).not.toMatch(NEUTRAL_PHRASE);
  });

  it('the route-guide single-route call site is unaffected — hasFareSignalElsewhere defaults to false and changes nothing there', () => {
    const withRoute = renderToStaticMarkup(NoFareFallback({ cityLabel: 'Manchester to Nowhere', routeSlug: 'not-a-real-route' }));
    expect(withRoute).toMatch(NO_TRACKED_FARE_PHRASE);
  });
});

describe('Real Glasgow/Newcastle/Edinburgh airport pages — before/after regression', () => {
  it.each(['glasgow', 'newcastle', 'edinburgh'])('%s airport page never renders the false "no tracked fare" claim', async (slug) => {
    const element = await AirportPage({ params: Promise.resolve({ slug }) });
    const html = renderToStaticMarkup(element);
    expect(html).not.toMatch(NO_TRACKED_FARE_PHRASE);
    expect(html).toMatch(NEUTRAL_PHRASE);
  });
});

describe('Genuine no-fare scope still renders the real fallback (zero Deals AND zero current Fare Signal)', () => {
  it('Liverpool airport (zero routes, zero deals) still shows the genuine no-tracked-fare fallback', async () => {
    const routeSlugs = getRoutesByAirport('liverpool').map((r) => r.slug);
    expect(routeSlugs).toHaveLength(0);
    expect(hasCurrentFareSignalAmongRoutes(routeSlugs, nowIso)).toBe(false);
    const element = await AirportPage({ params: Promise.resolve({ slug: 'liverpool' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toMatch(NO_TRACKED_FARE_PHRASE);
    expect(html).not.toMatch(NEUTRAL_PHRASE);
  });

  it('Sylhet destination (routes exist, but zero deals and zero current Fare Signal) still shows the genuine fallback', async () => {
    const routeSlugs = getRoutesByDestination('sylhet').map((r) => r.slug);
    expect(routeSlugs.length).toBeGreaterThan(0);
    expect(getDealsByDestination('sylhet')).toHaveLength(0);
    expect(hasCurrentFareSignalAmongRoutes(routeSlugs, nowIso)).toBe(false);
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'sylhet' }) });
    const html = renderToStaticMarkup(element);
    expect(html).toMatch(NO_TRACKED_FARE_PHRASE);
  });
});

describe('Curated-Deal-present scopes are unaffected — existing behaviour unchanged', () => {
  it('Manchester airport page (has curated Deals) never renders any no-fare fallback at all', async () => {
    expect(getDealsByAirport('manchester').length).toBeGreaterThan(0);
    const element = await AirportPage({ params: Promise.resolve({ slug: 'manchester' }) });
    const html = renderToStaticMarkup(element);
    expect(html).not.toMatch(NO_TRACKED_FARE_PHRASE);
    expect(html).not.toMatch(NEUTRAL_PHRASE);
  });
});
