/**
 * Evidence-gated comparison for a small set of manually observed trip options.
 *
 * This deliberately does not estimate missing baggage fees, journey times or
 * connection quality. If either option lacks those facts, the result stays
 * neutral instead of manufacturing a value judgement from incomplete data.
 */

export interface TripOptionForValueVerdict {
  id: string;
  price: number;
  baggage: {
    included: boolean;
    fee: number | null;
  };
  totalJourneyMinutes: number | null;
  stops: number | null;
}

export type TripValueVerdictKind =
  | 'dominant'
  | 'lower-total-cost'
  | 'faster-journey'
  | 'trade-off'
  | 'insufficient-evidence';

export interface TripValueVerdict {
  kind: TripValueVerdictKind;
  optionId: string | null;
  totalCost: number | null;
  comparison: string;
  reasons: string[];
}

function formatPounds(value: number): string {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function totalCost(option: TripOptionForValueVerdict): number | null {
  if (!Number.isFinite(option.price) || option.price < 0) return null;
  if (!option.baggage.included && option.baggage.fee === null) return null;
  if (option.baggage.fee !== null && (!Number.isFinite(option.baggage.fee) || option.baggage.fee < 0)) return null;
  return option.price + (option.baggage.included ? 0 : option.baggage.fee ?? 0);
}

function hasComparableJourneyFacts(option: TripOptionForValueVerdict): boolean {
  return option.totalJourneyMinutes !== null
    && Number.isFinite(option.totalJourneyMinutes)
    && option.totalJourneyMinutes >= 0
    && option.stops !== null
    && Number.isInteger(option.stops)
    && option.stops >= 0;
}

/**
 * Compares two or more options without pretending that incomplete data is a
 * recommendation. A dominant option must be no more expensive and no slower,
 * with at least one strict improvement. Otherwise the result describes the
 * observed trade-off and leaves the traveller to choose what matters more.
 */
export function deriveTripValueVerdict(options: TripOptionForValueVerdict[]): TripValueVerdict {
  if (options.length < 2) {
    return {
      kind: 'insufficient-evidence',
      optionId: null,
      totalCost: null,
      comparison: 'We need at least two comparable options before weighing value.',
      reasons: ['Only one comparable option was supplied.'],
    };
  }

  const enriched = options.map((option) => ({
    option,
    totalCost: totalCost(option),
    hasJourneyFacts: hasComparableJourneyFacts(option),
  }));

  if (enriched.some((item) => item.totalCost === null || !item.hasJourneyFacts)) {
    return {
      kind: 'insufficient-evidence',
      optionId: null,
      totalCost: null,
      comparison: 'We cannot compare total journey value yet because one or more options are missing verified baggage or journey details.',
      reasons: ['Baggage cost and total journey details must be known for every option.'],
    };
  }

  const dominant = enriched.find((candidate) => enriched.every((other) => {
    if (other.option.id === candidate.option.id) return true;
    return candidate.totalCost! <= other.totalCost!
      && candidate.option.totalJourneyMinutes! <= other.option.totalJourneyMinutes!
      && (candidate.totalCost! < other.totalCost! || candidate.option.totalJourneyMinutes! < other.option.totalJourneyMinutes!);
  }));

  if (dominant) {
    return {
      kind: 'dominant',
      optionId: dominant.option.id,
      totalCost: dominant.totalCost,
      comparison: `${formatPounds(dominant.totalCost!)} total and ${formatDuration(dominant.option.totalJourneyMinutes!)} journey time — lower or equal on both measures.`,
      reasons: ['Baggage treatment is included in the total.', 'The journey is no slower than the alternatives.'],
    };
  }

  const cheapest = enriched.reduce((best, candidate) => candidate.totalCost! < best.totalCost! ? candidate : best);
  const fastest = enriched.reduce((best, candidate) => candidate.option.totalJourneyMinutes! < best.option.totalJourneyMinutes! ? candidate : best);

  if (cheapest.option.id === fastest.option.id) {
    return {
      kind: 'dominant',
      optionId: cheapest.option.id,
      totalCost: cheapest.totalCost,
      comparison: `${formatPounds(cheapest.totalCost!)} total and the fastest observed journey at ${formatDuration(cheapest.option.totalJourneyMinutes!)}.`,
      reasons: ['This option is both the lowest total cost and the fastest observed journey.'],
    };
  }

  const costDifference = fastest.totalCost! - cheapest.totalCost!;
  const timeDifference = cheapest.option.totalJourneyMinutes! - fastest.option.totalJourneyMinutes!;
  const fasterText = formatDuration(Math.abs(timeDifference));
  const costText = formatPounds(Math.abs(costDifference));

  if (costDifference > 0 && timeDifference > 0) {
    return {
      kind: 'trade-off',
      optionId: null,
      totalCost: null,
      comparison: `The faster option costs ${costText} more and saves ${fasterText}; the cheaper option costs ${formatPounds(cheapest.totalCost!)} total.`,
      reasons: ['Neither option is best on both total cost and journey time.'],
    };
  }

  return {
    kind: 'trade-off',
    optionId: null,
    totalCost: null,
    comparison: `The observed options trade total cost against journey time: ${formatPounds(cheapest.totalCost!)} is cheapest and ${formatDuration(fastest.option.totalJourneyMinutes!)} is fastest.`,
    reasons: ['The evidence does not support naming one option the overall winner.'],
  };
}
