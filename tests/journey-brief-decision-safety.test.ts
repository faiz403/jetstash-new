import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareJourneyOptions,
  groupStillUnknownByOption,
  hasShortSelfTransferCaution,
  SELF_TRANSFER_SHORT_CONNECTION_MINUTES,
  SHORT_SELF_TRANSFER_CAUTION_COPY,
  type JourneyOptionInput,
} from '@/lib/journey-decision-brief';

/**
 * Journey Brief decision-safety fixes (12 Sept 2026) — a real 10-case
 * itinerary-comparison evaluation exposed four bounded decision-safety
 * defects in the generic Journey Decision Brief engine
 * (lib/journey-decision-brief.ts, components/journey-brief/
 * journey-decision-brief.tsx). Each fix below is scoped to exactly the
 * confirmed failure — no route data, no scoring engine, no recommendation,
 * no hard-coded 10-case data, and none of the explicitly out-of-scope items
 * (universal minimum connection times, party-size normalisation, a
 * value-of-time calculator) were touched.
 */

const baseOption: JourneyOptionInput = {
  label: 'Option A',
  priceGBP: 621,
  priceBasis: 'per-person',
  outboundDurationMinutes: 24 * 60 + 10,
  returnDurationMinutes: 20 * 60,
  outboundStops: 1,
  returnStops: 1,
  airportChange: 'no',
  selfTransfer: 'no',
  baggage: 'included',
};

function option(overrides: Partial<JourneyOptionInput>): JourneyOptionInput {
  return { ...baseOption, ...overrides };
}

describe('Case 6 — short self-transfer must not read as safely equivalent to a generous buffer', () => {
  it('a self-transfer with a layover under the caution threshold triggers the fail-closed caution copy', () => {
    const a = option({ label: 'A', selfTransfer: 'yes', layoverMinutes: 80 }); // 1h20
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    expect(result.optionASummary.extras).toContain(SHORT_SELF_TRANSFER_CAUTION_COPY);
  });

  it('a long self-transfer (well above the threshold) does NOT get the short-buffer caution', () => {
    const a = option({ label: 'A', selfTransfer: 'yes', layoverMinutes: 7 * 60 }); // 7h
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    expect(result.optionASummary.extras).not.toContain(SHORT_SELF_TRANSFER_CAUTION_COPY);
  });

  it('the exact founder-specified 7h vs 1h20 scenario: only the short connection gets the caution, the long one does not', () => {
    const a = option({ label: 'A', selfTransfer: 'yes', layoverMinutes: 7 * 60 });
    const b = option({ label: 'B', selfTransfer: 'yes', layoverMinutes: 80 });
    const result = compareJourneyOptions(a, b);
    expect(result.optionASummary.extras).not.toContain(SHORT_SELF_TRANSFER_CAUTION_COPY);
    expect(result.optionBSummary.extras).toContain(SHORT_SELF_TRANSFER_CAUTION_COPY);
  });

  it('never fires for a self-transfer with no layover duration entered — that stays an honest "layover not entered" unknown, not a caution about a duration we don\'t actually know', () => {
    const a = option({ label: 'A', selfTransfer: 'yes', layoverMinutes: undefined });
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    expect(result.optionASummary.extras).not.toContain(SHORT_SELF_TRANSFER_CAUTION_COPY);
    expect(result.stillUnknown).toContain('Option A: layover not entered.');
  });

  it('never fires when self-transfer is "no" or "unknown", regardless of layover duration', () => {
    expect(hasShortSelfTransferCaution({ selfTransfer: 'no', layoverMinutes: 40 })).toBe(false);
    expect(hasShortSelfTransferCaution({ selfTransfer: 'unknown', layoverMinutes: 40 })).toBe(false);
  });

  it('does not invent a universal minimum-connection-time RULE — the copy itself states no specific number, and the threshold is documented as a caution trigger only', () => {
    expect(SHORT_SELF_TRANSFER_CAUTION_COPY).not.toMatch(/\d+\s*(min|hour|h\b)/i);
    expect(SHORT_SELF_TRANSFER_CAUTION_COPY).not.toMatch(/impossible|invalid|not allowed|cannot connect/i);
    expect(typeof SELF_TRANSFER_SHORT_CONNECTION_MINUTES).toBe('number');
  });

  it('never declares a short connection impossible — it is additive advice, comparison output and all other facts are unaffected', () => {
    const a = option({ label: 'A', selfTransfer: 'yes', layoverMinutes: 80 });
    const b = option({ label: 'B' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparable).toBe(true);
    expect(result.comparisonStatements.length).toBeGreaterThan(0);
  });
});

describe('Case 8 — known baggage fee must reverse the headline price winner when it does', () => {
  it('the exact founder scenario: A=£500 incl. bag, B=£455+£70 bag -> B is actually £25 more expensive, not A £45 more', () => {
    const a = option({ label: 'A', priceGBP: 500, baggage: 'included' });
    const b = option({ label: 'B', priceGBP: 455, baggage: 'known-extra-cost', baggageCostGBP: 70 });
    const result = compareJourneyOptions(a, b);

    expect(result.priceComparisonUsesPayableTotal).toBe(true);
    // Payable totals: A = 500, B = 525. B costs more overall, by £25 — the
    // opposite conclusion from comparing the raw entered prices (500 vs 455,
    // which would have wrongly said "A costs £45 more").
    expect(result.priceDifferenceGBP).toBe(-25);
    expect(result.comparisonStatements.some((s) => s.includes('Option B costs £25 more than Option A') && s.includes('once baggage is included'))).toBe(true);
    expect(result.comparisonStatements.some((s) => s.includes('£45'))).toBe(false);
  });

  it('when both options have baggage included with no extra cost, the headline is unaffected (identical to entered-price comparison)', () => {
    const a = option({ label: 'A', priceGBP: 626, baggage: 'included' });
    const b = option({ label: 'B', priceGBP: 621, baggage: 'included' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparisonUsesPayableTotal).toBe(true);
    expect(result.priceDifferenceGBP).toBe(5);
    expect(result.comparisonStatements).toContain('Option A costs £5 more than Option B (per person).');
    expect(result.comparisonStatements.join(' ')).not.toContain('once baggage is included');
  });

  it('an equal payable total (baggage-adjusted) is stated as "same price", never silently switching wording away from the tested phrase', () => {
    const a = option({ label: 'A', priceGBP: 500, baggage: 'included' });
    const b = option({ label: 'B', priceGBP: 450, baggage: 'known-extra-cost', baggageCostGBP: 50 });
    const result = compareJourneyOptions(a, b);
    expect(result.priceDifferenceGBP).toBe(0);
    expect(result.comparisonStatements.some((s) => s.includes('same price') && s.includes('once baggage is included'))).toBe(true);
  });
});

describe('Case 8 — unknown baggage amount is never invented as £0', () => {
  it('extra-cost-unknown on one side falls back to the entered price, with an explicit qualifier — never a silent £0', () => {
    const a = option({ label: 'A', priceGBP: 500, baggage: 'included' });
    const b = option({ label: 'B', priceGBP: 455, baggage: 'extra-cost-unknown' });
    const result = compareJourneyOptions(a, b);

    expect(result.priceComparisonUsesPayableTotal).toBe(false);
    // Falls back to the raw entered prices (500 vs 455) — never assumes the
    // unknown extra is zero, and never silently produces the wrong-decision
    // £45 headline as though it were the full picture without qualification.
    expect(result.priceDifferenceGBP).toBe(45);
    expect(result.comparisonStatements.some((s) => s.includes("Option B's baggage cost is not fully confirmed"))).toBe(true);
  });

  it('"not-stated" baggage on one side is treated the same as "extra-cost-unknown" for payable-total purposes — neither is a confirmed £0', () => {
    const a = option({ label: 'A', priceGBP: 500, baggage: 'included' });
    const b = option({ label: 'B', priceGBP: 455, baggage: 'not-stated' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparisonUsesPayableTotal).toBe(false);
    expect(result.comparisonStatements.some((s) => s.includes("Option B's baggage cost is not fully confirmed"))).toBe(true);
  });

  it('both sides unconfirmed produces the two-sided qualifier, not a one-sided claim', () => {
    const a = option({ label: 'A', priceGBP: 500, baggage: 'extra-cost-unknown' });
    const b = option({ label: 'B', priceGBP: 455, baggage: 'not-stated' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparisonUsesPayableTotal).toBe(false);
    expect(result.comparisonStatements.some((s) => s.startsWith("Neither option's baggage cost is fully confirmed"))).toBe(true);
  });

  it('never invents a baggage figure anywhere in the result text for an unconfirmed side', () => {
    const a = option({ label: 'A', priceGBP: 500, baggage: 'included' });
    const b = option({ label: 'B', priceGBP: 455, baggage: 'extra-cost-unknown' });
    const result = compareJourneyOptions(a, b);
    const allText = [...result.comparisonStatements, ...result.optionBSummary.extras].join(' ');
    expect(allText).not.toMatch(/£0/);
  });
});

describe('Case 10 — different cabins must not read as a plain like-for-like comparison', () => {
  it('Business vs Economy produces an explicit non-equivalence statement, first in the list', () => {
    const a = option({ label: 'A', cabin: 'Business', priceGBP: 1800, outboundStops: 0, returnStops: 0 });
    const b = option({ label: 'B', cabin: 'Economy', priceGBP: 600 });
    const result = compareJourneyOptions(a, b);
    expect(result.comparisonStatements[0]).toBe('Option A is Business and Option B is Economy — these are different cabin products, not a like-for-like comparison.');
  });

  it('does not invent a cabin value figure or recommend one cabin over the other', () => {
    const a = option({ label: 'A', cabin: 'Business', priceGBP: 1800 });
    const b = option({ label: 'B', cabin: 'Economy', priceGBP: 600 });
    const result = compareJourneyOptions(a, b);
    const allText = result.comparisonStatements.join(' ').toLowerCase();
    expect(allText).not.toMatch(/worth it|better value|recommend|upgrade is|business is better/);
  });

  it('same cabin on both sides produces no non-equivalence statement', () => {
    const a = option({ label: 'A', cabin: 'Economy' });
    const b = option({ label: 'B', cabin: 'Economy' });
    const result = compareJourneyOptions(a, b);
    expect(result.comparisonStatements.some((s) => s.includes('different cabin products'))).toBe(false);
  });

  it('never fabricates a mismatch when cabin is unset on one or both sides — no cabin entered means no claim either way', () => {
    const a = option({ label: 'A', cabin: 'Business' });
    const b = option({ label: 'B', cabin: undefined });
    const result = compareJourneyOptions(a, b);
    expect(result.comparisonStatements.some((s) => s.includes('different cabin products'))).toBe(false);
    const bothUnset = compareJourneyOptions(option({ label: 'A' }), option({ label: 'B' }));
    expect(bothUnset.comparisonStatements.some((s) => s.includes('different cabin products'))).toBe(false);
  });

  it('cabin is surfaced as a plain fact in each option summary when entered', () => {
    const a = option({ label: 'A', cabin: 'Business' });
    const result = compareJourneyOptions(a, option({ label: 'B', cabin: 'Economy' }));
    expect(result.optionASummary.extras).toContain('Cabin: Business');
    expect(result.optionBSummary.extras).toContain('Cabin: Economy');
  });
});

describe('Direct-flight form logic — a direct option is not asked for connection/layover fields', () => {
  const componentSrc = readFileSync(join(process.cwd(), 'components/journey-brief/journey-decision-brief.tsx'), 'utf8');

  it('the component computes isFullyDirect from both legs\' stop counts and conditionally renders the connection/layover inputs on it', () => {
    expect(componentSrc).toContain("const isFullyDirect = option.outboundStops === 0 && option.returnStops === 0;");
    expect(componentSrc).toMatch(/\{isFullyDirect \? \(/);
    expect(componentSrc).toContain("don&apos;t apply — this option is direct on both legs.");
  });

  it('does not weaken data collection for a connecting flight — the connection/layover inputs still render in source for the non-direct branch', () => {
    expect(componentSrc).toContain('Connection airport(s)');
    expect(componentSrc).toContain('Longest layover');
  });

  it('the engine itself does not flag connection airport / layover as "still unknown" for a fully-direct option — nothing inapplicable is presented as an unconfirmed fact', () => {
    const direct = option({ label: 'A', outboundStops: 0, returnStops: 0, connectionAirports: undefined, layoverMinutes: undefined });
    const result = compareJourneyOptions(direct, option({ label: 'B', outboundStops: 0, returnStops: 0 }));
    expect(result.stillUnknown.some((u) => u.includes('connection airport'))).toBe(false);
    expect(result.stillUnknown.some((u) => u.includes('layover'))).toBe(false);
  });

  it('a connecting option (at least one stop) still gets flagged for unentered connection/layover — collection is not weakened', () => {
    const connecting = option({ label: 'A', outboundStops: 1, returnStops: 0, connectionAirports: undefined, layoverMinutes: undefined });
    const result = compareJourneyOptions(connecting, option({ label: 'B', outboundStops: 1, returnStops: 1 }));
    expect(result.stillUnknown.some((u) => u === 'Option A: connection airport(s) not entered.')).toBe(true);
    expect(result.stillUnknown.some((u) => u === 'Option A: layover not entered.')).toBe(true);
  });

  // Robustness follow-up (12 Sept 2026, external code review of this PR):
  // buildOptionSummary must not trust stale connection/layover/self-transfer
  // state left over from before a traveller changed an option's stops to 0
  // (or from any caller supplying contradictory data directly) — a direct
  // option's summary must never display these as though they were real,
  // applicable facts.
  it('never displays a connection or layover value in the option summary for a confirmed-direct option, even if that state is present', () => {
    const direct = option({
      label: 'A',
      outboundStops: 0,
      returnStops: 0,
      connectionAirports: 'Istanbul (IST)', // stale/contradictory — should never render
      layoverMinutes: 90,
    });
    const result = compareJourneyOptions(direct, option({ label: 'B' }));
    expect(result.optionASummary.extras.some((e) => e.startsWith('Connection:'))).toBe(false);
    expect(result.optionASummary.extras.some((e) => e.startsWith('Longest layover:'))).toBe(false);
  });

  it('never displays airport-change or self-transfer facts (including the short-self-transfer caution) for a confirmed-direct option', () => {
    const direct = option({
      label: 'A',
      outboundStops: 0,
      returnStops: 0,
      airportChange: 'yes',
      selfTransfer: 'yes',
      layoverMinutes: 40, // would otherwise trigger the short-self-transfer caution
    });
    const result = compareJourneyOptions(direct, option({ label: 'B' }));
    expect(result.optionASummary.extras.some((e) => e.startsWith('Airport change:'))).toBe(false);
    expect(result.optionASummary.extras.some((e) => e.startsWith('Self-transfer:'))).toBe(false);
    expect(result.optionASummary.extras).not.toContain(SHORT_SELF_TRANSFER_CAUTION_COPY);
  });

  it('a genuinely connecting option (at least one stop) is unaffected — connection/layover/self-transfer facts still render normally', () => {
    const connecting = option({
      label: 'A',
      outboundStops: 1,
      returnStops: 1,
      connectionAirports: 'Istanbul (IST)',
      layoverMinutes: 90,
      airportChange: 'yes',
      selfTransfer: 'yes',
    });
    const result = compareJourneyOptions(connecting, option({ label: 'B' }));
    expect(result.optionASummary.extras).toContain('Connection: Istanbul (IST)');
    expect(result.optionASummary.extras).toContain('Longest layover: 1h 30m');
    expect(result.optionASummary.extras).toContain('Airport change: yes');
    expect(result.optionASummary.extras).toContain('Self-transfer: yes');
  });
});

describe('Baggage-state wording — "extra cost, amount unknown" stays distinct from "not entered"', () => {
  it('the raw stillUnknown line for extra-cost-unknown is never worded as "not entered"', () => {
    const a = option({ label: 'A', baggage: 'extra-cost-unknown' });
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    const line = result.stillUnknown.find((u) => u.startsWith('Option A: baggage'));
    expect(line).toBe('Option A: baggage extra cost unknown.');
    expect(line).not.toMatch(/not entered/);
  });

  it('the raw stillUnknown line for not-stated baggage is genuinely worded as not stated (not conflated with extra-cost-unknown)', () => {
    const a = option({ label: 'A', baggage: 'not-stated' });
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    expect(result.stillUnknown).toContain('Option A: baggage not stated.');
  });

  it('the grouped/display sentence keeps the two states distinct — extra-cost-unknown gets its own clause, never folded into "were not entered"', () => {
    const a = option({ label: 'A', baggage: 'extra-cost-unknown', airportChange: 'unknown' });
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    const grouped = groupStillUnknownByOption(result.stillUnknown);
    expect(grouped.optionA).toContain('An extra baggage cost applies, but the amount is not confirmed.');
    expect(grouped.optionA).not.toMatch(/baggage.{0,15}not entered/i);
  });

  it('"not-stated" baggage still correctly appears inside the generic "were not entered" sentence — only extra-cost-unknown is pulled out', () => {
    const a = option({ label: 'A', baggage: 'not-stated' });
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    const grouped = groupStillUnknownByOption(result.stillUnknown);
    expect(grouped.optionA?.toLowerCase()).toContain('baggage');
    expect(grouped.optionA).toMatch(/not entered/);
  });

  it('a known baggage amount is a plain fact, never listed as unknown by either wording', () => {
    const a = option({ label: 'A', baggage: 'known-extra-cost', baggageCostGBP: 40 });
    const result = compareJourneyOptions(a, option({ label: 'B' }));
    expect(result.stillUnknown.some((u) => u.includes('Option A') && u.toLowerCase().includes('baggage'))).toBe(false);
    expect(result.optionASummary.extras).toContain('Baggage: extra £40 on top of the entered price');
  });
});

describe('No scope creep — out-of-scope items remain untouched', () => {
  const libSrc = readFileSync(join(process.cwd(), 'lib/journey-decision-brief.ts'), 'utf8');

  it('does not create a party-size normalisation, a value-of-time calculator, or a scoring/recommendation engine', () => {
    expect(libSrc).not.toMatch(/partySize|valueOfTime|hourlyRate|riskScore|recommendationScore/i);
  });

  it('does not hard-code any of the 10 real evaluation cases as a lookup table or fixed-scenario branch in production code', () => {
    // No per-case data structure (an array/object of the 10 evaluated
    // itineraries) or a conditional branching on a specific one of them —
    // every fix here is a general rule (payable-total math, a duration
    // threshold, a cabin-mismatch check), not a special case for a
    // particular price or route pair. Doc comments may reference the real
    // figures as evidence for *why* a rule exists (this codebase's own
    // established convention — see e.g. the file's IndiGo/withdrawal-date
    // comment above); that is not the same as hard-coding the case as logic.
    expect(libSrc).not.toMatch(/const\s+(TEN_CASES|EVALUATION_CASES|CASE_\d+)\s*=/);
    expect(libSrc).not.toMatch(/if\s*\(.*priceGBP\s*===\s*500.*\)/);
  });
});
