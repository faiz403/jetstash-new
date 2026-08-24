import type { SmartFareBaggage, SmartFareDirectness, SmartFareOptionSummary } from '@/lib/smart-fare-comparison';

/**
 * Journey Choice (MVP, pilot: manchester-islamabad only, 24 Aug 2026,
 * founder-approved following Journey Choice Brief Hero Project Phase 0).
 *
 * This module answers a different, narrower question than
 * lib/smart-fare-comparison.ts: not "what differences exist between these
 * genuinely comparable options" (that's deriveSmartFareComparison's job,
 * still called upstream via getSmartFareComparisonForRoute), but "which two
 * of those options make the single clearest trade-off a first-time visitor
 * can understand in about 10 seconds, and what sentence describes it".
 *
 * Deliberately built ONLY on top of SmartFareOptionSummary — the exact
 * exact-match-contract output PR #171 already enforces (identical cabin,
 * departureDate, returnDate, comparison-profile ID, currency; see
 * lib/smart-fare-route-adapter.ts's own doc comment). This module never
 * re-derives comparability and never sees the comparison-profile ID at
 * all: it isn't a field on SmartFareOptionSummary, so there is nothing
 * here to leak or misinterpret as baggage evidence. Baggage truth comes
 * only from each option's own `baggage` field (data/fare-observations.ts's
 * `baggage` text), never from any naming convention on an identifier.
 */

export interface JourneyChoiceOption {
  id: string;
  airline: string;
  cabin: string;
  price: number;
  currency: 'GBP';
  totalJourneyMinutes: number;
  outboundStops: number | null;
  returnStops: number | null;
  connectionAirports: string[];
  directness: SmartFareDirectness;
  baggage: SmartFareBaggage;
  departureDate: string;
  returnDate: string;
  checkedDate: string;
}

export interface JourneyChoiceDecision {
  /** fasterJourney.price - lowerFare.price. Always > 0 when a JourneyChoice is returned. */
  priceDifference: number;
  /** lowerFare.totalJourneyMinutes - fasterJourney.totalJourneyMinutes. Always > 0 when a JourneyChoice is returned. */
  timeDifferenceMinutes: number;
  /**
   * e.g. "£25 more saves 14h 15m of journey time." Always derived from
   * priceDifference/timeDifferenceMinutes above at render/compute time —
   * never a frozen string. If the underlying evidence changes (a new
   * comparable batch, a re-check), this sentence changes with it.
   */
  sentence: string;
}

export interface JourneyChoice {
  lowerFare: JourneyChoiceOption;
  fasterJourney: JourneyChoiceOption;
  decision: JourneyChoiceDecision;
  /** Any other comparable options beyond the two primaries — shown compactly, never hidden. */
  otherOptions: JourneyChoiceOption[];
  /** True only when every option's checked-baggage cost is actually known (included or a stated fee). */
  baggageCostConfirmedForAllOptions: boolean;
}

function formatPounds(value: number): string {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function toJourneyChoiceOption(option: SmartFareOptionSummary): JourneyChoiceOption {
  // totalJourneyMinutes is guaranteed non-null by deriveJourneyChoice's own
  // filter below before this is ever called.
  return {
    id: option.id,
    airline: option.airline,
    cabin: option.cabin,
    price: option.price,
    currency: option.currency,
    totalJourneyMinutes: option.totalJourneyMinutes!,
    outboundStops: option.outboundStops,
    returnStops: option.returnStops,
    connectionAirports: option.connectionAirports,
    directness: option.directness,
    baggage: option.baggage,
    departureDate: option.departureDate,
    returnDate: option.returnDate,
    checkedDate: option.checkedDate,
  };
}

function hasKnownBaggageCost(baggage: SmartFareBaggage): boolean {
  return baggage.kind === 'included' || baggage.kind === 'extra-charge-known';
}

/**
 * Derives the primary Journey Choice trade-off from an already
 * exact-match-comparable set of options (SmartFareComparison.options —
 * never a raw, unfiltered observation list).
 *
 * Selection:
 *   lowerFare     = cheapest option with known total journey time.
 *   fasterJourney = fastest option with known total journey time.
 *
 * Fails closed (returns null) rather than ever fabricating a trade-off:
 *   - fewer than 2 options carry a known total journey time
 *   - the cheapest and fastest option turn out to be the SAME observation
 *     (there is no genuine price-vs-time trade-off to describe)
 *   - the "faster" option isn't strictly cheaper-for-more or the "cheaper"
 *     option isn't strictly slower (i.e. price and time don't actually
 *     move in opposite directions between the two chosen options)
 *
 * This is a deliberately narrow MVP rule, not a general "best pair"
 * optimiser — see lib/journey-choice-route-adapter.ts's own doc comment
 * for why the route allowlist is a second, independent gate on top of this.
 */
export function deriveJourneyChoice(options: SmartFareOptionSummary[]): JourneyChoice | null {
  const withJourneyTime = options.filter(
    (option): option is SmartFareOptionSummary & { totalJourneyMinutes: number } => option.totalJourneyMinutes !== null
  );
  if (withJourneyTime.length < 2) return null;

  const cheapestFirst = [...withJourneyTime].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const lowerFare = cheapestFirst[0];

  const fastestFirst = [...withJourneyTime].sort(
    (a, b) => a.totalJourneyMinutes - b.totalJourneyMinutes || a.id.localeCompare(b.id)
  );
  const fasterJourney = fastestFirst[0];

  if (lowerFare.id === fasterJourney.id) return null;

  const priceDifference = fasterJourney.price - lowerFare.price;
  const timeDifferenceMinutes = lowerFare.totalJourneyMinutes - fasterJourney.totalJourneyMinutes;
  if (priceDifference <= 0 || timeDifferenceMinutes <= 0) return null;

  const otherOptions = withJourneyTime
    .filter((option) => option.id !== lowerFare.id && option.id !== fasterJourney.id)
    .sort((a, b) => a.checkedDate.localeCompare(b.checkedDate) || a.id.localeCompare(b.id));

  return {
    lowerFare: toJourneyChoiceOption(lowerFare),
    fasterJourney: toJourneyChoiceOption(fasterJourney),
    decision: {
      priceDifference,
      timeDifferenceMinutes,
      sentence: `${formatPounds(priceDifference)} more saves ${formatDuration(timeDifferenceMinutes)} of journey time.`,
    },
    otherOptions: otherOptions.map(toJourneyChoiceOption),
    baggageCostConfirmedForAllOptions: [lowerFare, fasterJourney, ...otherOptions].every((option) =>
      hasKnownBaggageCost(option.baggage)
    ),
  };
}
