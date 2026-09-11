import { getRouteBySlug, getRouteStatus } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation, getRouteStatusCopy, formatRouteStatusDate, type RouteStatusViewModel } from '@/lib/route-status-copy';
import { getFareSignalForRoute, type FareSignal as FareSignalData } from '@/lib/fare-signal';
import { getObservationsByRoute, isPubliclyPublishable, isObservationCausallyAvailable, type FareObservation } from '@/data/fare-observations';
import { getJourneyConsequences, formatJourneyConsequenceSummary } from '@/lib/journey-consequence';
import { getDestinationBySlug } from '@/data/destinations';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';
import type { TravelReadySignal } from '@/lib/travel-intelligence-engine';

/**
 * Journey Brief Phase 1 — Manchester → Mumbai founder-only pilot (5 Sept
 * 2026, product implementation following the Astra "30-second Journey
 * Brief" recommendation).
 *
 * Deliberately a NEW, separate file from lib/journey-brief-manchester-
 * mumbai.ts — that file's own exports (WITHDRAWAL_BOUNDARY_DATE,
 * EVIDENCE_BUNDLE, BOUNDARY_STATE_COPY, etc.) are still imported by
 * components/homepage-v2/journey-brief-hero.tsx, a separate, protected
 * homepage-v2 preview this task's own DO-NOT-TOUCH list covers ("do not
 * touch the homepage" / "do not broadly redesign"). That old file is left
 * completely unmodified here; this one only replaces what
 * components/journey-brief/journey-brief-manchester-mumbai.tsx (the
 * founder-only Journey Brief page itself, not the homepage) consumes.
 *
 * Read-only audit finding this rewrite exists to fix: the old bundle was
 * accurate when written (13-23 July 2026, before IndiGo's own announced
 * withdrawal took effect) but the ledger has since moved twice — the
 * withdrawal took effect (31 Aug 2026) and was independently confirmed
 * ended (2 Sept 2026, INDIA-002/PR #212) — and the old prototype's frozen
 * copy never picked either change up. As of this rewrite it was still
 * asserting "IndiGo... operates this route direct, with an announced end
 * date" days after the service had verifiably ended. This file reuses the
 * SAME canonical sources every public route page already reads from, so
 * this can never happen again silently:
 *
 *   - data/route-status-events.ts's ledger + lib/route-status-copy.ts's
 *     getEffectiveRoutePresentation()/getRouteStatusCopy() for the route's
 *     own current service status — the same functions app/routes/[slug]/
 *     page.tsx itself calls.
 *   - lib/fare-signal.ts's getFareSignalForRoute() for a current/recent
 *     representative fare, if one exists.
 *   - data/fare-observations.ts's isPubliclyPublishable — the same
 *     predicate components/route/fare-history-panel.tsx already uses — for
 *     the route's raw fare-check history when no current representative
 *     fare is available (true today: the route's service-ended status
 *     makes isObservationPublishable() false for every observation, so
 *     getFareSignalForRoute/getFareRangeSummary both correctly return
 *     nothing — see this file's own assembleManchesterMumbaiBrief()).
 *   - lib/journey-consequence.ts's getJourneyConsequences()/
 *     formatJourneyConsequenceSummary() (PR #232) for the one decisive-fact
 *     line, reused completely unmodified.
 *
 * Nothing here re-derives route truth, re-implements journey-consequence
 * extraction, or invents a second withdrawal-date calculator. Scoped to
 * this one founder-only pilot route.
 */

export const MANCHESTER_MUMBAI_ROUTE_SLUG = 'manchester-mumbai';

export interface RouteRealityAnswer {
  /** presentation.summary, verbatim — the same one-sentence status every public route page can show. */
  headline: string;
  /** presentation.statusLabel, verbatim (e.g. "Direct service ended"). */
  badgeLabel: string;
  /** Full sourced explanation + citations, for progressive disclosure only — null when the route has no ledger-managed status copy to show (never fabricated as a fallback). */
  detail: RouteStatusViewModel | null;
}

/**
 * A single logged fare check, framed explicitly as historical evidence —
 * never as "the current price" — plus whatever decisive consequence
 * lib/journey-consequence.ts finds in it. `isCurrentRepresentativeFare`
 * distinguishes the two cases the UI must word differently: a genuine
 * current Fare Signal (safe to call "a recent tracked fare") versus a raw
 * historical check surfaced only because no current one exists (must say so
 * explicitly).
 */
export interface EvidencedFareOption {
  price: number;
  currency: string;
  cabin: string;
  airline: string;
  observedDate: string;
  /**
   * PR #233 product-acceptance correction (5 Sept 2026): the RECORDED
   * example's own travel dates — distinct from `observedDate` (when
   * JetStash checked it). Null only when the source view model doesn't
   * carry them (never fabricated).
   */
  departureDate: string | null;
  returnDate: string | null;
  /** Reused verbatim from the observation's own `baggage` field — null only when unavailable (the current/recent Fare Signal branch, whose sanitised view model doesn't carry it). */
  baggage: string | null;
  directness: 'direct' | 'connecting' | null;
  outboundStops: number | null;
  returnStops: number | null;
  /** The same formatted duration strings lib/journey-consequence.ts computed internally — exposed directly (not just pre-joined into journeyConsequences) so formatWhatYouCouldMiss() can build a more specific sentence without re-parsing. */
  outboundDuration: string | null;
  returnDuration: string | null;
  /** Unmodified PR #232 output — see lib/journey-consequence.ts. Never overridden, only ever supplemented by longestNamedWait below. */
  journeyConsequences: string[];
  /**
   * PR #233 product-acceptance correction: the single longest individually
   * NAMED wait among this observation's own recorded layover breakdown, on
   * whichever leg lib/journey-consequence.ts's own getJourneyConsequences()
   * already flagged as decisive — e.g. Manchester-Mumbai's real "23h15m
   * Katowice" wait, which PR #232's own extractor doesn't surface today
   * (its `hasLongLayover` check only matches singular "long layover", and
   * this record's own text says "long layovers" — plural, describing three
   * named legs together). See extractLongestNamedWait's own doc comment for
   * the full extraction discipline (conservative, `null` when the pattern
   * doesn't cleanly match). Deliberately NOT a fix to the shared
   * lib/journey-consequence.ts module itself — that module is used live by
   * Fare Signal, DealCard and Tracked Fares Explorer for the wider route
   * catalogue, and widening its regex would change already-shipped,
   * already-reviewed production behaviour on other routes without those
   * surfaces having been through their own dedicated review. Flagged in
   * this PR's own report as a genuine candidate for a FUTURE, separately-
   * reviewed generalisation — not silently done here.
   */
  longestNamedWait: { leg: 'outbound' | 'return'; city: string; duration: string } | null;
  /** Whether the observation's own priceNote explicitly states a missed connection may be protected by the booking terms — never inferred, read directly from the record's own text. False (unconfirmed) whenever unavailable, e.g. the current/recent Fare Signal branch. */
  connectionProtectionMentioned: boolean;
  isCurrentRepresentativeFare: boolean;
}

export interface ManchesterMumbaiBrief {
  routeReality: RouteRealityAnswer;
  /** null only when there is genuinely no publishable evidence at all — current, recent, or historical. Never fabricated to fill the slot. */
  evidencedOption: EvidencedFareOption | null;
  /** True once a live Fare Signal exists again (future-proofing) — the "search current options" framing is only shown when this is false. */
  hasCurrentFareSignal: boolean;
  tripComUrl: string | null;
}

/**
 * Isolates one leg's own clause from a priceNote — the same `;`-delimited
 * convention lib/journey-consequence.ts's own (private, unexported)
 * legClause() relies on. Duplicated here narrowly (a few lines, one regex)
 * rather than imported, because that helper isn't exported and this
 * extractor answers a genuinely different question from anything in that
 * module's own public contract — see extractLongestNamedWait's doc
 * comment. Not a second source of route/fare TRUTH, just a second reader of
 * the same already-canonical priceNote field.
 */
function legClauseFor(priceNote: string, leg: 'outbound' | 'return'): string | null {
  const match = priceNote.match(new RegExp(`\\b${leg}\\s+([^;]+)`, 'i'));
  return match ? match[1] : null;
}

/**
 * PR #233 product-acceptance correction (5 Sept 2026). Finds every
 * individually-named "<duration> <City>" segment inside a leg's own
 * recorded layover breakdown (the parenthetical ending in "layover(s)") and
 * returns whichever one has the largest total minutes — e.g. "(23h15m
 * Katowice + 4h50m Abu Dhabi + 2h35m Ahmedabad long layovers)" -> Katowice,
 * 23h 15m. Deliberately conservative: returns `null` whenever no such
 * parenthetical breakdown exists for that leg at all (a clean nonstop leg,
 * or a record that states duration without a layover breakdown) — never a
 * guess. Verified against the full set of currently-known layover-bearing
 * priceNote shapes (single-layover MAN-IST/MAN-AGA style, this multi-leg
 * MAN-BOM style, and MAN-LHE's structured-duration-only style with no
 * layover text at all) before being trusted — see
 * tests/journey-brief-phase1-manchester-mumbai.test.ts.
 */
export function extractLongestNamedWait(priceNote: string, leg: 'outbound' | 'return'): { city: string; duration: string } | null {
  const clause = legClauseFor(priceNote, leg);
  if (!clause) return null;
  const parenMatch = clause.match(/\(([^()]*layovers?[^()]*)\)/i);
  if (!parenMatch) return null;
  const breakdown = parenMatch[1];
  const segmentPattern = /(\d+)h(\d+)?m?\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/g;
  let best: { city: string; duration: string; totalMinutes: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = segmentPattern.exec(breakdown))) {
    const hours = parseInt(m[1], 10);
    const minutes = m[2] ? parseInt(m[2], 10) : 0;
    const totalMinutes = hours * 60 + minutes;
    if (!best || totalMinutes > best.totalMinutes) {
      best = { city: m[3], duration: `${hours}h${minutes ? ' ' + minutes + 'm' : ''}`, totalMinutes };
    }
  }
  return best ? { city: best.city, duration: best.duration } : null;
}

/**
 * Picks the single longest named wait across whichever leg(s)
 * getJourneyConsequences() already flagged as decisive — never the OTHER
 * leg's unremarkable wait (e.g. Manchester-Mumbai's own 2h30m Riyadh
 * layover on the return leg, which is real but not material). `null` when
 * neither decisive leg has an extractable named wait.
 */
function pickLongestNamedWait(
  priceNote: string,
  outboundDurationIsDecisive: boolean,
  returnDurationIsDecisive: boolean
): { leg: 'outbound' | 'return'; city: string; duration: string } | null {
  const candidates: { leg: 'outbound' | 'return'; city: string; duration: string; minutes: number }[] = [];
  for (const [leg, decisive] of [['outbound', outboundDurationIsDecisive], ['return', returnDurationIsDecisive]] as const) {
    if (!decisive) continue;
    const wait = extractLongestNamedWait(priceNote, leg);
    if (!wait) continue;
    const match = wait.duration.match(/^(\d+)h(?:\s(\d+)m)?$/);
    const minutes = match ? parseInt(match[1], 10) * 60 + (match[2] ? parseInt(match[2], 10) : 0) : 0;
    candidates.push({ leg, ...wait, minutes });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.minutes - a.minutes);
  const { minutes: _minutes, ...rest } = candidates[0];
  return rest;
}

function toEvidencedOption(observation: FareObservation, destinationIataCode: string | null, isCurrentRepresentativeFare: boolean): EvidencedFareOption {
  const consequences = getJourneyConsequences(observation, destinationIataCode);
  const priceNote = observation.priceNote ?? '';
  return {
    price: observation.price,
    currency: observation.currency ?? 'GBP',
    cabin: observation.cabin,
    airline: observation.source,
    observedDate: observation.observedDate,
    departureDate: observation.departureDate ?? null,
    returnDate: observation.returnDate ?? null,
    baggage: observation.baggage ?? null,
    directness: observation.fareDirectness === 'direct' || observation.fareDirectness === 'connecting' ? observation.fareDirectness : null,
    outboundStops: observation.outboundStops ?? null,
    returnStops: observation.returnStops ?? null,
    outboundDuration: consequences.outboundDuration,
    returnDuration: consequences.returnDuration,
    journeyConsequences: formatJourneyConsequenceSummary(consequences),
    longestNamedWait: pickLongestNamedWait(priceNote, consequences.outboundDurationIsDecisive, consequences.returnDurationIsDecisive),
    connectionProtectionMentioned: /protected by the booking terms/i.test(priceNote),
    isCurrentRepresentativeFare,
  };
}

/**
 * The one function that assembles everything the brief's first four answers
 * need, purely from canonical sources, for a given evaluation date — see
 * this file's own header comment for why each source is the one to trust.
 * Returns `null` only if the route itself can't be resolved at all (should
 * never happen in production for this hardcoded slug; exists so the
 * component can fail closed instead of throwing).
 */
export function assembleManchesterMumbaiBrief(nowIso: string): ManchesterMumbaiBrief | null {
  const route = getRouteBySlug(MANCHESTER_MUMBAI_ROUTE_SLUG);
  if (!route) return null;

  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  const rawStatus = getRouteStatus(route, routeStatusEvents, nowIso);
  const routeStatusCopy = rawStatus ? getRouteStatusCopy(route, rawStatus, routeStatusEvents, nowIso) : null;

  const destinationIataCode = getDestinationBySlug(route.destinationSlug)?.iataCode ?? null;

  const fareSignal: FareSignalData = getFareSignalForRoute(MANCHESTER_MUMBAI_ROUTE_SLUG, nowIso);
  let evidencedOption: EvidencedFareOption | null = null;
  const hasCurrentFareSignal = fareSignal.state === 'current';

  if (fareSignal.observation && (fareSignal.state === 'current' || fareSignal.state === 'recent')) {
    // A genuine current/recent Fare Signal observation carries the same
    // sanitised fields toSignalObservation() already produced — journey
    // consequences are already computed there, reused verbatim rather than
    // recomputed against the raw record a second time.
    evidencedOption = {
      price: fareSignal.observation.price,
      currency: fareSignal.observation.currency ?? 'GBP',
      cabin: fareSignal.observation.cabin,
      airline: fareSignal.observation.airline,
      observedDate: fareSignal.observation.observedDate,
      departureDate: fareSignal.observation.departureDate,
      returnDate: fareSignal.observation.returnDate,
      // FareSignalObservation's sanitised view model deliberately doesn't
      // carry the raw priceNote/baggage fields (see lib/fare-signal.ts) —
      // these stay honestly null/false rather than guessed. A genuine
      // current Fare Signal's own baggage/protection facts remain
      // "unconfirmed" here until that view model is extended to carry them.
      baggage: null,
      directness: fareSignal.observation.directness,
      outboundStops: fareSignal.observation.outboundStops,
      returnStops: fareSignal.observation.returnStops,
      outboundDuration: null,
      returnDuration: null,
      journeyConsequences: fareSignal.observation.journeyConsequences,
      longestNamedWait: null,
      connectionProtectionMentioned: false,
      isCurrentRepresentativeFare: fareSignal.state === 'current',
    };
  } else {
    // No current/recent representative fare (true today: the route's
    // service-ended status makes every observation publishable=false for
    // Fare Signal's own purposes — see isObservationPublishable). Fall back
    // to the single most recent PUBLICLY PUBLISHABLE historical check —
    // exactly the same predicate FareHistoryPanel uses, so this can never
    // show a check FareHistoryPanel itself would consider incomplete.
    // Framed explicitly as a past check, never as a current price.
    const historical = getObservationsByRoute(MANCHESTER_MUMBAI_ROUTE_SLUG)
      .filter(isPubliclyPublishable)
      .filter((o) => isObservationCausallyAvailable(o, nowIso))
      .sort((a, b) => b.observedDate.localeCompare(a.observedDate));
    if (historical.length > 0) {
      evidencedOption = toEvidencedOption(historical[0], destinationIataCode, false);
    }
  }

  return {
    routeReality: {
      headline: presentation.summary,
      badgeLabel: presentation.statusLabel,
      detail: routeStatusCopy,
    },
    evidencedOption,
    hasCurrentFareSignal,
    tripComUrl: getTripComFlightHandoffUrl(MANCHESTER_MUMBAI_ROUTE_SLUG),
  };
}

export { formatRouteStatusDate };

/**
 * PR #233 product-acceptance correction (5 Sept 2026, founder + Astra
 * review): the visible "What you could miss" summary must lead with the
 * decision-changing facts (stop count, the single material named wait) a
 * traveller would otherwise have to open evidence to find — not the same
 * "Outbound: 43h" total figure alone, which is technically true but too
 * abstract on its own to be the "I would have missed that" moment this
 * whole workstream exists to create.
 *
 * When a longestNamedWait was found, builds a specific line: stop count for
 * that leg, the named wait itself, self-transfer (if present), then the
 * leg's own total duration as supporting context. When it wasn't found
 * (no layover breakdown for this record, or an entirely clean itinerary),
 * falls back to PR #232's own canonical journeyConsequences verbatim —
 * never a claim beyond what that shared, already-reviewed module
 * established.
 */
export function formatWhatYouCouldMiss(evidencedOption: EvidencedFareOption): string[] {
  const wait = evidencedOption.longestNamedWait;
  if (!wait) return evidencedOption.journeyConsequences;

  const isSelfTransfer = evidencedOption.journeyConsequences.includes('Self-transfer');
  const stopsForLeg = wait.leg === 'outbound' ? evidencedOption.outboundStops : evidencedOption.returnStops;
  const totalDuration = wait.leg === 'outbound' ? evidencedOption.outboundDuration : evidencedOption.returnDuration;

  const parts: string[] = [];
  if (stopsForLeg !== null && stopsForLeg > 0) {
    parts.push(`${stopsForLeg} stop${stopsForLeg === 1 ? '' : 's'} ${wait.leg}`);
  }
  parts.push(`${wait.duration} wait in ${wait.city}`);
  if (isSelfTransfer) parts.push('Self-transfer');
  if (totalDuration) parts.push(`${totalDuration} ${wait.leg} journey`);
  return parts;
}

/** True only when neither PR #232's canonical journeyConsequences nor this file's own longestNamedWait extraction found anything decisive — the brief must say so plainly rather than render an empty section (founder: "the brief must also be comfortable saying: no material problem identified"). */
export function hasNoMaterialConsequence(evidencedOption: EvidencedFareOption): boolean {
  return evidencedOption.journeyConsequences.length === 0 && evidencedOption.longestNamedWait === null;
}

export const NO_MATERIAL_CONSEQUENCE_COPY = 'No material issue identified within the checks performed.';

/**
 * Founder-approved bounded wording (5 Sept 2026) — deliberately does not
 * claim a specific consequence (missed-connection responsibility, baggage
 * recheck, etc.) this observation's own evidence doesn't establish either
 * way; only ever shown alongside a genuine self-transfer flag.
 */
export const SELF_TRANSFER_EXPLANATION =
  'This itinerary includes a self-transfer, so check the connection and baggage conditions carefully before booking.';

/**
 * Journey Brief public-readiness pilot (Astra review, 11 Sept 2026) —
 * incorporates two qualitative traveller-decision factors surfaced in
 * Reddit experiment #2: (1) travellers have their own maximum acceptable
 * journey time, distinct from fare, and (2) the personal value of saved
 * time differs from person to person. Deliberately NOT a calculator, a
 * scoring engine, or a hardcoded universal threshold — no salary input, no
 * "worth £X/hour" claim, no ranking. This is a single, plain-language
 * prompt that reuses ONLY the already-computed, canonical duration facts
 * (evidencedOption.journeyConsequences' own "Outbound:"/"Return:" entries)
 * to help a reader notice that the absolute duration itself — not just the
 * fare — is worth weighing, and that how much it's worth weighing is a
 * personal call JetStash cannot make for them. Never shown for a genuinely
 * clean itinerary (see hasMaterialDurationConsequence below) — there is
 * nothing to reflect on when no decisive duration consequence exists.
 */
export function hasMaterialDurationConsequence(evidencedOption: EvidencedFareOption): boolean {
  return evidencedOption.journeyConsequences.some((c) => c.startsWith('Outbound:') || c.startsWith('Return:'));
}

export const JOURNEY_DURATION_REFLECTION_COPY =
  'A journey this long affects travellers differently — some would pay more for a shorter one, others would rather keep the lower fare. Worth deciding which matters more to you before you compare on price alone.';

/**
 * Founder-approved supporting next step (5 Sept 2026) — locks the product
 * meaning that the recorded example above is evidence, not the booking
 * itself, and that Trip.com is a fresh search whose results still need
 * verifying before paying.
 */
export const VERIFY_BEFORE_PAYING_COPY =
  'When you find an itinerary, verify its airline/service and unresolved details before paying.';

/**
 * PR #233 product-acceptance correction (5 Sept 2026): "What remains
 * unconfirmed" as an explicit, first-class answer — not something a reader
 * has to infer by cross-referencing several cards. Every item here is
 * gated on a genuine, checkable data gap; nothing is a generic checklist
 * entry unless the current evidence actually leaves it open. Returns an
 * empty array when nothing material is unconfirmed (the component renders
 * a plain "nothing left unconfirmed" sentence in that case, never silence).
 */
export function getManchesterMumbaiUnconfirmedItems(brief: Pick<ManchesterMumbaiBrief, 'evidencedOption' | 'hasCurrentFareSignal'>): string[] {
  const { evidencedOption, hasCurrentFareSignal } = brief;
  const items: string[] = [];

  if (!hasCurrentFareSignal) {
    items.push('A current, live representative fare for this route');
  }

  if (evidencedOption) {
    if (!evidencedOption.isCurrentRepresentativeFare) {
      items.push('The exact itinerary and operating airline for a fresh search — the recorded example below may no longer be offered as shown');
    }

    const baggageKnown = Boolean(evidencedOption.baggage) && !/not stated|not disclosed|unknown/i.test(evidencedOption.baggage!);
    if (!baggageKnown) {
      items.push('Checked baggage allowance and cost');
    }

    const isSelfTransfer = evidencedOption.journeyConsequences.includes('Self-transfer');
    if (isSelfTransfer && !evidencedOption.connectionProtectionMentioned) {
      items.push('Whether a missed connection is protected, since this itinerary includes a self-transfer');
    }
  }

  return items;
}

export const NO_UNCONFIRMED_ITEMS_COPY = 'No material unknown identified within these checks.';

export type PrimaryNextAction =
  | { kind: 'check-travel-ready'; label: string; reason: string }
  | {
      kind: 'search-current-options';
      label: string;
      reason: string;
      /**
       * PR #233 final product-acceptance fix (5 Sept 2026, founder review).
       * Set only when a genuine, still-open Travel Ready caution exists
       * (severity 'caution' — e.g. document-timing-may-affect-booking) at
       * the moment the primary action becomes "search current options".
       * Carries that signal's own `label` verbatim — never a second,
       * independently-worded reminder — so the open document task can't be
       * silently forgotten the moment the reader reaches the actual action,
       * even though it correctly isn't escalated to become the PRIMARY
       * action itself (see this function's own doc comment for why
       * 'caution' correctly stays secondary here).
       */
      openDocumentTask: string | null;
    }
  | { kind: 'enter-travel-details'; label: string; reason: string };

/**
 * The one dominant next step — worst-true-signal-wins, the same philosophy
 * lib/travel-intelligence-engine.ts's computeReadiness() and the old
 * prototype's own getDominantAction() both already used. Simplified from
 * the old version: the withdrawal-boundary date-comparison branch is gone
 * entirely (obsolete now the withdrawal has already taken effect and been
 * confirmed — every date a traveller could now enter is permanently "after"
 * it, so that branch could never again return anything but the same
 * "search current options" outcome; keeping dead comparison logic around
 * would only invite it to silently disagree with the ledger again).
 *
 * PR #233 final product-acceptance check (5 Sept 2026, founder review): the
 * founder asked whether "search current options" outranking an unresolved
 * Travel Ready document task was a deliberate product decision or an
 * accident of the generic severity enum. Traced through
 * lib/travel-ready-check.ts's own verdict→severity mapping (unchanged by
 * this fix): 'critical' is reserved for the two verdicts whose own
 * NEXT_ACTIONS text says "before booking" — check-passport-validity and
 * visa-or-entry-permission-needed, i.e. states where continuing to shop for
 * a fare is actively premature. 'caution' covers
 * document-timing-may-affect-booking, official-confirmation-required and
 * stay-length-unconfirmed — states whose own NEXT_ACTIONS text explicitly
 * ALLOWS continued shopping ("Start your application now. Consider a
 * flexible or refundable fare until it's confirmed."), just with a caveat.
 * So deferring to 'critical' alone to decide whether Travel Ready should
 * become the PRIMARY action is not an accident of the enum — it already
 * encodes exactly the founder's own stated rule ("if the document checker
 * says the traveller needs to obtain/confirm entry permission before
 * relying on the journey, Travel Ready is primary; if it simply informs the
 * traveller of a known requirement that doesn't prevent continuing
 * research, a fresh search remains reasonable").
 *
 * What was missing, and is what this fix actually adds: a 'caution' signal
 * was previously invisible again the moment the reader reached this final
 * section — Entry Readiness (answer 4) stated it, but What To Do Next
 * (answer 5) said nothing about it. `openDocumentTask` closes that gap by
 * carrying the caution forward as a secondary reminder next to the primary
 * CTA, without re-litigating which action is primary and without
 * introducing a second severity/suitability policy.
 */
export function getManchesterMumbaiNextAction(input: {
  hasEnteredTravelDetails: boolean;
  travelReadySignal: TravelReadySignal | null;
  hasCurrentFareSignal: boolean;
}): PrimaryNextAction {
  const { hasEnteredTravelDetails, travelReadySignal, hasCurrentFareSignal } = input;
  if (travelReadySignal?.severity === 'critical') {
    return {
      kind: 'check-travel-ready',
      label: 'Check your travel readiness first',
      reason: travelReadySignal.detail,
    };
  }
  if (!hasEnteredTravelDetails) {
    return {
      kind: 'enter-travel-details',
      label: 'Add your travel dates and passport details above',
      reason: 'JetStash needs your dates and passport status to give a dated entry-readiness check, rather than a generic one.',
    };
  }
  return {
    kind: 'search-current-options',
    label: hasCurrentFareSignal ? 'Check today’s price' : 'Search current options on Trip.com',
    reason: hasCurrentFareSignal
      ? 'JetStash has a recent tracked fare for this route.'
      : "JetStash doesn't currently track a live representative fare for this route since the direct service ended — search current options directly.",
    openDocumentTask: travelReadySignal?.severity === 'caution' ? travelReadySignal.label : null,
  };
}
