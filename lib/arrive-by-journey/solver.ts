import { roundClockToNearestFive } from '../arrive-by-shared/format';
import { PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES } from '../arrive-by-shared/road-outcomes';
import { clockOf, floorToMinutes, parseLocalDateTime } from './local-time';
import { STATE_LABEL } from './types';
import type { FlightInput, JourneyPlan, JourneyPreferences, JourneyState, LegEvidence, NotEvidencedReason, ResolvedLeg, TimelineLeg } from './types';

/**
 * The pure journey-chain solver. No network, no clock, no randomness: given
 * the two resolved ground legs, the flight and the traveller's own buffers it
 * returns the plan -- so every rule below is provable with fixed inputs.
 *
 *   airportArriveBy = flightDeparture - departureAirportBuffer
 *   leaveBy         = airportArriveBy - originLegDuration     (rounded DOWN to 5 min)
 *   roadDeparture   = flightArrival + arrivalExit + pickupWait
 *   finalArrival    = roadDeparture + arrivalLegDuration
 *   latestAcceptable = finalDeadline - destinationReadiness
 *   margin          = latestAcceptable - finalArrival
 *
 * Rules that keep it honest:
 *  - Every local time is read in ITS airport's IANA zone, and a nonexistent
 *    or ambiguous local time is rejected rather than guessed.
 *  - "Leave by" rounds DOWN (earlier is the safe direction); the expected final
 *    arrival is displayed to the nearest 5 minutes because it rests on a Google
 *    traffic estimate. Deadline and margin arithmetic stays exact.
 *  - A missing or unproven leg never yields a verdict: the state is
 *    CANNOT_CONFIRM, and whatever part of the plan IS evidenced is still shown.
 *  - No deadline -> ESTIMATE_ONLY. There is no margin without something to
 *    measure it against.
 */

export interface SolverAirport {
  code: string;
  /** Display name, e.g. "Manchester Airport". */
  name: string;
  timeZone: string;
}

export interface SolverInput {
  startLabel: string;
  destinationLabel: string;
  departureAirport: SolverAirport;
  arrivalAirport: SolverAirport;
  flight: FlightInput;
  preferences: JourneyPreferences;
  originLeg: ResolvedLeg;
  arrivalLeg: ResolvedLeg;
  /** When set, a leave-by time already in the past is NOT_FEASIBLE. */
  nowIso?: string;
}

const MAX_MINUTES = 480;
/** No real single flight is this long; a longer entry is almost certainly a typo (wrong date). */
const MAX_FLIGHT_MINUTES = 36 * 60;
const SAFE_ASSUMPTION: LegEvidence = { kind: 'ENTERED', source: 'Entered by you' };

function cannot(reason: NotEvidencedReason, detail: string, base: Partial<JourneyPlan> = {}): JourneyPlan {
  return { timeline: [], ...base, state: 'CANNOT_CONFIRM', stateLabel: STATE_LABEL.CANNOT_CONFIRM, reasons: [detail, ...(base.reasons ?? [])], notEvidenced: { reason, detail } };
}

function validMinutes(value: number | undefined, allowUndefined = false): boolean {
  if (value === undefined) return allowUndefined;
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_MINUTES;
}

/** "2-hour", "45-minute", "1 hour 30 minute" -- reads naturally in "your chosen ___ buffer". */
export function describeBuffer(minutes: number): string {
  if (minutes < 60) return `${minutes}-minute`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour`;
  return `${Math.floor(minutes / 60)} hour ${minutes % 60} minute`;
}

/** First comma-separated part of free text, for headline copy ("Preston, Lancashire" -> "Preston"). */
export function shortPlaceName(text: string): string {
  return text.split(',')[0].trim() || text.trim();
}

export function solveJourney(input: SolverInput): JourneyPlan {
  const { departureAirport: dep, arrivalAirport: arr, flight, preferences: prefs } = input;

  // ---- input validation (fails closed) ----
  if ((flight.declaredConnections ?? 0) > 0) {
    return cannot('CONNECTION_NOT_MODELLED', 'This flight entry includes a connection, and Arrive By cannot check connections yet. Enter each direct flight separately, or check the connection with the airline.');
  }
  if (!validMinutes(prefs.departureAirportBufferMinutes) || !validMinutes(prefs.arrivalExitMinutes) || !validMinutes(prefs.pickupWaitMinutes, true) || !validMinutes(prefs.destinationReadinessMinutes, true)) {
    return cannot('INVALID_INPUT', `Buffers must be whole minutes between 0 and ${MAX_MINUTES}.`);
  }
  const departs = parseLocalDateTime(flight.departsLocal, dep.timeZone);
  if (!departs.ok) return cannot('INVALID_INPUT', localTimeMessage('departure', departs.reason));
  const arrives = parseLocalDateTime(flight.arrivesLocal, arr.timeZone);
  if (!arrives.ok) return cannot('INVALID_INPUT', localTimeMessage('landing', arrives.reason));
  const elapsedMinutes = Math.round((arrives.ms - departs.ms) / 60000);
  if (elapsedMinutes <= 0) return cannot('INVALID_INPUT', 'The landing time must be after the departure time, allowing for the time difference between the two airports.');
  if (elapsedMinutes > MAX_FLIGHT_MINUTES) return cannot('INVALID_INPUT', 'That flight would last more than 36 hours once the time difference is allowed for. Check the dates.');

  let deadlineMs: number | undefined;
  if (prefs.finalDeadlineLocal) {
    const parsed = parseLocalDateTime(prefs.finalDeadlineLocal, arr.timeZone);
    if (!parsed.ok) return cannot('INVALID_INPUT', localTimeMessage('deadline', parsed.reason));
    if (parsed.ms <= arrives.ms) return cannot('INVALID_INPUT', 'The deadline must be after your flight lands.');
    deadlineMs = parsed.ms;
  }

  const plan: JourneyPlan = {
    state: 'ESTIMATE_ONLY',
    stateLabel: STATE_LABEL.ESTIMATE_ONLY,
    reasons: [],
    flight: { departsIso: departs.iso, arrivesIso: arrives.iso, elapsedMinutes, departZone: dep.timeZone, arriveZone: arr.timeZone },
    timeline: [],
  };
  const timeline: TimelineLeg[] = [];
  const problems: Array<{ reason: NotEvidencedReason; detail: string }> = [];

  // ---- origin side: home -> departure airport ----
  const airportArriveByMs = departs.ms - prefs.departureAirportBufferMinutes * 60000;
  let leaveByMs: number | undefined;
  if (input.originLeg.status === 'OK') {
    const exactLeaveMs = airportArriveByMs - input.originLeg.expectedSeconds * 1000;
    leaveByMs = floorToMinutes(exactLeaveMs, 5);
    const reachAirportMs = leaveByMs + input.originLeg.expectedSeconds * 1000;
    plan.leaveBy = { iso: new Date(leaveByMs).toISOString(), zone: dep.timeZone, clock: clockOf(leaveByMs, dep.timeZone), roundedDownToFive: true };
    plan.airportArriveBy = { iso: new Date(airportArriveByMs).toISOString(), zone: dep.timeZone, clock: clockOf(airportArriveByMs, dep.timeZone), bufferMinutes: prefs.departureAirportBufferMinutes };
    timeline.push({
      kind: 'ORIGIN_ACCESS', label: `${shortPlaceName(input.startLabel)} to ${dep.name}`,
      startIso: new Date(leaveByMs).toISOString(), endIso: new Date(reachAirportMs).toISOString(),
      minutes: Math.round(input.originLeg.expectedSeconds / 60), startZone: dep.timeZone, endZone: dep.timeZone, evidence: input.originLeg.evidence,
    });
    timeline.push({
      kind: 'DEPARTURE_BUFFER', label: `At ${dep.name} before departure`,
      startIso: new Date(reachAirportMs).toISOString(), endIso: departs.iso,
      minutes: Math.round((departs.ms - reachAirportMs) / 60000), startZone: dep.timeZone, endZone: dep.timeZone,
      evidence: { ...SAFE_ASSUMPTION, source: 'Your chosen airport buffer' },
    });
  } else {
    problems.push({ reason: input.originLeg.reason, detail: input.originLeg.detail ?? 'The journey from your start location to the departure airport has not been evidenced.' });
  }

  timeline.push({
    kind: 'FLIGHT', label: flight.label ? `Flight ${flight.label}` : 'Flight',
    startIso: departs.iso, endIso: arrives.iso, minutes: elapsedMinutes, startZone: dep.timeZone, endZone: arr.timeZone,
    evidence: { ...SAFE_ASSUMPTION, source: 'Flight times entered by you' },
  });

  // ---- arrival side: landing -> final destination ----
  let finalArrivalMs: number | undefined;
  const exitMs = arrives.ms + prefs.arrivalExitMinutes * 60000;
  const roadDepartureMs = exitMs + (prefs.pickupWaitMinutes ?? 0) * 60000;
  timeline.push({
    kind: 'ARRIVAL_EXIT', label: `Leaving ${arr.name}`, startIso: arrives.iso, endIso: new Date(exitMs).toISOString(),
    minutes: prefs.arrivalExitMinutes, startZone: arr.timeZone, endZone: arr.timeZone, evidence: { ...SAFE_ASSUMPTION, source: 'Your own airport-exit estimate' },
  });
  if ((prefs.pickupWaitMinutes ?? 0) > 0) {
    timeline.push({
      kind: 'PICKUP_WAIT', label: 'Waiting for your pickup', startIso: new Date(exitMs).toISOString(), endIso: new Date(roadDepartureMs).toISOString(),
      minutes: prefs.pickupWaitMinutes ?? 0, startZone: arr.timeZone, endZone: arr.timeZone, evidence: { ...SAFE_ASSUMPTION, source: 'Your own pickup estimate' },
    });
  }
  if (input.arrivalLeg.status === 'OK') {
    finalArrivalMs = roadDepartureMs + input.arrivalLeg.expectedSeconds * 1000;
    plan.finalArrival = { iso: new Date(finalArrivalMs).toISOString(), zone: arr.timeZone, clock: roundClockToNearestFive(new Date(finalArrivalMs).toISOString(), arr.timeZone) };
    timeline.push({
      kind: 'ONWARD', label: `${arr.name} to ${shortPlaceName(input.destinationLabel)}`, startIso: new Date(roadDepartureMs).toISOString(), endIso: new Date(finalArrivalMs).toISOString(),
      minutes: Math.round(input.arrivalLeg.expectedSeconds / 60), startZone: arr.timeZone, endZone: arr.timeZone, evidence: input.arrivalLeg.evidence,
    });
  } else {
    problems.push({ reason: input.arrivalLeg.reason, detail: input.arrivalLeg.detail ?? 'The journey from the arrival airport to your destination has not been evidenced.' });
  }

  plan.timeline = timeline;

  // ---- deadline judgement (needs the arrival side) ----
  if (deadlineMs !== undefined && finalArrivalMs !== undefined) {
    const latestMs = deadlineMs - (prefs.destinationReadinessMinutes ?? 0) * 60000;
    const marginMinutes = Math.round((latestMs - finalArrivalMs) / 60000);
    plan.deadline = { iso: new Date(deadlineMs).toISOString(), latestAcceptableIso: new Date(latestMs).toISOString(), marginMinutes };
    if ((prefs.destinationReadinessMinutes ?? 0) > 0) {
      timeline.push({
        kind: 'DESTINATION_READINESS', label: 'Time you need at the destination', startIso: new Date(finalArrivalMs).toISOString(), endIso: new Date(finalArrivalMs + (prefs.destinationReadinessMinutes ?? 0) * 60000).toISOString(),
        minutes: prefs.destinationReadinessMinutes ?? 0, startZone: arr.timeZone, endZone: arr.timeZone, evidence: { ...SAFE_ASSUMPTION, source: 'Your own readiness estimate' },
      });
    }
  }

  // ---- headline copy (only for the parts that are evidenced) ----
  if (plan.leaveBy && plan.airportArriveBy && plan.finalArrival) {
    plan.headline = {
      leave: `Leave ${shortPlaceName(input.startLabel)} by around ${plan.leaveBy.clock}`,
      airport: `You should reach ${dep.name} with your chosen ${describeBuffer(prefs.departureAirportBufferMinutes)} buffer.`,
      arrival: `Expected final arrival: ${shortPlaceName(input.destinationLabel)} around ${plan.finalArrival.clock}`,
    };
  }

  // ---- state ----
  if (problems.length > 0) {
    const first = problems[0];
    return { ...plan, state: 'CANNOT_CONFIRM', stateLabel: STATE_LABEL.CANNOT_CONFIRM, reasons: problems.map((p) => p.detail), notEvidenced: first };
  }
  if (input.nowIso && leaveByMs !== undefined && leaveByMs < Date.parse(input.nowIso)) {
    return { ...plan, state: 'NOT_FEASIBLE', stateLabel: STATE_LABEL.NOT_FEASIBLE, reasons: ['The time you would need to leave has already passed.'] };
  }
  let state: JourneyState = 'ESTIMATE_ONLY';
  const reasons: string[] = [];
  if (plan.deadline) {
    const { marginMinutes } = plan.deadline;
    if (marginMinutes < 0) {
      state = 'NOT_FEASIBLE';
      reasons.push(`The expected arrival is about ${Math.abs(marginMinutes)} minutes after the latest time you need to be there.`);
    } else if (marginMinutes <= PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES) {
      state = 'POSSIBLE_BUT_TIGHT';
      reasons.push(`Only about ${marginMinutes} minutes to spare.`);
    } else {
      state = 'POSSIBLE_WITH_MARGIN';
      reasons.push(`About ${marginMinutes} minutes to spare.`);
    }
  } else {
    reasons.push('No deadline was entered, so this is an estimate rather than a verdict.');
  }
  return { ...plan, state, stateLabel: STATE_LABEL[state], reasons };
}

function localTimeMessage(what: string, reason: string): string {
  switch (reason) {
    case 'NONEXISTENT_LOCAL_TIME': return `That ${what} time does not exist on that date (the clocks change). Check the time.`;
    case 'AMBIGUOUS_LOCAL_TIME': return `That ${what} time happens twice on that date (the clocks go back). Use a different time or check with the airline.`;
    case 'INVALID_ZONE': return `The ${what} airport's time zone is not recognised.`;
    default: return `Enter a valid ${what} date and time.`;
  }
}
