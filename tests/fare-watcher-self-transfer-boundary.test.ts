import { describe, expect, it } from 'vitest';
import type { DealCabin } from '@/data/deals';
import { fareObservations, type FareObservation } from '@/data/fare-observations';
import { standoutFareApprovals } from '@/data/standout-fare-approvals';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';
import { generateFareWatcherCandidates, qualifyFareWatcherObservation, type FareWatcherCandidate } from '@/lib/fare-watcher';
import { generateRouteWatchFareCandidates } from '@/lib/route-watch-fare-trigger';
import { deriveApprovedStandoutFare } from '@/lib/standout-fare';

/**
 * FWATCH-ST-001 (7 October 2026) -- the narrow behavioural boundary of the fix.
 *
 * Fare Watcher reads self-transfer / separate-ticket evidence from an
 * observation's `priceNote` ONLY through the existing isSelfTransferItinerary()
 * detector. The fix has exactly three effects, and these tests pin each one and
 * pin what it must NOT do:
 *   1. same-day tie: a clean fare beats a (cheaper) self-transfer one;
 *   2. a self-transfer observation is never itself a candidate;
 *   3. a self-transfer recheck is never the evaluated fare of a candidate.
 * Explicitly NOT changed (and proven unchanged below): baseline membership,
 * medians, previous lows, thresholds, booking-horizon rules, Standout behaviour,
 * and the set of routes that can produce a candidate (the fix may only remove).
 */

const SELF_TRANSFER_NOTE = 'return, one adult; self-transfer; outbound 2 stops';
const CLEAN_NOTE = 'return, one adult';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same fixed 8-week-horizon / 14-night convention as the other Fare Watcher tests. */
function obs(id: string, observedDate: string, price: number, overrides: Partial<FareObservation> = {}): FareObservation {
  const departureDate = addDays(observedDate, 56);
  return {
    id, routeSlug: 'fixture-route', cabin: 'Economy', observedDate, price, priceNote: CLEAN_NOTE, source: 'Example',
    observedVia: 'google-flights', sourceUrl: 'https://example.test', currency: 'GBP', baggage: 'not stated', profileId: 'fixture-v1',
    observationReason: 'routine-weekly', comparisonEligibility: 'current', departureDate, returnDate: addDays(departureDate, 14),
    fareDirectness: 'connecting', ...overrides,
  };
}

const baseline = () => [obs('b1', '2026-07-01', 500), obs('b2', '2026-07-02', 510), obs('b3', '2026-07-03', 520)];
const NOW = '2026-08-11';

describe('1. same-day selection: a cheaper self-transfer observation cannot beat a clean one', () => {
  it('the clean observation is the detection and the evaluated fare, regardless of array order', () => {
    const clean = obs('clean', '2026-08-10', 450);
    const flagged = obs('flagged', '2026-08-10', 380, { priceNote: SELF_TRANSFER_NOTE });
    for (const archive of [[flagged, clean, ...baseline()], [clean, flagged, ...baseline()]]) {
      const candidates = generateFareWatcherCandidates(archive, NOW);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({ id: 'fare-watcher-clean', currentFare: 450, qualification: 'standout-candidate' });
      expect(candidates[0].verifiedObservation.id).toBe('clean');
    }
  });

  it('a self-transfer observation still wins a same-day tie when no clean observation exists, but then yields no candidate', () => {
    const flaggedLow = obs('flagged-low', '2026-08-10', 380, { priceNote: SELF_TRANSFER_NOTE });
    const flaggedHigh = obs('flagged-high', '2026-08-10', 450, { priceNote: SELF_TRANSFER_NOTE });
    expect(generateFareWatcherCandidates([flaggedHigh, flaggedLow, ...baseline()], NOW)).toEqual([]);
  });
});

describe('2. a self-transfer observation never becomes a Fare Watcher candidate', () => {
  it('a self-transfer-only identity with an otherwise qualifying price produces no candidate', () => {
    const flagged = obs('flagged', '2026-08-10', 380, { priceNote: SELF_TRANSFER_NOTE });
    // Evaluated directly the price would qualify -- the exclusion is at candidate selection, not a baseline change.
    expect(qualifyFareWatcherObservation(flagged, [flagged, ...baseline()], NOW).qualification).toBe('standout-candidate');
    expect(generateFareWatcherCandidates([flagged, ...baseline()], NOW)).toEqual([]);
  });

  it('a newer self-transfer observation retires an older clean lead (the stale clean fare is never resurrected)', () => {
    const olderClean = obs('older-clean', '2026-08-03', 400);
    const newerFlagged = obs('newer-flagged', '2026-08-10', 380, { priceNote: SELF_TRANSFER_NOTE });
    expect(generateFareWatcherCandidates([olderClean, ...baseline()], NOW).map((c) => c.id)).toEqual(['fare-watcher-older-clean']);
    expect(generateFareWatcherCandidates([olderClean, newerFlagged, ...baseline()], NOW)).toEqual([]);
  });

  it('uses the existing detector: "no self-transfer" wording is a clean observation and can still be a candidate', () => {
    const negated = obs('negated', '2026-08-10', 400, { priceNote: 'return, one adult; no self-transfer or separate-ticket notice shown' });
    expect(isSelfTransferItinerary(negated.priceNote)).toBe(false);
    expect(generateFareWatcherCandidates([negated, ...baseline()], NOW).map((c) => c.id)).toEqual(['fare-watcher-negated']);
    for (const note of ['self-transfer', 'Separate tickets booked together', 'separate tickets or self-transfer (the exact badge text shown on the row was not recorded on the day)']) {
      expect(isSelfTransferItinerary(note), note).toBe(true);
      expect(generateFareWatcherCandidates([obs('x', '2026-08-10', 400, { priceNote: note }), ...baseline()], NOW), note).toEqual([]);
    }
  });
});

describe('3. a self-transfer recheck never becomes the evaluated fare', () => {
  const detection = () => obs('detection', '2026-08-10', 400);

  it('a clean detection whose only recheck is self-transfer yields no candidate (retired, not evaluated on the flagged price)', () => {
    const flaggedRecheck = obs('flagged-recheck', '2026-08-10', 380, { observationReason: 'emergency-recheck', priceNote: SELF_TRANSFER_NOTE });
    expect(generateFareWatcherCandidates([detection(), ...baseline()], NOW)).toHaveLength(1);
    expect(generateFareWatcherCandidates([detection(), flaggedRecheck, ...baseline()], NOW)).toEqual([]);
  });

  it('same day, a clean recheck outranks a cheaper self-transfer recheck and is the evaluated fare', () => {
    const cleanRecheck = obs('clean-recheck', '2026-08-10', 430, { observationReason: 'emergency-recheck' });
    const flaggedRecheck = obs('flagged-recheck', '2026-08-10', 380, { observationReason: 'emergency-recheck', priceNote: SELF_TRANSFER_NOTE });
    for (const archive of [[detection(), flaggedRecheck, cleanRecheck, ...baseline()], [detection(), cleanRecheck, flaggedRecheck, ...baseline()]]) {
      const [candidate] = generateFareWatcherCandidates(archive, NOW);
      expect(candidate).toMatchObject({ id: 'fare-watcher-detection', currentFare: 430, checkedDate: '2026-08-10' });
      expect(candidate.verifiedObservation.id).toBe('clean-recheck');
    }
  });
});

describe('clean observations qualify exactly as before; baselines and medians are untouched', () => {
  it('a clean candidate over a clean baseline is unchanged', () => {
    const [candidate] = generateFareWatcherCandidates([obs('c', '2026-08-10', 400), ...baseline()], NOW);
    expect(candidate).toMatchObject({ currentFare: 400, qualification: 'standout-candidate', baselineMedian: 510, previousLow: 500, differencePounds: 110, baselineSampleSize: 3 });
    expect(candidate.differencePercent).toBeCloseTo(21.568, 2);
  });

  it('self-transfer observations REMAIN in a clean candidate\'s baseline (baseline membership and median are not changed by this fix)', () => {
    const mixed = [obs('b1', '2026-07-01', 500), obs('b2', '2026-07-02', 300, { priceNote: SELF_TRANSFER_NOTE }), obs('b3', '2026-07-03', 520), obs('b4', '2026-07-04', 510)];
    const clean = obs('c', '2026-08-10', 400);
    const [candidate] = generateFareWatcherCandidates([clean, ...mixed], NOW);
    expect(candidate.baselineSampleSize).toBe(4);
    expect(candidate.baselineMedian).toBe(505); // median of 300, 500, 510, 520 -- the flagged GBP 300 is still counted
    expect(candidate.previousLow).toBe(300);
    expect(candidate.qualification).toBe('notable-drop');
    // Baseline membership is reported by the qualification result: the flagged point is a member and no exclusion is recorded for it.
    const result = qualifyFareWatcherObservation(clean, [clean, ...mixed], NOW);
    expect(result.comparableBaseline.map((b) => b.id)).toEqual(expect.arrayContaining(['b1', 'b2', 'b3', 'b4']));
    expect(result.exclusions.some((e) => e.observationId === 'b2')).toBe(false);
  });
});

/**
 * The code reads `priceNote` only through isSelfTransferItinerary(), so running the
 * same code on an archive whose notes carry no self-transfer evidence reproduces the
 * behaviour from before the fix exactly. That gives a real-archive proof that the
 * fix can only REMOVE leads, never create or alter one.
 */
describe('real archive: the fix can only remove leads', () => {
  const neutral: FareObservation[] = fareObservations.map((o) => ({ ...o, priceNote: 'neutralised' }));
  const days: string[] = [];
  for (let d = '2026-08-11'; d <= '2026-10-07'; d = addDays(d, 1)) days.push(d);

  const figures = (c: FareWatcherCandidate) => [c.currentFare, c.baselineMedian, c.previousLow, c.baselineSampleSize, c.qualification, c.differencePounds, c.verifiedObservation.id].join('|');

  it('on every day from 11 August to 7 October the candidate routes are a subset of the pre-fix routes, and every candidate with an unchanged identity has identical figures', () => {
    let removedSomewhere = 0;
    for (const d of days) {
      const after = generateFareWatcherCandidates([...fareObservations], d);
      const before = generateFareWatcherCandidates(neutral, d);
      const beforeRoutes = new Set(before.map((c) => c.routeSlug));
      for (const c of after) {
        expect(beforeRoutes.has(c.routeSlug), `${d} ${c.routeSlug} is a NEW candidate route`).toBe(true);
        const same = before.find((b) => b.id === c.id);
        if (same) expect(figures(c), `${d} ${c.id}`).toBe(figures(same));
      }
      removedSomewhere += before.length - after.length;
    }
    expect(removedSomewhere).toBeGreaterThan(0); // the fix does remove something on this archive
  });

  it('Route Watch is likewise a subset on every day', () => {
    for (const d of days) {
      const after = generateRouteWatchFareCandidates([...fareObservations], d).map((c) => c.routeSlug);
      const before = new Set(generateRouteWatchFareCandidates(neutral, d).map((c) => c.routeSlug));
      for (const slug of after) expect(before.has(slug), `${d} ${slug}`).toBe(true);
    }
  });

  it('public Standout behaviour is identical on every day for every approval in the ledger', () => {
    const view = (archive: readonly FareObservation[], slug: string, cabin: DealCabin, d: string) => {
      const s = deriveApprovedStandoutFare(standoutFareApprovals, slug, cabin, archive, d);
      return s ? [s.observation.id, s.observation.price, s.baselineMedian, s.differencePounds, s.qualification].join('|') : null;
    };
    for (const approval of standoutFareApprovals) {
      for (const d of days.filter((x) => x >= '2026-08-25')) {
        expect(view(fareObservations, approval.routeSlug, approval.cabin, d), `${approval.id} ${d}`).toBe(view(neutral, approval.routeSlug, approval.cabin, d));
      }
    }
  });

  // Regression expectations for the CURRENT archive only -- never encoded in application logic.
  it('current archive (7 October 2026): the three self-transfer-derived leads are gone and nothing is added', () => {
    const fw = generateFareWatcherCandidates([...fareObservations], '2026-10-07').map((c) => c.routeSlug).sort();
    const rw = generateRouteWatchFareCandidates([...fareObservations], '2026-10-07').map((c) => c.routeSlug).sort();
    expect(fw).toEqual(['london-gatwick-faro', 'london-gatwick-marrakech', 'manchester-dalaman']);
    expect(rw).toEqual(['london-gatwick-faro', 'manchester-dalaman']);
    const before = generateFareWatcherCandidates(neutral, '2026-10-07').map((c) => c.routeSlug).sort();
    expect(before).toEqual(['birmingham-dubai', 'london-gatwick-athens', 'london-gatwick-faro', 'london-gatwick-marrakech', 'london-gatwick-tangier', 'manchester-dalaman']);
    expect(fw.every((slug) => before.includes(slug))).toBe(true);
    // The retained candidates keep the medians and baselines they had before the fix.
    const afterC = generateFareWatcherCandidates([...fareObservations], '2026-10-07');
    const beforeC = generateFareWatcherCandidates(neutral, '2026-10-07');
    for (const c of afterC) {
      const b = beforeC.find((x) => x.routeSlug === c.routeSlug)!;
      expect([c.baselineMedian, c.baselineSampleSize, c.previousLow, c.qualification]).toEqual([b.baselineMedian, b.baselineSampleSize, b.previousLow, b.qualification]);
    }
  });
});
