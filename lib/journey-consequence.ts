import type { FareObservation } from '@/data/fare-observations';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';

/**
 * Bad-fare prominence / journey-consequence fix (5 September 2026,
 * independently reproduced Astra findings: Manchester-Istanbul's £153
 * self-transfer/27h55m outbound, Manchester-Agadir's 20h55m return with a
 * Milan airport change, Manchester-Dubai's £336 observation whose itinerary
 * actually arrives at Sharjah, Manchester-Lahore's cumbersome Business
 * examples). The underlying evidence in every one of these cases was
 * already correct and already recorded — the problem is that a prominent
 * fare summary (Fare Signal, Tracked Fares Explorer, DealCard) can show an
 * attractive price with no decisive journey consequence visible beside it,
 * so a traveller has to open deep evidence to discover a self-transfer,
 * an airport change, an extreme elapsed duration, or an arrival airport
 * that differs from the route's own destination.
 *
 * This module is the ONE place that reads a `FareObservation`'s own
 * recorded evidence for these specific, narrow signals, mirroring
 * `lib/fare-self-transfer.ts`'s established discipline exactly:
 *
 *   - Reads only `priceNote` (plus the already-structured
 *     outboundJourneyMinutes/returnJourneyMinutes fields when present) —
 *     never infers a consequence from price, stop count, or airline count
 *     alone.
 *   - Every text-based extractor is deliberately conservative: it returns
 *     `null` (no signal) rather than a guess whenever the priceNote's
 *     routing description has embedded complexity (airline names, nested
 *     parenthetical detail) it can't confidently parse. A missed signal on
 *     a messily-formatted observation is an acceptable, honest gap; a
 *     WRONG signal is not. Every extractor here was tested against the
 *     four confirmed live examples above before being trusted with real
 *     data — see tests/journey-consequence.test.ts.
 *   - No observation data is created, guessed, or backfilled. Where a
 *     structured field (outboundJourneyMinutes, returnJourneyMinutes)
 *     already exists on the observation, it's used directly and preferred
 *     over any text extraction. Where it's absent, text extraction is
 *     attempted under the strict preconditions above; if that also fails,
 *     the corresponding consequence field is `null` (unknown), and unknown
 *     is never rendered as a fact.
 *
 * The suppression threshold for a genuinely poor itinerary already exists
 * (`isPoorItinerarySuitability()`, lib/fare-signal.ts — self-transfer AND
 * 2+ stops on either leg) and is untouched by this module: that governs
 * WHETHER an observation is shown as the current representative fare at
 * all. This module governs WHAT a shown observation's own summary says —
 * a fare that correctly passes the suitability threshold (e.g. a genuine
 * 1-stop self-transfer) can still have a decisive consequence worth
 * surfacing prominently, which is exactly the Manchester-Istanbul and
 * Manchester-Agadir cases: both pass suppression (1 stop, not 2+) but both
 * have a materially long, ground-transfer-airport-changing return leg.
 */

export interface JourneyConsequences {
  /** From the existing, unchanged predicate — see lib/fare-self-transfer.ts. */
  selfTransfer: boolean;
  /**
   * The two airport codes named in an explicit "ground transfer between X
   * and Y airports" statement already in the observation's own priceNote —
   * e.g. Manchester-Agadir's MXP/BGY (Milan Malpensa to Milan Bergamo).
   * `null` when no such statement is present.
   */
  groundTransferAirports: readonly [string, string] | null;
  /**
   * The human-readable city name the observation's own priceNote already
   * states next to an explicit "long layover" flag (e.g. "16h10m Milan
   * long layover") — reused verbatim, never invented. `null` when no
   * layover is flagged as long, or the city name couldn't be confidently
   * extracted from that specific sentence.
   */
  longLayoverCity: string | null;
  /** True when priceNote contains the literal, already-established "long layover" marker — see the doc comment above for why this is safe to read as a genuine signal rather than an inference. */
  hasLongLayover: boolean;
  /**
   * Formatted elapsed duration for each leg (e.g. "27h 55m"), preferring
   * the observation's own structured outboundJourneyMinutes/
   * returnJourneyMinutes when present, falling back to a conservative
   * priceNote extraction (see extractLegDurationFromText's own doc
   * comment) only when the structured field is absent. `null` when
   * neither source can confidently establish it — never estimated.
   */
  outboundDuration: string | null;
  returnDuration: string | null;
  /**
   * The actual final airport code the outbound leg's own priceNote states
   * it arrives at, only when it could be confidently extracted AND differs
   * from the destination's own recorded IATA code — e.g.
   * Manchester-Dubai's SHJ (Sharjah) against the route's own DXB. `null`
   * when the codes match, or the routing string couldn't be confidently
   * parsed (see extractCleanRoutingCodes's own doc comment) — a `null`
   * here is NOT a claim that the airports match, only that this module
   * couldn't confidently establish otherwise; it never asserts a mismatch
   * it can't support.
   */
  arrivalAirportMismatch: string | null;
}

const GROUND_TRANSFER_PATTERN = /ground transfer between ([A-Z]{3}) and ([A-Z]{3})/i;
const LONG_LAYOVER_PATTERN = /\blong layover\b/i;
/** Captures the city name the observation's own text already states immediately before "long layover", e.g. "(16h10m Milan long layover" -> "Milan". */
const LONG_LAYOVER_CITY_PATTERN = /\(\s*[\dh\s]+m?\s+([A-Z][a-zA-Z]+)\s+long layover/i;

/**
 * Deliberately strict: only matches a routing string that is PURELY
 * hyphen-separated 3-letter airport codes with nothing else interspersed
 * (no airline names, no parenthetical detail) — e.g. "MAN-SAW-SHJ", not
 * "MAN-ATH(Aegean A3639)-CAI(...)" or "MAN-REU(-ground transfer to
 * BCN)-IST". Returns `null` for anything it isn't fully confident about,
 * by construction (a partial/best-effort parse of a messy string risks
 * silently dropping a leg and returning a wrong final airport, which is
 * worse than surfacing nothing). Verified against all four of this fix's
 * confirmed live examples — see tests/journey-consequence.test.ts.
 */
export function extractCleanRoutingCodes(priceNote: string, leg: 'outbound' | 'return'): string[] | null {
  const pattern = new RegExp(`\\b${leg}\\s+([A-Z]{3}(?:-[A-Z]{3})+)(?=[,;])`);
  const match = priceNote.match(pattern);
  return match ? match[1].split('-') : null;
}

/**
 * Same strict precondition as extractCleanRoutingCodes (the routing string
 * right after the leg keyword must be a clean hyphen-separated code
 * sequence) before trusting a trailing duration figure — if that
 * precondition isn't met, returns `null` rather than a guess.
 */
function extractLegDurationFromText(priceNote: string, leg: 'outbound' | 'return'): string | null {
  const pattern = new RegExp(`\\b${leg}\\s+[A-Z]{3}(?:-[A-Z]{3})+,[^;]*?(\\d+h\\s?\\d*m?)\\b`);
  const match = priceNote.match(pattern);
  return match ? match[1].trim() : null;
}

/** "27h55m" / "26h" -> "27h 55m" / "26h" — matches the site's existing "Xh Ym" spacing convention. */
function normaliseDurationSpacing(duration: string): string {
  return duration.replace(/^(\d+h)(\d)/, '$1 $2');
}

function formatMinutesAsDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`;
}

export function getJourneyConsequences(
  observation: Pick<FareObservation, 'priceNote' | 'outboundJourneyMinutes' | 'returnJourneyMinutes'>,
  destinationIataCode: string | null
): JourneyConsequences {
  const priceNote = observation.priceNote ?? '';

  const groundTransferMatch = priceNote.match(GROUND_TRANSFER_PATTERN);
  const hasLongLayover = LONG_LAYOVER_PATTERN.test(priceNote);
  const layoverCityMatch = hasLongLayover ? priceNote.match(LONG_LAYOVER_CITY_PATTERN) : null;

  const outboundDuration = observation.outboundJourneyMinutes !== undefined
    ? formatMinutesAsDuration(observation.outboundJourneyMinutes)
    : (() => {
        const extracted = extractLegDurationFromText(priceNote, 'outbound');
        return extracted ? normaliseDurationSpacing(extracted) : null;
      })();
  const returnDuration = observation.returnJourneyMinutes !== undefined
    ? formatMinutesAsDuration(observation.returnJourneyMinutes)
    : (() => {
        const extracted = extractLegDurationFromText(priceNote, 'return');
        return extracted ? normaliseDurationSpacing(extracted) : null;
      })();

  let arrivalAirportMismatch: string | null = null;
  if (destinationIataCode) {
    const outboundCodes = extractCleanRoutingCodes(priceNote, 'outbound');
    const finalCode = outboundCodes?.[outboundCodes.length - 1] ?? null;
    if (finalCode && finalCode !== destinationIataCode) {
      arrivalAirportMismatch = finalCode;
    }
  }

  return {
    selfTransfer: isSelfTransferItinerary(priceNote),
    groundTransferAirports: groundTransferMatch ? [groundTransferMatch[1], groundTransferMatch[2]] : null,
    longLayoverCity: layoverCityMatch ? layoverCityMatch[1] : null,
    hasLongLayover,
    outboundDuration,
    returnDuration,
    arrivalAirportMismatch,
  };
}

/**
 * Whether a formatted "Xh Ym" duration is extreme enough to be a decisive
 * consequence on its own — a full calendar day (24h) or more spent
 * travelling, a round, defensible, non-arbitrary-feeling threshold rather
 * than a fine-tuned score. Only ever applied to a duration this module
 * already confidently knows (structured field or a conservative text
 * extraction) — never estimated.
 */
function isExtremeDuration(duration: string | null): boolean {
  if (!duration) return false;
  const hours = parseInt(duration, 10);
  return Number.isFinite(hours) && hours >= 24;
}

/** True when any decisive consequence was actually found — used to gate whether the summary line renders at all. */
export function hasAnyJourneyConsequence(c: JourneyConsequences): boolean {
  return (
    c.selfTransfer ||
    c.groundTransferAirports !== null ||
    c.hasLongLayover ||
    c.arrivalAirportMismatch !== null ||
    isExtremeDuration(c.outboundDuration) ||
    isExtremeDuration(c.returnDuration)
  );
}

/**
 * Builds the short, plain-language label list for a prominent fare summary
 * — priced to sit directly beside the fare, not buried in deep evidence.
 * Priority order: an arrival-airport mismatch is the most consequential
 * fact (it changes what "this destination" even means), followed by
 * self-transfer (changes who's responsible for the connection), then the
 * ground-transfer airport change and long layover (why the journey takes
 * as long as it does), then the duration figures themselves. Deliberately
 * short — this is not a general-purpose itinerary dump; see this module's
 * own doc comment for the "decisive consequence" scope.
 */
export function formatJourneyConsequenceSummary(c: JourneyConsequences): string[] {
  const parts: string[] = [];
  if (c.arrivalAirportMismatch) parts.push(`Arrives at ${c.arrivalAirportMismatch}`);
  if (c.selfTransfer) parts.push('Self-transfer');
  if (c.groundTransferAirports) {
    parts.push(
      c.longLayoverCity
        ? `${c.longLayoverCity} airport change`
        : `Airport change (${c.groundTransferAirports[0]}→${c.groundTransferAirports[1]})`
    );
  } else if (c.hasLongLayover && c.longLayoverCity) {
    parts.push(`${c.longLayoverCity} long layover`);
  } else if (c.hasLongLayover) {
    parts.push('Long layover');
  }
  // Duration is supporting context for a consequence that specifically
  // implies an inflated journey time (an airport change, a long layover,
  // or the duration itself being extreme — a full day or more) — never
  // attached to self-transfer alone, since an ordinary short self-transfer
  // flight's duration is not itself a "decisive consequence" (Part 5: "a
  // normal protected journey should remain concise").
  if (c.groundTransferAirports || c.hasLongLayover || isExtremeDuration(c.outboundDuration) || isExtremeDuration(c.returnDuration)) {
    if (c.outboundDuration) parts.push(`Outbound: ${c.outboundDuration}`);
    if (c.returnDuration) parts.push(`Return: ${c.returnDuration}`);
  }
  return parts;
}
