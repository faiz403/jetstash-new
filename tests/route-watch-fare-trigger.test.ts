import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fareObservations, type FareObservation } from '@/data/fare-observations';
import { generateRouteWatchFareCandidates } from '@/lib/route-watch-fare-trigger';
import { qualifyFareWatcherObservation } from '@/lib/fare-watcher';
import { ROUTE_WATCH_INTENT_OPTIONS, isRouteWatchIntent } from '@/lib/route-watch-options';
import { ROUTE_WATCH_INITIAL_COPY } from '@/lib/route-watch-config';
import { getFounderSnapshot } from '@/lib/founder-insights';

/**
 * Route Watch meaningful lower-fare trigger (PR #143, August 2026).
 *
 * The one rule this file exists to lock in: Route Watch reuses Fare
 * Watcher's existing, already-reviewed evidence engine (lib/fare-watcher.ts)
 * completely unchanged — it never invents a second, looser threshold just
 * to keep the Route Watch queue non-empty. A bare 'new-recent-low' (clears
 * the previous-low bar but not both meaningful-drop thresholds together)
 * must never enter this queue, even though it remains valid Fare Watcher
 * intelligence elsewhere. See docs/project-control/ROUTE_WATCH_PILOT_PROCEDURE.md.
 */

const routeWatchFareTriggerSrc = readFileSync(join(process.cwd(), 'lib', 'route-watch-fare-trigger.ts'), 'utf8');
const founderInsightsSrc = readFileSync(join(process.cwd(), 'lib', 'founder-insights.ts'), 'utf8');
const procedureDoc = readFileSync(join(process.cwd(), 'docs', 'project-control', 'ROUTE_WATCH_PILOT_PROCEDURE.md'), 'utf8');

function fixture(overrides: Partial<FareObservation> = {}): FareObservation {
  return {
    id: 'fixture', routeSlug: 'fixture-route', cabin: 'Economy', observedDate: '2026-08-10',
    price: 500, priceNote: 'return, one adult', source: 'Example', observedVia: 'google-flights',
    sourceUrl: 'https://example.test', currency: 'GBP', baggage: 'not stated', profileId: 'fixture-v1',
    observationReason: 'routine-weekly', comparisonEligibility: 'current', departureDate: '2026-10-05', returnDate: '2026-10-19', fareDirectness: 'connecting',
    ...overrides,
  };
}

function baselineFixture(id: string, observedDate: string, departureDate: string, price: number, routeSlug = 'fixture-route'): FareObservation {
  const returnDate = new Date(`${departureDate}T12:00:00Z`);
  returnDate.setUTCDate(returnDate.getUTCDate() + 14);
  return fixture({ id, routeSlug, observedDate, departureDate, returnDate: returnDate.toISOString().slice(0, 10), price });
}

describe('A. Public intent wording', () => {
  it('the customer-facing label is exactly "I care most about a lower fare"', () => {
    const opt = ROUTE_WATCH_INTENT_OPTIONS.find((o) => o.value === 'best-fare');
    expect(opt?.label).toBe('I care most about a lower fare');
  });

  it('the stored slug/value remains "best-fare" — no Brevo data migration required', () => {
    expect(isRouteWatchIntent('best-fare')).toBe(true);
  });

  it('the label never claims best market price, cheapest fare, continuous monitoring or automatic alerts', () => {
    const label = ROUTE_WATCH_INTENT_OPTIONS.find((o) => o.value === 'best-fare')!.label;
    expect(label.toLowerCase()).not.toMatch(/\bbest\b/);
    expect(label.toLowerCase()).not.toMatch(/cheapest/);
    expect(label.toLowerCase()).not.toMatch(/automatic|continuous|live|guarantee/);
  });

  it('the existing "not an automatic price-drop alert" disclaimer is unchanged by this PR', () => {
    expect(ROUTE_WATCH_INITIAL_COPY).toMatch(/not an automatic price-drop alert/i);
  });
});

describe('B–G. Route Watch fare-candidate gate — only clears when Fare Watcher\'s strong threshold is met', () => {
  const strongBaseline = [
    baselineFixture('a', '2026-08-01', '2026-09-26', 500),
    baselineFixture('b', '2026-08-02', '2026-09-27', 510),
    baselineFixture('c', '2026-08-03', '2026-09-28', 520),
  ]; // median 510

  it('B. a standout candidate (clears >=£25 AND >=10% below median, and is a new low) enters the queue', () => {
    const candidate = fixture({ id: 'standout', price: 400 }); // -110 / -21.6%, below previous low 500
    const all = [candidate, ...strongBaseline];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.qualification).toBe('standout-candidate');

    const queued = generateRouteWatchFareCandidates(all, '2026-08-11');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ routeSlug: 'fixture-route', currentFare: 400, qualification: 'standout-candidate' });
  });

  it('B2. a notable drop (clears both thresholds but is not a new low) also enters the queue', () => {
    // median 510, previousLow 500. price 450: -60/-11.76%, clears both thresholds, but 450 < 500 so it IS a new low too —
    // construct a case that clears both thresholds without being a new low by raising previousLow above the candidate only via a tighter baseline.
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 440), // previous low, but NOT what median drops against alone
      baselineFixture('b', '2026-08-02', '2026-09-27', 560),
      baselineFixture('c', '2026-08-03', '2026-09-28', 560),
    ]; // median 560, previousLow 440
    const candidate = fixture({ id: 'notable', price: 450 }); // vs median 560: -110/-19.6% (clears both), but 450 > previousLow 440 so NOT a new low
    const all = [candidate, ...baseline];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.qualification).toBe('notable-drop');

    const queued = generateRouteWatchFareCandidates(all, '2026-08-11');
    expect(queued).toHaveLength(1);
    expect(queued[0].qualification).toBe('notable-drop');
  });

  it('C. clears >=£25 but not >=10% below median → does NOT enter the queue', () => {
    // median 1000 baseline, candidate 977 -> diff 23... use larger baseline to isolate axes.
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 1000),
      baselineFixture('b', '2026-08-02', '2026-09-27', 1000),
      baselineFixture('c', '2026-08-03', '2026-09-28', 1000),
    ]; // median 1000
    const candidate = fixture({ id: 'pound-only', price: 970 }); // -£30 (>=25) but only -3% (<10%)
    const all = [candidate, ...baseline];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.differencePounds).toBe(30);
    expect(result.differencePercent).toBeCloseTo(3, 1);
    expect(result.qualification).not.toBe('standout-candidate');
    expect(result.qualification).not.toBe('notable-drop');

    expect(generateRouteWatchFareCandidates(all, '2026-08-11')).toHaveLength(0);
  });

  it('D. clears >=10% but not >=£25 below median → does NOT enter the queue', () => {
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 100),
      baselineFixture('b', '2026-08-02', '2026-09-27', 100),
      baselineFixture('c', '2026-08-03', '2026-09-28', 100),
    ]; // median 100
    const candidate = fixture({ id: 'percent-only', price: 89 }); // -£11 (<25) but -11% (>=10%)
    const all = [candidate, ...baseline];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.differencePounds).toBe(11);
    expect(result.differencePercent).toBeCloseTo(11, 1);
    expect(result.qualification).not.toBe('standout-candidate');
    expect(result.qualification).not.toBe('notable-drop');

    expect(generateRouteWatchFareCandidates(all, '2026-08-11')).toHaveLength(0);
  });

  it('E. new-recent-low without clearing the strong threshold → does NOT enter the queue (the real Manchester-Lahore case)', () => {
    // Reproduces the real archive shape: 574 vs median 620, previous low 578 — a new low, only 7.4% below median.
    const baseline = [
      baselineFixture('a', '2026-08-01', '2026-09-26', 578),
      baselineFixture('b', '2026-08-02', '2026-09-27', 620),
      baselineFixture('c', '2026-08-03', '2026-09-28', 645),
    ]; // median 620, previousLow 578
    const candidate = fixture({ id: 'new-low', price: 574 });
    const all = [candidate, ...baseline];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.qualification).toBe('new-recent-low');
    expect(result.differencePercent).toBeLessThan(10);

    expect(generateRouteWatchFareCandidates(all, '2026-08-11')).toHaveLength(0);
  });

  it('F. an ordinary fare → does NOT enter the queue', () => {
    const candidate = fixture({ id: 'ordinary', price: 505 });
    const all = [candidate, ...strongBaseline];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.qualification).toBe('ordinary-fare');
    expect(generateRouteWatchFareCandidates(all, '2026-08-11')).toHaveLength(0);
  });

  it('G. insufficient baseline (< 3 comparable prior observations) → does NOT enter the queue', () => {
    const candidate = fixture({ id: 'thin', price: 400 });
    const all = [candidate, baselineFixture('a', '2026-08-01', '2026-09-26', 500)];
    const result = qualifyFareWatcherObservation(candidate, all, '2026-08-11');
    expect(result.qualification).toBe('insufficient-baseline');
    expect(generateRouteWatchFareCandidates(all, '2026-08-11')).toHaveLength(0);
  });

  it('never redeclares Fare Watcher\'s own threshold constants — only calls into its exports', () => {
    // The derivation must call generateFareWatcherCandidates from fare-watcher.ts, never
    // redeclare a new MIN_DROP-style constant or threshold assignment of its own. Mentioning
    // the numbers in a doc comment (referencing FARE_WATCHER_MIN_DROP_POUNDS/PERCENT by name)
    // is fine — a new executable threshold constant is not.
    expect(routeWatchFareTriggerSrc).toContain("from '@/lib/fare-watcher'");
    expect(routeWatchFareTriggerSrc).toContain('generateFareWatcherCandidates(');
    expect(routeWatchFareTriggerSrc).not.toMatch(/export const \w*(THRESHOLD|MIN_DROP|MIN_BASELINE)\w*\s*=/i);
    expect(routeWatchFareTriggerSrc).not.toMatch(/=\s*25\s*[;,)]/); // no new "= 25" threshold assignment
    expect(routeWatchFareTriggerSrc).not.toMatch(/=\s*10\s*[;,)]/); // no new "= 10" threshold assignment
  });
});

describe('Real archive expectation (19 August 2026, post-supersession-fix) — one genuine notable-drop candidate, from real evidence, is the honest, expected result', () => {
  // Superseded by the Fare Watcher Current-Candidate Supersession fix
  // (see lib/fare-watcher.ts's latestCurrentObservationsByIdentity doc
  // comment, 19 August 2026): the 18 August £579/£367 standout-candidate
  // observations for birmingham-amritsar and london-heathrow-jeddah both
  // triggered a same-profile verification recheck the next day
  // (observationReason: 'emergency-recheck', logged 2026-08-19). Neither
  // £579 nor £367 could be reproduced; the fresh, honest results were
  // £603 and £535 respectively. Once logged, the supersession fix
  // correctly stops treating the no-longer-reproducible 18 August
  // observations as active candidates in favour of the fresh 19 August
  // ones — exactly the "expire when source availability no longer
  // supports the claim" behaviour FARE_WATCHER_DESIGN.md always described
  // but this fix was the first to implement. Of the two fresh 19 August
  // observations, birmingham-amritsar's £603 still clears the meaningful-
  // drop threshold against its own comparable median (as 'notable-drop',
  // not 'standout-candidate' — a smaller but still real margin);
  // london-heathrow-jeddah's £535 does not clear it at all. One genuine,
  // currently-reproducible candidate was the correct result before the
  // 25 August controlled weekly batch. That batch intentionally adds three
  // new standout candidates and one notable drop, all founder-review-only.
  //
  // 1 September 2026 Tuesday weekly batch update: this test's `nowIso` is
  // the live clock date, so it honestly re-derives against the current
  // archive rather than pinning a historical snapshot. Four routine
  // observations qualified past the meaningful-drop threshold this week
  // (manchester-islamabad, manchester-lahore, birmingham-amritsar,
  // london-heathrow-doha) and each got a same-day emergency recheck per
  // established policy; birmingham-amritsar's own recheck (£562) came back
  // even lower than its routine check (£587) -- a new recent low as well as
  // a meaningful drop -- so Fare Watcher's verified-candidate evaluation
  // (which always evaluates through the matching recheck when one exists,
  // per PR #184) correctly upgrades it from 'notable-drop' to
  // 'standout-candidate' alongside the other three. london-heathrow-jeddah's
  // £464 routine check does not clear the meaningful-drop threshold this
  // week, so it's honestly no longer one of the four current candidates —
  // both are genuine consequences of new evidence, not loosened assertions.
  //
  // Tuesday full weekly refresh, remaining 73 routes: three further routes'
  // routine checks independently cleared the same standout threshold —
  // london-heathrow-delhi (£403), manchester-doha (£257) and
  // manchester-madinah (£313) — the same trigger FARE_WATCHER_DESIGN.md's
  // candidate-flow step 4 and the established 25 Aug/1 Sep precedent apply
  // to every qualifying candidate, not only a controlled batch, so all three
  // got the same same-day emergency recheck as the original four. Two
  // reproduced almost exactly (manchester-doha £257 unchanged;
  // manchester-madinah £313 -> £309, still a standout candidate). The third
  // did not survive verification: london-heathrow-delhi's Cheapest-tab tile
  // price (£407, close to the routine check's £403) did not survive
  // click-through — Google's own itinerary page corrected it to £433, a RISE
  // against the route's baseline median that no longer clears the
  // meaningful-drop threshold at all. Fare Watcher's verified-candidate
  // evaluation (which always evaluates through the matching recheck when one
  // exists) correctly drops it from the queue — exactly the
  // "rises-stops-qualifying" scenario this same evaluation logic was built
  // to handle, and exactly why the recheck step exists: an unverified
  // routine tile price would have silently published a candidate that was
  // never actually available.
  it('the real fareObservations archive produces six current Route Watch candidates after the Tuesday full weekly refresh and its emergency rechecks', () => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const candidates = generateRouteWatchFareCandidates(fareObservations, nowIso);
    expect(candidates).toHaveLength(6);
    expect(candidates.map((c) => c.routeSlug)).toEqual([
      'manchester-islamabad',
      'manchester-lahore',
      'birmingham-amritsar',
      'london-heathrow-doha',
      'manchester-doha',
      'manchester-madinah',
    ]);
    expect(candidates.map((c) => c.routeSlug)).not.toContain('london-heathrow-delhi');
    expect(candidates.every((c) => c.qualification === 'standout-candidate')).toBe(true);
    expect(candidates.every((c) => c.lifecycle === 'detected' && c.founderVerificationRequired)).toBe(true);
  });
});

describe('H. No automatic send path or external provider call exists in candidate derivation', () => {
  // Both files legitimately mention "Brevo" in prose (instructing the founder to check Brevo
  // manually at send time) — that's the point of a human-reviewed pilot. What must never exist
  // is an actual call: an import of a Brevo/email helper, or a fetch.
  it('lib/route-watch-fare-trigger.ts makes no actual Brevo, email, or network call', () => {
    expect(routeWatchFareTriggerSrc).not.toMatch(/fetch\(/);
    expect(routeWatchFareTriggerSrc).not.toMatch(/sendResendEmail|upsertBrevoContact|getBrevoContact/);
    expect(routeWatchFareTriggerSrc).not.toMatch(/import .*from ['"]@\/lib\/email['"]/);
  });

  it('the new founder-insights.ts section makes no actual Brevo, email, or network call either', () => {
    const section = founderInsightsSrc.slice(
      founderInsightsSrc.indexOf('function routeWatchFareCandidates'),
      founderInsightsSrc.indexOf('// ── 1. Fare observation coverage')
    );
    expect(section).not.toMatch(/fetch\(/);
    expect(section).not.toMatch(/sendResendEmail|upsertBrevoContact|getBrevoContact/);
  });

  it('founder-insights.ts does not import any Brevo/email helper for this section (module-level imports unchanged for that concern)', () => {
    expect(founderInsightsSrc).not.toMatch(/import .*from ['"]@\/lib\/email['"]/);
  });

  it('the founder snapshot includes the new section without requiring any network dependency', () => {
    const snapshot = getFounderSnapshot(new Date('2026-08-17T12:00:00.000Z'));
    const section = snapshot.grouped['nice-to-have'].find((s) => s.id === 'route-watch-fare-candidates');
    expect(section).toBeDefined();
    expect(section!.title).toBe('Route Watch — lower-fare candidates');
  });
});

describe('I. Trust wording — no overclaim in rendered founder copy or customer-facing labels', () => {
  // Applied only to actually-rendered copy (founder dashboard text, the customer intent label) —
  // NOT to the procedure doc's own guardrail prose, which must legitimately name the forbidden
  // phrases in order to warn against them ("must never say: best price, cheapest fare, ...").
  const forbidden = [/\bcheapest\b/i, /best market price/i, /guaranteed saving/i, /\blive alert\b/i, /market-wide price drop/i, /fare still available/i];

  it('the founder section headline/action text never overclaims', () => {
    const snapshot = getFounderSnapshot(new Date('2026-08-17T12:00:00.000Z'));
    const section = snapshot.grouped['nice-to-have'].find((s) => s.id === 'route-watch-fare-candidates')!;
    const text = [section.headline, section.action ?? '', ...section.items.map((i) => i.detail)].join(' ');
    for (const pattern of forbidden) expect(text).not.toMatch(pattern);
  });

  it('the customer intent label never overclaims', () => {
    const label = ROUTE_WATCH_INTENT_OPTIONS.find((o) => o.value === 'best-fare')!.label;
    for (const pattern of forbidden) expect(label).not.toMatch(pattern);
  });

  it('the non-empty state clearly states how many candidates cleared the threshold, never overclaiming urgency', () => {
    // 4 -> 7 -> 6 (Tuesday full weekly refresh, 1 September 2026, and its
    // same-day emergency rechecks) — see the dedicated regression above:
    // two of the three newly-qualifying routes survived verification,
    // one (london-heathrow-delhi) did not. Exercise the actual
    // non-empty-state copy against that final, verified count.
    const snapshot = getFounderSnapshot(new Date());
    const section = snapshot.grouped['nice-to-have'].find((s) => s.id === 'route-watch-fare-candidates')!;
    expect(section.items).toHaveLength(6);
    expect(section.headline).toMatch(/6 fare observations clear Fare Watcher's strong evidence threshold/i);
    expect(section.headline).toMatch(/Nothing sends itself/i);
    for (const pattern of forbidden) expect(section.headline).not.toMatch(pattern);
  });

  it('the pilot procedure explicitly states it reuses Fare Watcher unchanged and never loosens the threshold to manufacture candidates', () => {
    // \s+ (not literal spaces) because the markdown source wraps this prose across lines.
    expect(procedureDoc).toMatch(/reuses\s+Fare\s+Watcher's\s+existing\s+evidence\s+engine\s+unchanged/i);
    expect(procedureDoc).toMatch(/not\s+a\s+gap\s+to\s+work\s+around\s+by\s+loosening\s+the\s+threshold/i);
  });

  it('the pilot procedure explicitly names its own guardrail phrases (must legitimately mention them to forbid them)', () => {
    expect(procedureDoc).toMatch(/must\s+\*\*never\*\*\s+say/i);
    expect(procedureDoc).toMatch(/nothing\s+sends\s+itself|nothing\s+sends\s+automatically|automatic\s+send/i);
  });
});
