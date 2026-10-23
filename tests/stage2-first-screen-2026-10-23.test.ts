import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { JourneyCheckForm } from '@/components/homepage-v2/journey-check-form';
import { HomepageEvidenceCard } from '@/components/homepage-v2/homepage-evidence-card';
import { DealCard } from '@/components/ui/deal-card';
import { deals } from '@/data/deals';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getHomepageEvidenceExample, getHomepageEvidenceExpiryIso, HOMEPAGE_EVIDENCE_CANDIDATE_SLUGS } from '@/lib/homepage-evidence';
import { isHomepageEvidenceExpired } from '@/lib/homepage-evidence-expiry';
import { FARE_AGE_WARNING_AFTER_DAYS } from '@/lib/fare-age-warning';
import { daysBetweenIso, meetsPromotedDepartureLeadTime } from '@/lib/freshness-thresholds';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const TODAY = '2026-10-23';

const formData = {
  origins: [{ slug: 'birmingham', label: 'Birmingham' }, { slug: 'manchester', label: 'Manchester' }],
  destinations: [{ slug: 'agadir', label: 'Agadir, Morocco' }, { slug: 'islamabad', label: 'Islamabad, Pakistan' }],
  routeIndex: { 'manchester|islamabad': 'manchester-islamabad' },
};

describe('Stage 2 homepage: no silent destination default', () => {
  it('renders both selects with a neutral placeholder selected, not the first alphabetical destination', () => {
    const html = renderToStaticMarkup(createElement(JourneyCheckForm, formData));
    expect(html).toContain('Choose airport');
    expect(html).toContain('Choose destination');
    // React marks the controlled value via the option order; the placeholder is first in each select.
    expect(html).toMatch(/<select[^>]*id="jc-from"[^>]*>\s*<option value="" [^>]*>\s*Choose airport/);
    expect(html).toMatch(/<select[^>]*id="jc-to"[^>]*>\s*<option value="" [^>]*>\s*Choose destination/);
    expect(html).toContain('Choose your airport and destination.');
    expect(html).not.toContain('We track');
  });

  it('source no longer seeds state from origins[0] / destinations[0] and blocks an incomplete submit', () => {
    const src = read('components/homepage-v2/journey-check-form.tsx');
    expect(src).toContain("useState('')");
    expect(src).not.toMatch(/useState\((origins|destinations)\[0\]/);
    expect(src).toMatch(/if \(!fromSlug \|\| !toSlug\) \{[\s\S]{0,200}return;/);
    // Existing behaviour preserved: a tracked pair still goes to its route page, anything else to the destination guide.
    expect(src).toContain('router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`);');
    expect(src).toContain("track('journey_check_completed'");
  });
});

describe('Stage 2 homepage evidence example', () => {
  it('today it is the Manchester-Islamabad fare, labelled as a connecting fare on a direct route, with its dates', () => {
    const example = getHomepageEvidenceExample(TODAY);
    expect(example?.kind).toBe('fare');
    if (example?.kind !== 'fare') return;
    expect(example.route.slug).toBe('manchester-islamabad');
    expect(example.route.slug).toBe(HOMEPAGE_EVIDENCE_CANDIDATE_SLUGS[0]);
    expect(example.connectingFareOnDirectRoute).toBe(true);
    const html = renderToStaticMarkup(createElement(HomepageEvidenceCard, { example }));
    expect(html).toContain('Manchester → Islamabad');
    expect(html).toContain(`£${example.fare.price.toLocaleString('en-GB')} return`);
    expect(html).toContain('Connecting fare, not nonstop');
    expect(html).toContain('An example check');
    expect(html).toMatch(/checked \d{1,2} [A-Z][a-z]+ 20\d\d/);
    expect(html).toContain('Travel dates:');
    expect(html).toContain('A dated observation, not today&#x27;s price.');
    expect(html).toContain('href="/routes/manchester-islamabad"');
    // No booking-provider link on the homepage card.
    expect(html).not.toMatch(/trip\.com|tpk\.mx|sponsored/i);
  });

  it('property: across a year of dates, a promoted fare is always current, fresh, recent and departing with lead time', () => {
    const start = new Date('2026-10-23T12:00:00Z').getTime();
    let fareDays = 0;
    for (let i = 0; i <= 400; i += 1) {
      const nowIso = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const ex = getHomepageEvidenceExample(nowIso);
      if (ex?.kind !== 'fare') continue;
      fareDays += 1;
      const signal = getFareSignalForRoute(ex.route.slug, nowIso);
      expect(signal.state, nowIso).toBe('current');
      expect(signal.freshness, nowIso).toBe('fresh');
      expect(ex.fare.id, nowIso).toBe(signal.observation?.id);
      expect(ex.fare.cabin, nowIso).toBe('Economy');
      expect(daysBetweenIso(ex.fare.observedDate, nowIso), nowIso).toBeLessThanOrEqual(FARE_AGE_WARNING_AFTER_DAYS);
      expect(meetsPromotedDepartureLeadTime(ex.fare.departureDate, nowIso), nowIso).toBe(true);
      expect(ex.fare.departureDate > nowIso, nowIso).toBe(true);
    }
    expect(fareDays).toBeGreaterThan(0);
  });

  it('property: a route-finding fallback is only ever a verified direct route with its own verification date, and never shows a price', () => {
    const start = new Date('2026-10-23T12:00:00Z').getTime();
    for (let i = 0; i <= 400; i += 5) {
      const nowIso = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const ex = getHomepageEvidenceExample(nowIso);
      if (ex?.kind !== 'route') continue;
      expect(ex.route.routeIsDirect, nowIso).toBe(true);
      expect(ex.route.verifiedDate, nowIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const html = renderToStaticMarkup(createElement(HomepageEvidenceCard, { example: ex }));
      expect(html, nowIso).not.toContain('£');
      expect(html, nowIso).toContain('service checked');
    }
  });

  it('degrades fare -> verified route finding -> nothing as evidence ages (frozen dates)', () => {
    expect(getHomepageEvidenceExample('2026-10-23')?.kind).toBe('fare');
    expect(getHomepageEvidenceExample('2026-11-02')?.kind).toBe('fare');
    // From 3 Nov the fare's 17 Nov departure is inside the 15-day promotion guard, so only the route finding remains.
    expect(getHomepageEvidenceExample('2026-11-03')?.kind).toBe('route');
    // The route's own verification lapses on 17 Nov; with nothing current the card is omitted, never stale.
    expect(getHomepageEvidenceExample('2026-11-17')).toBeNull();
  });

  it('with no eligible evidence the example is simply absent (nothing invented)', () => {
    // Far beyond every verification review date and fare window.
    expect(getHomepageEvidenceExample('2030-01-01')).toBeNull();
  });

  it('the hero renders the card only when an example exists, and the homepage wires it from the helper', () => {
    const hero = read('components/homepage-v2/homepage-opening-hero.tsx');
    expect(hero).toContain('{evidence ? (');
    expect(read('components/homepage-v2/journey-desk-home.tsx')).toContain('getHomepageEvidenceExample(');
    // The Route Atlas, journey console and analytics wiring are still in place.
    expect(read('components/homepage-v2/journey-desk-home.tsx')).toContain('<AtlasFeelTest');
    expect(hero).toContain('<JourneyCheckForm origins={journeyCheck.origins}');
  });
});

describe('Stage 2 /deals hero', () => {
  const src = read('app/deals/page.tsx');
  it('is two short sentences with a methodology link, keeping coverage stats and the curated-cards distinction', () => {
    const hero = src.slice(src.indexOf('description={'), src.indexOf('stats={['));
    const words = hero.replace(/<[^>]+>|\{[^}]*\}|description=|[()]/g, ' ').split(/\s+/).filter(Boolean);
    expect(words.length).toBeLessThan(45);
    expect(hero).toContain('Dated fare observations, not live prices');
    expect(hero).toContain('Every fare is tied to its recorded date');
    expect(hero).toContain('confirm the final price before booking');
    expect(hero).toContain('How we track fares');
    expect(hero).toContain('href="/about"');
    expect(src).toContain('stats={[');
    expect(src).toContain('Fare checks logged');
    expect(src).toContain('curated selection of routes and categories');
    expect(src).toContain('not shown as one of the cards here');
  });
});

describe('Stage 2 deal-card scanning order (nothing removed)', () => {
  const withFare = deals
    .map((deal) => ({ deal, html: renderToStaticMarkup(DealCard({ deal, nowIso: TODAY })) }))
    .filter(({ html }) => /Fare check(ed|s) with/.test(html));

  it('has fare cards to check', () => {
    expect(withFare.length).toBeGreaterThan(10);
  });

  it('price, then the source-and-date line, then any connecting-fare reconciliation, then travel dates, then the fare details', () => {
    for (const { deal, html } of withFare) {
      const price = html.search(/£\d/);
      const source = html.search(/Fare check(ed|s) with/);
      const travel = html.indexOf('Travel ');
      expect(source, deal.id).toBeGreaterThan(price);
      expect(travel, deal.id).toBeGreaterThan(source);
      const tag = html.indexOf('Connecting fare, not nonstop');
      if (tag !== -1) {
        expect(tag, deal.id).toBeGreaterThan(source);
        expect(tag, deal.id).toBeLessThan(travel);
        expect(html, deal.id).toContain('so its price is not a nonstop price');
      }
      // The source line carries a date.
      expect(html.slice(source, source + 400), deal.id).toMatch(/\d{1,2} [A-Z][a-z]+ 20\d\d/);
    }
  });

  it('keeps every safeguard that was on the card: self-transfer wording, return-unknown wording, disclosures, booking links', () => {
    const joined = withFare.map((c) => c.html).join('\n');
    expect(joined).toContain('Connecting fare, not nonstop');
    expect(joined).toContain('Fare checked with');
    // The unknown-return warning specifically (not just any use of the word "return"): it must still appear on the real cards.
    expect(joined).toMatch(/return leg not checked/);
    expect(joined).toContain('rel="');
    for (const { deal, html } of withFare) {
      if (html.includes('href="https://')) {
        expect(html, deal.id).toMatch(/Ad · Affiliate link|Affiliate link/);
      }
    }
    const src = read('components/ui/deal-card.tsx');
    expect(src).toContain('toTravellerFareNote(range.priceNote)');
    expect(src).toContain('<JourneyConsequenceLine consequences={range.journeyConsequences} />');
  });

  it('never states a stop count or baggage allowance of its own', () => {
    const src = read('components/ui/deal-card.tsx') + read('components/homepage-v2/homepage-evidence-card.tsx');
    expect(src).not.toMatch(/\d\s*stops?\b/i);
    expect(src).not.toMatch(/\d+\s?kg/i);
  });
});

describe('Stage 2 intentionally unchanged', () => {
  it('the homepage example only ever links to a route page the homepage already linked to (SEO pilot link graph unchanged)', () => {
    // manchester-islamabad is already a homepage link target on Production (Route Atlas panel). Adding a candidate that the
    // homepage did not already link to changes the pilot's internal link set: log it as a pilot event before widening this.
    expect([...HOMEPAGE_EVIDENCE_CANDIDATE_SLUGS]).toEqual(['manchester-islamabad']);
  });

  it('the new homepage selection module stays isolated from booking providers, fare records and email/CRM code', () => {
    // Scope of this check: only the new module's own imports. Unchanged files are proven by the PR's file list, not here.
    const evidence = read('lib/homepage-evidence.ts');
    expect(evidence).not.toMatch(/booking-providers|fare-observations'|api\/|brevo|resend/i);
  });
});

describe('Stage 2 evidence card safeguards on awkward fares (fixtures)', () => {
  const baseFare = {
    id: 'fixture', cabin: 'Economy' as const, airline: 'TestAir', price: 400, currency: 'GBP' as const,
    observedDate: '2026-10-20', departureDate: '2026-12-01', returnDate: '2026-12-15',
    directness: 'connecting' as const, outboundDirectness: 'connecting' as const, returnDirectness: null,
    outboundStops: 1, returnStops: null, connectionAirports: ['DXB'], isSelfTransfer: false,
    hasPositiveNonSelfTransferEvidence: false, journeyConsequences: [] as string[],
  };
  const route = { slug: 'manchester-islamabad', originName: 'Manchester', destinationCity: 'Islamabad', routeStatusHeadline: 'Direct flights available', routeIsDirect: true, verifiedDate: '2026-10-17' };
  const render = (fare: typeof baseFare) =>
    renderToStaticMarkup(createElement(HomepageEvidenceCard, { example: { kind: 'fare', route, fare, connectingFareOnDirectRoute: true } }));

  it('an unknown return leg stays visibly unconfirmed', () => {
    expect(render(baseFare)).toContain('return directness unconfirmed');
  });

  it('a self-transfer fare keeps its self-transfer label and any decisive consequence', () => {
    const html = render({ ...baseFare, isSelfTransfer: true, journeyConsequences: ['Overnight layover of 19h 35m'] });
    expect(html).toContain('Self-transfer itinerary');
    expect(html).toContain('Overnight layover of 19h 35m');
    expect(html).toContain('Connecting fare, not nonstop');
  });
});

describe('Stage 2 evidence expiry guard (cached-page safety)', () => {
  it('the expiry date is the first day the selection changes, and the guard is wired around the card', () => {
    expect(getHomepageEvidenceExpiryIso('2026-10-23')).toBe('2026-11-03');
    expect(getHomepageEvidenceExpiryIso('2026-11-03')).toBe('2026-11-17');
    expect(getHomepageEvidenceExpiryIso('2030-01-01')).toBeNull();
    // An example that never changes inside the horizon still gets a conservative re-check date, not unlimited validity.
    expect(getHomepageEvidenceExpiryIso('2026-10-23', 3)).toBe('2026-10-26');
    const hero = read('components/homepage-v2/homepage-opening-hero.tsx');
    expect(hero).toMatch(/<HomepageEvidenceExpiryGuard expiresOnIso=\{evidenceExpiresOnIso\}>\s*<HomepageEvidenceCard example=\{evidence\} \/>/);
    expect(read('components/homepage-v2/journey-desk-home.tsx')).toContain('getHomepageEvidenceExpiryIso(evidenceNowIso)');
    const guard = read('components/homepage-v2/homepage-evidence-expiry-guard.tsx');
    // Re-checked on mount, on a timer, and when a suspended or restored tab returns.
    expect(guard).toContain("document.addEventListener('visibilitychange', check)");
    expect(guard).toContain("window.addEventListener('pageshow', check)");
    expect(guard).toContain('window.setInterval(check, 60_000)');
    // The guard must not import the data-heavy selection module into the client bundle.
    expect(guard).not.toContain("from '@/lib/homepage-evidence'");
  });

  it('isHomepageEvidenceExpired: before, at and after the expiry date, across UK midnight and the clock change', () => {
    expect(isHomepageEvidenceExpired(null, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    expect(isHomepageEvidenceExpired('2026-11-17', new Date('2026-11-16T23:59:00Z'))).toBe(false);
    expect(isHomepageEvidenceExpired('2026-11-17', new Date('2026-11-17T00:00:00Z'))).toBe(true);
    expect(isHomepageEvidenceExpired('2026-11-17', new Date('2026-12-01T09:00:00Z'))).toBe(true);
    // BST: 23:30 UTC on 24 Oct is already 00:30 on 25 Oct in the UK.
    expect(isHomepageEvidenceExpired('2026-10-25', new Date('2026-10-24T23:30:00Z'))).toBe(true);
    expect(isHomepageEvidenceExpired('2026-10-25', new Date('2026-10-24T22:30:00Z'))).toBe(false);
    // After the clocks go back (25 Oct 01:00 UTC), UK date follows UTC.
    expect(isHomepageEvidenceExpired('2026-10-26', new Date('2026-10-25T23:30:00Z'))).toBe(false);
    expect(isHomepageEvidenceExpired('2026-10-26', new Date('2026-10-26T00:00:00Z'))).toBe(true);
  });
});
