import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import {
  getSafeTripComFlightHandoffUrl,
  getTripComReturnDatesNote,
  TRIPCOM_FRESH_SEARCH_NOTE,
  TRIPCOM_NO_FARE_SEARCH_NOTE,
  TRIPCOM_RETURN_DATES_NOTE_ROUTE_SLUGS,
} from '@/lib/booking-providers';
import { JOURNEY_CHOICE_PILOT_ROUTE_SLUGS, getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import { TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS } from '@/lib/tripcom-dated-handoff';
import { FareSignal } from '@/components/route/fare-signal';

/**
 * MAN-ISB return-dates note (18 Oct 2026, founder-approved Option 1).
 * The instruction beneath the Fare Signal's Trip.com CTA names the
 * displayed fare's own travel dates; the Trip.com link is unchanged.
 * Pinned dates: 18 Oct 2026 (MAN-ISB shows a current fare) and 3 Nov 2026
 * (that fare falls inside the 14-day promoted-departure guard).
 */
const ROUTE = 'manchester-islamabad';
const CURRENT_DATE = '2026-10-18';
const EXPIRED_DATE = '2026-11-03';

function render(nowIso: string, overrides: Record<string, unknown> = {}) {
  const signal = getFareSignalForRoute(ROUTE, nowIso);
  const tripComUrl = getSafeTripComFlightHandoffUrl(ROUTE, 'manchester', 'islamabad', nowIso);
  return { signal, tripComUrl, html: renderToStaticMarkup(FareSignal({ signal, nowIso, tripComUrl, routeSlug: ROUTE, ...overrides })) };
}

describe('getTripComReturnDatesNote', () => {
  it('is allowlisted to Manchester-Islamabad only', () => {
    expect(TRIPCOM_RETURN_DATES_NOTE_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
    expect(getTripComReturnDatesNote('manchester-lahore', { departureDate: '2026-11-17', returnDate: '2026-12-01' })).toBeNull();
  });

  it('formats a same-year return with the year once, keeping the not-carried-across warning', () => {
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '2026-11-17', returnDate: '2026-12-01' })).toBe(
      'Opens a new Trip.com search. Select Return and enter 17 November to 1 December 2026. The fare shown above is not carried across.',
    );
  });

  it('names both years when the trip crosses New Year', () => {
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '2026-12-28', returnDate: '2027-01-11' })).toBe(
      'Opens a new Trip.com search. Select Return and enter 28 December 2026 to 11 January 2027. The fare shown above is not carried across.',
    );
  });

  it('returns null for no fare, malformed or impossible dates, or a return not after departure', () => {
    expect(getTripComReturnDatesNote(ROUTE, null)).toBeNull();
    expect(getTripComReturnDatesNote(ROUTE, undefined)).toBeNull();
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '', returnDate: '2026-12-01' })).toBeNull();
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '2026-11-17', returnDate: '01/12/2026' })).toBeNull();
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '2027-02-30', returnDate: '2027-03-10' })).toBeNull();
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '2026-11-17', returnDate: '2026-11-17' })).toBeNull();
    expect(getTripComReturnDatesNote(ROUTE, { departureDate: '2026-12-01', returnDate: '2026-11-17' })).toBeNull();
  });
});

describe('Fare Signal CTA note on Manchester-Islamabad', () => {
  it('names the exact displayed observation’s dates while a current fare is shown', () => {
    const { signal, html } = render(CURRENT_DATE);
    expect(signal.state).toBe('current');
    const obs = signal.observation!;
    const expected = getTripComReturnDatesNote(ROUTE, obs)!;
    expect(expected).not.toBeNull();
    expect(html).toContain(expected);
    expect(html).toContain('Select Return and enter 17 November to 1 December 2026.');
    expect(html).not.toContain(TRIPCOM_FRESH_SEARCH_NOTE);
  });

  it('follows the displayed fare when it changes — no stored dates', () => {
    const base = getFareSignalForRoute(ROUTE, CURRENT_DATE);
    const signal = { ...base, observation: { ...base.observation!, departureDate: '2027-01-05', returnDate: '2027-01-19' } };
    const html = renderToStaticMarkup(FareSignal({ signal, nowIso: CURRENT_DATE, tripComUrl: getSafeTripComFlightHandoffUrl(ROUTE, 'manchester', 'islamabad', CURRENT_DATE), routeSlug: ROUTE }));
    expect(html).toContain('Select Return and enter 5 January to 19 January 2027.');
    expect(html).not.toContain('enter 17 November');
  });

  it('drops the dates once that fare is no longer eligible', () => {
    const { signal, html } = render(EXPIRED_DATE);
    expect(signal.state).toBe('none');
    expect(html).not.toContain('Opens a new Trip.com search');
    expect(html).not.toContain('November to');
  });

  it('keeps the generic note for an older "recent" fare, which shows no travel dates', () => {
    const base = getFareSignalForRoute(ROUTE, CURRENT_DATE);
    const signal = { ...base, state: 'recent' as const };
    const html = renderToStaticMarkup(FareSignal({ signal, nowIso: CURRENT_DATE, tripComUrl: getSafeTripComFlightHandoffUrl(ROUTE, 'manchester', 'islamabad', CURRENT_DATE), routeSlug: ROUTE }));
    expect(html).toContain(TRIPCOM_FRESH_SEARCH_NOTE);
    expect(html).not.toContain('Opens a new Trip.com search');
  });

  it('keeps the generic note if the route were service-ended', () => {
    const { html } = render(CURRENT_DATE, { isServiceEnded: true });
    expect(html).not.toContain('Opens a new Trip.com search');
  });

  it('leaves the Trip.com URL, affiliate identifiers and tracking source unchanged', () => {
    const { html, tripComUrl } = render(CURRENT_DATE);
    expect(tripComUrl).toBe(
      'https://www.trip.com/flights/Manchester-to-Islamabad/tickets-MAN-ISB?flighttype=S&dcity=MAN&acity=ISB&locale=en-XX&curr=GBP&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082296',
    );
    expect(html).toContain(`href="${tripComUrl!.replace(/&/g, '&amp;')}"`);
    expect(html).not.toContain('showfarefirst');
    expect(html).not.toContain('ddate=');
  });
});

describe('scope', () => {
  it('other routes keep the generic note', () => {
    const route = 'manchester-antalya';
    const nowIso = '2026-10-07';
    const signal = getFareSignalForRoute(route, nowIso);
    const tripComUrl = getSafeTripComFlightHandoffUrl(route, 'manchester', 'antalya', nowIso);
    const html = renderToStaticMarkup(FareSignal({ signal, nowIso, tripComUrl, routeSlug: route }));
    expect(html).toContain(TRIPCOM_FRESH_SEARCH_NOTE);
    expect(html).not.toContain('Opens a new Trip.com search');
  });

  it('the no-fare note is unchanged', () => {
    expect(TRIPCOM_NO_FARE_SEARCH_NOTE).toBe('Opens a new search. Choose your trip type and travel dates.');
  });

  it('Journey Choice stays dormant; the dated-link pilot is not reached', () => {
    expect(JOURNEY_CHOICE_PILOT_ROUTE_SLUGS).toEqual([]);
    expect(getJourneyChoiceForRoute(ROUTE, CURRENT_DATE)).toBeNull();
    expect(TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
  });
});
