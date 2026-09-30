import { CallCeilingExceeded, GoogleCallLedger, JOURNEY_CALL_CEILING, type MonthlyCallGuard } from './call-budget';
import { resolveJourneyAirports, type AirportMode, type OriginMode } from './airports';
import { enteredOriginLeg, roadArrivalLeg } from './providers';
import { googleOriginLeg, type OriginLegOutcome } from './origin-leg';
import { solveJourney, shortPlaceName } from './solver';
import { STATE_LABEL, type JourneyInput, type JourneyPlan, type NotEvidencedReason, type ResolvedLeg } from './types';

/**
 * The full-journey orchestrator: validates, meters, resolves legs, solves.
 *
 * Order of operations is deliberate, cheapest and safest first:
 *   1. airports (catalogue + capability + DEPARTURE evidence for a live origin) -- no Google
 *   2. input validation via a leg-less solve (times, buffers, connections) -- no Google
 *   3. reserve the monthly budget (fail closed) -- no Google
 *   4. resolve legs, every Google request through ONE per-journey ledger:
 *        origin  start -> departure airport   (start geocode + bounded backward search)
 *        arrival arrival airport -> destination (destination geocode + drive)
 *   5. solve; settle the unused part of the monthly reservation
 *
 * The 10-call ceiling is for the WHOLE journey, not per leg: the origin search is capped so the arrival side always
 * keeps its reserve, and if the ceiling is reached, or the monthly guard refuses, the plan is CANNOT CONFIRM.
 * The system never spends past a limit to finish, and never substitutes an entered duration when live routing fails:
 * ENTERED origin mode exists only as an explicit, internal opt-in.
 */

export interface PlanDeps {
  apiKey: string;
  guard: MonthlyCallGuard;
  nowIso: string;
  airportMode?: AirportMode;
  /** LIVE (default): Google-backed origin leg. ENTERED: explicit internal fallback that uses `input.originLegMinutes`. Never chosen automatically. */
  originMode?: OriginMode;
  /** Injectable for tests and for a metered base fetch; defaults to global fetch. */
  baseFetch?: typeof fetch;
  ceiling?: number;
  /** Test seams: replace the engines so a scenario can make an exact number of Google calls. */
  arrivalLegProvider?: typeof roadArrivalLeg;
  originLegProvider?: typeof googleOriginLeg;
}

function refusal(reason: NotEvidencedReason, detail: string): JourneyPlan {
  return { state: 'CANNOT_CONFIRM', stateLabel: STATE_LABEL.CANNOT_CONFIRM, reasons: [detail], notEvidenced: { reason, detail }, timeline: [] };
}

export async function planFullJourney(input: JourneyInput, deps: PlanDeps): Promise<JourneyPlan> {
  const originMode: OriginMode = deps.originMode ?? 'LIVE';

  // 1. Airports
  const check = resolveJourneyAirports(input.departureAirport, input.arrivalAirport, deps.airportMode ?? 'internal', originMode);
  if (!check.ok) return refusal(check.reason, check.detail);
  const { departure, arrival } = check.airports;

  const solverBase = {
    startLabel: input.start,
    destinationLabel: input.destination,
    departureAirport: { code: departure.code, name: departure.name, timeZone: departure.timeZone },
    arrivalAirport: { code: arrival.code, name: arrival.name, timeZone: arrival.timeZone },
    flight: input.flight,
    preferences: input.preferences,
    nowIso: deps.nowIso,
  };

  // 2. Cheap validation before any spend: solve with no legs and see whether the INPUT itself is the problem.
  const enteredLeg = originMode === 'ENTERED' ? enteredOriginLeg(input.originLegMinutes) : undefined;
  const preflight = solveJourney({
    ...solverBase,
    originLeg: enteredLeg ?? { status: 'NOT_EVIDENCED', reason: 'ORIGIN_LEG_MISSING' },
    arrivalLeg: { status: 'NOT_EVIDENCED', reason: 'ARRIVAL_ROUTE_UNAVAILABLE' },
  });
  if (preflight.notEvidenced?.reason === 'INVALID_INPUT' || preflight.notEvidenced?.reason === 'CONNECTION_NOT_MODELLED') return preflight;
  if (!input.destination.trim() || input.destination.length > 180 || !input.start.trim() || input.start.length > 180) {
    return refusal('INVALID_INPUT', 'Enter where you are starting from and where you are going.');
  }

  // 3. Monthly reservation (fails closed)
  const ceiling = deps.ceiling ?? JOURNEY_CALL_CEILING;
  const reservation = await deps.guard.reserve(ceiling);
  if (!reservation.granted) {
    return refusal('MONTHLY_BUDGET_UNAVAILABLE', "Arrive By can't run live checks right now, so this journey can't be confirmed.");
  }

  const ledger = new GoogleCallLedger(ceiling, deps.baseFetch);
  try {
    // 4a. Origin leg: live search, or the explicit entered fallback
    let originLeg: ResolvedLeg;
    let originOutcome: OriginLegOutcome | undefined;
    if (enteredLeg) {
      originLeg = enteredLeg;
    } else {
      try {
        originOutcome = await (deps.originLegProvider ?? googleOriginLeg)(deps.apiKey, check.airports, input, ledger, deps.nowIso);
        originLeg = originOutcome.leg;
      } catch (error) {
        originLeg = error instanceof CallCeilingExceeded
          ? { status: 'NOT_EVIDENCED', reason: 'CALL_CEILING_REACHED' }
          : { status: 'NOT_EVIDENCED', reason: 'ORIGIN_ROUTE_UNAVAILABLE', detail: "We couldn't get a reliable driving route from your start location to the departure airport." };
      }
      // The engines swallow network errors; a refused call is visible on the ledger, and an over-budget leg is never trusted.
      if (ledger.exhausted) originLeg = { status: 'NOT_EVIDENCED', reason: 'CALL_CEILING_REACHED' };
    }

    // 4b. Arrival leg
    let arrivalLeg: ResolvedLeg;
    let road;
    try {
      const outcome = await (deps.arrivalLegProvider ?? roadArrivalLeg)(deps.apiKey, check.airports, input, ledger, deps.nowIso);
      arrivalLeg = outcome.leg;
      road = outcome.road;
    } catch (error) {
      arrivalLeg = error instanceof CallCeilingExceeded
        ? { status: 'NOT_EVIDENCED', reason: 'CALL_CEILING_REACHED' }
        : { status: 'NOT_EVIDENCED', reason: 'ARRIVAL_ROUTE_UNAVAILABLE', detail: "We couldn't get a reliable driving route from the arrival airport to that destination." };
    }
    if (ledger.exhausted) arrivalLeg = { status: 'NOT_EVIDENCED', reason: 'CALL_CEILING_REACHED' };

    // 5. Solve
    const plan = solveJourney({ ...solverBase, originLeg, arrivalLeg });
    const finished: JourneyPlan = ledger.exhausted
      ? { ...plan, state: 'CANNOT_CONFIRM', stateLabel: STATE_LABEL.CANNOT_CONFIRM, reasons: [`Checking this journey needed more than ${ceiling} live lookups, so it was stopped rather than guessed.`], notEvidenced: { reason: 'CALL_CEILING_REACHED', detail: `Reached the ${ceiling}-call limit for one journey.` } }
      : plan;

    const search = originOutcome?.search;
    return {
      ...finished,
      startDetail: originOutcome?.start && originOutcome.start.confidence !== 'CONFIRMED' ? originOutcome.start : undefined,
      originSearch: search
        ? { queries: search.queries, converged: search.status === 'OK' && search.converged, slackMinutes: search.status === 'OK' ? search.slackMinutes : 0, departureAirport: departure.code }
        : undefined,
      arrivalDetail: road && road.outcome !== 'ETA_ONLY'
        ? { outcome: road.outcome, pendingConfirmation: road.pendingConfirmation, pendingSelection: road.pendingSelection, clarificationReason: road.clarificationReason }
        : undefined,
      calls: { used: ledger.used, ceiling, breakdown: { ...ledger.breakdown() } },
    };
  } finally {
    await deps.guard.settle(reservation, ledger.used);
  }
}

export { shortPlaceName };
