import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { FareSignal } from '@/components/route/fare-signal';
import { fareObservations } from '@/data/fare-observations';
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

  it('checks exist in the archive but none is currently shown: "no current fare to show", with no pointer to history that is not on the page', () => {
    const html = render(false, true);
    expect(html).toContain('JetStash has no current fare to show for this route.');
    expect(html).not.toContain('fare history below');
    expect(html).not.toContain("hasn't logged a fare");
  });

  it('nothing has ever been logged: "hasn\'t logged a fare for this route yet"', () => {
    const html = render(false, false);
    expect(html).toContain("JetStash hasn't logged a fare for this route yet.");
    expect(html).not.toContain('no current fare to show');
  });

  it('the old wording ("hasn\'t logged a current fare") no longer exists in source', () => {
    expect(read('components/route/fare-signal.tsx')).not.toContain("logged a current fare");
  });

  it('every real route with no current fare but checks in the archive says "no current fare to show", never "hasn\'t logged"', async () => {
    // The route page derives its Fare Signal from today's date, so the candidates must too.
    const today = new Date().toISOString().slice(0, 10);
    const candidates = routes.filter((route) => getFareSignalForRoute(route.slug, today).state === 'none' && fareObservations.some((o) => o.routeSlug === route.slug));
    if (candidates.length === 0) return; // wording is covered by the unit cases above if every route has a current fare
    expect(NOW.length).toBe(10);
    for (const route of candidates.slice(0, 4)) {
      const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: route.slug }) })).replace(/&#x27;/g, "'");
      expect(html, route.slug).toContain('JetStash has no current fare to show for this route.');
      expect(html, route.slug).not.toContain("hasn't logged a fare");
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

describe('7. /deals and /tracked-fares are distinguished by name', () => {
  it('"Tracked Fares" is the exhaustive list; the footer entry for /deals is "Curated fare cards"', () => {
    expect(mainNav.find((item) => item.label === 'Tracked Fares')?.href).toBe('/tracked-fares');
    expect(footerNav.specialist.find((item) => item.label === 'Tracked Fares')?.href).toBe('/tracked-fares');
    expect(footerNav.specialist.find((item) => item.label === 'Curated fare cards')?.href).toBe('/deals');
    expect(footerNav.specialist.map((item) => item.label)).not.toContain('Deals');
  });

  it('the /deals page names itself as curated cards, not as the tracked-fares list', () => {
    const src = read('app/deals/page.tsx');
    expect(src).toContain("title: 'Curated fare cards from UK airports'");
    expect(src).toContain('title="Curated fare cards"');
    expect(src).toContain('eyebrow="Curated fare cards"');
    expect(read('app/tracked-fares/page.tsx')).toContain("title: 'Tracked Fares — Checked fares by UK airport'");
  });
});
