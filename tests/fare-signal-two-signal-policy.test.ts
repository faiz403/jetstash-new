import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FareObservation } from '@/data/fare-observations';
import { fareObservations } from '@/data/fare-observations';
import { deriveFareSignal, getFareSignalForRoute } from '@/lib/fare-signal';
import { FareSignal } from '@/components/route/fare-signal';

const NOW = '2026-10-03';
const POLICY_NOW = '2026-10-04';

function observation(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture',
    routeSlug: 'fixture-route',
    cabin: 'Economy',
    observedDate: '2026-09-29',
    price: 175,
    priceNote: 'return, per person; self-transfer shown; connection detail shown: 19 hr 35 min layover at Fixture Airport;',
    source: 'Example airline',
    currency: 'GBP',
    profileId: 'fixture-economy-1adult-v1',
    comparisonEligibility: 'current',
    departureDate: '2026-11-17',
    returnDate: '2026-12-01',
    fareDirectness: 'connecting',
    outboundStops: 1,
    ...overrides,
  };
}

describe('two-signal fare policy', () => {
  it('uses the latest fresh, exact-profile non-self-transfer observation as primary while retaining a cheaper self-transfer as dated secondary evidence', () => {
    const selfTransfer = observation();
    const clean = observation({
      id: 'clean',
      observedDate: '2026-09-22',
      price: 233,
      priceNote: 'return, per person; one stop; single ticket',
      source: 'Clean airline',
    });
    const signal = deriveFareSignal([selfTransfer, clean], NOW);

    expect(signal.observation).toMatchObject({ id: 'clean', price: 233, isSelfTransfer: false, observedDate: '2026-09-22' });
    expect(signal.lowerSelfTransfer).toMatchObject({ id: 'fixture', price: 175, isSelfTransfer: true, observedDate: '2026-09-29', connectionDetail: '19 hr 35 min layover at Fixture Airport' });
  });

  it('uses the lowest in-window clean fare even when its comparison profile differs', () => {
    const selfTransfer = observation();
    const wrongProfile = observation({ id: 'wrong-profile', observedDate: '2026-09-22', price: 233, priceNote: 'single ticket', profileId: 'another-profile' });
    const wrongCabin = observation({ id: 'wrong-cabin', observedDate: '2026-09-22', price: 233, priceNote: 'single ticket', cabin: 'Business' });
    const wrongDates = observation({ id: 'wrong-dates', observedDate: '2026-09-22', price: 233, priceNote: 'single ticket', departureDate: '2026-11-18' });
    const signal = deriveFareSignal([selfTransfer, wrongProfile, wrongCabin, wrongDates], POLICY_NOW);

    expect(signal.observation?.id).toBe('wrong-dates');
    expect(signal.observation?.isSelfTransfer).toBe(false);
    expect(signal.lowerSelfTransfer?.id).toBe('fixture');
  });

  it('does not promote a clean observation outside the existing freshness window', () => {
    const selfTransfer = observation();
    const staleClean = observation({ id: 'stale-clean', observedDate: '2026-07-01', price: 233, priceNote: 'single ticket' });
    const signal = deriveFareSignal([selfTransfer, staleClean], NOW);

    expect(signal.observation?.id).toBe('fixture');
    expect(signal.lowerSelfTransfer).toBeNull();
  });

  it('keeps raw archive evidence unchanged while exposing lower self-transfer evidence separately', () => {
    const before = JSON.stringify(fareObservations);
    const signal = getFareSignalForRoute('glasgow-antalya', NOW);

    expect(signal.observation?.isSelfTransfer).toBe(true);
    expect(signal.lowerSelfTransfer).toBeNull();
    expect(JSON.stringify(fareObservations)).toBe(before);
  });

  it('renders both factual signals for Birmingham–Antalya without altering the booking CTA', () => {
    const signal = getFareSignalForRoute('birmingham-antalya', NOW);
    const text = renderToStaticMarkup(FareSignal({ signal, tripComUrl: null, routeSlug: 'birmingham-antalya' })).replace(/\s+/g, ' ');

    expect(signal.observation).toMatchObject({ id: 'obs-bhx-ayt-economy-20260922-v1', price: 233, airline: 'Turkish Airlines' });
    expect(signal.lowerSelfTransfer).toMatchObject({ id: 'obs-bhx-ayt-economy-20260929-v1', price: 175 });
    expect(text).toContain('Lowest comparable non-self-transfer fare observed');
    expect(text).toContain('Lower fare also seen: £175 return');
    expect(text).toContain('Self-transfer');
    expect(text).toContain('19 hr 35 min layover at Edinburgh Airport in Edinburgh');
    expect(text).toContain('checked 29 September 2026');
    expect(text).toContain('Search current flights');
  });
});
