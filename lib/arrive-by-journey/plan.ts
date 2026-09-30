import { CallCeilingExceeded, GoogleCallLedger, JOURNEY_CALL_CEILING, type MonthlyCallGuard } from './call-budget';
import { resolveJourneyAirports, type AirportMode } from './airports';
import { enteredOriginLeg, roadArrivalLeg } from './providers';
import { solveJourney, shortPlaceName } from './solver';
import { STATE_LABEL, type JourneyInput, type JourneyPlan, type NotEvidencedReason, type ResolvedLeg } from './types';

/**
 * The full-journey orchestrator: validates, meters, resolves legs, solves.
 *
 * Order of operations is deliberate, cheapest and safest first:
 *   1. airports (catalogue + capability) -- no Google
 *   2. input validation via a leg-less solve (times, buffers, connections) -- no Google
 *   3. reserve the monthly budget (fail closed) -- no Google
 *   4. resolve legs, every Google request through the per-journey ledger
 *   5. solve; settle the unused part of the monthly reservation
 *
 * If the 10-call journey ceiling is reached, or the monthly guard refuses,
 * the plan is CANNOT CONFIRM: the system never spends past a limit to finish.
 */

export interface PlanDeps {
  apiKey: string;
  guard: MonthlyCallGuard;
  nowIso: string;
  airportMode?: AirportMode;
  /** Injectable for tests and for a metered base fetch; defaults to global fetch. */
  baseFetch?: typeof fetch;
  ceiling?: number;
  /** Test seam: replaces the road engine so a scenario can make an exact number of Google calls. */
  arrivalLegProvider?: typeof roadArrivalLeg;
}

function refusal(reason: NotEvidencedReason, detail: string): JourneyPlan {
  return { state: 'CANNOT_CONFIRM', stateLabel: STATE_LABEL.CANNOT_CONFIRM, reasons: [detail], notEvidenced: { reason, detail }, timeline: [] };
}

export async function planFullJourney(input: JourneyInput, deps: PlanDeps): Promise<JourneyPlan> {
  // 1. Airports
  const check = resolveJourneyAirports(input.departureAirport, input.arrivalAirport, deps.airportMode ?? 'internal');
  if (!check.ok) return refusal(check.reason, check.detail);
  const { departure, arrival } = check.airports;

  const solverBase = {
    startLabel: input.start,
    destinationLabel: input.destination,
    departureAirport: departure,
    arrivalAirport: { code: arrival.code, name: arrival.name, timeZone: arrival.timeZone },
    flight: input.flight,
    preferences: input.preferences,
    nowIso: deps.nowIso,
  };

  // 2. Cheap validation before any spend: solve with no legs and see whether the INPUT itself is the problem.
  const originLeg = enteredOriginLeg(input.originLegMinutes);
  const preflight = solveJourney({ ...solverBase, originLeg, arrivalLeg: { status: 'NOT_EVIDENCED', reason: 'ARRIVAL_ROUTE_UNAVAILABLE' } });
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
    // 4. Legs
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
    // The engines swallow network errors, so a refused call shows up as "unresolved". The ledger is the truth.
    if (ledger.exhausted) {
      arrivalLeg = { status: 'NOT_EVIDENCED', reason: 'CALL_CEILING_REACHED' };
    }

    // 5. Solve
    const plan = solveJourney({ ...solverBase, originLeg, arrivalLeg });
    const finished: JourneyPlan = ledger.exhausted
      ? { ...plan, state: 'CANNOT_CONFIRM', stateLabel: STATE_LABEL.CANNOT_CONFIRM, reasons: [`Checking this journey needed more than ${ceiling} live lookups, so it was stopped rather than guessed.`], notEvidenced: { reason: 'CALL_CEILING_REACHED', detail: `Reached the ${ceiling}-call limit for one journey.` } }
      : plan;
    return {
      ...finished,
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
