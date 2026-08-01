/**
 * Arrive By MVP — Stage 1 (engine only, no public interface).
 *
 * Answers "what sort of journey should I look for if I must reach my
 * destination by a particular local date and time?" by working backwards
 * from a required local arrival instant using documented planning
 * assumptions (lib/arrive-by/config.ts) and JetStash's existing, real Route
 * Status data (lib/arrive-by/route-support.ts) — never a live schedule
 * search. See docs/product/ARRIVE_BY_MVP.md for the full product spec.
 *
 * Deliberately distinct from docs/project-control/ARRIVE_BY_SPEC.md's
 * "evidence-gated" full feasibility engine (which requires live
 * schedule/ground-transport sources and remains deferred) — this MVP
 * sidesteps that entirely by never claiming a specific flight, connection,
 * or timetable exists. It only ever returns an indicative planning window,
 * always labelled as such.
 */

// ── Input contract ──────────────────────────────────────────────────────

export type DeadlineStrictness = 'strict' | 'flexible';

export type BaggageType = 'hand-luggage-only' | 'checked-baggage';

/** Only meaningful for connecting journeys; ignored for direct ones. Defaults to 'standard' when omitted. */
export type ConnectionRiskPreference = 'standard' | 'cautious';

/**
 * No passport, visa, nationality, or other personal-identification data by
 * design — Arrive By is a pure journey-timing calculator, not a Travel
 * Ready Check (lib/travel-ready-check.ts remains the one place document
 * readiness is evaluated). See ARRIVE_BY_MVP.md §4.
 */
export interface ArriveByInput {
  originAirportSlug: string;
  destinationSlug: string;
  /** Destination-LOCAL calendar date the traveller must arrive by, e.g. '2026-09-14'. */
  requiredArrivalDateLocal: string;
  /** Destination-LOCAL 24h time, e.g. '14:30'. Required — a missing/empty value is rejected, never defaulted. */
  requiredArrivalTimeLocal: string;
  deadlineStrictness: DeadlineStrictness;
  baggage: BaggageType;
  connectionRiskPreference?: ConnectionRiskPreference;
}

// ── Explicit local/UTC datetime values ──────────────────────────────────

/**
 * Every datetime the engine returns is one of these — local wall-clock
 * value, its IANA zone, and the real UTC instant, all explicit, never a
 * bare Date or ambiguous string. See lib/arrive-by/timezones.ts.
 */
export interface ZonedDateTime {
  /** YYYY-MM-DD, in `timeZone`. */
  dateIso: string;
  /** HH:mm, 24h, in `timeZone`. */
  timeHHmm: string;
  /** IANA identifier, e.g. 'Asia/Karachi'. */
  timeZone: string;
  /** The real instant, e.g. '2026-09-14T09:30:00.000Z'. */
  utcIso: string;
}

// ── Planning assumptions (explainable, never silent) ────────────────────

export interface PlanningAssumption {
  name: string;
  /** Human-readable value, e.g. "75 minutes" or "6.5–10.5 hours". Kept as a string so a range and a scalar can share one shape. */
  value: string;
  rationale: string;
}

// ── Journey/route classification ─────────────────────────────────────────

export type ArriveByJourneyType = 'direct' | 'connecting' | 'verification-pending' | 'service-ended';

export type DepartureTiming = 'same_day' | 'previous_evening' | 'previous_day' | 'more_than_one_day_earlier';

export type ArriveByConfidence = 'normal' | 'limited';

// ── Result states ────────────────────────────────────────────────────────

export type ArriveByResultState =
  | 'ready_for_planning'
  | 'limited_confidence'
  | 'route_verification_required'
  | 'unsupported_route'
  | 'invalid_deadline'
  | 'insufficient_timezone_data';

interface ArriveByResultBase {
  state: ArriveByResultState;
  /** Always present — the non-live-schedule disclaimer, verbatim across every result. See config.ts's NON_LIVE_SCHEDULE_DISCLAIMER. */
  disclaimer: string;
}

/** unsupported_route | invalid_deadline | insufficient_timezone_data — no plan is computed. */
export interface ArriveByRejection extends ArriveByResultBase {
  state: 'unsupported_route' | 'invalid_deadline' | 'insufficient_timezone_data';
  reason: string;
}

export interface ArriveByRouteIdentity {
  originAirportSlug: string;
  destinationSlug: string;
  routeSlug: string;
}

/**
 * route_verification_required — the route itself has no currently
 * confirmed service for the requested travel date (verification-pending,
 * service-ended, or the travel date falls on/after an announced
 * withdrawal's effective date). No landing/departure times are computed:
 * inventing a backward-planning window for a service that isn't confirmed
 * to exist would fabricate confidence the evidence doesn't support.
 */
export interface ArriveByRouteVerificationRequired extends ArriveByResultBase {
  state: 'route_verification_required';
  routeIdentity: ArriveByRouteIdentity;
  journeyType: ArriveByJourneyType;
  requiredArrivalLocal: ZonedDateTime;
  /** Existing Route Status ledger/route wording only — never invented here. */
  routeWarning: string;
  assumptionsUsed: PlanningAssumption[];
  sourceProvenance: string[];
}

/**
 * ready_for_planning | limited_confidence — a full indicative planning
 * window. limited_confidence still returns real numbers, just with an
 * explicit reason confidence is reduced (e.g. an announced-but-not-yet-
 * effective withdrawal, or a route with a documented service-stability
 * caveat) — never a silently weaker version of the same claim.
 */
export interface ArriveByPlan extends ArriveByResultBase {
  state: 'ready_for_planning' | 'limited_confidence';
  routeIdentity: ArriveByRouteIdentity;
  journeyType: ArriveByJourneyType;
  confidence: ArriveByConfidence;
  requiredArrivalLocal: ZonedDateTime;
  recommendedLatestLandingLocal: ZonedDateTime;
  indicativeUkDepartureWindow: { earliest: ZonedDateTime; latest: ZonedDateTime };
  recommendedOriginAirportArrivalLocal: ZonedDateTime;
  departureTiming: DepartureTiming;
  /** Existing Route Status ledger/route wording only, or null when nothing applies. Never invented here. */
  routeWarning: string | null;
  /** Planning-model-authored cautions (e.g. overnight departure, thin connection evidence) — distinct from routeWarning. */
  planningWarnings: string[];
  assumptionsUsed: PlanningAssumption[];
  sourceProvenance: string[];
}

export type ArriveByResult = ArriveByRejection | ArriveByRouteVerificationRequired | ArriveByPlan;
