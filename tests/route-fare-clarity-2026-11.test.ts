import { createElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage from '@/app/routes/[slug]/page';
import { FareSignal } from '@/components/route/fare-signal';
import { getRouteBySlug, routes } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import {
  ENDED_SERVICE_ALTERNATIVES_HEADING,
  ENDED_SERVICE_ALTERNATIVES_INTRO,
  ENDED_SERVICE_HERO_SUPPORTING,
  ENDED_SERVICE_HERO_SUPPORTING_NO_ALTERNATIVE,
  FLIGHT_TIME_NOT_VERIFIED_DIRECT,
  JOURNEY_TIME_NOT_CONFIRMED,
  JOURNEY_TIME_VARIES_CONNECTING,
  getEndedServiceHeroCopy,
  getFlightTimeDisplay,
  getRouteHeroBadgeLabel,
  getRouteSummaryForPage,
} from '@/lib/route-first-screen-copy';
import {
  ENDED_SERVICE_FLIGHT_SEARCH_CTA_LABEL,
  ENDED_SERVICE_FLIGHT_SEARCH_NOTE,
  GENERIC_FLIGHT_SEARCH_CTA_LABEL,
  GENERIC_FLIGHT_SEARCH_REL,
  GENERIC_FLIGHT_SEARCH_URL,
} from '@/lib/booking-providers';

/**
 * Route-page PR C (November 2026, CEO-approved): fare clarity and traveller next steps.
 *  A. A verified direct route that shows a connecting fare says so on the price line, in the badge and in the callout.
 *  B. A service-ended route with evidenced connecting alternatives gets a labelled Google Flights search instead of a dead end.
 *  C. The hero flight-time line never shows service-status prose under a "flight time" label; verified durations are preserved.
 *  D. The obsolete airport-specific Trip.com handoff sentence is gone from the nine public route introductions.
 * Presentation and prose only: no price, route status, fare classification or verification changes.
 */
const TODAY = '2026-11-06';
const render = async (slug: string) => renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
const DURATION = /\b\d+(?:\.\d+)?\s?(?:h|hr|hrs|hours?)\b|\b\d+\s?(?:–|-|to)\s?\d+\s?(?:h|hr|hrs|hours?)\b/i;
const OLD_CALLOUT = 'so its price is not a nonstop price';
const NEW_CALLOUT = 'Nonstop services are listed for this route, but this tracked fare is for a connecting journey. It is not a nonstop fare.';

describe('C. flight-time wording (shared helper)', () => {
  it('replaces status-first values that state no duration with the three approved sentences', () => {
    expect(getFlightTimeDisplay('Direct; check PIA for the scheduled duration')).toEqual({
      heroLine: "Typical flight time not verified. Check the airline's current schedule.",
      rowValue: "Typical flight time not verified. Check the airline's current schedule.",
      replaced: true,
    });
    expect(getFlightTimeDisplay('Direct service listed by Manchester Airport; check the exact flight for duration').heroLine).toBe(FLIGHT_TIME_NOT_VERIFIED_DIRECT);
    expect(getFlightTimeDisplay('Connecting; stops and journey time vary by itinerary').heroLine).toBe('Journey time varies by itinerary and connection.');
    expect(getFlightTimeDisplay('Connecting via Amritsar — journey time depends on the connection').heroLine).toBe(JOURNEY_TIME_VARIES_CONNECTING);
    expect(getFlightTimeDisplay('Unverified — actual stop count and journey time vary by date').heroLine).toBe('Journey time not yet confirmed.');
    expect(JOURNEY_TIME_NOT_CONFIRMED).toBe('Journey time not yet confirmed.');
  });

  it('never says "not published": an airline may have published a schedule JetStash has not verified', () => {
    for (const s of [FLIGHT_TIME_NOT_VERIFIED_DIRECT, JOURNEY_TIME_VARIES_CONNECTING, JOURNEY_TIME_NOT_CONFIRMED]) expect(s).not.toMatch(/not published/i);
  });

  it.each([
    '8h direct',
    '7h 45m direct',
    'Approximately 7h 45m, based on Emirates\' published duration for its wider UK network',
    'About 7–8h direct to Dubai; up to 8h 10m back (Emirates timetable)',
    '7-8 hours, per Gatwick\'s own destination listing',
    'Published timings vary: Manchester Airport lists 4h 30m; Turkish Airlines says a little over 4h',
    'Nonstop: about 10h 35m out and 12h 35m back on Air India\'s winter schedule',
    'Direct destination listed by Gatwick; approximately 3h; check the exact flight for duration',
  ])('preserves a verified duration unchanged: %s', (value) => {
    expect(DURATION.test(value)).toBe(true);
    expect(getFlightTimeDisplay(value)).toEqual({ heroLine: `Typical flight time: ${value}`, rowValue: value, replaced: false });
  });

  it.each([
    'Published duration not stated by Glasgow Airport; check the exact flight for your dates',
    'Duration not confirmed; check the exact flight for your dates',
    'Published timings vary by source; check the exact flight for duration',
    'Not confirmed; one stop via Sylhet per Biman\'s notice as checked on 18 August 2026, current routing not re-confirmed',
  ])('leaves a value that already speaks about duration alone: %s', (value) => {
    expect(getFlightTimeDisplay(value).replaced).toBe(false);
    expect(getFlightTimeDisplay(value).heroLine).toBe(`Typical flight time: ${value}`);
  });

  it('across every real route: no hero line pairs the flight-time label with service-status prose, durations survive, and only status-first values without a duration are replaced', () => {
    let replaced = 0;
    let preserved = 0;
    for (const route of routes) {
      const p = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
      if (p.status !== 'direct' && p.status !== 'connecting') continue;
      const d = getFlightTimeDisplay(p.flightTime);
      // a value that states a duration may still begin with a status word ("Direct destination listed by Gatwick; approximately 3h"); one that
      // states none must never sit under the flight-time label
      if (/^Typical flight time: (?:Direct|Connecting|Unverified)\b/i.test(d.heroLine)) expect(DURATION.test(p.flightTime), route.slug).toBe(true);
      const statusFirstNoDuration = /^(?:direct|connecting|unverified)\b/i.test(p.flightTime.trim()) && !DURATION.test(p.flightTime);
      expect(d.replaced, route.slug).toBe(statusFirstNoDuration);
      if (DURATION.test(p.flightTime)) {
        expect(d.rowValue, route.slug).toBe(p.flightTime);
        preserved++;
      }
      if (d.replaced) replaced++;
    }
    expect(replaced).toBeGreaterThan(5);
    expect(preserved).toBeGreaterThan(15);
  });

  it('the record\'s own flightTime string is never edited', () => {
    expect(routes.find((r) => r.slug === 'london-heathrow-jeddah')!.flightTime).toBe('Direct; check Saudia for the scheduled duration');
  });
});

describe('A. badge, price qualifier and callout on rendered pages', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true'); // Production runs with the Trip.com pause on
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('the hero badge helper rewords only a verified direct "Direct" and passes everything else through', () => {
    expect(getRouteHeroBadgeLabel('direct', 'Direct')).toBe('Direct service');
    expect(getRouteHeroBadgeLabel('connecting', 'Connecting')).toBe('Connecting');
    expect(getRouteHeroBadgeLabel('service-ended', 'Direct service ended')).toBe('Direct service ended');
    expect(getRouteHeroBadgeLabel('unverified', 'Verification pending')).toBe('Verification pending');
    expect(getRouteHeroBadgeLabel('direct', 'Something else')).toBe('Something else');
  });

  it('every rendered page: the qualifier appears exactly where the "Connecting fare, not nonstop" pill does, on the price line, ahead of the pill; the old callout sentence is gone; no Trip.com text remains', async () => {
    let withPill = 0;
    const directBadgePages: string[] = [];
    for (const route of routes) {
      const html = await render(route.slug);
      const hasPill = html.includes('Connecting fare, not nonstop');
      const q = html.indexOf('· connecting</span>');
      expect(q > -1, route.slug).toBe(hasPill);
      if (hasPill) {
        withPill++;
        const price = html.indexOf('return<span');
        expect(price, route.slug).toBeGreaterThan(-1);
        expect(price, route.slug).toBeLessThan(q);
        expect(q, route.slug).toBeLessThan(html.indexOf('Connecting fare, not nonstop'));
        expect(html, route.slug).toContain(NEW_CALLOUT);
      }
      expect(html, route.slug).not.toContain(OLD_CALLOUT);
      expect(html, route.slug).not.toMatch(/Trip\.com/);
      const p = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
      if (p.status === 'direct') {
        directBadgePages.push(route.slug);
        expect(html, route.slug).toMatch(/>Direct service</);
        expect(html, route.slug).toContain('Direct flights available'); // the status line is unchanged
      }
    }
    expect(withPill).toBeGreaterThanOrEqual(10);
    expect(directBadgePages.length).toBeGreaterThan(20);
  });

  it('a connecting route with a connecting fare gets no qualifier and keeps its "Connecting" badge', async () => {
    const html = await render('manchester-karachi');
    expect(html).not.toContain('· connecting</span>');
    expect(html).not.toContain('Connecting fare, not nonstop');
    expect(html).toMatch(/>Connecting</);
  });

  it('the callout still names the verified airline dynamically (never hard-coded) and keeps the route-service label', async () => {
    const html = await render('manchester-islamabad');
    expect(html).toContain('Route service');
    expect(html).toContain('PIA · Direct');
    const dubai = await render('london-heathrow-dubai');
    expect(dubai).toContain('Emirates · Direct');
    expect(dubai).not.toContain('PIA · Direct');
  });

  it('prices are rendered exactly as before: the qualifier is an addition to the price line, not a change to it', async () => {
    const html = await render('manchester-islamabad');
    expect(html).toMatch(/£906 return<span[^>]*>· connecting<\/span>/);
  });
});

describe('B. ended-service alternatives (Trip.com pause on)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  const fareCard = (html: string) => html.slice(html.indexOf('id="fare-signal-heading"'), html.indexOf('</section>', html.indexOf('id="fare-signal-heading"')));

  it.each(['manchester-delhi', 'manchester-mumbai'])('%s: the first screen offers a labelled Google Flights search, says the nonstop service has ended and promises nothing it cannot support', async (slug) => {
    const html = await render(slug);
    const card = fareCard(html);
    expect(card).toContain('Find connecting alternatives');
    expect(card).toContain('The former nonstop service on this route has ended.');
    expect(card).toContain('JetStash has not checked live availability for connecting flights.');
    expect(card).toContain(ENDED_SERVICE_FLIGHT_SEARCH_CTA_LABEL);
    expect(card).toContain('Search connecting flights on Google Flights');
    expect(card).toContain(ENDED_SERVICE_FLIGHT_SEARCH_NOTE.replace("'", '&#x27;'));
    // no dead end any more
    expect(card).not.toContain('No current fare tracked');
    expect(card).not.toContain('Exact partner booking link is not currently verified');
    // nothing invented: no stop count, hubs, duration, airline or itinerary inside the card
    expect(card).not.toMatch(/\bstops?\b|Usually|\b\d+h\b|Dubai|Doha|Abu Dhabi|Istanbul|Emirates|Qatar|Etihad|Turkish/);
    // an ended direct service is never represented as operating
    expect(html).toMatch(/>Direct service ended</);
    expect(html).not.toMatch(/>Direct service</);
    expect(html).not.toContain('Direct flights available');
    expect(html).not.toMatch(/Trip\.com/);
  });

  it('the link is the plain Google Flights URL: no query string, no routing API, no tracking, no affiliate parameters', async () => {
    const card = fareCard(await render('manchester-delhi'));
    const href = card.match(/<a href="([^"]+)"[^>]*>\s*Search connecting flights on Google Flights/)?.[1];
    expect(href).toBe(GENERIC_FLIGHT_SEARCH_URL);
    const url = new URL(href!);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/travel/flights');
    expect(url.search).toBe('');
    expect(card).toContain(`rel="${GENERIC_FLIGHT_SEARCH_REL}"`);
    expect(GENERIC_FLIGHT_SEARCH_REL).not.toMatch(/sponsored/);
    expect(card).not.toMatch(/data-analytics|tripcom|Allianceid|maps\.googleapis|routes\.googleapis/i);
    expect(card).toContain('target="_blank"');
  });

  it('the ended-service wording is distinct from the ordinary generic search wording', () => {
    expect(ENDED_SERVICE_FLIGHT_SEARCH_CTA_LABEL).toBe('Search connecting flights on Google Flights');
    expect(ENDED_SERVICE_FLIGHT_SEARCH_CTA_LABEL).not.toBe(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
    expect(ENDED_SERVICE_FLIGHT_SEARCH_NOTE).toContain('JetStash does not earn commission from this link');
    expect(ENDED_SERVICE_FLIGHT_SEARCH_NOTE).toContain('The former nonstop service has ended');
  });

  it('eligibility gate: a service-ended route WITHOUT evidenced connecting-alternative data still gets no search link and keeps the fail-closed sentence', () => {
    const none = { state: 'none', observation: null, freshness: null, strongerSignal: null, noneReason: null } as const;
    const withoutEvidence = renderToStaticMarkup(
      createElement(FareSignal, { signal: { ...none }, tripComUrl: null, routeSlug: 'x', isServiceEnded: true, routeLabel: 'A to B', connectingSummary: null, hasFareHistory: true, hasLoggedFares: true })
    );
    expect(withoutEvidence).not.toContain('google.com');
    expect(withoutEvidence).not.toContain('Find connecting alternatives');
    expect(withoutEvidence).toContain('No current fare tracked.');
    const withEvidence = renderToStaticMarkup(
      createElement(FareSignal, { signal: { ...none }, tripComUrl: null, routeSlug: 'x', isServiceEnded: true, routeLabel: 'A to B', connectingSummary: { stops: 1, hubs: ['X'], journeyTime: 'y' }, hasFareHistory: true, hasLoggedFares: true })
    );
    expect(withEvidence).toContain(GENERIC_FLIGHT_SEARCH_URL);
    expect(withEvidence).toContain('Find connecting alternatives');
  });

  it('ordinary no-fare routes keep the ordinary Google Flights wording; connecting routes keep their own lead', async () => {
    const doha = fareCard(await render('manchester-doha'));
    expect(doha).toContain('Search flights on Google Flights');
    expect(doha).not.toContain('Search connecting flights on Google Flights');
    const amritsar = fareCard(await render('manchester-amritsar'));
    expect(amritsar).toContain('Connecting flights available');
    expect(amritsar).not.toContain('Find connecting alternatives');
  });
});

describe('B. precedence when a monetised handoff exists (Trip.com pause off)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'false');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  it('an ended route with a verified handoff keeps its Trip.com label and never gains the Google search', async () => {
    const html = await render('manchester-delhi');
    expect(html).toContain('Search connecting flights on Trip.com');
    expect(html).not.toContain('Search connecting flights on Google Flights');
  });
});

describe('D. obsolete Trip.com handoff sentence removed from the nine public introductions', () => {
  const EXPECTED: Record<string, string> = {
    'london-gatwick-istanbul': 'Gatwick Airport announced daily direct Pegasus service to Istanbul Sabiha Gokcen for summer 2026. Check the airline and airport directly before booking.',
    'london-gatwick-antalya': 'Gatwick has published seasonal direct service to Antalya from Jet2 and SunExpress. Exact dates, frequency and duration vary by schedule.',
    'london-gatwick-dalaman': 'Gatwick–Dalaman is a seasonal SunExpress route. It ran in summer 2026 and is announced again for Summer 2027, but SunExpress’s winter 2026/27 timetable lists no Dalaman flights. Exact dates, frequency and duration vary.',
    'london-gatwick-bodrum': 'Gatwick–Bodrum is a seasonal route. SunExpress flew it twice weekly in summer 2026 but has not listed it for winter 2026/27 or Summer 2027, and other operators are not yet confirmed. Check the exact airline and itinerary before booking.',
    'london-gatwick-izmir': 'Gatwick–Izmir is a seasonal SunExpress route. It ran in SunExpress’s April-October 2026 plan and is announced again for Summer 2027, but SunExpress’s winter 2026/27 timetable lists Izmir only from London Stansted, not Gatwick. Exact dates, frequency and duration vary.',
    'london-gatwick-marrakech': 'London Gatwick\'s own live flight board confirms current direct easyJet service to Marrakech, with more than one flight observed on the same day. Exact frequency and duration remain date-specific, so check the exact flight before booking.',
    'london-gatwick-agadir': 'Current easyJet and British Airways evidence supports direct London Gatwick–Agadir service, with easyJet publishing bookable dates from late September 2026. Exact operators, dates, frequency and duration vary by schedule, so check the specific flight before booking.',
    'london-heathrow-casablanca': 'Royal Air Maroc currently publishes London Heathrow–Casablanca options, with Heathrow identifying Casablanca as a Royal Air Maroc destination from Terminal 4. Check the exact date, itinerary, duration and fare before booking.',
    'london-gatwick-tangier': 'London Gatwick publishes direct service to Tangier. Exact operators, dates, frequency and duration vary by schedule, so check the specific flight before booking.',
  };

  it.each(Object.entries(EXPECTED))('%s: the introduction keeps its other wording and loses only the Trip.com sentence', (slug, expected) => {
    const route = routes.find((r) => r.slug === slug)!;
    expect(route.intro).toBe(expected);
    expect(route.intro).not.toMatch(/Trip\.com|handoff/i);
  });

  it('no public route introduction mentions Trip.com at all', () => {
    expect(routes.filter((r) => /Trip\.com/i.test(r.intro)).map((r) => r.slug)).toEqual([]);
  });
});

describe('E. ended-service hero (CEO ruling of 6 November 2026): no availability claim and no undated typical figures above the fold', () => {
  const HERO_SUPPORTING = 'The former nonstop service has ended. Connecting alternatives may be available. Check current flights, stops and total journey times for your dates before booking.';
  const heroOf = (html: string) => html.slice(html.indexOf('<h1'), html.indexOf('id="fare-signal-heading"'));

  describe.each([
    ['Trip.com paused', 'true'],
    ['Trip.com not paused (a verified handoff exists)', 'false'],
  ])('%s', (_label, paused) => {
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
      vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', paused);
    });
    afterAll(() => {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    });

    it.each(['manchester-delhi', 'manchester-mumbai'])('%s: the hero heading and supporting text are exactly the ruling, with nothing undated or promised', async (slug) => {
      const html = await render(slug);
      const hero = heroOf(html);
      expect(ENDED_SERVICE_HERO_SUPPORTING).toBe(HERO_SUPPORTING);
      expect(hero).toMatch(/<p[^>]*>Direct service ended<\/p>/); // the bold heading line (the badge says the same)
      expect(hero).toContain(HERO_SUPPORTING);
      expect(hero).not.toMatch(/Usually|\bstops? ·|12 to 15h|Varies widely|layover|Former direct service ended|connecting flights available/i);
      expect(html).not.toContain('Former direct service ended · connecting flights available');
    });

    it.each(['manchester-delhi', 'manchester-mumbai'])('%s: no contradictory availability wording anywhere else on the page', async (slug) => {
      const html = await render(slug);
      expect(html).not.toMatch(/current connecting journey|journey itself is still possible|You can still fly this route with a connection|connecting flights available/i);
      // the summary now points at the evidence, and the lower section says alternatives may be available and were not checked live
      expect(html).toContain('the previously-verified direct service has ended. The route status below sets out the evidence.');
      expect(html).toContain(ENDED_SERVICE_ALTERNATIVES_HEADING);
      expect(html).toContain(ENDED_SERVICE_ALTERNATIVES_INTRO);
      expect(ENDED_SERVICE_ALTERNATIVES_INTRO).toContain('JetStash has not checked them live');
      // the historical evidence and the labelled general pattern are preserved
      expect(html).toContain('Post-effective-date verification');
      expect(html).toContain('Typical stops');
      expect(html).toContain('Typical total journey time');
    });
  });

  it('the Google Flights note tells the traveller the link does not fill in their search', () => {
    expect(ENDED_SERVICE_FLIGHT_SEARCH_NOTE).toContain('It does not fill in your search: enter your airports and travel dates there.');
    expect(ENDED_SERVICE_FLIGHT_SEARCH_NOTE).toContain('JetStash does not earn commission from this link');
    expect(ENDED_SERVICE_FLIGHT_SEARCH_NOTE).toContain('results may show connecting itineraries');
    expect(ENDED_SERVICE_FLIGHT_SEARCH_NOTE).not.toMatch(/expect connecting/);
  });

  it('helpers: alternatives wording only with evidenced connecting-alternative data; canonical summary kept everywhere else', () => {
    expect(getEndedServiceHeroCopy(true)).toEqual({ heading: 'Direct service ended', supporting: HERO_SUPPORTING });
    expect(getEndedServiceHeroCopy(false)).toEqual({ heading: 'Direct service ended', supporting: ENDED_SERVICE_HERO_SUPPORTING_NO_ALTERNATIVE });
    expect(ENDED_SERVICE_HERO_SUPPORTING_NO_ALTERNATIVE).not.toMatch(/alternative|connecting/i);
    const canonical = 'canonical summary';
    expect(getRouteSummaryForPage({ status: 'direct', canShowConnectingAlternative: false, summary: canonical }, 'A to B')).toBe(canonical);
    expect(getRouteSummaryForPage({ status: 'service-ended', canShowConnectingAlternative: false, summary: canonical }, 'A to B')).toBe(canonical);
    expect(getRouteSummaryForPage({ status: 'service-ended', canShowConnectingAlternative: true, summary: canonical }, 'A to B')).toContain('The route status below sets out the evidence.');
  });

  it('canonical service-ended status, evidence and connecting-alternative data are unchanged', () => {
    for (const slug of ['manchester-delhi', 'manchester-mumbai']) {
      const route = getRouteBySlug(slug)!;
      const p = getEffectiveRoutePresentation(route, routeStatusEvents, TODAY);
      expect(p.status, slug).toBe('service-ended');
      expect(p.statusLabel, slug).toBe('Direct service ended');
      expect(p.canShowConnectingAlternative, slug).toBe(true);
      // the canonical headline and summary still exist for the surfaces that use them (Arrive By, journey brief, homepage evidence)
      expect(p.statusHeadline, slug).toBe('Former direct service ended · connecting flights available');
      expect(p.summary, slug).toContain('See below for the current connecting journey');
      expect(route.connectingAlternative!.typicalStops, slug).toBe(1);
      expect(route.connectingAlternative!.hubAirports.length, slug).toBeGreaterThanOrEqual(3);
    }
    expect(getRouteBySlug('manchester-delhi')!.connectingAlternative!.typicalJourneyTime).toBe('12 to 15h total, depending on layover length');
    expect(getRouteBySlug('manchester-mumbai')!.connectingAlternative!.typicalJourneyTime).toBe('Varies widely by connection and layover length');
  });

  it('every other page keeps its hero: a direct route still reads "Direct flights available" and a connecting route its own headline', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    try {
      expect(await render('manchester-doha')).toContain('Direct flights available');
      expect(await render('manchester-amritsar')).toContain('Connecting flights available');
    } finally {
      vi.useRealTimers();
    }
  });
});
