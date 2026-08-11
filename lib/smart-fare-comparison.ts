/**
 * Evidence-led comparison of observed itineraries.
 *
 * This layer reports differences in the facts that are actually known. It is
 * deliberately separate from deriveTripValueVerdict(), which requires a
 * complete total-cost basis before it can name a value outcome.
 */

export type SmartFareDirectness = 'direct' | 'connecting' | 'unknown';

export type SmartFareBaggage =
  | { kind: 'included'; detail: string }
  | { kind: 'extra-charge-known'; fee: number; detail: string }
  | { kind: 'extra-charge-unknown'; detail: string }
  | { kind: 'not-stated'; detail: string };

export interface SmartFareMandatoryFee {
  label: string;
  amount: number;
  currency: 'GBP';
}

export interface SmartFareOption {
  id: string;
  airline: string;
  price: number;
  currency: 'GBP';
  departureDate: string;
  returnDate: string;
  checkedDate: string;
  directness: SmartFareDirectness;
  stops: number | null;
  outboundStops: number | null;
  returnStops: number | null;
  connectionAirports: string[];
  outboundJourneyMinutes: number | null;
  returnJourneyMinutes: number | null;
  outboundLayoverMinutes: number[];
  returnLayoverMinutes: number[];
  baggage: SmartFareBaggage;
  mandatoryFees: SmartFareMandatoryFee[];
  mandatoryFeeEvidence: 'complete' | 'incomplete';
}

export interface SmartFareOptionSummary {
  id: string;
  airline: string;
  price: number;
  currency: 'GBP';
  departureDate: string;
  returnDate: string;
  checkedDate: string;
  directness: SmartFareDirectness;
  stops: number | null;
  outboundStops: number | null;
  returnStops: number | null;
  connectionAirports: string[];
  outboundJourneyMinutes: number | null;
  returnJourneyMinutes: number | null;
  totalJourneyMinutes: number | null;
  outboundLayoverMinutes: number[];
  returnLayoverMinutes: number[];
  baggage: SmartFareBaggage;
  mandatoryFees: SmartFareMandatoryFee[];
  mandatoryFeeEvidence: 'complete' | 'incomplete';
}

export type SmartFarePairStatementKind = 'price-time' | 'connection';

export interface SmartFarePairStatement {
  optionIds: [string, string];
  kind: SmartFarePairStatementKind;
  text: string;
}

export interface SmartFareComparison {
  options: SmartFareOptionSummary[];
  pairStatements: SmartFarePairStatement[];
  statements: string[];
  /** Always false when any mandatory cost component is not evidenced. */
  totalCostComparisonReady: boolean;
}

function formatPounds(value: number): string {
  return `\u00a3${Math.round(value).toLocaleString('en-GB')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatStops(stops: number): string {
  return `${stops} ${stops === 1 ? 'stop' : 'stops'}`;
}

function formatBaggageStatement(option: SmartFareOption): string {
  switch (option.baggage.kind) {
    case 'included':
      return `${option.airline}: checked baggage is included.`;
    case 'extra-charge-known':
      return `${option.airline}: checked baggage costs an additional ${formatPounds(option.baggage.fee)}.`;
    case 'extra-charge-unknown':
      return `${option.airline}: checked baggage costs extra, but the amount was not shown.`;
    case 'not-stated':
      return `${option.airline}: baggage allowance and charges were not stated.`;
  }
}

function hasCompleteTotalCostEvidence(option: SmartFareOption): boolean {
  return (option.baggage.kind === 'included'
    || (option.baggage.kind === 'extra-charge-known' && Number.isFinite(option.baggage.fee) && option.baggage.fee >= 0))
    && option.mandatoryFeeEvidence === 'complete';
}

function pairStatements(first: SmartFareOptionSummary, second: SmartFareOptionSummary): SmartFarePairStatement[] {
  const result: SmartFarePairStatement[] = [];
  const ids: [string, string] = [first.id, second.id];

  if (first.currency === second.currency && Number.isFinite(first.price) && Number.isFinite(second.price) && first.price !== second.price) {
    const higher = first.price > second.price ? first : second;
    const lower = higher.id === first.id ? second : first;
    if (higher.totalJourneyMinutes !== null && lower.totalJourneyMinutes !== null && higher.totalJourneyMinutes < lower.totalJourneyMinutes) {
      result.push({
        optionIds: ids,
        kind: 'price-time',
        text: `${formatPounds(higher.price - lower.price)} more saves ${formatDuration(lower.totalJourneyMinutes - higher.totalJourneyMinutes)} of total journey time.`,
      });
    } else if (higher.totalJourneyMinutes !== null && lower.totalJourneyMinutes !== null && higher.totalJourneyMinutes > lower.totalJourneyMinutes) {
      result.push({
        optionIds: ids,
        kind: 'price-time',
        text: `${formatPounds(higher.price - lower.price)} more takes ${formatDuration(higher.totalJourneyMinutes - lower.totalJourneyMinutes)} longer overall.`,
      });
    }
  }

  if (first.stops !== null && second.stops !== null && first.stops !== second.stops) {
    const fewer = first.stops < second.stops ? first : second;
    const more = fewer.id === first.id ? second : first;
    result.push({
      optionIds: ids,
      kind: 'connection',
      text: `${fewer.airline} has ${formatStops(more.stops! - fewer.stops!)} fewer than ${more.airline}.`,
    });
  }

  const firstOutboundLayover = first.outboundLayoverMinutes[0];
  const secondOutboundLayover = second.outboundLayoverMinutes[0];
  if (firstOutboundLayover !== undefined && secondOutboundLayover !== undefined && firstOutboundLayover !== secondOutboundLayover) {
    const shorter = firstOutboundLayover < secondOutboundLayover ? first : second;
    const longer = shorter.id === first.id ? second : first;
    const longerMinutes = longer.outboundLayoverMinutes[0]!;
    result.push({
      optionIds: ids,
      kind: 'connection',
      text: `${shorter.airline} has a shorter outbound connection (${formatDuration(shorter.outboundLayoverMinutes[0]!)} versus ${formatDuration(longerMinutes)}).`,
    });
  }

  return result;
}

/**
 * Produces factual itinerary comparisons only. It never names a winner or
 * turns an unknown baggage charge into zero. A caller may render the returned
 * option summaries without exposing any additional interpretation.
 */
export function deriveSmartFareComparison(options: SmartFareOption[]): SmartFareComparison {
  const summaries = options.map((option): SmartFareOptionSummary => ({
    ...option,
    totalJourneyMinutes: option.outboundJourneyMinutes !== null && option.returnJourneyMinutes !== null
      ? option.outboundJourneyMinutes + option.returnJourneyMinutes
      : null,
  }));

  const pairResults = summaries.flatMap((first, index) => summaries.slice(index + 1).flatMap((second) => pairStatements(first, second)));
  const statements = [
    ...summaries.map(formatBaggageStatement),
    ...summaries.flatMap((option) => option.mandatoryFees.map((fee) => {
      const label = fee.label.toLowerCase().endsWith('fee') ? fee.label : `${fee.label} fee`;
      return `${option.airline}: mandatory ${label} is ${formatPounds(fee.amount)}.`;
    })),
    ...pairResults.map((statement) => statement.text),
  ];

  return {
    options: summaries,
    pairStatements: pairResults,
    statements,
    totalCostComparisonReady: summaries.length >= 2 && summaries.every(hasCompleteTotalCostEvidence),
  };
}
