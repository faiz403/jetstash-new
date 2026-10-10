import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { FareSignal } from '@/components/route/fare-signal';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { routes } from '@/data/routes';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { toTravellerFareNote } from '@/lib/fare-note-display';
import { buildTrackedFareAirportGroups, getTrackedFareCoverage } from '@/lib/tracked-fare-groups';
import { GENERIC_FLIGHT_SEARCH_CTA_LABEL, SERVICE_ENDED_CTA_LABEL, TRIPCOM_DEFAULT_CTA_LABEL } from '@/lib/booking-providers';
import { footerNav, mainNav } from '@/lib/site-config';

/**
 * 10 October 2026 customer copy / consistency batch. Presentation only: none of these
 * tests (or the changes they cover) touch fare selection, eligibility, Fare Watcher,
 * Route Watch, Standout, baselines or any stored observation.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const NOW = '2026-10-10';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('1. one shared coverage count', () => {
  it('counts exactly the routes /tracked-fares lists (a current Fare Signal), for any date', () => {
    for (const day of ['2026-10-09', '2026-10-14', '2026-10-20', '2026-11-05']) {
      const coverage = getTrackedFareCoverage(routes, day);
      const listed = buildTrackedFareAirportGroups(routes, undefined, day).reduce((sum, group) => sum + group.entries.length, 0);
      const current = routes.filter((route) => getFareSignalForRoute(route.slug, day).state === 'current').length;
      expect(coverage.trackedRoutes, day).toBe(listed);
      expect(coverage.trackedRoutes, day).toBe(current);
      expect(coverage.totalRoutes).toBe(routes.length);
      expect(coverage.asOfIso).toBe(day);
    }
  });

  it('the homepage, /deals and /tracked-fares all use that one helper and show an "as of" date', () => {
    const home = read('components/homepage-v2/homepage-sections.tsx');
    const deals = read('app/deals/page.tsx');
    const tracked = read('app/tracked-fares/page.tsx');
    for (const src of [home, deals, tracked]) {
      expect(src).toContain('getTrackedFareCoverage');
      expect(src).toContain('formatChecked(coverage.asOfIso)');
      expect(src).not.toContain('routesWithTrackedFare');
    }
    // The old per-page definition (any publishable observation) is gone from all three pages.
    expect(home).not.toMatch(/getPublishableObservationsByRoute\(route\.slug/);
    expect(deals).not.toMatch(/getPublishableObservationsByRoute\(r\.slug/);
  });
});

describe('2. "Verified check" is gone', () => {
  it('a route page with a recheck says "Last fare check", never "Verified check"', async () => {
    const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) }));
    expect(html).toContain('Last fare check');
    expect(html).not.toContain('Verified check');
  });

  it('no component or page source still says "Verified check"', () => {
    for (const file of [...walk(join(process.cwd(), 'components')), ...walk(join(process.cwd(), 'app'))]) {
      expect(readFileSync(file, 'utf8').includes('Verified check'), file).toBe(false);
    }
  });
});

describe('3. no-fare copy distinguishes "no current fare" from "none ever logged"', () => {
  const none = { state: 'none', observation: null, freshness: null, strongerSignal: null, noneReason: null, lowerSelfTransfer: null } as never;
  const render = (hasFareHistory: boolean, hasLoggedFares: boolean) =>
    renderToStaticMarkup(FareSignal({ signal: none, tripComUrl: 'https://example.test/x', routeSlug: 'fixture-route', routeLabel: 'Manchester to Antalya', hasFareHistory, hasLoggedFares })).replace(/&#x27;/g, "'");

  it('earlier checks are shown on the page: "no current fare to show", pointing at the history below', () => {
    const html = render(true, true);
    expect(html).toContain('JetStash has no current fare to show for this route. Earlier checks are in the fare history below.');
    expect(html).not.toContain("hasn't logged a fare");
  });

  it('checks exist in the archive but none is currently safe to show: says so, with no pointer to history that is not on the page', () => {
    const html = render(false, true);
    expect(html).toContain("JetStash has checked this route before, but there isn't a current fare we can safely show.");
    expect(html).not.toContain('fare history below');
    expect(html).not.toContain("hasn't logged a fare");
  });

  it('nothing has ever been logged: "hasn\'t logged a fare for this route yet"', () => {
    const html = render(false, false);
    expect(html).toContain("JetStash hasn't logged a fare for this route yet.");
    expect(html).not.toContain('no current fare to show');
    expect(html).not.toContain('checked this route before');
  });

  it('the old wording ("hasn\'t logged a current fare") no longer exists in source', () => {
    expect(read('components/route/fare-signal.tsx')).not.toContain("logged a current fare");
  });

  it('every real route with no current fare but checks in the archive says it has checked before and nothing is safe to show, never "hasn\'t logged", and does not expose the hidden history', async () => {
    // The route page derives its Fare Signal from today's date, so the candidates must too.
    const today = new Date().toISOString().slice(0, 10);
    const candidates = routes.filter((route) => getFareSignalForRoute(route.slug, today).state === 'none' && fareObservations.some((o) => o.routeSlug === route.slug));
    if (candidates.length === 0) return; // wording is covered by the unit cases above if every route has a current fare
    expect(NOW.length).toBe(10);
    for (const route of candidates.slice(0, 4)) {
      const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: route.slug }) })).replace(/&#x27;/g, "'");
      expect(html, route.slug).toContain("JetStash has checked this route before, but there isn't a current fare we can safely show.");
      expect(html, route.slug).not.toContain("hasn't logged a fare");
      // Founder ruling 10 Oct 2026: observations the publishability rules reject stay hidden; no history panel appears.
      if (getPublishableObservationsByRoute(route.slug, today).length === 0) expect(html, route.slug).not.toContain('fare-history');
    }
  });
});

describe('4. internal evidence notes stay out of traveller copy (archive untouched)', () => {
  const INTERNAL = [/exact airport pair/i, /badge text/i, /comparable check/i, /retained result summary/i, /not recorded during this check/i, /booking flow was entered/i, /Cheapest-tab/i];

  it('no archive note is empty after the transform, and the core internal phrases never reach traveller copy', () => {
    for (const observation of fareObservations) {
      const text = toTravellerFareNote(observation.priceNote);
      expect(text.length, observation.id).toBeGreaterThan(0);
      for (const pattern of INTERNAL) expect(pattern.test(text), `${observation.id}: ${pattern}`).toBe(false);
    }
  });

  it('traveller-relevant meaning is preserved in concise wording', () => {
    const separate = "return, per person, one adult; Google Flights flags this fare as separate tickets or self-transfer (the exact badge text shown on the row was not recorded on the day): the trip combines tickets from more than one airline or booking, so it is not covered by a single airline ticket and any missed connection depends on the booking provider; the return leg was not opened, so exact return timing and routing are not independently confirmed; baggage not stated (no overhead bin access)";
    expect(toTravellerFareNote(separate)).toBe('return, per person, one adult; separate tickets: not covered by one airline ticket, so a missed connection is not protected; return leg not checked; baggage not stated (no overhead bin access)');
    const clean = 'return, per person, one adult; cheapest clean fare visible (no separate-tickets or self-transfer notice); Google Flights, exact 17 Nov/1 Dec search; searched as an exact airport pair, so only itineraries actually landing at ISB were considered; Etihad, 1 stop; outbound MAN to ISB, 14 hr; connection detail shown: 3h 45m Abu Dhabi; no separate-tickets or self-transfer notice was shown for this itinerary; the return leg was not opened, so exact return timing and routing are not independently confirmed; baggage not stated';
    expect(toTravellerFareNote(clean)).toBe('return, per person, one adult; Etihad, 1 stop; outbound MAN to ISB, 14 hr; connection: 3h 45m Abu Dhabi; return leg not checked; baggage not stated');
  });

  it('unrecognised notes are kept as written, never emptied', () => {
    expect(toTravellerFareNote('return, per person, one adult; a bespoke note nobody wrote a rule for')).toBe('return, per person, one adult; a bespoke note nobody wrote a rule for');
  });

  it('the archive itself is unchanged: the original methodology wording is still stored', () => {
    const stored = fareObservations.find((o) => o.id === 'obs-man-isb-economy-20261006-v1');
    expect(stored?.priceNote).toContain('searched as an exact airport pair');
    expect(fareObservations.some((o) => /badge text shown on the row was not recorded/.test(o.priceNote))).toBe(true);
  });

  it('a rendered route page no longer shows the methodology wording in fare history', async () => {
    const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) }));
    expect(html).not.toContain('exact airport pair');
    expect(html).not.toContain('badge text shown on the row');
    expect(html).not.toContain('against the previous comparable check');
  });

  it('the display transform is used only for display, never by selection or Fare Watcher logic', () => {
    for (const file of ['lib/fare-signal.ts', 'lib/fare-watcher.ts', 'lib/route-watch-fare-trigger.ts', 'lib/standout-fare.ts', 'lib/fare-evidence-eligibility.ts']) {
      expect(read(file), file).not.toContain('fare-note-display');
    }
  });
});

describe('6. one honest flight-search CTA vocabulary (labels only; no URL touched)', () => {
  it('labels describe what each link does and avoid "live" / "current price" claims', () => {
    expect(TRIPCOM_DEFAULT_CTA_LABEL).toBe('Compare flights on Trip.com');
    expect(SERVICE_ENDED_CTA_LABEL).toBe('Compare connecting flights on Trip.com');
    expect(GENERIC_FLIGHT_SEARCH_CTA_LABEL).toBe('Search flights on Google Flights');
    for (const label of [TRIPCOM_DEFAULT_CTA_LABEL, SERVICE_ENDED_CTA_LABEL, GENERIC_FLIGHT_SEARCH_CTA_LABEL]) {
      expect(label).not.toMatch(/\blive\b|\bcurrent\b|today|price/i);
    }
  });

  it('the old flight-search label variants appear nowhere in app, components or lib', () => {
    const OLD = ['Check live flights on Trip.com', 'Search current flights', 'Compare current connecting flights on Trip.com'];
    for (const file of [...walk(join(process.cwd(), 'app')), ...walk(join(process.cwd(), 'components')), ...walk(join(process.cwd(), 'lib'))]) {
      const src = readFileSync(file, 'utf8');
      for (const phrase of OLD) expect(src.includes(phrase), `${file}: ${phrase}`).toBe(false);
    }
  });

  it('the hotel handoff CTA is a different action and keeps its own wording', () => {
    expect(read('components/destination/holiday-intelligence.tsx')).toContain('Check current price on Trip.com');
  });
});

describe('7. /deals and /tracked-fares naming is deliberately unchanged in this batch', () => {
  // Founder ruling 10 Oct 2026: renaming the indexed /deals page ("Curated fare cards") is a separate
  // SEO / product-naming decision, not part of a copy-consistency batch.
  it('the nav and footer labels are exactly as before', () => {
    expect(mainNav.find((item) => item.label === 'Tracked Fares')?.href).toBe('/tracked-fares');
    expect(footerNav.specialist.find((item) => item.label === 'Tracked Fares')?.href).toBe('/tracked-fares');
    expect(footerNav.specialist.find((item) => item.label === 'Deals')?.href).toBe('/deals');
    expect(footerNav.specialist.map((item) => item.label)).not.toContain('Curated fare cards');
  });

  it('the /deals title, heading and eyebrow keep their existing wording', () => {
    const src = read('app/deals/page.tsx');
    expect(src).toContain("title: 'Tracked Fares from UK Airports'");
    expect(src).toContain('title="Fares we\'re tracking"');
    expect(src).toContain('eyebrow="Tracked fares"');
    expect(src).not.toContain('Curated fare cards');
    expect(read('app/tracked-fares/page.tsx')).not.toContain('curated fare cards');
  });
});

describe('4b. audit of the remaining one-off notes (narrow, explicit handling only)', () => {
  const note = (id: string) => toTravellerFareNote(fareObservations.find((o) => o.id === id)!.priceNote);

  it('a KAYAK result that was a standard connecting itinerary is never described as a self-transfer', () => {
    const out = note('obs-lba-isb-economy-20260916-kayak-v1');
    expect(out).not.toContain('self-transfer combination');
    expect(out).toContain('standard interline booking, not a self-transfer');
  });

  it('KAYAK results that really were self-transfer combinations keep that fact', () => {
    expect(note('obs-brs-ayt-economy-20260916-kayak-v1')).toContain('self-transfer combination');
    expect(note('obs-gla-dlm-economy-20260916-kayak-v1')).toContain('self-transfer combination');
  });

  it('operator procedure and source-selection wording is dropped from named one-off notes', () => {
    const cases: Array<[string, RegExp]> = [
      ['obs-lba-bjv-economy-20260822-8w-v1', /standard 8-week horizon|14-night stay length/],
      ['obs-man-lhe-business-20260822-8w-v1', /individually expanded|flagship route/],
      ['obs-man-isb-economy-20260913-pia-direct-v1', /lowest total price|typical range|cheapest listed booking option/],
      ['obs-brs-ayt-economy-20260916-kayak-v1', /originally recorded via Trip\.com|fallback priority/],
      ['obs-gla-dlm-economy-20260916-kayak-v1', /SAME underlying|fallback priority/],
      ['obs-gla-bjv-economy-20260922-kayak-v1', /anomalous|prior sweeps/],
      ['obs-gla-dxb-economy-20260922-v1', /persistent error page/],
      ['obs-bhx-bcn-economy-20260922-v1', /this session|intermittent/],
      ['obs-lgw-dlm-economy-20260929-final-recheck-v1', /final live Google Flights recheck|remained bookable/],
      ['obs-man-bom-economy-20261004-rescue-v1', /commercial-completeness|Google Flights result set/],
      ['obs-man-del-economy-20261004-rescue-v1', /commercial-completeness|Google Flights result set/],
      ['obs-lgw-dlm-economy-20261007-offer-level-reverification-v1', /exact Google Flights search/],
      ['obs-lhr-doh-business-20260822-8w-v1', /individually expanded|verified direct Qatar/],
      ['obs-man-khi-business-20260822-8w-v1', /individually expanded|COV-001|route record|typical for Business/],
      ['obs-man-dxb-economy-20260901-8w-v1', /baseline-series|PR #\d+|pilot/],
      ['obs-man-doh-economy-20260901-recheck-v1', /click-through|routine check/],
      ['obs-lgw-doh-economy-20260915-8w-v1', /first-ever observation/],
      ['obs-man-del-economy-20260916-8w-v1', /genuine connecting evidence|IndiGo withdrawal|confirmed separately/],
      ['obs-bhx-bcn-economy-20260916-8w-v1', /recorded factually/],
      ['obs-ncl-dlm-economy-20260916-kayak-v1', /every source checked/],
      ['obs-lgw-atq-economy-20260806-8w-v1', /route-level verification/],
      ['obs-lhr-del-economy-20260901-recheck-v1', /same profile|routine check/],
    ];
    for (const [id, pattern] of cases) expect(pattern.test(note(id)), id).toBe(false);
  });

  it('traveller-relevant facts in those notes survive', () => {
    expect(note('obs-man-lhe-business-20260822-8w-v1')).toContain('different, connecting, non-PIA itinerary');
    expect(note('obs-man-isb-economy-20260913-pia-direct-v1')).toContain('price shown is the airline-direct price');
    expect(note('obs-lhr-jed-economy-20260915-8w-v1')).toContain('change of Istanbul airport');
    expect(note('obs-man-bom-economy-20261004-rescue-v1')).toContain('this is explicitly a connecting fare');
    expect(note('obs-man-khi-economy-20260822-8w-v1')).toContain('overhead bin access');
  });

  it('after the audit no stored note leaves collection-procedure wording in traveller copy', () => {
    const PROCEDURE = [/exact airport pair/i, /badge text/i, /comparable check/i, /retained result/i, /this session/i, /prior sweeps/i, /fallback priority/i, /originally recorded via Trip\.com/i, /commercial-completeness/i, /individually expanded/i, /persistent error page/i, /anomalous/i, /standard 8-week horizon/i, /COV-\d+/, /PR #\d+/, /route record/i, /baseline-series/i, /first-ever observation/i, /click-through/i, /same profile/i, /route-level verification/i, /recorded factually/i];
    for (const observation of fareObservations) {
      const text = toTravellerFareNote(observation.priceNote);
      for (const pattern of PROCEDURE) expect(pattern.test(text), `${observation.id}: ${pattern}`).toBe(false);
    }
  });
});
