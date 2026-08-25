import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSelfTransferItinerary, SELF_TRANSFER_LABEL } from '@/lib/fare-self-transfer';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { FareSignal } from '@/components/route/fare-signal';

/**
 * Self-transfer prominence fix (25 Aug 2026, founder-approved narrow
 * customer-trust fix). Several fares in the 25 August controlled weekly
 * batch are materially cheaper because they are explicitly self-transfer
 * or separate-ticket itineraries; the fix makes Fare Signal say so, using
 * only the evidence already recorded in each observation's own
 * `priceNote`. No fare data, Fare Watcher maths, Journey Choice or
 * Book-By logic changed -- this is presentation only.
 *
 * The founder's own evidence rule, tested directly against the exact
 * strings recorded in this session's real observations (not paraphrases):
 *   - recognise "self-transfer" and "separate tickets"/"separate-ticket"
 *   - never infer from stop/airline count, price or route-level wording
 *   - never label a negated mention ("no self-transfer notice", "NOT
 *     self-transfer", "no self-transfer or separate-ticket notice shown")
 */
const NOW_ISO = '2026-08-25';

describe('isSelfTransferItinerary() -- the one evidence predicate', () => {
  it('recognises explicit "self-transfer" wording', () => {
    expect(isSelfTransferItinerary('return, per person, one adult; self-transfer; outbound MAN-MXP-CAI-RUH-LHE')).toBe(true);
  });

  it('recognises explicit "separate tickets" wording', () => {
    expect(isSelfTransferItinerary('outbound MAN–FAO 3h nonstop, return FAO–MAN 3h nonstop on separate tickets; overhead-bin access is not included')).toBe(true);
  });

  it('recognises the hyphenated "separate-ticket" form', () => {
    expect(isSelfTransferItinerary('return shown as separate-ticket; baggage not stated')).toBe(true);
  });

  it('does NOT label a route-level mention of multiple airlines alone', () => {
    expect(isSelfTransferItinerary('outbound Ryanair, return Wizz Air, 2 stops each way; baggage not stated')).toBe(false);
  });

  it('does NOT label a cheap price or stop count alone', () => {
    expect(isSelfTransferItinerary('return, per person, one adult; £96; 3 stops each way; baggage not stated')).toBe(false);
  });

  it('does NOT label ordinary text with no self-transfer/separate-ticket mention at all', () => {
    expect(isSelfTransferItinerary('return, per person, one adult; Riyadh Air both ways; lowest visible Google Flights fare for the exact search; outbound MAN-RUH-ISB, 1 stop via Riyadh, 13h45m; baggage allowance not stated')).toBe(false);
  });

  it('does NOT label a negated "no self-transfer notice" mention -- the exact real wording used elsewhere in the archive', () => {
    expect(isSelfTransferItinerary('single ticket, no self-transfer notice; Google Flights states this fare does not include overhead-bin access')).toBe(false);
  });

  it('does NOT label a negated "NOT self-transfer" mention -- the exact real wording used elsewhere in the archive', () => {
    expect(isSelfTransferItinerary("EgyptAir's own direct booking £2,129, Trip.com £1,951); NOT self-transfer, single itinerary; all 4 segments individually expanded")).toBe(false);
  });

  it('does NOT label a combined negation naming both self-transfer and separate-ticket -- the exact real wording used elsewhere in the archive', () => {
    expect(isSelfTransferItinerary('single carrier, single booking, no self-transfer or separate-ticket notice shown; baggage not stated')).toBe(false);
  });

  it('handles missing/empty priceNote as false, never as an assumption', () => {
    expect(isSelfTransferItinerary(null)).toBe(false);
    expect(isSelfTransferItinerary(undefined)).toBe(false);
    expect(isSelfTransferItinerary('')).toBe(false);
  });

  it('is case-insensitive (matches the real "NOT self-transfer" capitalisation and a lowercase "self-transfer")', () => {
    expect(isSelfTransferItinerary('SELF-TRANSFER required between terminals')).toBe(true);
    expect(isSelfTransferItinerary('not self-transfer')).toBe(false);
  });
});

describe('the 25 August 2026 batch -- real observations, real founder-specified expectations', () => {
  const expectedLabelled = [
    'manchester-lahore',
    'manchester-dubai',
    'london-heathrow-jeddah',
    'london-heathrow-doha',
    'birmingham-amritsar',
    'london-gatwick-amritsar',
  ];

  it.each(expectedLabelled)('%s\'s current Fare Signal is flagged self-transfer', (slug) => {
    const signal = getFareSignalForRoute(slug, NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.isSelfTransfer).toBe(true);
  });

  it('manchester-islamabad\'s representative Riyadh Air observation is NOT flagged -- its priceNote records no self-transfer/separate-ticket evidence (now the 25 Aug emergency-recheck, £480, which outranks the £460 routine check on the same-day representative-priority rule -- PR #182 -- but carries the same "no self-transfer notice" evidence)', () => {
    const signal = getFareSignalForRoute('manchester-islamabad', NOW_ISO);
    expect(signal.state).toBe('current');
    expect(signal.observation?.price).toBe(480);
    expect(signal.observation?.isSelfTransfer).toBe(false);
  });
});

describe('rendered Fare Signal -- label appears in the primary/prominent area, not only in a deep-detail view', () => {
  function renderFareSignalForRoute(slug: string): string {
    const signal = getFareSignalForRoute(slug, NOW_ISO);
    const html = renderToStaticMarkup(
      FareSignal({
        signal,
        tripComUrl: getTripComRouteUrl(slug),
        routeSlug: slug,
      })
    );
    return html.replace(/\s+/g, ' ');
  }

  it('renders the exact label text on a self-transfer route (manchester-lahore)', () => {
    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).toContain(SELF_TRANSFER_LABEL);
  });

  it('renders the label on every one of the six affected routes', () => {
    for (const slug of ['manchester-lahore', 'manchester-dubai', 'london-heathrow-jeddah', 'london-heathrow-doha', 'birmingham-amritsar', 'london-gatwick-amritsar']) {
      expect(renderFareSignalForRoute(slug)).toContain(SELF_TRANSFER_LABEL);
    }
  });

  it('does NOT render the label on manchester-islamabad', () => {
    const html = renderFareSignalForRoute('manchester-islamabad');
    expect(html).not.toContain(SELF_TRANSFER_LABEL);
  });

  it('does NOT render the label on an ordinary route with no current self-transfer evidence (manchester-antalya)', () => {
    const html = renderFareSignalForRoute('manchester-antalya');
    expect(html).not.toContain(SELF_TRANSFER_LABEL);
  });

  it('existing caveats remain: baggage/optional-charges disclosure and the fresh-search note still render alongside the new label', () => {
    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
    expect(html).toContain(SELF_TRANSFER_LABEL);
  });

  it('makes no claim beyond the recorded evidence -- no "guaranteed", "protected", or baggage-transfer promise text is introduced', () => {
    const html = renderFareSignalForRoute('manchester-lahore');
    expect(html).not.toMatch(/guarantee/i);
    expect(html).not.toMatch(/protected/i);
    expect(html).not.toMatch(/baggage (will|is) transfer/i);
  });
});

describe('scope discipline -- this fix touches presentation only', () => {
  it('does not add a structured field to FareObservation itself (data/fare-observations.ts)', () => {
    const src = readFileSync(join(process.cwd(), 'data/fare-observations.ts'), 'utf-8');
    expect(src).not.toContain('isSelfTransfer');
  });

  it('lib/fare-self-transfer.ts is not imported by Journey Choice, Book-By or the Trip.com dated handoff', () => {
    for (const file of ['lib/journey-choice.ts', 'lib/journey-choice-route-adapter.ts', 'lib/tripcom-dated-handoff.ts', 'lib/booking-intelligence.ts', 'components/route/journey-choice.tsx', 'components/route/book-by-countdown.tsx']) {
      const src = readFileSync(join(process.cwd(), file), 'utf-8');
      expect(src).not.toContain('fare-self-transfer');
    }
  });
});
