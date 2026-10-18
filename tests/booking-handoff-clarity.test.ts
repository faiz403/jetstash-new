import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FareSignal } from '@/components/route/fare-signal';
import { JourneyChoice } from '@/components/route/journey-choice';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getSafeTripComFlightHandoffUrl, getTripComSearchCtaLabel, TRIPCOM_FRESH_SEARCH_NOTE, TRIPCOM_NO_FARE_SEARCH_NOTE } from '@/lib/booking-providers';
import { SELF_TRANSFER_EXPLANATION } from '@/lib/fare-self-transfer';
import { JOURNEY_CHOICE_DATED_HANDOFF_NOTE } from '@/lib/tripcom-dated-handoff';
import type { JourneyChoice as JourneyChoiceData, JourneyChoiceOption } from '@/lib/journey-choice';
import RoutePage from '@/app/routes/[slug]/page';
import { DestinationFlightGuides } from '@/components/destination/destination-flight-guides';
import { getDestinationBySlug } from '@/data/destinations';

const NOW = '2026-10-13';
const LHE_URL = 'https://www.trip.com/flights/Manchester-to-Lahore/tickets-MAN-LHE?flighttype=S&dcity=MAN&acity=LHE&locale=en-XX&curr=GBP&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082226';

// MAN→ISB was re-verified on 17 Oct 2026 (review due 16 Nov), so its
// suppressed-fare case is now exercised the day after that expiry.
const MAN_ISB_EXPIRED = '2026-11-17';

function renderSignal(routeSlug: string, nowIso = NOW) {
  return renderToStaticMarkup(FareSignal({
    routeSlug, signal: getFareSignalForRoute(routeSlug, nowIso), nowIso,
    tripComUrl: getSafeTripComFlightHandoffUrl(routeSlug, undefined, undefined, nowIso),
  }));
}

describe('generic flight-search handoff clarity', () => {
  it('pairs the real displayed Lahore return fare with an explicit new-search action', () => {
    const html = renderSignal('manchester-lahore');
    expect(html).toContain('£585 return');
    expect(html).toContain('17 November 2026');
    expect(html).toContain('1 December 2026');
    expect(html).toContain('Search Manchester to Lahore flights on Trip.com');
    expect(html).toContain(TRIPCOM_FRESH_SEARCH_NOTE);
    expect(html).not.toContain(TRIPCOM_NO_FARE_SEARCH_NOTE);
    expect(getSafeTripComFlightHandoffUrl('manchester-lahore', undefined, undefined, NOW)).toBe(LHE_URL);
    expect(html).toContain(LHE_URL.replaceAll('&', '&amp;'));
  });

  it('does not refer to an unseen fare or dates when route verification suppresses the fare', () => {
    expect(getFareSignalForRoute('manchester-islamabad', MAN_ISB_EXPIRED).state).toBe('none');
    const html = renderSignal('manchester-islamabad', MAN_ISB_EXPIRED);
    expect(html).toContain('Search Manchester to Islamabad flights on Trip.com');
    expect(html).toContain(TRIPCOM_NO_FARE_SEARCH_NOTE);
    expect(html).not.toContain(TRIPCOM_FRESH_SEARCH_NOTE);
    expect(html).not.toContain('shown above');
  });

  it('also explains a dateless destination continuation where no route guide or fare is displayed', () => {
    const html = renderToStaticMarkup(DestinationFlightGuides({ destination: getDestinationBySlug('athens')!, nowIso: NOW }));
    expect(html).toContain('Search Glasgow to Athens flights on Trip.com');
    expect(html).toContain(TRIPCOM_NO_FARE_SEARCH_NOTE);
    expect(html).not.toContain(TRIPCOM_FRESH_SEARCH_NOTE);
    expect(html).not.toContain('Compare flights on Trip.com');
  });

  it('explains the cheaper self-transfer beside that option without reclassifying the main fare', () => {
    const signal = getFareSignalForRoute('manchester-lahore', NOW);
    expect(signal.observation?.isSelfTransfer).toBe(false);
    expect(signal.lowerSelfTransfer?.price).toBe(442);
    expect(signal.lowerSelfTransfer?.isSelfTransfer).toBe(true);
    const html = renderSignal('manchester-lahore');
    expect(html).toContain('Self-transfer itinerary');
    expect(html).toContain(SELF_TRANSFER_EXPLANATION);
    expect(html.indexOf(SELF_TRANSFER_EXPLANATION)).toBeGreaterThan(html.indexOf('£442'));
    expect(html.match(/Self-transfer may involve/g)).toHaveLength(1);
    expect(html).not.toMatch(/guaranteed|fully protected/i);
  });

  it('keeps an exact-date handoff label and disclosure unchanged', () => {
    const option: JourneyChoiceOption = {
      id: 'lower', airline: 'Fixture Air', cabin: 'Economy', price: 500, currency: 'GBP',
      totalJourneyMinutes: 900, outboundStops: 1, returnStops: 1, connectionAirports: [],
      directness: 'connecting', baggage: { kind: 'not-stated', detail: 'not stated' },
      departureDate: '2026-11-17', returnDate: '2026-12-01', checkedDate: NOW,
    };
    const journeyChoice: JourneyChoiceData = {
      lowerFare: option, fasterJourney: { ...option, id: 'faster', price: 600, totalJourneyMinutes: 700 },
      decision: { priceDifference: 100, timeDifferenceMinutes: 200, sentence: 'Fixture comparison.' },
      otherOptions: [], baggageCostConfirmedForAllOptions: false,
    };
    const url = 'https://example.test/dated-search';
    const html = renderToStaticMarkup(JourneyChoice({
      journeyChoice, routeSlug: 'manchester-islamabad', routeLabel: 'Manchester to Islamabad',
      tripComHandoff: { url, datesPreserved: true },
    }));
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('Compare flights on Trip.com');
    expect(html).toContain(JOURNEY_CHOICE_DATED_HANDOFF_NOTE);
    expect(html).not.toContain(TRIPCOM_FRESH_SEARCH_NOTE);
    expect(html).not.toContain('Select Return');
  });

  it('retains the real Lahore return-leg and baggage limitations on the route page', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    try {
      const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-lahore' }) }));
      expect(html).toContain('£585');
      expect(html).toContain('£442');
      expect(html).toContain('return leg not checked');
      expect(html).toContain('baggage not stated');
      expect(html).not.toMatch(/fully protected|return itinerary verified/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves every stored Trip.com URL and affiliate identifier from the reviewed base', () => {
    const source = readFileSync('lib/booking-providers.ts', 'utf8');
    const urls = source.match(/'https:\/\/www\.trip\.com\/flights\/[^']+'/g);
    expect(createHash('sha256').update(JSON.stringify(urls)).digest('hex'))
      .toBe('00c4957db6e7e7578059b60abed46b75706be2f3c0e83725f57facc9677360c7');
    expect(getTripComSearchCtaLabel('unknown-route')).toBe('Search flights on Trip.com');
  });
});
