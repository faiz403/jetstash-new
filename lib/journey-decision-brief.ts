/**
 * Journey Decision Brief — the small, generic, deterministic comparison
 * engine at the heart of the founder-only MVP experiment (August 2026).
 *
 * Deliberately NOT built on the Manchester–Mumbai prototype
 * (`lib/journey-brief-manchester-mumbai.ts`). That prototype carries its own
 * duplicated route-evidence bundle (hardcoded IndiGo flight numbers, a
 * hardcoded 31 August 2026 withdrawal boundary, a hardcoded 14 August 2026
 * review date that has since passed with no expiry gate) — exactly the kind
 * of route-specific, single-source drift this engine must not repeat. This
 * file knows nothing about any specific route, airline, or evidence source.
 * It only knows how to compare two traveller-entered itinerary options
 * against each other, honestly.
 *
 * Every comparison rule below traces to an explicit safety boundary from the
 * Journey Decision Brief audit (August 2026):
 * - price is compared only when both options share the exact same
 *   `priceBasis` — never normalised or converted;
 * - a missing required field on either option blocks the comparison
 *   entirely (fail closed), never silently excluded;
 * - unknown baggage/airport-change/self-transfer states are preserved and
 *   surfaced, never treated as "no" or "£0" or folded into a default;
 * - the engine never suggests which option to choose, favours one over the
 *   other, or ranks them in any way — only factual statements the entered
 *   data actually supports.
 */

import type { DealCabin } from '@/data/deals';

export type PriceBasis = 'per-person' | 'party-total';

export type TriState = 'yes' | 'no' | 'unknown';

export type BaggageState = 'included' | 'known-extra-cost' | 'extra-cost-unknown' | 'not-stated';

/**
 * What the traveller enters for one shortlisted itinerary. Every field here
 * is traveller-entered, never JetStash-verified — the UI must label it that
 * way; this type does not carry a "source" or "verified" flag because there
 * isn't one to carry.
 */
export interface JourneyOptionInput {
  /** Free text — e.g. "Turkish Airlines via Istanbul". Not a route slug. */
  label: string;
  priceGBP: number;
  priceBasis: PriceBasis;
  outboundDurationMinutes: number;
  returnDurationMinutes: number;
  outboundStops: number;
  returnStops: number;
  /** Optional. Free text, e.g. "Istanbul (IST)" — never validated against a real airport list. */
  connectionAirports?: string;
  /** Optional. The longest single layover the traveller knows about. */
  layoverMinutes?: number;
  airportChange: TriState;
  selfTransfer: TriState;
  baggage: BaggageState;
  /** Only meaningful when baggage === 'known-extra-cost'. */
  baggageCostGBP?: number;
  /**
   * Journey Brief decision-safety fix (12 Sept 2026, real 10-case
   * evaluation, Case 10). Optional — reuses the site's existing
   * `DealCabin` type (data/deals.ts) rather than a new enum. Left unset
   * when the traveller doesn't know or didn't record it; a cabin mismatch
   * is only ever flagged when BOTH options have this set (see
   * `compareJourneyOptions`) — never inferred, never assumed equal.
   */
  cabin?: DealCabin;
}

// ---------------------------------------------------------------------------
// Short self-transfer caution (decision-safety fix, 12 Sept 2026, Case 6)
// ---------------------------------------------------------------------------
//
// Real 10-case evaluation finding: two self-transfer options (7h vs 1h20
// connection) were shown with the same "Self-transfer: yes" fact and no
// distinction — reading as though a 1h20 self-transfer carries the same
// practical risk as a 7h one. This does NOT invent a minimum-connection-time
// rule, and never declares a short connection impossible or unsafe — it only
// decides when to surface a plain, fail-closed prompt to check for yourself.
// The threshold below is a caution-surfacing trigger, not a claimed safe/
// unsafe boundary, and the copy itself states no number to the traveller —
// only "short self-transfer", so no specific minute count is ever presented
// as an authoritative rule.

/**
 * Below this many minutes, a self-transfer connection surfaces the caution
 * copy below. Chosen to separate the two real evaluation examples (a 1h20
 * connection triggers it; a 7h connection does not) — not a claim that any
 * duration at or above this is safe, only where JetStash starts prompting a
 * traveller to check for themselves.
 */
export const SELF_TRANSFER_SHORT_CONNECTION_MINUTES = 120;

export const SHORT_SELF_TRANSFER_CAUTION_COPY =
  'Short self-transfer — check terminal, immigration, baggage reclaim and re-check-in time before relying on this connection.';

/**
 * True only when the traveller has confirmed this option IS a self-transfer
 * (never inferred from stops/airline count) AND entered a known layover
 * duration under the caution threshold. A self-transfer with an unentered
 * layover duration is already surfaced as "layover not entered" in
 * `stillUnknown` — it does not additionally get this caution, since we
 * genuinely don't know whether it's short or long.
 */
export function hasShortSelfTransferCaution(option: Pick<JourneyOptionInput, 'selfTransfer' | 'layoverMinutes'>): boolean {
  return option.selfTransfer === 'yes' && option.layoverMinutes !== undefined && option.layoverMinutes < SELF_TRANSFER_SHORT_CONNECTION_MINUTES;
}

/** The fields a valid option must have before any comparison can run. */
const REQUIRED_FIELDS = [
  'label',
  'priceGBP',
  'priceBasis',
  'outboundDurationMinutes',
  'returnDurationMinutes',
  'outboundStops',
  'returnStops',
] as const;

export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Validates one option in isolation. Returns an empty array when the option
 * is complete enough to compare. Never throws — callers decide what to do
 * with issues (block submission, show inline errors).
 */
export function validateJourneyOption(input: Partial<JourneyOptionInput>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.label || input.label.trim().length === 0) {
    issues.push({ field: 'label', message: 'Give this option a short label (e.g. the airline or route).' });
  }
  if (input.priceGBP === undefined || input.priceGBP === null || Number.isNaN(input.priceGBP)) {
    issues.push({ field: 'priceGBP', message: 'Enter the price you were shown, in GBP.' });
  } else if (input.priceGBP <= 0) {
    issues.push({ field: 'priceGBP', message: 'Price must be greater than zero.' });
  }
  if (input.priceBasis !== 'per-person' && input.priceBasis !== 'party-total') {
    issues.push({ field: 'priceBasis', message: 'State whether that price is per person or the total for the party.' });
  }
  for (const [field, label] of [
    ['outboundDurationMinutes', 'Outbound journey duration'],
    ['returnDurationMinutes', 'Return journey duration'],
  ] as const) {
    const value = input[field];
    if (value === undefined || value === null || Number.isNaN(value)) {
      issues.push({ field, message: `${label} is required.` });
    } else if (value <= 0) {
      issues.push({ field, message: `${label} must be greater than zero.` });
    }
  }
  for (const [field, label] of [
    ['outboundStops', 'Outbound stops'],
    ['returnStops', 'Return stops'],
  ] as const) {
    const value = input[field];
    if (value === undefined || value === null || Number.isNaN(value)) {
      issues.push({ field, message: `${label} is required (0 if nonstop).` });
    } else if (value < 0) {
      issues.push({ field, message: `${label} cannot be negative.` });
    } else if (!Number.isInteger(value)) {
      issues.push({ field, message: `${label} must be a whole number.` });
    }
  }
  if (input.baggage === 'known-extra-cost') {
    if (input.baggageCostGBP === undefined || input.baggageCostGBP === null || Number.isNaN(input.baggageCostGBP)) {
      issues.push({ field: 'baggageCostGBP', message: 'Enter the known baggage cost, or change baggage state to "unknown".' });
    } else if (input.baggageCostGBP < 0) {
      issues.push({ field: 'baggageCostGBP', message: 'Baggage cost cannot be negative.' });
    }
  }

  return issues;
}

/** True only when every required field is present and valid — the fail-closed gate before any comparison runs. */
export function isJourneyOptionComplete(input: Partial<JourneyOptionInput>): input is JourneyOptionInput {
  return validateJourneyOption(input).length === 0;
}

// ---------------------------------------------------------------------------
// Hours/minutes duration adapter (UX refinement, August 2026)
// ---------------------------------------------------------------------------
//
// Travellers enter duration as separate hours + minutes fields — asking for
// a raw minutes total reads like an internal data-entry tool, not something
// a genuine traveller would fill in. The engine and its comparison
// arithmetic are completely unchanged: every JourneyOptionInput field is
// still a total-minutes number, exactly as before. This adapter only
// converts between the two representations, and does so honestly — an
// incomplete or out-of-range hours/minutes pair converts to `undefined`
// (never clamped, never guessed), which then surfaces as the existing
// "required" validation on the underlying total-minutes field.

export interface HoursMinutesInput {
  hours: number | undefined;
  minutes: number | undefined;
}

/**
 * Converts a traveller-entered hours+minutes pair to a total-minutes value
 * for the engine, or `undefined` if either half is missing or invalid.
 * Validation: hours must be a non-negative whole number; minutes must be a
 * whole number from 0–59. Never clamps an out-of-range value into range.
 */
export function hoursMinutesToMinutes(input: HoursMinutesInput): number | undefined {
  const { hours, minutes } = input;
  if (hours === undefined || hours === null || Number.isNaN(hours)) return undefined;
  if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return undefined;
  if (!Number.isInteger(hours) || hours < 0) return undefined;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/** The reverse conversion, for displaying an existing total-minutes value as hours+minutes. */
export function minutesToHoursMinutes(totalMinutes: number | undefined): HoursMinutesInput {
  if (totalMinutes === undefined || totalMinutes === null || Number.isNaN(totalMinutes) || totalMinutes < 0) {
    return { hours: undefined, minutes: undefined };
  }
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export { REQUIRED_FIELDS as journeyOptionRequiredFields };

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * A compact per-option summary for the result's "Option A / Option B"
 * section. The traveller-entered label is carried as supporting context
 * only (`label`) — every summary is always headed by its fixed `identifier`
 * ("Option A"/"Option B"), because two shortlisted flights can honestly
 * share the same airline name (e.g. two Turkish Airlines itineraries), and
 * a comparison that relied on the label alone would then read as
 * "Turkish Airlines vs Turkish Airlines" — genuinely ambiguous. See the
 * result-UX refinement (August 2026) that introduced this shape.
 */
export interface OptionSummary {
  identifier: 'Option A' | 'Option B';
  label: string;
  priceText: string;
  totalTimeText: string;
  outboundStopsText: string;
  returnStopsText: string;
  /** Only entered/known optional facts — an unknown one lives in `stillUnknown` instead, never both. */
  extras: string[];
}

export interface JourneyComparisonResult {
  priceComparable: boolean;
  /**
   * A minus B, in GBP. Only present when priceComparable. Decision-safety
   * fix (12 Sept 2026, Case 8): computed from each option's confirmed
   * payable total (price + any known baggage extra) whenever BOTH options
   * have one — never the raw entered price alone when a known baggage cost
   * would change the answer. See `priceComparisonUsesPayableTotal`.
   */
  priceDifferenceGBP?: number;
  priceIncomparableReason?: string;
  /**
   * True when priceDifferenceGBP above reflects each option's confirmed
   * payable total (baggage-inclusive) rather than the entered price alone —
   * only possible when priceComparable and both options' baggage state
   * resolves to a confirmed total ('included', or 'known-extra-cost' with a
   * real cost figure). False whenever at least one side's baggage cost is
   * 'not-stated' or 'extra-cost-unknown' — the comparison then falls back
   * to the entered price, and `comparisonStatements` carries an explicit
   * qualifier saying so, never a silent £0 assumption.
   */
  priceComparisonUsesPayableTotal: boolean;

  totalTimeDifferenceMinutes: number;
  outboundStopsDifference: number;
  returnStopsDifference: number;

  optionASummary: OptionSummary;
  optionBSummary: OptionSummary;

  /**
   * Section A — the decision-relevant deterministic comparisons only
   * (price, total journey time, stops). Always phrased "Option A"/"Option
   * B", never the traveller-entered label alone. Never suggests which
   * option to choose, favours one over the other, or ranks them in any
   * way — see tests/journey-decision-brief.test.ts's FORBIDDEN_WORDS list
   * for the enforced rule.
   */
  comparisonStatements: string[];

  /**
   * Section C — every optional field either option left unknown/unentered,
   * named exactly once each (never duplicated into comparisonStatements or
   * an option's `extras`), prefixed "Option A:"/"Option B:" so identical
   * airline labels can never create ambiguity here either.
   */
  stillUnknown: string[];
}

function formatMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${sign}${minutes}m`;
  if (minutes === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${minutes}m`;
}

function pluralStops(n: number, leg: 'outbound' | 'return'): string {
  const noun = n === 1 ? 'stop' : 'stops';
  return n === 0 ? `Direct ${leg}` : `${n} ${leg} ${noun}`;
}

function buildOptionSummary(identifier: 'Option A' | 'Option B', option: JourneyOptionInput): OptionSummary {
  const extras: string[] = [];
  if (option.cabin) extras.push(`Cabin: ${option.cabin}`);
  if (option.connectionAirports) extras.push(`Connection: ${option.connectionAirports}`);
  if (option.layoverMinutes !== undefined) extras.push(`Longest layover: ${formatMinutes(option.layoverMinutes)}`);
  if (option.airportChange !== 'unknown') extras.push(`Airport change: ${option.airportChange}`);
  if (option.selfTransfer !== 'unknown') extras.push(`Self-transfer: ${option.selfTransfer}`);
  // Decision-safety fix, Case 6: a short self-transfer connection gets an
  // additional, distinct caution line — never folded into the plain
  // "Self-transfer: yes" fact, so it can't be mistaken for equivalent to a
  // generous connection buffer.
  if (hasShortSelfTransferCaution(option)) extras.push(SHORT_SELF_TRANSFER_CAUTION_COPY);
  if (option.baggage === 'included') extras.push('Baggage: included');
  if (option.baggage === 'known-extra-cost') extras.push(`Baggage: extra £${option.baggageCostGBP} on top of the entered price`);

  return {
    identifier,
    label: option.label,
    priceText: `£${option.priceGBP} (${option.priceBasis === 'per-person' ? 'per person' : 'party total'})`,
    totalTimeText: `${formatMinutes(option.outboundDurationMinutes + option.returnDurationMinutes)} total`,
    outboundStopsText: pluralStops(option.outboundStops, 'outbound'),
    returnStopsText: pluralStops(option.returnStops, 'return'),
    extras,
  };
}

function buildStillUnknown(identifier: 'Option A' | 'Option B', option: JourneyOptionInput): string[] {
  const lines: string[] = [];
  if (option.airportChange === 'unknown') lines.push(`${identifier}: airport change unknown.`);
  if (option.selfTransfer === 'unknown') lines.push(`${identifier}: self-transfer unknown.`);
  if (option.baggage === 'not-stated') lines.push(`${identifier}: baggage not stated.`);
  if (option.baggage === 'extra-cost-unknown') lines.push(`${identifier}: baggage extra cost unknown.`);
  // Decision-safety fix, Case 6/direct-flight logic: a connection airport or
  // layover genuinely cannot apply to an option that is direct on both legs
  // — that isn't an unconfirmed fact, it's an inapplicable one, so it must
  // not be listed alongside genuine unknowns. Only asked about, and only
  // flagged as unentered, when at least one leg actually has a stop.
  const isFullyDirect = option.outboundStops === 0 && option.returnStops === 0;
  if (!isFullyDirect) {
    if (!option.connectionAirports) lines.push(`${identifier}: connection airport(s) not entered.`);
    if (option.layoverMinutes === undefined) lines.push(`${identifier}: layover not entered.`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Baggage-adjusted payable total (decision-safety fix, 12 Sept 2026, Case 8)
// ---------------------------------------------------------------------------
//
// Real 10-case evaluation finding: Option A = £500 including bag, Option B =
// £455 + £70 bag. The engine compared the two ENTERED prices (£500 vs £455 —
// "Option A costs £45 more") when the real payable totals are £500 vs £525 —
// Option A is actually £25 CHEAPER. A material wrong-decision defect.
//
// Fix: the headline price comparison uses each option's confirmed PAYABLE
// total whenever it is fully known (baggage included, or a known extra
// cost) for BOTH options — never a silent guess. When baggage is
// 'extra-cost-unknown' or 'not-stated' on either side, the payable total for
// that side genuinely isn't confirmed, so the comparison falls back to the
// entered price alone and says so explicitly — it never invents an unknown
// baggage charge as £0.

/**
 * The confirmed amount the traveller would actually pay for this option, or
 * `null` when that isn't fully knowable from what was entered. Only
 * 'included' (no extra) and 'known-extra-cost' with a real cost figure
 * produce a confirmed total — 'not-stated' and 'extra-cost-unknown' cannot,
 * by definition, and must never be treated as a £0 addition.
 */
function payableTotalGBP(option: JourneyOptionInput): number | null {
  if (option.baggage === 'included') return option.priceGBP;
  if (option.baggage === 'known-extra-cost' && option.baggageCostGBP !== undefined) {
    return Number((option.priceGBP + option.baggageCostGBP).toFixed(2));
  }
  return null;
}

/** True only when a confirmed baggage extra genuinely exists on at least one side — i.e. when using the payable total actually changes anything versus the raw entered price. */
function baggageAffectsPayableTotal(a: JourneyOptionInput, b: JourneyOptionInput): boolean {
  const extra = (o: JourneyOptionInput) => (o.baggage === 'known-extra-cost' ? o.baggageCostGBP ?? 0 : 0);
  return extra(a) > 0 || extra(b) > 0;
}

/** One sentence naming which option(s)' baggage cost is not confirmed, so the entered-price-only comparison above it can't be mistaken for the full payable total. `null` when both sides are fully confirmed. */
function unconfirmedBaggageQualifier(a: JourneyOptionInput, b: JourneyOptionInput): string | null {
  const aUnconfirmed = payableTotalGBP(a) === null;
  const bUnconfirmed = payableTotalGBP(b) === null;
  if (!aUnconfirmed && !bUnconfirmed) return null;
  if (aUnconfirmed && bUnconfirmed) {
    return "Neither option's baggage cost is fully confirmed, so this compares the entered price only — the actual payable total may differ for either.";
  }
  const which = aUnconfirmed ? 'Option A' : 'Option B';
  return `${which}'s baggage cost is not fully confirmed, so this compares the entered price only — the actual payable total may be higher.`;
}

/**
 * Compares two complete options. Callers must validate both with
 * `isJourneyOptionComplete()` first — this function assumes complete,
 * required-field data and does not re-validate (kept pure and simple; the
 * fail-closed gate lives at the validation boundary, not duplicated here).
 */
export function compareJourneyOptions(a: JourneyOptionInput, b: JourneyOptionInput): JourneyComparisonResult {
  const priceComparable = a.priceBasis === b.priceBasis;
  const basisText = (basis: PriceBasis) => (basis === 'per-person' ? 'per person' : 'as a party total');
  const basisWord = (basis: PriceBasis) => (basis === 'per-person' ? 'per person' : 'party total');
  const priceIncomparableReason = priceComparable
    ? undefined
    : `Option A is priced ${basisText(a.priceBasis)}; Option B is priced ${basisText(b.priceBasis)} — these cannot be compared directly.`;

  const payableA = priceComparable ? payableTotalGBP(a) : null;
  const payableB = priceComparable ? payableTotalGBP(b) : null;
  const bothPayableKnown = payableA !== null && payableB !== null;
  const useBaggageAdjustedTotal = bothPayableKnown && baggageAffectsPayableTotal(a, b);

  // The one canonical comparison basis: the confirmed payable total when
  // both sides have one, otherwise the entered price (with a qualifier
  // statement below making clear that's all it is). Never both at once.
  const priceDifferenceGBP = priceComparable
    ? Number(((bothPayableKnown ? payableA! : a.priceGBP) - (bothPayableKnown ? payableB! : b.priceGBP)).toFixed(2))
    : undefined;

  const totalA = a.outboundDurationMinutes + a.returnDurationMinutes;
  const totalB = b.outboundDurationMinutes + b.returnDurationMinutes;
  const totalTimeDifferenceMinutes = totalA - totalB;

  const outboundStopsDifference = a.outboundStops - b.outboundStops;
  const returnStopsDifference = a.returnStops - b.returnStops;

  // ---- Section A: comparisonStatements — always "Option A"/"Option B" ----
  const comparisonStatements: string[] = [];

  // Decision-safety fix, Case 10: different cabin products must never read
  // as a plain like-for-like fare comparison. Stated first, before any
  // price/time/stops line, and only when BOTH options record a cabin (never
  // inferred, never assumed equal when one or both are unset).
  if (a.cabin && b.cabin && a.cabin !== b.cabin) {
    comparisonStatements.push(
      `Option A is ${a.cabin} and Option B is ${b.cabin} — these are different cabin products, not a like-for-like comparison.`
    );
  }

  if (priceComparable && priceDifferenceGBP !== undefined) {
    const qualifier = useBaggageAdjustedTotal ? ' once baggage is included' : '';
    if (priceDifferenceGBP === 0) {
      const shownPrice = bothPayableKnown ? payableA! : a.priceGBP;
      comparisonStatements.push(`Option A and Option B are the same price${qualifier} (£${shownPrice}, ${basisWord(a.priceBasis)}).`);
    } else if (priceDifferenceGBP > 0) {
      const detail = useBaggageAdjustedTotal ? ` (£${payableA} vs £${payableB}, ${basisWord(a.priceBasis)})` : ` (${basisWord(a.priceBasis)})`;
      comparisonStatements.push(`Option A costs £${priceDifferenceGBP} more than Option B${qualifier}${detail}.`);
    } else {
      const detail = useBaggageAdjustedTotal ? ` (£${payableB} vs £${payableA}, ${basisWord(a.priceBasis)})` : ` (${basisWord(a.priceBasis)})`;
      comparisonStatements.push(`Option B costs £${Math.abs(priceDifferenceGBP)} more than Option A${qualifier}${detail}.`);
    }
    if (!bothPayableKnown) {
      const note = unconfirmedBaggageQualifier(a, b);
      if (note) comparisonStatements.push(note);
    }
  } else if (priceIncomparableReason) {
    comparisonStatements.push(priceIncomparableReason);
  }

  if (totalTimeDifferenceMinutes === 0) {
    comparisonStatements.push(`Option A and Option B have the same total journey time (${formatMinutes(totalA)}).`);
  } else if (totalTimeDifferenceMinutes < 0) {
    comparisonStatements.push(`Option A takes ${formatMinutes(Math.abs(totalTimeDifferenceMinutes))} less total journey time than Option B.`);
  } else {
    comparisonStatements.push(`Option B takes ${formatMinutes(totalTimeDifferenceMinutes)} less total journey time than Option A.`);
  }

  if (outboundStopsDifference === 0) {
    comparisonStatements.push(`Option A and Option B both have ${a.outboundStops} outbound ${a.outboundStops === 1 ? 'stop' : 'stops'}.`);
  } else if (outboundStopsDifference < 0) {
    comparisonStatements.push(`Option A has ${Math.abs(outboundStopsDifference)} fewer outbound stop(s) than Option B.`);
  } else {
    comparisonStatements.push(`Option B has ${outboundStopsDifference} fewer outbound stop(s) than Option A.`);
  }

  if (returnStopsDifference === 0) {
    comparisonStatements.push(`Option A and Option B both have ${a.returnStops} return ${a.returnStops === 1 ? 'stop' : 'stops'}.`);
  } else if (returnStopsDifference < 0) {
    comparisonStatements.push(`Option A has ${Math.abs(returnStopsDifference)} fewer return stop(s) than Option B.`);
  } else {
    comparisonStatements.push(`Option B has ${returnStopsDifference} fewer return stop(s) than Option A.`);
  }

  return {
    priceComparable,
    priceDifferenceGBP,
    priceIncomparableReason,
    priceComparisonUsesPayableTotal: bothPayableKnown,
    totalTimeDifferenceMinutes,
    outboundStopsDifference,
    returnStopsDifference,
    optionASummary: buildOptionSummary('Option A', a),
    optionBSummary: buildOptionSummary('Option B', b),
    comparisonStatements,
    stillUnknown: [...buildStillUnknown('Option A', a), ...buildStillUnknown('Option B', b)],
  };
}

// ---------------------------------------------------------------------------
// Display grouping for "Still unknown" (presentation-only, August 2026)
// ---------------------------------------------------------------------------
//
// compareJourneyOptions()'s `stillUnknown` array is untouched by this —
// it's still one line per missing/unknown field per option, and remains
// the source of truth every existing test asserts against. This is a pure,
// additive formatting helper the UI calls on top of that array to avoid
// showing up to 10 near-identical bullets: it groups each option's unknown
// topics into one natural-language sentence. It does not change what is
// known to be unknown, does not hide anything, and does not convert an
// unknown into a fact — it only changes how the same information reads.

// Decision-safety fix (12 Sept 2026): 'baggage extra cost unknown.' used to
// collapse into the same 'baggage' topic as 'baggage not stated.', so both
// rendered inside the generic "...were not entered" sentence — but an
// extra-cost-unknown baggage state was NOT left unentered; the traveller
// positively confirmed an extra charge exists, just not its amount. Folding
// it into "not entered" wording is itself a misleading collapse of two
// genuinely different states (see the file header's three-state
// distinction: not-entered/unknown status, extra cost known to exist but
// amount unknown, and a known amount). It is deliberately excluded from this
// map — and therefore from the generic bucket entirely — and given its own
// clause in `toSentence` below instead.
const UNKNOWN_TOPIC_BY_SUFFIX: Readonly<Record<string, string>> = {
  'airport change unknown.': 'airport change',
  'self-transfer unknown.': 'self-transfer',
  'baggage not stated.': 'baggage',
  'connection airport(s) not entered.': 'connection airport',
  'layover not entered.': 'layover',
};

const BAGGAGE_EXTRA_COST_UNKNOWN_SUFFIX = 'baggage extra cost unknown.';

function joinWithAnd(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Groups a JourneyComparisonResult's `stillUnknown` lines into one sentence
 * per option — e.g. "Airport change, self-transfer, baggage, connection
 * airport and layover were not entered." Lists only the topics that are
 * genuinely unknown for that option; returns `null` for an option with
 * nothing left unknown, rather than an empty sentence.
 *
 * A confirmed-but-unquantified baggage extra cost ('extra-cost-unknown') is
 * never folded into that "not entered" sentence — see this file's own
 * decision-safety-fix comment above `UNKNOWN_TOPIC_BY_SUFFIX` — and instead
 * gets its own explicit, distinctly-worded clause appended after it.
 */
export function groupStillUnknownByOption(stillUnknown: readonly string[]): { optionA: string | null; optionB: string | null } {
  const topicsFor: Record<'Option A' | 'Option B', string[]> = { 'Option A': [], 'Option B': [] };
  const baggageExtraCostUnknownFor: Record<'Option A' | 'Option B', boolean> = { 'Option A': false, 'Option B': false };

  for (const line of stillUnknown) {
    const match = line.match(/^(Option A|Option B): (.+)$/);
    if (!match) continue;
    const identifier = match[1] as 'Option A' | 'Option B';
    if (match[2] === BAGGAGE_EXTRA_COST_UNKNOWN_SUFFIX) {
      baggageExtraCostUnknownFor[identifier] = true;
      continue;
    }
    const topic = UNKNOWN_TOPIC_BY_SUFFIX[match[2]];
    if (topic && !topicsFor[identifier].includes(topic)) topicsFor[identifier].push(topic);
  }

  function toSentence(topics: string[], baggageExtraCostUnknown: boolean): string | null {
    const clauses: string[] = [];
    if (topics.length > 0) {
      const capitalizedList = topics.map((topic, i) => (i === 0 ? topic.charAt(0).toUpperCase() + topic.slice(1) : topic));
      const verb = topics.length === 1 ? 'was' : 'were';
      clauses.push(`${joinWithAnd(capitalizedList)} ${verb} not entered.`);
    }
    if (baggageExtraCostUnknown) {
      clauses.push('An extra baggage cost applies, but the amount is not confirmed.');
    }
    if (clauses.length === 0) return null;
    return clauses.join(' ');
  }

  return {
    optionA: toSentence(topicsFor['Option A'], baggageExtraCostUnknownFor['Option A']),
    optionB: toSentence(topicsFor['Option B'], baggageExtraCostUnknownFor['Option B']),
  };
}
