import type { FareObservation } from '@/data/fare-observations';
import { isSelfTransferItinerary } from '@/lib/fare-self-transfer';
import { isPoorItinerarySuitability } from '@/lib/itinerary-suitability';

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
 * an airport change, a decisive elapsed duration, or an arrival airport
 * that differs from the route's own destination.
 *
 * This module is the ONE place that reads a `FareObservation`'s own
 * recorded evidence for these specific, narrow signals, mirroring
 * `lib/fare-self-transfer.ts`'s established discipline exactly:
 *
 *   - Reads only `priceNote` (plus the already-structured
 *     outboundJourneyMinutes/returnJourneyMinutes fields when present) —
 *     never infers a consequence from price, stop count, or airline count
 *     alone. The one exception is deliberate and narrow: whether a leg's
 *     own KNOWN duration is worth SHOWING (not detecting) can also reuse
 *     the existing, canonical isPoorItinerarySuitability() self-transfer
 *     + stop-count verdict — see getJourneyConsequences's own doc comment.
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
 * (`isPoorItinerarySuitability()`, lib/itinerary-suitability.ts —
 * self-transfer AND 2+ stops on either leg, re-exported from
 * lib/fare-signal.ts for backward compatibility) and its own SUPPRESSION
 * behaviour is untouched by this module: that governs WHETHER an
 * observation is shown as the current representative fare at all. This
 * module governs WHAT a shown observation's own summary says — a fare
 * that correctly passes the suitability threshold (e.g. a genuine 1-stop
 * self-transfer) can still have a decisive consequence worth surfacing
 * prominently, which is exactly the Manchester-Istanbul and
 * Manchester-Agadir cases: both pass suppression (1 stop, not 2+) but both
 * have a materially long, ground-transfer-airport-changing leg. This
 * module DOES reuse isPoorItinerarySuitability() itself, once, as a
 * signal (never a new threshold) for whether a shown-but-poor
 * observation's own known durations are worth surfacing — see
 * getJourneyConsequences's own "PR #232 decisive-duration correction"
 * comment for exactly where and why.
 */

export interface JourneyConsequences {
  /** From the existing, unchanged predicate — see lib/fare-self-transfer.ts. */
  selfTransfer: boolean;
  /**
   * The two airport codes named in an explicit "ground transfer between X
   * and Y airports" statement already in the observation's own priceNote —
   * e.g. Manchester-Agadir's MXP/BGY (Milan Malpensa to Milan Bergamo).
   * `null` when no such statement is present anywhere in the observation.
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
   * Whether THIS specific leg's own duration is itself a decisive fact
   * worth surfacing prominently — see formatJourneyConsequenceSummary's
   * doc comment ("PR #232 decisive-duration correction") for why this must
   * be decided per leg, not "show whichever leg happened to parse". A leg
   * is decisive when either (a) that leg's own priceNote clause states the
   * ground-transfer airport change or a long layover — the fact making
   * that specific leg cumbersome — or (b) the WHOLE observation already
   * matches the existing, canonical isPoorItinerarySuitability() rule
   * (self-transfer AND 2+ stops on either leg — see
   * lib/itinerary-suitability.ts). (b) is deliberately NOT a new duration
   * threshold: it reuses the same evidenced product state JetStash already
   * uses elsewhere to decide an itinerary is operationally unreasonable,
   * rather than inventing a second, independent definition of "long". This
   * is exactly why Manchester-Lahore's 34h50m/43h20m Business fare — no
   * leg stating a layover or airport change, but self-transfer with 3
   * stops each way, which already trips isPoorItinerarySuitability() —
   * still surfaces both known durations: JetStash has already, elsewhere,
   * evidenced that this itinerary is materially unreasonable; that
   * existing verdict is reused here, not re-derived.
   */
  outboundDurationIsDecisive: boolean;
  returnDurationIsDecisive: boolean;
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
 * worse than surfacing nothing). This strict precondition is deliberately
 * kept ONLY for arrival-airport-mismatch detection (the highest-stakes
 * claim this module makes) — see extractLegDurationFromText below for why
 * duration extraction itself no longer needs this same precondition.
 * Verified against all four of this fix's confirmed live examples — see
 * tests/journey-consequence.test.ts.
 */
export function extractCleanRoutingCodes(priceNote: string, leg: 'outbound' | 'return'): string[] | null {
  const pattern = new RegExp(`\\b${leg}\\s+([A-Z]{3}(?:-[A-Z]{3})+)(?=[,;])`);
  const match = priceNote.match(pattern);
  return match ? match[1].split('-') : null;
}

/**
 * Isolates one leg's own clause — from the leg keyword up to the next
 * semicolon — the same `;`-delimited-fact convention every observation's
 * priceNote already follows throughout the archive. Requiring whitespace
 * directly after the keyword (`\s+`, not merely present anywhere) is what
 * keeps this from matching the "return, per person, one adult;" preamble
 * every priceNote opens with — that "return" is always followed by a
 * comma, never whitespace, so it's structurally excluded, not filtered by
 * special-casing.
 */
function legClause(priceNote: string, leg: 'outbound' | 'return'): string | null {
  const match = priceNote.match(new RegExp(`\\b${leg}\\s+([^;]+)`, 'i'));
  return match ? match[1] : null;
}

/**
 * PR #232 decisive-duration correction (5 Sept 2026). The original version
 * of this function required extractCleanRoutingCodes' strict clean-routing
 * precondition before trusting a duration figure — which meant a
 * ground-transfer-annotated leg (e.g. Manchester-Agadir's return,
 * "AGA-MXP(-ground transfer to BGY)-MAN") could never yield a duration at
 * all, even though the total elapsed time is stated in plain text right
 * there. Founder review confirmed this was the wrong trade-off: the exact
 * cases this module exists to surface (an airport change, a long layover)
 * are precisely the cases whose routing string carries this extra
 * parenthetical detail.
 *
 * The safe alternative doesn't need the routing string to be clean at
 * all: within one leg's own clause (see legClause), the leg's TOTAL
 * elapsed duration is always the first "Nh" / "NhNm" - shaped figure that
 * appears — a layover's own duration, when stated, always appears
 * afterward inside its own trailing parenthetical (e.g. "27h55m (22h
 * Barcelona long layover...)", "20h55m (16h10m Milan long layover...)"),
 * and no flight/airline code in the archive's own format (e.g. "FR1227",
 * "W62430", "TK1993") contains a digit-h-digit-m shaped substring — so the
 * first match is never ambiguous with a flight number or a layover figure.
 * This was verified against the full archive (314 records, 193 outbound +
 * 166 return durations successfully extracted, zero anomalous values)
 * before being trusted here — see tests/journey-consequence.test.ts's
 * dataset-wide sweep.
 */
function extractLegDurationFromText(priceNote: string, leg: 'outbound' | 'return'): string | null {
  const clause = legClause(priceNote, leg);
  if (!clause) return null;
  const durationMatch = clause.match(/\d+h\s?\d*m?\b/);
  return durationMatch ? durationMatch[0].trim() : null;
}

/** Whether this leg's own clause states the ground-transfer airport change itself — narrower than the observation-wide GROUND_TRANSFER_PATTERN check, used only to decide whether THIS leg's duration is decisive (see outboundDurationIsDecisive/returnDurationIsDecisive). */
function legHasGroundTransfer(priceNote: string, leg: 'outbound' | 'return'): boolean {
  const clause = legClause(priceNote, leg);
  return clause !== null && GROUND_TRANSFER_PATTERN.test(clause);
}

/** Whether this leg's own clause states a long layover itself — see legHasGroundTransfer's doc comment for why this is scoped per leg rather than observation-wide. */
function legHasLongLayover(priceNote: string, leg: 'outbound' | 'return'): boolean {
  const clause = legClause(priceNote, leg);
  return clause !== null && LONG_LAYOVER_PATTERN.test(clause);
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
  observation: Pick<FareObservation, 'priceNote' | 'outboundJourneyMinutes' | 'returnJourneyMinutes' | 'outboundStops' | 'returnStops'>,
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

  // PR #232 decisive-duration correction: each leg's own "is this duration
  // worth showing" decision is scoped to THAT leg's own clause — a leg is
  // decisive when its own text states the reason (ground transfer / long
  // layover). Never decided by the OTHER leg's facts, and never by "a
  // duration exists" alone — Manchester-Agadir's short, unremarkable
  // 3h50m outbound must stay hidden even though the record as a whole has
  // a decisive return leg.
  //
  // The one fallback is deliberately NOT a new duration threshold: when
  // the WHOLE observation already matches the existing, canonical
  // isPoorItinerarySuitability() rule (self-transfer AND 2+ stops on
  // either leg), JetStash has already, elsewhere, evidenced that this
  // itinerary is materially unreasonable — that existing verdict is
  // reused to justify showing both known durations (Manchester-Lahore's
  // 34h50m/43h20m Business fare is the confirmed live case), never
  // re-derived from a newly invented number.
  const wholeItineraryIsPoor = isPoorItinerarySuitability({
    priceNote,
    outboundStops: observation.outboundStops,
    returnStops: observation.returnStops,
  });
  const outboundDurationIsDecisive =
    legHasGroundTransfer(priceNote, 'outbound') ||
    legHasLongLayover(priceNote, 'outbound') ||
    wholeItineraryIsPoor;
  const returnDurationIsDecisive =
    legHasGroundTransfer(priceNote, 'return') ||
    legHasLongLayover(priceNote, 'return') ||
    wholeItineraryIsPoor;

  return {
    selfTransfer: isSelfTransferItinerary(priceNote),
    groundTransferAirports: groundTransferMatch ? [groundTransferMatch[1], groundTransferMatch[2]] : null,
    longLayoverCity: layoverCityMatch ? layoverCityMatch[1] : null,
    hasLongLayover,
    outboundDuration,
    returnDuration,
    outboundDurationIsDecisive,
    returnDurationIsDecisive,
    arrivalAirportMismatch,
  };
}

/** True when any decisive consequence was actually found — used to gate whether the summary line renders at all. */
export function hasAnyJourneyConsequence(c: JourneyConsequences): boolean {
  return (
    c.selfTransfer ||
    c.groundTransferAirports !== null ||
    c.hasLongLayover ||
    c.arrivalAirportMismatch !== null ||
    c.outboundDurationIsDecisive ||
    c.returnDurationIsDecisive
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
 *
 * PR #232 decisive-duration correction (5 Sept 2026, founder review): the
 * original version showed BOTH outbound and return whenever ANY
 * observation-wide signal fired, which surfaced Manchester-Agadir's
 * short, unremarkable "Outbound: 3h 50m" while still failing to show the
 * actually-decisive "Return: 20h 55m" (the return leg's duration couldn't
 * be extracted at all under the old strict-clean-routing precondition).
 * Each duration is now gated independently on THAT leg's own
 * outboundDurationIsDecisive/returnDurationIsDecisive — so Agadir now
 * shows only "Return: 20h 55m" (the leg the airport change and long
 * layover actually belong to), while Manchester-Istanbul, where BOTH legs
 * independently state their own long layover, correctly shows both.
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
  if (c.outboundDurationIsDecisive && c.outboundDuration) parts.push(`Outbound: ${c.outboundDuration}`);
  if (c.returnDurationIsDecisive && c.returnDuration) parts.push(`Return: ${c.returnDuration}`);
  return parts;
}
