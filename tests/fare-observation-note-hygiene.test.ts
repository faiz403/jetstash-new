import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fareObservations, getPublishableObservationsByRoute, getFareRangeSummary } from '@/data/fare-observations';
import { computeBookBySnapshot } from '@/lib/booking-intelligence';
import { FareHistoryPanel } from '@/components/route/fare-history-panel';

/**
 * Fare note hygiene (Production Customer Journey Audit #1, P1-1 fix, 19
 * August 2026). The audit found internal Fare Watcher workflow language
 * ("Fare Watcher standout-candidate verification recheck") rendering
 * verbatim to customers via FareObservation.priceNote, which is rendered
 * with no transformation on three live surfaces: components/route/
 * fare-history-panel.tsx, components/route/book-by-countdown.tsx (via
 * computeBookBySnapshot's latestObservation.priceNote) and components/ui/
 * deal-card.tsx (via getFareRangeSummary's priceNote, itself the latest
 * observation's own field). There is no sanitization layer between the
 * archive and any of these — this file tests the actual archive content
 * plus the two simplest of those three render paths directly, since the
 * traced pass-through means testing the raw field is equivalent proof for
 * the third (book-by-countdown.tsx renders latestObservation.priceNote
 * unmodified, tested here via computeBookBySnapshot itself rather than the
 * full 'use client' component).
 *
 * The fix was a data correction (rewrite the two affected priceNote
 * strings in customer language) plus a doc-comment boundary on the
 * `priceNote` field itself pointing internal classification at the
 * already-existing, never-rendered `observationReason` field instead of
 * free text. This file's job is the durable guard: prove the two known
 * records are clean, prove nothing useful was lost, and scan the entire
 * current archive so a future entry authored the same way is caught here
 * rather than found live in production again.
 */

const BANNED_JARGON = [
  /fare watcher/i,
  /standout-candidate/i,
  /standout candidate/i,
  /verification recheck/i,
  /emergency recheck/i,
  /\blifecycle\b/i,
  /\bfounder\b/i,
  // "detected" and "candidate" alone are common enough in ordinary prose
  // (a detected connection, a candidate itinerary) that banning them
  // outright would be a fragile, false-positive-prone blacklist rather
  // than a targeted guard — the compound phrases above are what actually
  // leaked, and are what this test polices.
];

function assertClean(label: string, text: string) {
  for (const pattern of BANNED_JARGON) {
    expect(text, `${label} should not match ${pattern}`).not.toMatch(pattern);
  }
}

describe('Birmingham → Amritsar and Heathrow → Jeddah customer-facing fare copy no longer contains internal Fare Watcher jargon', () => {
  const nowIso = '2026-08-19';

  it('the raw archive priceNote for both 19 August observations is clean', () => {
    const bhx = fareObservations.find((o) => o.id === 'obs-bhx-atq-economy-20260819-8w-v1')!;
    const jed = fareObservations.find((o) => o.id === 'obs-lhr-jed-economy-20260819-8w-v1')!;
    expect(bhx).toBeDefined();
    expect(jed).toBeDefined();
    assertClean('birmingham-amritsar priceNote', bhx.priceNote);
    assertClean('london-heathrow-jeddah priceNote', jed.priceNote);
  });

  it('the rendered Fare History panel for both routes is clean (components/route/fare-history-panel.tsx)', () => {
    const bhxHtml = renderToStaticMarkup(
      FareHistoryPanel({ observations: getPublishableObservationsByRoute('birmingham-amritsar', nowIso) })
    );
    const jedHtml = renderToStaticMarkup(
      FareHistoryPanel({ observations: getPublishableObservationsByRoute('london-heathrow-jeddah', nowIso) })
    );
    assertClean('birmingham-amritsar Fare History panel', bhxHtml);
    assertClean('london-heathrow-jeddah Fare History panel', jedHtml);
  });

  it('the Book-By Countdown’s Verified Check citation is clean for both routes (lib/booking-intelligence.ts computeBookBySnapshot -> latestObservation.priceNote, the exact field book-by-countdown.tsx renders unmodified)', () => {
    const bhxSnapshot = computeBookBySnapshot('birmingham-amritsar', new Date(`${nowIso}T12:00:00Z`));
    const jedSnapshot = computeBookBySnapshot('london-heathrow-jeddah', new Date(`${nowIso}T12:00:00Z`));
    expect(bhxSnapshot?.latestObservation?.priceNote).toBeTruthy();
    expect(jedSnapshot?.latestObservation?.priceNote).toBeTruthy();
    assertClean('birmingham-amritsar Book-By latestObservation.priceNote', bhxSnapshot!.latestObservation!.priceNote);
    assertClean('london-heathrow-jeddah Book-By latestObservation.priceNote', jedSnapshot!.latestObservation!.priceNote);
  });

  it('the Deal Card fare-range priceNote is clean for both routes (data/fare-observations.ts getFareRangeSummary -> deal-card.tsx)', () => {
    const bhxRange = getFareRangeSummary('birmingham-amritsar', 'Economy', nowIso);
    const jedRange = getFareRangeSummary('london-heathrow-jeddah', 'Economy', nowIso);
    expect(bhxRange?.priceNote).toBeTruthy();
    expect(jedRange?.priceNote).toBeTruthy();
    assertClean('birmingham-amritsar deal-card priceNote', bhxRange!.priceNote);
    assertClean('london-heathrow-jeddah deal-card priceNote', jedRange!.priceNote);
  });
});

describe('the useful public facts survive the cleanup, not just the jargon removal', () => {
  it('birmingham-amritsar: search parameters, dates and the non-reproducible-fare context are all still present', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-bhx-atq-economy-20260819-8w-v1')!;
    expect(obs.priceNote).toMatch(/fresh google flights search/i);
    expect(obs.priceNote).toContain('BHX-ATQ');
    expect(obs.priceNote).toContain('13-27 October 2026');
    expect(obs.priceNote).toMatch(/1 adult/i);
    expect(obs.priceNote).toMatch(/economy/i);
    expect(obs.priceNote).toContain('GBP');
    expect(obs.priceNote).toMatch(/could not be reproduced/i);
    expect(obs.priceNote).toMatch(/fresh lowest eligible result/i);
  });

  it('london-heathrow-jeddah: search parameters, dates and the non-reproducible-fare context are all still present', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-lhr-jed-economy-20260819-8w-v1')!;
    expect(obs.priceNote).toMatch(/fresh google flights search/i);
    expect(obs.priceNote).toContain('LHR-JED');
    expect(obs.priceNote).toContain('13-27 October 2026');
    expect(obs.priceNote).toMatch(/1 adult/i);
    expect(obs.priceNote).toMatch(/economy/i);
    expect(obs.priceNote).toContain('GBP');
    expect(obs.priceNote).toMatch(/could not be reproduced/i);
    expect(obs.priceNote).toMatch(/fresh lowest eligible result/i);
  });
});

describe('ordinary customer-safe priceNote copy continues to render normally', () => {
  it('an unaffected route’s Fare History panel still renders its own real content, unchanged by this fix', () => {
    const html = renderToStaticMarkup(
      FareHistoryPanel({ observations: getPublishableObservationsByRoute('manchester-dubai', '2026-08-19') })
    );
    expect(html).toMatch(/return, per person, one adult/i);
    expect(html).toMatch(/Checked \d{1,2} August 2026/);
    assertClean('manchester-dubai Fare History panel', html);
  });
});

describe('internal evidence is not accidentally deleted — it remains where it always belonged, not duplicated into priceNote', () => {
  it('both records keep their structured, never-rendered internal classification and unchanged fare facts', () => {
    const bhx = fareObservations.find((o) => o.id === 'obs-bhx-atq-economy-20260819-8w-v1')!;
    const jed = fareObservations.find((o) => o.id === 'obs-lhr-jed-economy-20260819-8w-v1')!;

    expect(bhx.observationReason).toBe('emergency-recheck');
    expect(bhx.observedDate).toBe('2026-08-19');
    expect(bhx.price).toBe(603);
    expect(bhx.source).toBe('KLM / Air India-KLM Cityhopper');
    expect(bhx.profileId).toBe('birmingham-amritsar-economy-1adult-23kg-v1');
    expect(bhx.comparisonEligibility).toBe('current');
    expect(bhx.fareDirectness).toBe('connecting');
    expect(bhx.baggage).toBe('not stated');

    expect(jed.observationReason).toBe('emergency-recheck');
    expect(jed.observedDate).toBe('2026-08-19');
    expect(jed.price).toBe(535);
    expect(jed.source).toBe('Aegean / Gulf Air');
    expect(jed.profileId).toBe('london-heathrow-jeddah-economy-1adult-23kg-v1');
    expect(jed.comparisonEligibility).toBe('current');
    expect(jed.fareDirectness).toBe('connecting');
    expect(jed.baggage).toBe('not stated');
  });

  it('historical (pre-19-August) observations for both routes are untouched', () => {
    const bhxHistorical = fareObservations.find((o) => o.id === 'obs-bhx-atq-economy-1')!;
    const jedHistorical = fareObservations.find((o) => o.id === 'obs-lhr-jed-economy-1')!;
    expect(bhxHistorical.priceNote).toBe('return, per person');
    expect(jedHistorical.priceNote).toBe('7 nights, flights + hotel, per person sharing');
  });
});

describe('recurrence guard — no current FareObservation leaks internal workflow terminology into priceNote', () => {
  it('scans the entire live archive, not just the two known records', () => {
    const offenders = fareObservations.filter((o) => BANNED_JARGON.some((pattern) => pattern.test(o.priceNote)));
    expect(
      offenders.map((o) => o.id),
      'One or more FareObservation.priceNote values contain internal Fare Watcher/Route Watch workflow language. ' +
        'Move the classification into `observationReason` (never publicly rendered) and describe the itinerary in ' +
        'plain customer language in `priceNote` instead — see the doc comment on FareObservation.priceNote.'
    ).toEqual([]);
  });
});
