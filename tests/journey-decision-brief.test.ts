import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareJourneyOptions,
  groupStillUnknownByOption,
  hoursMinutesToMinutes,
  isJourneyOptionComplete,
  minutesToHoursMinutes,
  validateJourneyOption,
  type JourneyOptionInput,
} from '@/lib/journey-decision-brief';

/**
 * Focused coverage for the generic Journey Decision Brief comparison
 * engine (founder-only MVP, August 2026) — deliberately separate from
 * tests/journey-brief-manchester-mumbai.test.ts, which covers the older,
 * route-specific prototype this engine does not build on.
 */

const baseOption: JourneyOptionInput = {
  label: 'Option A',
  priceGBP: 621,
  priceBasis: 'per-person',
  outboundDurationMinutes: 24 * 60 + 10, // 24h 10m
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

describe('validateJourneyOption / isJourneyOptionComplete', () => {
  it('rejects a completely empty option, naming every missing required field', () => {
    const issues = validateJourneyOption({});
    const fields = issues.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining(['label', 'priceGBP', 'priceBasis', 'outboundDurationMinutes', 'returnDurationMinutes', 'outboundStops', 'returnStops']),
    );
    expect(isJourneyOptionComplete({})).toBe(false);
  });

  it('accepts a fully specified option with only required fields', () => {
    const minimal: JourneyOptionInput = {
      label: 'X',
      priceGBP: 100,
      priceBasis: 'per-person',
      outboundDurationMinutes: 60,
      returnDurationMinutes: 60,
      outboundStops: 0,
      returnStops: 0,
      airportChange: 'unknown',
      selfTransfer: 'unknown',
      baggage: 'not-stated',
    };
    expect(validateJourneyOption(minimal)).toEqual([]);
    expect(isJourneyOptionComplete(minimal)).toBe(true);
  });

  it('rejects zero or negative price, duration, or negative stops', () => {
    expect(validateJourneyOption(option({ priceGBP: 0 })).some((i) => i.field === 'priceGBP')).toBe(true);
    expect(validateJourneyOption(option({ priceGBP: -50 })).some((i) => i.field === 'priceGBP')).toBe(true);
    expect(validateJourneyOption(option({ priceGBP: Number.NaN })).some((i) => i.field === 'priceGBP')).toBe(true);
    expect(validateJourneyOption(option({ outboundDurationMinutes: 0 })).some((i) => i.field === 'outboundDurationMinutes')).toBe(true);
    expect(validateJourneyOption(option({ outboundDurationMinutes: -10 })).some((i) => i.field === 'outboundDurationMinutes')).toBe(true);
    expect(validateJourneyOption(option({ outboundStops: -1 })).some((i) => i.field === 'outboundStops')).toBe(true);
  });

  it('rejects a non-integer stop count on either leg', () => {
    expect(validateJourneyOption(option({ outboundStops: 1.5 })).some((i) => i.field === 'outboundStops')).toBe(true);
    expect(validateJourneyOption(option({ returnStops: 0.5 })).some((i) => i.field === 'returnStops')).toBe(true);
    expect(isJourneyOptionComplete(option({ outboundStops: 1.5 }))).toBe(false);
  });

  it('requires an explicit, non-negative baggage cost when baggage is "known-extra-cost"', () => {
    const issues = validateJourneyOption(option({ baggage: 'known-extra-cost' }));
    expect(issues.some((i) => i.field === 'baggageCostGBP')).toBe(true);
    expect(validateJourneyOption(option({ baggage: 'known-extra-cost', baggageCostGBP: 30 }))).toEqual([]);
    expect(validateJourneyOption(option({ baggage: 'known-extra-cost', baggageCostGBP: -40 })).some((i) => i.field === 'baggageCostGBP')).toBe(true);
    expect(isJourneyOptionComplete(option({ baggage: 'known-extra-cost', baggageCostGBP: -40 }))).toBe(false);
  });

  it('treats airport-change and self-transfer "unknown" as a valid, complete state — never an error', () => {
    expect(validateJourneyOption(option({ airportChange: 'unknown' }))).toEqual([]);
    expect(validateJourneyOption(option({ selfTransfer: 'unknown' }))).toEqual([]);
  });

  it('never throws on a partial/garbage input', () => {
    expect(() => validateJourneyOption({ priceGBP: Number.NaN })).not.toThrow();
  });
});

describe('hoursMinutesToMinutes / minutesToHoursMinutes — duration-entry adapter (UX refinement, August 2026)', () => {
  it('converts a complete, valid hours+minutes pair to total minutes', () => {
    expect(hoursMinutesToMinutes({ hours: 21, minutes: 25 })).toBe(21 * 60 + 25);
    expect(hoursMinutesToMinutes({ hours: 0, minutes: 45 })).toBe(45);
    expect(hoursMinutesToMinutes({ hours: 18, minutes: 0 })).toBe(18 * 60);
  });

  it('round-trips cleanly through minutesToHoursMinutes', () => {
    const total = 21 * 60 + 25;
    const hm = minutesToHoursMinutes(total);
    expect(hm).toEqual({ hours: 21, minutes: 25 });
    expect(hoursMinutesToMinutes(hm)).toBe(total);
  });

  it('fails closed (undefined) rather than guessing when either half is missing', () => {
    expect(hoursMinutesToMinutes({ hours: 21, minutes: undefined })).toBeUndefined();
    expect(hoursMinutesToMinutes({ hours: undefined, minutes: 25 })).toBeUndefined();
    expect(hoursMinutesToMinutes({ hours: undefined, minutes: undefined })).toBeUndefined();
  });

  it('rejects a negative hours value rather than clamping it to zero', () => {
    expect(hoursMinutesToMinutes({ hours: -1, minutes: 0 })).toBeUndefined();
  });

  it('rejects a minutes value outside 0–59 rather than wrapping it into an hour', () => {
    expect(hoursMinutesToMinutes({ hours: 1, minutes: 60 })).toBeUndefined();
    expect(hoursMinutesToMinutes({ hours: 1, minutes: -1 })).toBeUndefined();
  });

  it('rejects a non-integer hours or minutes value', () => {
    expect(hoursMinutesToMinutes({ hours: 1.5, minutes: 0 })).toBeUndefined();
    expect(hoursMinutesToMinutes({ hours: 1, minutes: 30.5 })).toBeUndefined();
  });

  it('minutesToHoursMinutes returns an undefined pair for an undefined or negative total, never a guessed value', () => {
    expect(minutesToHoursMinutes(undefined)).toEqual({ hours: undefined, minutes: undefined });
    expect(minutesToHoursMinutes(-5)).toEqual({ hours: undefined, minutes: undefined });
  });

  it('an incomplete hours/minutes pair surfaces as the existing "required" duration validation, never a silent gap', () => {
    // Simulates the UI adapter: only hours entered, minutes left blank.
    const durationFromAdapter = hoursMinutesToMinutes({ hours: 21, minutes: undefined });
    const issues = validateJourneyOption(option({ outboundDurationMinutes: durationFromAdapter }));
    expect(issues.some((i) => i.field === 'outboundDurationMinutes')).toBe(true);
  });
});

describe('compareJourneyOptions — same-basis price arithmetic', () => {
  it('computes an exact price difference when both options share the same basis, phrased Option A/Option B', () => {
    const a = option({ label: 'A', priceGBP: 626, priceBasis: 'per-person' });
    const b = option({ label: 'B', priceGBP: 621, priceBasis: 'per-person' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparable).toBe(true);
    expect(result.priceDifferenceGBP).toBe(5);
    expect(result.comparisonStatements.some((s) => s === 'Option A costs £5 more than Option B (per person).')).toBe(true);
  });

  it('states equal prices factually when they match exactly', () => {
    const a = option({ label: 'A', priceGBP: 500 });
    const b = option({ label: 'B', priceGBP: 500 });
    const result = compareJourneyOptions(a, b);
    expect(result.priceDifferenceGBP).toBe(0);
    expect(result.comparisonStatements.some((s) => s.includes('same price'))).toBe(true);
  });

  it('handles party-total basis identically to per-person when both options match', () => {
    const a = option({ label: 'A', priceGBP: 1200, priceBasis: 'party-total' });
    const b = option({ label: 'B', priceGBP: 1100, priceBasis: 'party-total' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparable).toBe(true);
    expect(result.priceDifferenceGBP).toBe(100);
  });
});

describe('compareJourneyOptions — incompatible price bases', () => {
  it('refuses to compute a price difference when bases differ, and explains why using Option A/Option B', () => {
    const a = option({ label: 'A', priceGBP: 500, priceBasis: 'per-person' });
    const b = option({ label: 'B', priceGBP: 900, priceBasis: 'party-total' });
    const result = compareJourneyOptions(a, b);
    expect(result.priceComparable).toBe(false);
    expect(result.priceDifferenceGBP).toBeUndefined();
    expect(result.priceIncomparableReason).toMatch(/Option A is priced per person/);
    expect(result.priceIncomparableReason).toMatch(/Option B is priced as a party total/);
    expect(result.comparisonStatements.some((s) => s.includes('cannot be compared directly'))).toBe(true);
  });

  it('never invents a price difference number when bases are incompatible', () => {
    const a = option({ priceGBP: 500, priceBasis: 'per-person' });
    const b = option({ priceGBP: 500, priceBasis: 'party-total' });
    const result = compareJourneyOptions(a, b);
    expect(result.comparisonStatements.join(' ')).not.toMatch(/£0 (more|less)/);
    expect(result.priceDifferenceGBP).toBeUndefined();
  });
});

describe('compareJourneyOptions — time arithmetic', () => {
  it('computes total round-trip time difference in minutes, both directions, phrased Option A/Option B', () => {
    const a = option({ label: 'A', outboundDurationMinutes: 24 * 60 + 10, returnDurationMinutes: 20 * 60 }); // 44h10
    const b = option({ label: 'B', outboundDurationMinutes: 21 * 60 + 25, returnDurationMinutes: 20 * 60 }); // 41h25
    const result = compareJourneyOptions(a, b);
    expect(result.totalTimeDifferenceMinutes).toBe(165); // 2h45m
    expect(result.comparisonStatements.some((s) => s === 'Option B takes 2h 45m less total journey time than Option A.')).toBe(true);
  });

  it('states equal total time factually when both options match exactly', () => {
    const a = option({ label: 'A', outboundDurationMinutes: 600, returnDurationMinutes: 600 });
    const b = option({ label: 'B', outboundDurationMinutes: 500, returnDurationMinutes: 700 });
    const result = compareJourneyOptions(a, b);
    expect(result.totalTimeDifferenceMinutes).toBe(0);
    expect(result.comparisonStatements.some((s) => s.includes('same total journey time'))).toBe(true);
  });
});

describe('compareJourneyOptions — stops', () => {
  it('states equal stops as "both have" and unequal stops as "fewer than", always Option A/Option B', () => {
    const equalStops = compareJourneyOptions(option({ outboundStops: 1, returnStops: 1 }), option({ outboundStops: 1, returnStops: 1 }));
    expect(equalStops.comparisonStatements.some((s) => s === 'Option A and Option B both have 1 outbound stop.')).toBe(true);
    expect(equalStops.comparisonStatements.some((s) => s === 'Option A and Option B both have 1 return stop.')).toBe(true);

    const unequalStops = compareJourneyOptions(option({ outboundStops: 0 }), option({ outboundStops: 2 }));
    expect(unequalStops.outboundStopsDifference).toBe(-2);
    expect(unequalStops.comparisonStatements.some((s) => s.includes('Option A has 2 fewer outbound stop(s) than Option B'))).toBe(true);
  });
});

describe('compareJourneyOptions — missing-leg / incomplete-option handling', () => {
  it('isJourneyOptionComplete fails closed when either leg duration is missing — compareJourneyOptions is never reached', () => {
    const incomplete: Partial<JourneyOptionInput> = { ...baseOption, returnDurationMinutes: undefined };
    expect(isJourneyOptionComplete(incomplete)).toBe(false);
    // The UI/caller must gate on isJourneyOptionComplete before calling
    // compareJourneyOptions — this test documents that contract exists,
    // not that compareJourneyOptions itself re-validates (it doesn't, by
    // design; see the file header comment).
  });
});

describe('compareJourneyOptions — baggage', () => {
  it('discloses baggage as not-stated (in the option summary + stillUnknown) without treating it as zero cost or included', () => {
    const a = option({ label: 'A', baggage: 'not-stated' });
    const b = option({ label: 'B', baggage: 'included' });
    const result = compareJourneyOptions(a, b);
    expect(result.optionBSummary.extras.some((e) => e === 'Baggage: included')).toBe(true);
    expect(result.optionASummary.extras.some((e) => e.startsWith('Baggage'))).toBe(false);
    expect(result.stillUnknown.some((u) => u === 'Option A: baggage not stated.')).toBe(true);
  });

  it('discloses an unknown extra baggage cost without inventing a figure', () => {
    const a = option({ label: 'A', baggage: 'extra-cost-unknown' });
    const b = option({ label: 'B', baggage: 'known-extra-cost', baggageCostGBP: 45 });
    const result = compareJourneyOptions(a, b);
    expect(result.stillUnknown.some((u) => u === 'Option A: baggage extra cost unknown.')).toBe(true);
    expect(result.optionBSummary.extras.some((e) => e.includes('£45'))).toBe(true);
  });

  it('never shows the same baggage fact in both the option summary and stillUnknown', () => {
    const a = option({ label: 'A', baggage: 'not-stated' });
    const b = option({ label: 'B', baggage: 'included' });
    const result = compareJourneyOptions(a, b);
    // "not stated" is unknown-only (never in extras); "included" is extras-only (never in stillUnknown).
    expect(result.optionASummary.extras.some((e) => e.startsWith('Baggage'))).toBe(false);
    expect(result.stillUnknown.some((u) => u.includes('Option B') && u.toLowerCase().includes('baggage'))).toBe(false);
  });
});

describe('compareJourneyOptions — airport-change / self-transfer unknowns', () => {
  it('surfaces unknown tri-state fields in stillUnknown only, per option, without defaulting to "no"', () => {
    const a = option({ label: 'A', airportChange: 'unknown', selfTransfer: 'unknown' });
    const b = option({ label: 'B', airportChange: 'yes', selfTransfer: 'no' });
    const result = compareJourneyOptions(a, b);
    expect(result.stillUnknown.some((u) => u === 'Option A: airport change unknown.')).toBe(true);
    expect(result.stillUnknown.some((u) => u === 'Option A: self-transfer unknown.')).toBe(true);
    expect(result.optionBSummary.extras.some((e) => e === 'Airport change: yes')).toBe(true);
    // Option B's airport-change/self-transfer are both known — neither appears in stillUnknown for B,
    // even though B still has other legitimately-unset optional fields (connection/layover) there.
    expect(result.stillUnknown.some((u) => u.includes('Option B') && u.includes('airport change'))).toBe(false);
    expect(result.stillUnknown.some((u) => u.includes('Option B') && u.includes('self-transfer'))).toBe(false);
  });

  it('never infers connection suitability from layover length alone', () => {
    const a = option({ label: 'A', layoverMinutes: 40 });
    const b = option({ label: 'B', layoverMinutes: 300 });
    const result = compareJourneyOptions(a, b);
    const allText = [...result.comparisonStatements, result.optionASummary.extras.join(' '), result.optionBSummary.extras.join(' ')].join(' ').toLowerCase();
    expect(allText).not.toMatch(/tight|risky|comfortable|safe connection/);
  });
});

describe('compareJourneyOptions — every unknown appears exactly once', () => {
  it('no field appears in both an option summary\'s extras and stillUnknown, and comparisonStatements never repeats an unknown', () => {
    const a = option({ label: 'A', airportChange: 'unknown', selfTransfer: 'unknown', baggage: 'not-stated', connectionAirports: undefined, layoverMinutes: undefined });
    const b = option({ label: 'B', airportChange: 'yes', selfTransfer: 'no', baggage: 'included', connectionAirports: 'Istanbul (IST)', layoverMinutes: 90 });
    const result = compareJourneyOptions(a, b);

    // Every "Option A: ... unknown/not stated/not entered" line appears exactly once across the whole result.
    for (const unknownLine of result.stillUnknown) {
      const occurrencesInComparison = result.comparisonStatements.filter((s) => s === unknownLine).length;
      const occurrencesInExtrasA = result.optionASummary.extras.filter((e) => e === unknownLine).length;
      const occurrencesInExtrasB = result.optionBSummary.extras.filter((e) => e === unknownLine).length;
      expect(occurrencesInComparison + occurrencesInExtrasA + occurrencesInExtrasB).toBe(0);
    }
    // stillUnknown itself has no duplicate entries.
    expect(new Set(result.stillUnknown).size).toBe(result.stillUnknown.length);
  });
});

describe('groupStillUnknownByOption — presentation-only grouping (pre-commit polish, August 2026)', () => {
  it('groups all five unknown topics for an option into one natural-language sentence', () => {
    const a = option({ label: 'A', airportChange: 'unknown', selfTransfer: 'unknown', baggage: 'not-stated', connectionAirports: undefined, layoverMinutes: undefined });
    const b = option({ label: 'B', airportChange: 'unknown', selfTransfer: 'unknown', baggage: 'not-stated', connectionAirports: undefined, layoverMinutes: undefined });
    const result = compareJourneyOptions(a, b);
    const grouped = groupStillUnknownByOption(result.stillUnknown);
    expect(grouped.optionA).toBe('Airport change, self-transfer, baggage, connection airport and layover were not entered.');
    expect(grouped.optionB).toBe('Airport change, self-transfer, baggage, connection airport and layover were not entered.');
  });

  it('lists only the genuinely unknown topics when some optional facts were entered', () => {
    const a = option({ label: 'A', airportChange: 'unknown', selfTransfer: 'no', baggage: 'included', connectionAirports: 'Istanbul (IST)', layoverMinutes: 90 });
    const grouped = groupStillUnknownByOption(compareJourneyOptions(a, option({ label: 'B' })).stillUnknown);
    expect(grouped.optionA).toBe('Airport change was not entered.');
  });

  it('uses singular "was" for exactly one topic and plural "were" for more than one', () => {
    const singular = groupStillUnknownByOption(['Option A: layover not entered.']);
    expect(singular.optionA).toBe('Layover was not entered.');
    const plural = groupStillUnknownByOption(['Option A: layover not entered.', 'Option A: baggage not stated.']);
    expect(plural.optionA).toBe('Layover and baggage were not entered.');
  });

  it('returns null for an option with nothing left unknown, rather than an empty sentence', () => {
    const complete = option({ label: 'A', airportChange: 'yes', selfTransfer: 'no', baggage: 'included', connectionAirports: 'Istanbul (IST)', layoverMinutes: 90 });
    const grouped = groupStillUnknownByOption(compareJourneyOptions(complete, complete).stillUnknown);
    expect(grouped.optionA).toBeNull();
    expect(grouped.optionB).toBeNull();
  });

  it('never drops or invents a topic — grouping is a pure display transform of the same underlying unknowns', () => {
    const a = option({ label: 'A', airportChange: 'unknown', baggage: 'extra-cost-unknown' });
    const result = compareJourneyOptions(a, option({ label: 'B', airportChange: 'unknown', baggage: 'extra-cost-unknown' }));
    const grouped = groupStillUnknownByOption(result.stillUnknown);
    // Both "baggage not stated" and "baggage extra cost unknown" collapse to one "baggage" topic —
    // never double-counted, and connection/layover (also unset on this fixture) still appear too.
    expect(grouped.optionA).toBe('Airport change, baggage, connection airport and layover were not entered.');
  });

  it('handles an empty stillUnknown array without throwing', () => {
    expect(() => groupStillUnknownByOption([])).not.toThrow();
    expect(groupStillUnknownByOption([])).toEqual({ optionA: null, optionB: null });
  });
});

describe('compareJourneyOptions — always distinguishes Option A / Option B, even with identical traveller-entered labels', () => {
  it('never produces a "Label vs Label" ambiguous sentence when both options share the same label', () => {
    // Exact founder QA scenario: both candidates are "Turkish Airlines".
    const a = option({
      label: 'Turkish Airlines',
      priceGBP: 626,
      outboundDurationMinutes: 21 * 60 + 25,
      returnDurationMinutes: 18 * 60,
      outboundStops: 1,
      returnStops: 1,
    });
    const b = option({
      label: 'Turkish Airlines',
      priceGBP: 621,
      outboundDurationMinutes: 24 * 60 + 10,
      returnDurationMinutes: 18 * 60,
      outboundStops: 1,
      returnStops: 1,
    });
    const result = compareJourneyOptions(a, b);

    expect(result.priceDifferenceGBP).toBe(5);
    expect(result.totalTimeDifferenceMinutes).toBe(-165);

    // Every comparison sentence identifies candidates as Option A / Option B, never by label alone.
    for (const statement of result.comparisonStatements) {
      expect(statement).toMatch(/Option A|Option B/);
    }
    // The exact expected sentences from the founder's reference scenario.
    expect(result.comparisonStatements).toContain('Option A costs £5 more than Option B (per person).');
    expect(result.comparisonStatements).toContain('Option A takes 2h 45m less total journey time than Option B.');
    expect(result.comparisonStatements).toContain('Option A and Option B both have 1 outbound stop.');
    expect(result.comparisonStatements).toContain('Option A and Option B both have 1 return stop.');

    // No sentence anywhere reads as "Turkish Airlines ... Turkish Airlines" (the ambiguous form).
    const allStatements = [...result.comparisonStatements];
    for (const s of allStatements) {
      const labelCount = (s.match(/Turkish Airlines/g) ?? []).length;
      expect(labelCount, `ambiguous label-only sentence: "${s}"`).toBeLessThan(2);
    }

    // The summaries still carry the label as supporting context, correctly identified by Option A/B first.
    expect(result.optionASummary.identifier).toBe('Option A');
    expect(result.optionASummary.label).toBe('Turkish Airlines');
    expect(result.optionBSummary.identifier).toBe('Option B');
    expect(result.optionBSummary.label).toBe('Turkish Airlines');
  });
});

describe('compareJourneyOptions — no winner / recommendation language', () => {
  const FORBIDDEN_WORDS = ['best', 'winner', 'recommended', 'recommend', 'cheapest overall', 'better value', 'worth it', 'smartest', 'choose this'];

  function allResultText(result: ReturnType<typeof compareJourneyOptions>): string {
    return [
      ...result.comparisonStatements,
      ...result.optionASummary.extras,
      ...result.optionBSummary.extras,
      result.optionASummary.priceText,
      result.optionBSummary.priceText,
      ...result.stillUnknown,
    ]
      .join(' ')
      .toLowerCase();
  }

  it('never emits a forbidden recommendation word across a range of inputs', () => {
    const scenarios: Array<[Partial<JourneyOptionInput>, Partial<JourneyOptionInput>]> = [
      [{}, {}],
      [{ priceGBP: 1000 }, { priceGBP: 50 }],
      [{ outboundStops: 3 }, { outboundStops: 0 }],
      [{ baggage: 'not-stated' }, { baggage: 'known-extra-cost', baggageCostGBP: 60 }],
      [{ airportChange: 'yes' }, { airportChange: 'unknown' }],
    ];
    for (const [overridesA, overridesB] of scenarios) {
      const a = option({ label: 'A', ...overridesA });
      const b = option({ label: 'B', ...overridesB });
      const result = compareJourneyOptions(a, b);
      const text = allResultText(result);
      for (const word of FORBIDDEN_WORDS) {
        expect(text, `scenario produced forbidden word "${word}": ${text}`).not.toContain(word);
      }
    }
  });

  it('the component source never renders a forbidden recommendation word as static copy', () => {
    const src = readFileSync(join(process.cwd(), 'components/journey-brief/journey-decision-brief.tsx'), 'utf8');
    const lower = src.toLowerCase();
    for (const word of FORBIDDEN_WORDS) {
      expect(lower, `component copy contains forbidden word "${word}"`).not.toContain(word);
    }
  });

  it('the engine source never constructs a forbidden recommendation word', () => {
    const src = readFileSync(join(process.cwd(), 'lib/journey-decision-brief.ts'), 'utf8');
    const lower = src.toLowerCase();
    for (const word of FORBIDDEN_WORDS) {
      expect(lower, `engine source contains forbidden word "${word}"`).not.toContain(word);
    }
  });
});

describe('component analytics — no PII, no itinerary details', () => {
  it('journey_decision_brief_started and journey_decision_brief_completed fire with no properties', () => {
    const src = readFileSync(join(process.cwd(), 'components/journey-brief/journey-decision-brief.tsx'), 'utf8');
    expect(src).toMatch(/track\('journey_decision_brief_started'\)/);
    expect(src).toMatch(/track\('journey_decision_brief_completed'\)/);
    // Neither call site passes a properties object — no price, label, or
    // itinerary detail is ever sent to analytics from this component.
    expect(src).not.toMatch(/track\('journey_decision_brief_started', \{/);
    expect(src).not.toMatch(/track\('journey_decision_brief_completed', \{/);
  });
});

describe('component result behaviour (pre-commit polish, August 2026)', () => {
  const src = readFileSync(join(process.cwd(), 'components/journey-brief/journey-decision-brief.tsx'), 'utf8');

  it('scrolls to and focuses the result heading only when a comparison is freshly produced', () => {
    expect(src).toContain('const resultHeadingRef = useRef<HTMLHeadingElement>(null);');
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(result\) \{\s*resultHeadingRef\.current\?\.scrollIntoView/);
    expect(src).toMatch(/resultHeadingRef\.current\?\.focus\(\);/);
    expect(src).toMatch(/\}, \[result\]\);/);
    // Accessible focus target: a heading with tabIndex={-1} can receive
    // programmatic focus without being in the normal tab order.
    expect(src).toContain('ref={resultHeadingRef} id="jdb-result-heading" tabIndex={-1}');
  });

  it('Edit flights and Start again still scroll to the form, unaffected by the result-scroll effect', () => {
    expect(src).toContain('function handleEditFlights()');
    expect(src).toContain('function handleStartAgain()');
    const editFlightsBody = src.slice(src.indexOf('function handleEditFlights()'), src.indexOf('function handleEditFlights()') + 200);
    expect(editFlightsBody).toContain('formRef.current?.scrollIntoView');
    const startAgainBody = src.slice(src.indexOf('function handleStartAgain()'), src.indexOf('function handleEditFlights()'));
    expect(startAgainBody).toContain('formRef.current?.scrollIntoView');
    expect(startAgainBody).toContain('setResult(null);');
  });

  it('renders the grouped Still-unknown sentence per option via groupStillUnknownByOption, not the raw per-field list', () => {
    expect(src).toContain('groupStillUnknownByOption');
    expect(src).toContain('const grouped = groupStillUnknownByOption(result.stillUnknown);');
    expect(src).toContain('grouped.optionA');
    expect(src).toContain('grouped.optionB');
    // The old one-bullet-per-field rendering (`result.stillUnknown.map(...)`) is gone.
    expect(src).not.toMatch(/result\.stillUnknown\.map/);
  });
});

describe('access gate', () => {
  it('the founder page 404s outside development unless FOUNDER_DASHBOARD_ENABLED=true, matching the existing founder-route pattern', () => {
    const src = readFileSync(join(process.cwd(), 'app/founder/journey-brief/page.tsx'), 'utf8');
    expect(src).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(src).toContain('notFound()');
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });

  it('does not modify the existing Manchester-Mumbai prototype route or component', () => {
    const pageSrc = readFileSync(join(process.cwd(), 'app/founder/journey-brief/manchester-mumbai/page.tsx'), 'utf8');
    expect(pageSrc).toContain('JourneyBriefManchesterMumbai');
  });
});
