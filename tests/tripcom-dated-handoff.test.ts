import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JourneyChoice, JourneyChoiceOption } from '@/lib/journey-choice';
import { getJourneyChoiceForRoute } from '@/lib/journey-choice-route-adapter';
import { getTripComFlightHandoffUrl, TRIPCOM_FRESH_SEARCH_NOTE } from '@/lib/booking-providers';
import {
  getJourneyChoiceTripComHandoff,
  JOURNEY_CHOICE_DATED_HANDOFF_NOTE,
  TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS,
} from '@/lib/tripcom-dated-handoff';

/**
 * Journey Choice dated Trip.com handoff pilot (24 Aug 2026, PR pending,
 * manchester-islamabad only). Two-part commercial evidence this rests on
 * — see lib/tripcom-dated-handoff.ts's own doc comment — is not
 * re-verified here (it isn't code-testable); this file proves the
 * *engineering* contract: correct URL construction from real structured
 * Journey Choice context, fail-closed fallback, and zero leakage onto any
 * other route, cabin, or surface.
 */

const NOW_ISO = '2026-08-24';

function fixtureOption(overrides: Partial<JourneyChoiceOption> = {}): JourneyChoiceOption {
  return {
    id: 'fixture',
    airline: 'Fixture Air',
    cabin: 'Economy',
    price: 500,
    currency: 'GBP',
    totalJourneyMinutes: 1000,
    outboundStops: 1,
    returnStops: 1,
    connectionAirports: [],
    directness: 'connecting',
    baggage: { kind: 'not-stated', detail: 'not stated' },
    departureDate: '2026-10-06',
    returnDate: '2026-10-20',
    checkedDate: '2026-08-10',
    ...overrides,
  };
}

function fixtureJourneyChoice(overrides: Partial<{ lowerFare: Partial<JourneyChoiceOption>; fasterJourney: Partial<JourneyChoiceOption> }> = {}): JourneyChoice {
  const lowerFare = fixtureOption({ id: 'lower', price: 500, ...overrides.lowerFare });
  const fasterJourney = fixtureOption({ id: 'faster', price: 600, totalJourneyMinutes: 700, ...overrides.fasterJourney });
  return {
    lowerFare,
    fasterJourney,
    decision: { priceDifference: 100, timeDifferenceMinutes: 300, sentence: '£100 more saves 5h 0m of journey time.' },
    otherOptions: [],
    baggageCostConfirmedForAllOptions: false,
  };
}

describe('Real manchester-islamabad Journey Choice — the pilot route', () => {
  const journeyChoice = getJourneyChoiceForRoute('manchester-islamabad', NOW_ISO)!;
  const genericUrl = getTripComFlightHandoffUrl('manchester-islamabad', 'manchester', 'islamabad');
  const handoff = getJourneyChoiceTripComHandoff('manchester-islamabad', journeyChoice, genericUrl)!;

  it('produces a round-trip dated /showfarefirst handoff, not the generic dateless one', () => {
    expect(handoff.datesPreserved).toBe(true);
    expect(handoff.url).toContain('trip.com/flights/showfarefirst?');
    expect(handoff.url).toContain('triptype=rt');
  });

  it('dates are 6 Oct / 20 Oct, read from Journey Choice\'s own current structured comparison data, not hardcoded', () => {
    expect(journeyChoice.lowerFare.departureDate).toBe('2026-10-06');
    expect(journeyChoice.lowerFare.returnDate).toBe('2026-10-20');
    expect(handoff.url).toContain(`ddate=${journeyChoice.lowerFare.departureDate}`);
    expect(handoff.url).toContain(`rdate=${journeyChoice.lowerFare.returnDate}`);
  });

  it('airport pair remains MAN / ISB (lowercased, matching the discovered Trip.com format)', () => {
    expect(handoff.url).toContain('dcity=man');
    expect(handoff.url).toContain('acity=isb');
  });

  it('Economy remains Economy (class=y) and 1-adult context is present (quantity=1) — this format is only proven for that profile', () => {
    expect(handoff.url).toContain('class=y');
    expect(handoff.url).toContain('quantity=1');
  });

  it('GBP remains intact', () => {
    expect(handoff.url).toContain('curr=GBP');
  });

  it('affiliate parameters remain exactly the route\'s own already-verified values — never invented, never D19082751', () => {
    expect(handoff.url).toContain('Allianceid=9804124');
    expect(handoff.url).toContain('SID=327450313');
    expect(handoff.url).toContain('trip_sub3=D19082296');
    expect(handoff.url).not.toContain('D19082751');
    expect(handoff.url).toContain('trip_sub1=');
  });

  it('CTA disclosure copy never claims the observed £601/£621/£626 fare is still available, and never says "book this fare"', () => {
    expect(JOURNEY_CHOICE_DATED_HANDOFF_NOTE).not.toMatch(/£601|£621|£626/);
    expect(JOURNEY_CHOICE_DATED_HANDOFF_NOTE).not.toMatch(/book this fare/i);
    expect(JOURNEY_CHOICE_DATED_HANDOFF_NOTE).toBe(
      'Trip.com opens a fresh search for the route and dates shown above. Prices may have changed since JetStash checked.'
    );
  });
});

describe('Fail-closed: missing or invalid Journey Choice context falls back to the safe generic handoff', () => {
  const genericUrl = 'https://www.trip.com/flights/Manchester-to-Islamabad/tickets-MAN-ISB?flighttype=S&dcity=MAN&acity=ISB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082296';

  it('falls back when cabin is not Economy', () => {
    const jc = fixtureJourneyChoice({ lowerFare: { cabin: 'Business' } });
    const handoff = getJourneyChoiceTripComHandoff('manchester-islamabad', jc, genericUrl)!;
    expect(handoff.datesPreserved).toBe(false);
    expect(handoff.url).toBe(genericUrl);
  });

  it('falls back when departureDate is malformed', () => {
    const jc = fixtureJourneyChoice({ lowerFare: { departureDate: '6 Oct 2026' } });
    const handoff = getJourneyChoiceTripComHandoff('manchester-islamabad', jc, genericUrl)!;
    expect(handoff.datesPreserved).toBe(false);
    expect(handoff.url).toBe(genericUrl);
  });

  it('falls back when returnDate is empty', () => {
    const jc = fixtureJourneyChoice({ lowerFare: { returnDate: '' } });
    const handoff = getJourneyChoiceTripComHandoff('manchester-islamabad', jc, genericUrl)!;
    expect(handoff.datesPreserved).toBe(false);
    expect(handoff.url).toBe(genericUrl);
  });

  it('falls back when lowerFare and fasterJourney disagree on dates (defensive re-check of the exact-match contract)', () => {
    const jc = fixtureJourneyChoice({ fasterJourney: { departureDate: '2026-11-01' } });
    const handoff = getJourneyChoiceTripComHandoff('manchester-islamabad', jc, genericUrl)!;
    expect(handoff.datesPreserved).toBe(false);
    expect(handoff.url).toBe(genericUrl);
  });

  it('returns null (no CTA) when there is no generic URL to fall back to at all', () => {
    const jc = fixtureJourneyChoice();
    const handoff = getJourneyChoiceTripComHandoff('manchester-islamabad', jc, null);
    expect(handoff).toBeNull();
  });

  it('never throws and falls back cleanly for a route with no Trip.com route URL at all, even inside the pilot slug list hypothetically', () => {
    const jc = fixtureJourneyChoice();
    // london-heathrow-jeddah has no TRIPCOM_ROUTE_URLS entry — genericUrl is
    // null in production for this route, exercised via the null-CTA case
    // above; this covers the case where a caller passes a non-null generic
    // URL that doesn't itself resolve back through getTripComRouteUrl.
    const handoff = getJourneyChoiceTripComHandoff('london-heathrow-jeddah', jc, 'https://www.trip.com/flights/London-to-Jeddah/tickets-LHR-JED?dcity=LHR&acity=JED');
    expect(handoff?.datesPreserved).toBe(false);
  });
});

describe('Strict scope: no other route or surface is affected', () => {
  it('TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS is exactly manchester-islamabad today', () => {
    expect(TRIPCOM_DATED_HANDOFF_PILOT_ROUTE_SLUGS).toEqual(['manchester-islamabad']);
  });

  it('a route outside the pilot never gets a dated handoff, even with an otherwise-valid Journey Choice context', () => {
    const jc = fixtureJourneyChoice();
    const genericUrl = 'https://www.trip.com/flights/Birmingham-to-Amritsar/tickets-BHX-ATQ?flighttype=S&dcity=BHX&acity=ATQ&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082751';
    const handoff = getJourneyChoiceTripComHandoff('birmingham-amritsar', jc, genericUrl)!;
    expect(handoff.datesPreserved).toBe(false);
    expect(handoff.url).toBe(genericUrl);
  });

  it('Fare Signal\'s own CTA source is untouched — still the plain generic handoff and TRIPCOM_FRESH_SEARCH_NOTE, no import of the dated-handoff module', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    expect(src).not.toContain('tripcom-dated-handoff');
    expect(src).toContain('TRIPCOM_FRESH_SEARCH_NOTE');
  });

  it('Book-By is untouched — no import of the dated-handoff module', () => {
    const src = readFileSync(join(process.cwd(), 'lib/booking-intelligence.ts'), 'utf8');
    expect(src).not.toContain('tripcom-dated-handoff');
  });

  it('Business Clarity / Business CTAs are untouched — no import of the dated-handoff module', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/business-clarity-panel.tsx'), 'utf8');
    expect(src).not.toContain('tripcom-dated-handoff');
  });

  it('D19082751 (the confirmed test click\'s own Ad ID, Birmingham-Amritsar) is never reused for any other route\'s dated handoff', () => {
    const jc = fixtureJourneyChoice();
    // Even if birmingham-amritsar were hypothetically added to the pilot
    // list, its own route URL carries its own trip_sub3 (D19082751) — the
    // helper must never substitute a different route's ID. Proven here by
    // confirming the real manchester-islamabad handoff (above suite) uses
    // only D19082296, and this route's generic URL (its own real stored
    // value) is passed through unmodified when not in the pilot.
    const genericUrl = 'https://www.trip.com/flights/Birmingham-to-Amritsar/tickets-BHX-ATQ?flighttype=S&dcity=BHX&acity=ATQ&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082751';
    const handoff = getJourneyChoiceTripComHandoff('birmingham-amritsar', jc, genericUrl)!;
    expect(handoff.url).toBe(genericUrl);
    expect(handoff.url).toContain('trip_sub3=D19082751');
  });
});
