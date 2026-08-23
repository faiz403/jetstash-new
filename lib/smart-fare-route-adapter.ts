import {
  getPublishableObservationsByRoute,
  type FareObservation,
} from '@/data/fare-observations';
import {
  deriveSmartFareComparison,
  type SmartFareBaggage,
  type SmartFareComparison,
  type SmartFareOption,
} from '@/lib/smart-fare-comparison';

function mapBaggage(observation: FareObservation): SmartFareBaggage {
  const detail = observation.baggage ?? 'Baggage allowance and charges were not stated.';
  const lower = detail.toLowerCase();
  if (lower.includes('included')) return { kind: 'included', detail };
  if (lower.includes('fee') && !lower.includes('may apply')) {
    return { kind: 'extra-charge-unknown', detail };
  }
  if (lower.includes('optional charges') || lower.includes('costs extra')) {
    return { kind: 'extra-charge-unknown', detail };
  }
  return { kind: 'not-stated', detail };
}

function toSmartFareOption(observation: FareObservation): SmartFareOption | null {
  if (!observation.departureDate || !observation.returnDate || !observation.currency) return null;
  if (!observation.fareDirectness || observation.fareDirectness === 'unknown') return null;

  const outboundStops = observation.outboundStops ?? null;
  const returnStops = observation.returnStops ?? null;
  const totalStops = outboundStops !== null && returnStops !== null
    ? outboundStops + returnStops
    : null;

  return {
    id: observation.id,
    airline: observation.source,
    cabin: observation.cabin,
    price: observation.price,
    currency: observation.currency,
    departureDate: observation.departureDate,
    returnDate: observation.returnDate,
    checkedDate: observation.observedDate,
    directness: observation.fareDirectness,
    stops: totalStops,
    outboundStops,
    returnStops,
    connectionAirports: [...new Set([
      ...(observation.outboundConnectionAirports ?? []),
      ...(observation.returnConnectionAirports ?? []),
    ])],
    outboundJourneyMinutes: observation.outboundJourneyMinutes ?? null,
    returnJourneyMinutes: observation.returnJourneyMinutes ?? null,
    outboundLayoverMinutes: observation.outboundLayoverMinutes ?? [],
    returnLayoverMinutes: observation.returnLayoverMinutes ?? [],
    baggage: mapBaggage(observation),
    mandatoryFees: [],
    mandatoryFeeEvidence: 'incomplete',
  };
}

/**
 * An observation with every field a genuine like-for-like comparison
 * requires, all guaranteed present (not just "truthy" — TypeScript narrows
 * each one).
 */
interface ComparableObservation extends FareObservation {
  departureDate: string;
  returnDate: string;
  currency: 'GBP';
  profileId: string;
  fareDirectness: Exclude<FareObservation['fareDirectness'], undefined | 'unknown'>;
}

/**
 * Smart Fare Comparison integrity reset (23 Aug 2026, founder-approved,
 * following an independent P0 verification — see lib/smart-fare-comparison.ts's
 * own doc comment for the confirmed defect this replaces).
 *
 * The PREVIOUS eligibility rule was "current, dated, known directness" and
 * nothing else — no cabin check, no exact-date check, no passenger/profile
 * check. Verified against the real archive: 64 routes rendered a
 * comparison, only 1 (manchester-islamabad) was genuinely like-for-like.
 * 4 silently compared Economy against Business with the cabin difference
 * never surfaced anywhere in the UI; 62 silently compared two different
 * travel-date windows (the archive's own "N weeks from check date" rolling
 * methodology means consecutive weekly checks rarely land on the same
 * literal dates, even for the same cabin).
 *
 * The invariant now enforced, exactly (founder-specified, deliberately
 * strict, no fuzzy date matching): two observations are only comparable
 * if they share IDENTICAL cabin, departureDate, returnDate, profileId and
 * currency. profileId is the one structured field that already encodes
 * the passenger/bag/trip-type series (e.g.
 * "manchester-islamabad-economy-1adult-23kg-v1") — there is no separate
 * structured trip-type or passenger-count field on FareObservation today,
 * so profileId equality is the correct, currently-available proxy for
 * that invariant, not a substitute chosen to skip it. An observation
 * missing profileId (a small number of historic entries predate the
 * field) can never be grouped with anything — unknown profile is never
 * treated as "probably compatible".
 *
 * This deliberately drops from 64 routes to 1 on today's real data. That
 * is the correct, honest outcome — see this project's own COMPARABLE OR
 * NOT SHOWN standing rule. The archive's collection methodology can later
 * be changed to intentionally target a fixed comparison window (as
 * manchester-islamabad's original pilot batch happened to), which would
 * let more routes re-qualify honestly over time — this fix does not
 * attempt that, and does not weaken the invariant to manufacture more
 * coverage in the meantime.
 */
function comparisonGroupKey(observation: ComparableObservation): string {
  return [observation.cabin, observation.departureDate, observation.returnDate, observation.profileId, observation.currency].join('::');
}

function isComparable(observation: FareObservation): observation is ComparableObservation {
  return (
    observation.comparisonEligibility === 'current'
    && Boolean(observation.departureDate)
    && Boolean(observation.returnDate)
    && Boolean(observation.currency)
    && Boolean(observation.profileId)
    && Boolean(observation.fareDirectness)
    && observation.fareDirectness !== 'unknown'
  );
}

/**
 * Picks the single largest exact-match comparison group for a route (ties
 * broken by whichever group's most recent member was checked most
 * recently) — never blends two different groups, and never assumes the
 * globally "latest" observations belong together the way the pre-reset
 * code did.
 */
function selectBestComparisonGroup(observations: ComparableObservation[]): ComparableObservation[] | null {
  const groups = new Map<string, ComparableObservation[]>();
  for (const observation of observations) {
    const key = comparisonGroupKey(observation);
    const group = groups.get(key);
    if (group) group.push(observation);
    else groups.set(key, [observation]);
  }

  let best: ComparableObservation[] | null = null;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    if (!best) {
      best = group;
      continue;
    }
    if (group.length > best.length) {
      best = group;
      continue;
    }
    if (group.length === best.length) {
      const latestOf = (g: ComparableObservation[]) => g.reduce((max, o) => (o.observedDate > max ? o.observedDate : max), g[0].observedDate);
      if (latestOf(group) > latestOf(best)) best = group;
    }
  }
  return best;
}

/**
 * Selects only explicitly current, structured, genuinely comparable
 * observations from an arbitrary observation list — see
 * selectBestComparisonGroup's own doc comment for the exact-match
 * invariant. Exported (rather than kept as a private step inside
 * getSmartFareComparisonForRoute below) so regression tests can exercise
 * the actual selection/grouping logic with explicit synthetic fixtures,
 * the same pattern lib/fare-signal.ts's deriveFareSignal() already
 * established for its own cabin-safety regression coverage — never
 * re-verified only against whatever the live archive happens to contain
 * today.
 */
export function selectComparableSmartFareOptions(observations: FareObservation[]): SmartFareOption[] {
  const comparable = observations.filter(isComparable);
  const group = selectBestComparisonGroup(comparable);
  if (!group) return [];

  // Most recently checked members of the winning group, in checked-date
  // order — the group is already guaranteed identical cabin/dates/profile,
  // so this only ever chooses between otherwise-comparable price checks.
  return group
    .slice(-3)
    .map(toSmartFareOption)
    .filter((option): option is SmartFareOption => option !== null);
}

/**
 * Historical fares stay in the archive and are never silently mixed into
 * a current comparison — see selectComparableSmartFareOptions above.
 */
export function getSmartFareComparisonForRoute(routeSlug: string, nowIso: string): SmartFareComparison | null {
  const options = selectComparableSmartFareOptions(getPublishableObservationsByRoute(routeSlug, nowIso));
  return options.length >= 2 ? deriveSmartFareComparison(options) : null;
}
