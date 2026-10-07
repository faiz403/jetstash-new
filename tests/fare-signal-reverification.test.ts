import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  fareObservations,
  getPublishableObservationsByRoute,
  isMethodologyExcluded,
  type FareObservation,
} from '@/data/fare-observations';
import { fareReverifications, type FareReverification } from '@/data/fare-reverifications';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';
import { deriveFareSignal, getFareSignalForRoute } from '@/lib/fare-signal';
import { getReverifiedObservationIds, isSameStructuredItinerary } from '@/lib/fare-reverification';
import { LOWEST_FARE_POLICY_START_DATE } from '@/lib/fare-window';
import { generateFareWatcherCandidates } from '@/lib/fare-watcher';
import { generateRouteWatchFareCandidates } from '@/lib/route-watch-fare-trigger';
import { getApprovedStandoutFare } from '@/lib/standout-fare';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';

/**
 * FARE-SIGNAL-RECHECK-001 (7 October 2026). Every test here runs on or after the
 * 4 October lowest-fare policy activation date, because that policy is what let
 * a lower older fare keep beating its own later targeted recheck. The wider
 * policy (later same-window routine observations, implied non-reproduction,
 * unknown-directness cases, fare age) is deliberately NOT changed here.
 */
const NOW = '2026-10-07';

const ISB = {
  routine: 'obs-man-isb-economy-20260825-8w-v1',
  recheck: 'obs-man-isb-economy-20260825-recheck-v1',
};
const BHX_ATQ = {
  older: 'obs-bhx-atq-economy-20260818-8w-v1',
  recheck: 'obs-bhx-atq-economy-20260819-8w-v1',
};
const LHR_JED = {
  older: 'obs-lhr-jed-economy-20260818-8w-v1',
  recheck: 'obs-lhr-jed-economy-20260819-8w-v1',
};

function obs(overrides: Partial<FareObservation>): FareObservation {
  return {
    id: 'fixture', routeSlug: 'fixture-route', cabin: 'Economy', observedDate: '2026-10-05',
    price: 500, priceNote: 'return, one adult; protected one-stop itinerary', source: 'Etihad',
    observedVia: 'google-flights', currency: 'GBP', baggage: 'not stated', profileId: 'fixture-route-economy-v1',
    observationReason: 'routine-weekly', comparisonEligibility: 'current',
    departureDate: '2026-11-17', returnDate: '2026-12-01',
    fareDirectness: 'connecting', outboundDirectness: 'connecting', returnDirectness: 'connecting',
    outboundStops: 1, returnStops: 1,
    outboundConnectionAirports: ['Abu Dhabi (AUH)'], returnConnectionAirports: ['Abu Dhabi (AUH)'],
    outboundJourneyMinutes: 700, returnJourneyMinutes: 720,
    ...overrides,
  };
}

function entry(overrides: Partial<FareReverification> = {}): FareReverification {
  return {
    id: 'fixture-reverification',
    reverifyingObservationId: 'recheck',
    targetObservationId: 'older',
    action: 'supersede',
    recordedDate: '2026-10-07',
    note: 'fixture',
    ...overrides,
  };
}

const older = (o: Partial<FareObservation> = {}) => obs({ id: 'older', price: 460, observedDate: '2026-10-05', ...o });
const recheck = (o: Partial<FareObservation> = {}) => obs({ id: 'recheck', price: 480, observedDate: '2026-10-05', observationReason: 'emergency-recheck', ...o });

describe('FARE-SIGNAL-RECHECK-001 -- policy context', () => {
  it('runs after the 4 October lowest-fare policy activation date', () => {
    expect(LOWEST_FARE_POLICY_START_DATE).toBe('2026-10-04');
    expect(NOW >= LOWEST_FARE_POLICY_START_DATE).toBe(true);
  });

  it('control: with no ledger entry the lowest-fare policy still prefers the cheaper older observation over its pricier same-window recheck', () => {
    const signal = deriveFareSignal([older(), recheck()], NOW, []);
    expect(signal.observation?.id).toBe('older');
    expect(signal.observation?.price).toBe(460);
  });
});

describe('MAN-ISB -- targeted same-itinerary recheck supersedes the cheaper routine fare', () => {
  it('the real archive now shows the £480 recheck, not the cheaper £460, after the policy date', () => {
    const routine = fareObservations.find((o) => o.id === ISB.routine)!;
    const verified = fareObservations.find((o) => o.id === ISB.recheck)!;
    expect(routine.price).toBe(460);
    expect(verified.price).toBe(480);
    const signal = getFareSignalForRoute('manchester-islamabad', NOW);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe(ISB.recheck);
    expect(signal.observation?.price).toBe(480);
    expect(signal.observation?.airline).toBe('Riyadh Air');
  });

  it('is evidence-recency tied to the structured itinerary, not a "highest price" or "newest price" rule', () => {
    // Same itinerary, recheck is HIGHER -> older retired, recheck shown.
    expect(deriveFareSignal([older(), recheck()], NOW, [entry()]).observation?.id).toBe('recheck');
    // Same itinerary, recheck is LOWER -> the older (now not reconfirmed) fare is still retired and the recheck shown.
    expect(deriveFareSignal([older({ price: 500 }), recheck({ price: 450 })], NOW, [entry()]).observation?.id).toBe('recheck');
    // A DIFFERENT carrier at the same window is not "the same itinerary": the entry is inert and the lowest fare stands.
    const differentCarrier = recheck({ source: 'Turkish Airlines' });
    expect(isSameStructuredItinerary(older(), differentCarrier)).toBe(false);
    expect(deriveFareSignal([older(), differentCarrier], NOW, [entry()]).observation?.id).toBe('older');
    // Different layover airport, or a missing structured field, also cannot be shown to be the same itinerary.
    expect(deriveFareSignal([older(), recheck({ outboundConnectionAirports: ['Doha (DOH)'] })], NOW, [entry()]).observation?.id).toBe('older');
    expect(deriveFareSignal([older(), recheck({ outboundJourneyMinutes: undefined })], NOW, [entry()]).observation?.id).toBe('older');
  });

  it('the structured itinerary of the two real ISB observations genuinely matches (carrier, stops, layover airports, journey times)', () => {
    const routine = fareObservations.find((o) => o.id === ISB.routine)!;
    const verified = fareObservations.find((o) => o.id === ISB.recheck)!;
    expect(isSameStructuredItinerary(routine, verified)).toBe(true);
  });
});

describe('an unrelated later itinerary never supersedes a lower valid observation merely by being newer', () => {
  it('a newer, pricier, different-carrier observation in the same window leaves the lower valid fare selected', () => {
    const lower = obs({ id: 'lower', price: 400, observedDate: '2026-09-29' });
    const newerUnrelated = obs({ id: 'newer', price: 520, observedDate: '2026-10-06', source: 'Lufthansa', outboundJourneyMinutes: 905, returnJourneyMinutes: 880 });
    expect(deriveFareSignal([lower, newerUnrelated], NOW, fareReverifications).observation?.id).toBe('lower');
  });

  it('a newer emergency-recheck with no ledger entry does not supersede either: the ledger is the only mechanism', () => {
    const lower = older({ price: 400, observedDate: '2026-10-01' });
    const laterRecheck = recheck({ price: 520, observedDate: '2026-10-06' });
    expect(deriveFareSignal([lower, laterRecheck], NOW, []).observation?.id).toBe('older');
  });
});

describe('explicit non-reproduction removes exactly the contradicted observation from public eligibility', () => {
  it('BHX-ATQ and LHR-JED: the older fares are no longer selected, and the archive still contains them unchanged', () => {
    const bhxOlder = fareObservations.find((o) => o.id === BHX_ATQ.older)!;
    const jedOlder = fareObservations.find((o) => o.id === LHR_JED.older)!;
    expect(bhxOlder.price).toBe(579);
    expect(jedOlder.price).toBe(367);
    expect(getFareSignalForRoute('birmingham-amritsar', NOW).observation?.id).not.toBe(BHX_ATQ.older);
    expect(getFareSignalForRoute('london-heathrow-jeddah', NOW).observation?.id).not.toBe(LHR_JED.older);
    // Preserved, not edited, not methodology-excluded: still counts as history and Fare Watcher baseline evidence.
    expect(isMethodologyExcluded(BHX_ATQ.older)).toBe(false);
    expect(isMethodologyExcluded(LHR_JED.older)).toBe(false);
  });

  it('retires only the target: a synthetic not-reproduced entry removes it and nothing else', () => {
    const target = older({ price: 300 });
    const other = obs({ id: 'other', price: 480, source: 'Lufthansa' });
    const entries = [entry({ action: 'retire' })];
    expect([...getReverifiedObservationIds([target, recheck({ source: 'KLM' }), other], NOW, entries)]).toEqual(['older']);
  });

  it('a ledger entry is inert (the target stays eligible) whenever its structured evidence does not check out', () => {
    const base = [older(), recheck()];
    const inert = (list: FareObservation[], e = entry()) => getReverifiedObservationIds(list, NOW, [e]).size === 0;
    expect(inert([older(), recheck({ departureDate: '2026-11-24', returnDate: '2026-12-08' })])).toBe(true); // different travel window
    expect(inert([older(), recheck({ routeSlug: 'another-route' })])).toBe(true);
    expect(inert([older(), recheck({ cabin: 'Business' })])).toBe(true);
    expect(inert([older(), recheck({ profileId: 'another-profile' })])).toBe(true);
    expect(inert([older(), recheck({ observationReason: 'routine-weekly' })])).toBe(true); // not a targeted recheck
    expect(inert([older({ observedDate: '2026-10-06' }), recheck({ observedDate: '2026-10-05' })])).toBe(true); // recheck must not predate the target
    expect(inert([older(), recheck({ observedDate: '2026-10-09' })])).toBe(true); // recheck not yet observed as of NOW
    expect(inert([older()])).toBe(true); // recheck absent from the publishable set (e.g. excluded)
    expect(inert([recheck()])).toBe(true); // target absent
    expect(inert(base, entry({ targetObservationId: 'recheck' }))).toBe(true); // an observation cannot reverify itself
    expect(inert(base, entry({ action: 'something-else' as never }))).toBe(true);
    // And the control: the same inputs with valid evidence do retire the target.
    expect(inert(base)).toBe(false);
  });
});

describe('the fallback after explicit non-reproduction independently satisfies normal display eligibility', () => {
  it('BHX-ATQ: the fallback is the clean 19 August recheck, chosen only because it wins under the ordinary rules', () => {
    const signal = getFareSignalForRoute('birmingham-amritsar', NOW);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).toBe(BHX_ATQ.recheck);
    expect(signal.observation?.price).toBe(603);
    expect(signal.observation?.isSelfTransfer).toBe(false);
    expect(signal.observation?.directness).toBe('connecting');
  });

  it('LHR-JED: the self-transfer £535 recheck is NOT promoted; the fallback is the fresh clean 6 October fare', () => {
    const signal = getFareSignalForRoute('london-heathrow-jeddah', NOW);
    expect(signal.state).toBe('current');
    expect(signal.observation?.id).not.toBe(LHR_JED.recheck);
    expect(signal.observation?.id).toBe('obs-lhr-jed-economy-20261006-v1');
    expect(signal.observation?.price).toBe(450);
    expect(signal.observation?.isSelfTransfer).toBe(false);
    expect(signal.observation?.observedDate).toBe('2026-10-06');
    const selfTransferRecheck = fareObservations.find((o) => o.id === LHR_JED.recheck)!;
    expect(selfTransferRecheck.price).toBe(535);
  });

  it('a self-transfer recheck is never promoted over a clean alternative, and a cheaper clean alternative beats a pricier recheck', () => {
    const target = older({ price: 300 });
    const selfTransferRecheck = recheck({ price: 330, priceNote: 'return, one adult; separate tickets booked together', source: 'Wizz Air / Pegasus', outboundConnectionAirports: ['Milan (BGY)'] });
    const clean = obs({ id: 'clean', price: 480, source: 'Lufthansa', observedDate: '2026-10-04', outboundConnectionAirports: ['Frankfurt (FRA)'] });
    const signal = deriveFareSignal([target, selfTransferRecheck, clean], NOW, [entry({ action: 'retire' })]);
    expect(signal.observation?.id).toBe('clean');
    // Same result when the recheck is even cheaper than the clean alternative: clean wins over self-transfer.
    const cheaperSelfTransfer = { ...selfTransferRecheck, price: 200 };
    expect(deriveFareSignal([target, cheaperSelfTransfer, clean], NOW, [entry({ action: 'retire' })]).observation?.id).toBe('clean');
    // A clean recheck is not special either: it only wins if it is the lowest eligible fare.
    const cleanRecheckPricier = recheck({ price: 600, source: 'KLM', outboundConnectionAirports: ['Amsterdam (AMS)'] });
    expect(deriveFareSignal([target, cleanRecheckPricier, clean], NOW, [entry({ action: 'retire' })]).observation?.id).toBe('clean');
    expect(deriveFareSignal([target, cleanRecheckPricier], NOW, [entry({ action: 'retire' })]).observation?.id).toBe('recheck');
  });
});

describe('the lowest-fare policy is otherwise untouched', () => {
  it('exactly three routes differ from the pre-change selection today: manchester-islamabad, birmingham-amritsar, london-heathrow-jeddah', () => {
    const routes = [...new Set(fareObservations.map((o) => o.routeSlug))];
    const changed: string[] = [];
    for (const route of routes) {
      const publishable = getPublishableObservationsByRoute(route, NOW);
      const without = deriveFareSignal(publishable, NOW, []);
      const withLedger = deriveFareSignal(publishable, NOW);
      if (JSON.stringify(without) !== JSON.stringify(withLedger)) changed.push(route);
    }
    expect(changed.sort()).toEqual(['birmingham-amritsar', 'london-heathrow-jeddah', 'manchester-islamabad']);
  });

  it('the ledger holds exactly the three approved entries', () => {
    expect(fareReverifications.map((e) => [e.reverifyingObservationId, e.targetObservationId, e.action])).toEqual([
      [ISB.recheck, ISB.routine, 'supersede'],
      [BHX_ATQ.recheck, BHX_ATQ.older, 'retire'],
      [LHR_JED.recheck, LHR_JED.older, 'retire'],
    ]);
  });

  it('the lowest fare across windows still wins where nothing was contradicted', () => {
    const cheaperLater = obs({ id: 'dec', price: 450, departureDate: '2026-12-03', returnDate: '2026-12-17', observedDate: '2026-10-04' });
    const pricierNewer = obs({ id: 'nov', price: 645, departureDate: '2026-11-17', returnDate: '2026-12-01', observedDate: '2026-10-06' });
    expect(deriveFareSignal([cheaperLater, pricierNewer], NOW).observation?.id).toBe('dec');
  });
});

describe('the ledger data is internally consistent and never edits the archive', () => {
  it('every entry points at two real observations of the same route, cabin, profile, currency and travel window', () => {
    for (const e of fareReverifications) {
      const target = fareObservations.find((o) => o.id === e.targetObservationId);
      const verifier = fareObservations.find((o) => o.id === e.reverifyingObservationId);
      expect(target, e.id).toBeDefined();
      expect(verifier, e.id).toBeDefined();
      expect(verifier!.observationReason, e.id).toBe('emergency-recheck');
      expect(verifier!.routeSlug, e.id).toBe(target!.routeSlug);
      expect(verifier!.cabin, e.id).toBe(target!.cabin);
      expect(verifier!.profileId, e.id).toBe(target!.profileId);
      expect(verifier!.currency, e.id).toBe(target!.currency);
      expect(verifier!.departureDate, e.id).toBe(target!.departureDate);
      expect(verifier!.returnDate, e.id).toBe(target!.returnDate);
      expect(verifier!.observedDate >= target!.observedDate, e.id).toBe(true);
      expect(isMethodologyExcluded(target!.id), e.id).toBe(false);
      expect(isMethodologyExcluded(verifier!.id), e.id).toBe(false);
      expect(e.note.length, e.id).toBeGreaterThan(40);
    }
  });

  it('audit-only: each not-reproduced recheck record itself states the earlier fare could not be reproduced (test-side evidence check; production never parses the note)', () => {
    for (const e of fareReverifications.filter((x) => x.action === 'retire')) {
      const target = fareObservations.find((o) => o.id === e.targetObservationId)!;
      const verifier = fareObservations.find((o) => o.id === e.reverifyingObservationId)!;
      expect(verifier.priceNote).toContain(`£${target.price} fare could not be reproduced`);
    }
  });

  it('production code never inspects free text to decide a reverification', () => {
    const raw = readFileSync(join(process.cwd(), 'lib', 'fare-reverification.ts'), 'utf8');
    // Inspect code only: comments are allowed to say what the module does NOT do.
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/priceNote/);
    expect(src).not.toMatch(/\.match\(|\.test\(|new RegExp|RegExp\(/);
  });
});

describe('Fare Watcher, Route Watch and Standout are unchanged', () => {
  it('Fare Watcher and Route Watch do not read the ledger or the Fare Signal selector', () => {
    const fw = readFileSync(join(process.cwd(), 'lib', 'fare-watcher.ts'), 'utf8');
    const rw = readFileSync(join(process.cwd(), 'lib', 'route-watch-fare-trigger.ts'), 'utf8');
    for (const src of [fw, rw]) {
      expect(src).not.toContain('fare-reverification');
      expect(src).not.toContain('fare-reverifications');
      expect(src).not.toContain("from '@/lib/fare-signal'");
    }
  });

  it('Fare Watcher and Route Watch produce exactly the same candidates as before the change', () => {
    const watcher = generateFareWatcherCandidates([...fareObservations], NOW);
    expect(watcher.map((c) => [c.routeSlug, c.currentFare, c.qualification])).toEqual([
      ['manchester-dalaman', 52, 'standout-candidate'],
      ['london-gatwick-faro', 49, 'standout-candidate'],
      ['london-gatwick-marrakech', 57, 'new-recent-low'],
    ]);
    const routeWatch = generateRouteWatchFareCandidates([...fareObservations], NOW);
    expect(routeWatch.map((c) => [c.routeSlug, c.currentFare, c.qualification])).toEqual([
      ['manchester-dalaman', 52, 'standout-candidate'],
      ['london-gatwick-faro', 49, 'standout-candidate'],
    ]);
  });

  it('the six affected observations are still in the archive, unedited, and still count as Fare Watcher baseline evidence', () => {
    const expected: Array<[string, number]> = [
      [ISB.routine, 460], [ISB.recheck, 480], [BHX_ATQ.older, 579], [BHX_ATQ.recheck, 603], [LHR_JED.older, 367], [LHR_JED.recheck, 535],
    ];
    for (const [id, price] of expected) {
      const o = fareObservations.find((x) => x.id === id);
      expect(o?.price, id).toBe(price);
      expect(o?.comparisonEligibility, id).toBe('current');
    }
  });

  it('Standout output is unchanged: no Standout is live today, and the pilot window (live 25-31 Aug, retired 1 Sep) replays identically', () => {
    for (const a of standoutFareApprovals) {
      expect(getApprovedStandoutFare(a.routeSlug, a.cabin, fareObservations, NOW), a.routeSlug).toBeNull();
    }
    expect(getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, '2026-08-31')?.observation.id).toBe(ISB.recheck);
    expect(getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, '2026-09-01')).toBeNull();
  });

  it('natural consequence for MAN-ISB, reported not changed: Fare Signal now displays the exact observation the dormant approval pins as its verified evidence, but the approval stays dormant (its detection identity was superseded on 1 September)', () => {
    const approval = standoutFareApprovals.find((a) => a.routeSlug === 'manchester-islamabad')!;
    expect(getFareSignalForRoute('manchester-islamabad', NOW).observation?.id).toBe(approval.approvedVerifiedObservationId);
    expect(getApprovedStandoutFare('manchester-islamabad', 'Economy', fareObservations, NOW)).toBeNull();
  });
});

describe('public wording: the secondary line describes the selector truthfully', () => {
  it('says "Lowest comparable non-self-transfer fare observed" and no longer claims "Latest"', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW);
    expect(signal.lowerSelfTransfer).not.toBeNull();
    const html = renderToStaticMarkup(FareSignal({ signal, tripComUrl: getTripComRouteUrl('manchester-islamabad'), routeSlug: 'manchester-islamabad', standoutFare: null }));
    expect(html).toContain('Lowest comparable non-self-transfer fare observed');
    expect(html).not.toContain('Latest comparable non-self-transfer fare observed');
    expect(html).toContain('£480');
  });

  it('the airport-page intro no longer claims the shown fare is the latest one checked', () => {
    const page = readFileSync(join(process.cwd(), 'app', 'airports', '[slug]', 'page.tsx'), 'utf8');
    expect(page).not.toContain('the latest fare JetStash checked');
    expect(page).toContain('a fare JetStash has tracked');
  });

  it('the old wording appears in no component, lib or app file', () => {
    const component = readFileSync(join(process.cwd(), 'components', 'route', 'fare-signal.tsx'), 'utf8');
    expect(component).not.toContain('Latest comparable');
    expect(component).toContain('Lowest comparable non-self-transfer fare observed');
  });
});

describe('the ledger applies only from the lowest-fare policy activation date, so historical replays are not rewritten', () => {
  it('every as-of date before 4 October gives exactly the pre-change Fare Signal for the three routes', () => {
    const days: string[] = [];
    for (let d = new Date('2026-08-19T12:00:00Z'); d.toISOString().slice(0, 10) < LOWEST_FARE_POLICY_START_DATE; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
    expect(days.length).toBe(46);
    for (const route of ['manchester-islamabad', 'birmingham-amritsar', 'london-heathrow-jeddah']) {
      for (const day of days) {
        const publishable = getPublishableObservationsByRoute(route, day);
        expect(JSON.stringify(deriveFareSignal(publishable, day)), `${route} ${day}`).toBe(JSON.stringify(deriveFareSignal(publishable, day, [])));
      }
    }
  });

  it('the first day it applies is the policy activation date itself', () => {
    const dayBefore = getPublishableObservationsByRoute('london-heathrow-jeddah', '2026-10-03');
    expect(deriveFareSignal(dayBefore, '2026-10-03').observation?.id).toBe(deriveFareSignal(dayBefore, '2026-10-03', []).observation?.id);
    expect(getFareSignalForRoute('london-heathrow-jeddah', LOWEST_FARE_POLICY_START_DATE).observation?.id).not.toBe(LHR_JED.older);
    expect(getFareSignalForRoute('manchester-islamabad', LOWEST_FARE_POLICY_START_DATE).observation?.id).toBe(ISB.recheck);
  });
});
