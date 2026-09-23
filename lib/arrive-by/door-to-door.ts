import { parseLocalMoment, type LocalMoment } from './deadline-comparison';
import { toZonedDateTime } from './timezones';
import type { ZonedDateTime } from './types';
import {
  latestSafeReadyTime, planTurnUpAndGo, validateTurnUpAndGo,
  type EvidenceClass, type TurnUpAndGoTransport,
} from './turn-up-and-go';

export type FlexibleMode = 'car' | 'taxi' | 'rickshaw' | 'walk' | 'family pickup';
export type ScheduledMode = 'train' | 'bus' | 'coach' | 'ferry';
export interface Place { name: string; timeZone: string }
export interface Allowance { minutes: number | null; buffer: number | null }
export interface FlexibleTransport extends Allowance { kind: 'flexible'; mode: FlexibleMode }
export interface Service { id: string; departure: LocalMoment; arrival: LocalMoment }
export interface ScheduledTransport {
  kind: 'scheduled'; mode: ScheduledMode; from: Place; to: Place;
  minimumBeforeDeparture: number | null; services: Service[];
}
export type Transport = FlexibleTransport | ScheduledTransport;
export interface FlightOption { label: string; departure: LocalMoment; landing: LocalMoment; priceGBP: number | null }
export interface DoorJourney {
  home: Place; departureAirport: Place; arrivalAirport: Place; destination: Place;
  deadline: LocalMoment;
  finalBuffer: number | null;
  connectionCushion: number | null;
  homeAccess: Allowance;
  toAirport: Transport;
  departureProcess: { terminalTransfer: number | null; checkIn: number | null; security: number | null; boarding: number | null };
  arrivalProcess: { disembark: number | null; immigration: number | null; baggage: number | null; customs: number | null; walkToTransport: number | null };
  /** Timetabled onward leg, turn-up-and-go onward leg, or none. */
  onward: ScheduledTransport | TurnUpAndGoTransport | null;
  finalMile: FlexibleTransport;
  flights: FlightOption[];
}
/**
 * A journey whose onward leg is known to be timetabled. Fixtures and tests
 * that mutate `onward.services` use this so widening `DoorJourney.onward` to
 * include turn-up-and-go transport does not force casts at every call site.
 */
export type ScheduledOnwardJourney = Omit<DoorJourney, 'onward'> & { onward: ScheduledTransport | null };
export interface TimelineItem { label: string; start: ZonedDateTime; end: ZonedDateTime; minutes: number; buffer?: number }
/**
 * PLAN FRAGILITY CORRECTION (Tester 2, 23 Sep 2026): `state` here used to
 * collapse to `spare < 0 ? 'NOT CATCHABLE' : spare < (extraCushion > 0 ? 0 :
 * cushion) ? 'TIGHT' : 'COMFORTABLE'` — whenever a connection was built with
 * a nonzero `extraCushion` (every onward-service connection: the ONE most
 * safety-critical link in the whole chain, since it is what a flight delay
 * actually threatens), the TIGHT band collapsed to zero width. A connection
 * could clear its required minimum-plus-cushion allowance by a single
 * minute and still be reported COMFORTABLE, identically to one that cleared
 * it by three hours — exactly the failure a real traveller (Tester 2:
 * Manchester -> Dubai -> Abu Dhabi -> Yas Marina Circuit, a 10:00 coach with
 * ~10 minutes of genuine delay tolerance) found actively misleading,
 * because the large final-deadline margin made the headline look safe.
 * `spare` itself was always correct arithmetic; only the classification
 * boundary was wrong. Fixed to a single, consistent rule: TIGHT is
 * `0 <= spare < cushion` for every connection, using the founder's own
 * entered `connectionCushion` as the fragility band width in every case,
 * never widened or narrowed by whether this particular call already folded
 * that same cushion into its required allowance.
 */
export interface Connection {
  label: string; ready: ZonedDateTime; departure: ZonedDateTime; margin: number;
  minimum: number; extraCushion: number; spare: number; state: 'COMFORTABLE' | 'TIGHT' | 'NOT CATCHABLE';
}
export interface ServiceAssessment {
  id: string; departure: ZonedDateTime; arrival: ZonedDateTime;
  fitsDownstream: boolean; catchable: boolean | null; status: string; selected: boolean;
}
export interface BackwardStep { label: string; by: ZonedDateTime }
export type DeadlineStatus = 'MEETS REQUIREMENT' | 'BEFORE DEADLINE, BUT BUFFER NOT MET' | 'AT DEADLINE, BUT BUFFER NOT MET' | 'MISSES DEADLINE' | 'NOT ESTABLISHED';
/**
 * Plan fragility, separate from whether the plan works at all (`state`).
 * Derived purely from `tightest` — the same cushion-based COMFORTABLE/TIGHT
 * threshold `connection()` already computes, never a second, independently
 * invented number. `null` whenever `state !== 'YES'` (fragility is only
 * meaningful for a plan that currently works) or there is no scheduled
 * connection to assess (a flexible-transport-only chain has nothing to be
 * fragile against). See PLAN-FRAGILITY-CORRECTION doc comment on `connection()`.
 */
export type PlanConfidence = 'ROBUST' | 'FRAGILE';
export interface DoorOptionResult {
  label: string; priceGBP: number | null; state: 'YES' | 'NO' | 'CANNOT CONFIRM';
  /** Set only when `state === 'YES'`. See `PlanConfidence`. */
  confidence: PlanConfidence | null;
  reasons: string[]; deadline: ZonedDateTime; homeDeparture?: ZonedDateTime;
  airportArrivalBy?: ZonedDateTime; flightArrivalBy?: ZonedDateTime;
  finalArrival?: ZonedDateTime; deadlineMargin?: number;
  effectiveLatestArrival: ZonedDateTime; requiredFinalBuffer: number; deadlineStatus: DeadlineStatus;
  readyForOnward?: ZonedDateTime; waitMinutes?: number;
  latestDeadlineService?: { id: string; departure: ZonedDateTime; arrival: ZonedDateTime };
  /** Turn-up-and-go onward leg: availability and planning wait, never a named departure. */
  turnUpAndGo?: {
    state: 'SERVICE AVAILABLE' | 'SERVICE CLOSED AT READY TIME';
    mode: string;
    readyAt: ZonedDateTime;
    windowClosesAt?: ZonedDateTime;
    nextOpening?: ZonedDateTime;
    waitUntilOpeningMinutes?: number;
    waitLabel: string;
    waitBasis: EvidenceClass | 'NONE';
    journeyMinutesBasis: EvidenceClass;
    timingConfirmed: boolean;
    missing: string[];
    notes: string[];
  };
  /** Turn-up-and-go backwards boundary: the latest moment to be ready, not a service. */
  latestSafeReadyTime?: ZonedDateTime;
  /** Why no turn-up-and-go boundary could be derived. */
  latestBoundaryUnavailable?: string;
  /** A catchable service shown only to explain failure, never a qualifying selection. */
  diagnosticOnwardService?: string;
  onwardService?: string; originService?: string;
  connections: Connection[]; tightest?: Connection; timeline: TimelineItem[];
  backwards: BackwardStep[]; originServices: ServiceAssessment[]; onwardServices: ServiceAssessment[];
  /**
   * "What happens if I miss the onward service I'm relying on?" (Testers 1
   * and 2 both asked this independently). Answered only from services
   * genuinely entered for a fixed-timetable onward leg — the next one to
   * depart after the one this plan relies on, whether or not that plan
   * relies on a real selection or only a non-qualifying diagnostic one.
   * `undefined` when there is no onward-service chain to fall back within
   * (no scheduled onward leg entered, or no service was assessed at all).
   * Never a live search and never a fabricated alternative: a scheduled
   * onward leg with nothing entered after the relied-on service reports
   * `hasNextEntered: false`, not silence.
   */
  fallbackOnward?: {
    hasNextEntered: boolean;
    nextService?: { id: string; departure: ZonedDateTime; arrival: ZonedDateTime };
    finalArrivalIfUsed?: ZonedDateTime;
    meetsDeadline?: boolean;
    meetsDeadlineWithBuffer?: boolean;
  };
}
export interface DoorComparison { errors: string[]; options: DoorOptionResult[]; tradeOff?: string }
type ParsedService = { service: Service; departure: number; arrival: number };
const MINUTE = 60000;
const validMinutes = (value: number | null): value is number => value !== null && Number.isSafeInteger(value) && value >= 0 && value <= 10080;
const total = (allowance: Allowance) => allowance.minutes! + allowance.buffer!;
const stamp = (ms: number, zone: string) => toZonedDateTime(new Date(ms).toISOString(), zone);
const instant = (value: LocalMoment) => { const iso = parseLocalMoment(value); return iso ? Date.parse(iso) : NaN; };
const sum = (values: Record<string, number | null>) => Object.values(values).reduce<number>((a, b) => a + b!, 0);

function checkServices(transport: ScheduledTransport, prefix: string, errors: string[]): ParsedService[] {
  if (!transport.services.length) errors.push(`${prefix}: NO SCHEDULED SERVICE PROVIDED.`);
  if (transport.services.length > 8) errors.push(`${prefix}: enter at most eight candidate services.`);
  if (!validMinutes(transport.minimumBeforeDeparture)) errors.push(`${prefix}: enter the required stop/station arrival allowance.`);
  if (!transport.from.name.trim() || !transport.to.name.trim()) errors.push(`${prefix}: enter both stop/station names.`);
  const ids = new Set<string>();
  return transport.services.map((service) => {
    const departure = instant(service.departure); const arrival = instant(service.arrival);
    if (!service.id.trim() || ids.has(service.id)) errors.push(`${prefix}: each service needs a distinct name.`);
    ids.add(service.id);
    if (!Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) errors.push(`${prefix} ${service.id}: confirm valid departure/arrival dates and time zones; arrival must follow departure. Clock-change ambiguities cannot be guessed.`);
    if (service.departure.timeZone !== transport.from.timeZone || service.arrival.timeZone !== transport.to.timeZone) errors.push(`${prefix} ${service.id}: service time zones must match its stops.`);
    return { service, departure, arrival };
  });
}

/** Closed, manually entered chain. Schedules and all allowances remain unverified assumptions. */
export function planDoorJourney(input: DoorJourney, nowIso: string): DoorComparison {
  const errors: string[] = [];
  const deadline = instant(input.deadline); const now = Date.parse(nowIso);
  if (!Number.isFinite(deadline) || !Number.isFinite(now) || deadline <= now) errors.push('Enter a future, valid deadline. Ambiguous or nonexistent clock-change times need confirmation.');
  for (const [label, place] of Object.entries({ Home: input.home, 'Departure airport': input.departureAirport, 'Arrival airport': input.arrivalAirport, Destination: input.destination })) {
    if (!place.name.trim()) errors.push(`${label}: enter a location name.`);
    try { new Intl.DateTimeFormat('en-GB', { timeZone: place.timeZone }); } catch { errors.push(`${label}: enter a valid IANA time zone.`); }
  }
  if (input.deadline.timeZone !== input.destination.timeZone) errors.push('Deadline time zone must match the final destination.');
  for (const [label, value] of Object.entries({ 'Final arrival buffer': input.finalBuffer, 'Extra connection cushion': input.connectionCushion })) if (!validMinutes(value)) errors.push(`${label}: enter whole minutes, including an explicit 0 if none.`);
  const checkAllowance = (label: string, value: Allowance) => {
    if (!validMinutes(value.minutes) || !validMinutes(value.buffer)) errors.push(`${label}: enter duration and buffer; unknown is not zero.`);
  };
  checkAllowance('Final mile', input.finalMile);
  if (input.toAirport.kind === 'flexible') checkAllowance('Travel to departure airport', input.toAirport);
  else checkAllowance('Home to departure stop/station', input.homeAccess);
  for (const [label, value] of Object.entries(input.departureProcess)) if (!validMinutes(value)) errors.push(`Departure ${label}: allowance missing or invalid.`);
  for (const [label, value] of Object.entries(input.arrivalProcess)) if (!validMinutes(value)) errors.push(`Arrival ${label}: allowance missing or invalid.`);
  const originServices = input.toAirport.kind === 'scheduled' ? checkServices(input.toAirport, 'Before flight', errors) : [];
  const scheduledOnward = input.onward?.kind === 'scheduled' ? input.onward : null;
  const turnUpOnward = input.onward?.kind === 'turn-up-and-go' ? input.onward : null;
  const onwardServices = scheduledOnward ? checkServices(scheduledOnward, 'After flight', errors) : [];
  if (turnUpOnward) validateTurnUpAndGo(turnUpOnward, 'After flight', errors);
  if (input.flights.length < 1 || input.flights.length > 2) errors.push('Enter one or two flights.');
  if (errors.length) return { errors, options: [] };

  const cushion = input.connectionCushion!;
  const arrivalAllowance = sum(input.arrivalProcess);
  const departureAllowance = sum(input.departureProcess);
  const finalDuration = total(input.finalMile);
  const finalTarget = deadline - input.finalBuffer! * MINUTE;
  const latestFinalMileStart = finalTarget - finalDuration * MINUTE;
  const onwardFits = onwardServices.filter((s) => s.arrival <= latestFinalMileStart).sort((a, b) => b.departure - a.departure || a.arrival - b.arrival);
  const latestOnward = onwardFits[0];
  const latestSafeReady = turnUpOnward ? latestSafeReadyTime(turnUpOnward, latestFinalMileStart) : null;
  const flightArrivalBy = scheduledOnward
    ? latestOnward ? latestOnward.departure - (scheduledOnward.minimumBeforeDeparture! + cushion + arrivalAllowance) * MINUTE : undefined
    : turnUpOnward
      ? latestSafeReady?.ms != null ? latestSafeReady.ms - arrivalAllowance * MINUTE : undefined
      : latestFinalMileStart - arrivalAllowance * MINUTE;

  const options = input.flights.map((flight): DoorOptionResult => {
    const result: DoorOptionResult = {
      label: flight.label.trim() || 'Flight', priceGBP: flight.priceGBP, state: 'YES', confidence: null, reasons: [],
      deadline: stamp(deadline, input.destination.timeZone), connections: [], timeline: [], backwards: [], originServices: [], onwardServices: [],
      effectiveLatestArrival: stamp(finalTarget, input.destination.timeZone), requiredFinalBuffer: input.finalBuffer!, deadlineStatus: 'NOT ESTABLISHED',
    };
    const departure = instant(flight.departure); const landing = instant(flight.landing);
    if (!Number.isFinite(departure) || !Number.isFinite(landing) || departure <= now || landing <= departure
      || flight.departure.timeZone !== input.departureAirport.timeZone || flight.landing.timeZone !== input.arrivalAirport.timeZone
      || (flight.priceGBP !== null && (!Number.isFinite(flight.priceGBP) || flight.priceGBP < 0))) {
      result.state = 'CANNOT CONFIRM'; result.reasons.push('Confirm this flight’s future departure and landing instants, airport time zones and optional GBP price.'); return result;
    }
    function segment(label: string, start: number, end: number, fromZone: string, toZone = fromZone, buffer?: number) {
      result.timeline.push({ label, start: stamp(start, fromZone), end: stamp(end, toZone), minutes: (end - start) / MINUTE, buffer });
    }
    function connection(label: string, ready: number, leaves: number, minimum: number, zone: string, extraCushion = 0): Connection {
      const margin = (leaves - ready) / MINUTE; const required = minimum + extraCushion; const spare = margin - required;
      // See the PLAN FRAGILITY CORRECTION doc comment on `Connection`: the
      // TIGHT band is always `spare < cushion`, regardless of whether this
      // call already folded `cushion` into `required` via `extraCushion`.
      const item: Connection = { label, ready: stamp(ready, zone), departure: stamp(leaves, zone), margin, minimum: required, extraCushion, spare, state: spare < 0 ? 'NOT CATCHABLE' : spare < cushion ? 'TIGHT' : 'COMFORTABLE' };
      result.connections.push(item); return item;
    }
    const airportBy = departure - departureAllowance * MINUTE;
    result.airportArrivalBy = stamp(airportBy, input.departureAirport.timeZone);
    if (flightArrivalBy !== undefined) result.flightArrivalBy = stamp(flightArrivalBy, input.arrivalAirport.timeZone);
    result.backwards.push({ label: `At ${input.destination.name} by`, by: stamp(deadline, input.destination.timeZone) });
    result.backwards.push({ label: 'Effective latest arrival (clock deadline minus required final buffer)', by: result.effectiveLatestArrival });
    result.backwards.push({ label: `Start ${input.finalMile.mode} final mile by (includes final buffer)`, by: stamp(latestFinalMileStart, input.onward?.to.timeZone ?? input.arrivalAirport.timeZone) });
    if (scheduledOnward && latestOnward) {
      result.latestDeadlineService = { id: latestOnward.service.id, departure: stamp(latestOnward.departure, scheduledOnward.from.timeZone), arrival: stamp(latestOnward.arrival, scheduledOnward.to.timeZone) };
      result.backwards.push({ label: `Latest downstream-compatible ${scheduledOnward.mode}: ${latestOnward.service.id}`, by: stamp(latestOnward.departure, scheduledOnward.from.timeZone) });
      result.backwards.push({ label: `Ready at ${scheduledOnward.from.name} by (boarding allowance + extra cushion)`, by: stamp(latestOnward.departure - (scheduledOnward.minimumBeforeDeparture! + cushion) * MINUTE, scheduledOnward.from.timeZone) });
    }
    if (turnUpOnward) {
      // No individual departure is published for this mode, so the boundary is
      // the latest moment to be READY — deliberately not phrased as a service.
      if (latestSafeReady?.ms != null) {
        result.latestSafeReadyTime = stamp(latestSafeReady.ms, turnUpOnward.from.timeZone);
        result.backwards.push({ label: `Latest safe ready time at ${turnUpOnward.from.name} (${turnUpOnward.mode}: no individual departures published; EXACT DEPARTURE NOT PROVIDED)`, by: result.latestSafeReadyTime });
      } else if (latestSafeReady?.reason) {
        result.latestBoundaryUnavailable = latestSafeReady.reason;
      }
    }
    if (flightArrivalBy !== undefined) result.backwards.push({ label: 'Flight must land by, under entered allowances', by: stamp(flightArrivalBy, input.arrivalAirport.timeZone) });
    result.backwards.push({ label: `Reach ${input.departureAirport.name} transport drop-off by`, by: result.airportArrivalBy });
    let airportAt: number | undefined;
    if (input.toAirport.kind === 'flexible') {
      const start = airportBy - (total(input.toAirport) + cushion) * MINUTE;
      result.homeDeparture = stamp(start, input.home.timeZone);
      airportAt = airportBy - cushion * MINUTE;
      segment(`${input.toAirport.mode}: ${input.home.name} → ${input.departureAirport.name}`, start, airportAt, input.home.timeZone, input.departureAirport.timeZone, input.toAirport.buffer!);
    } else {
      const transport = input.toAirport;
      const selected = originServices.filter((s) => s.arrival <= airportBy).sort((a, b) => b.departure - a.departure || a.arrival - b.arrival)[0];
      result.originServices = originServices.map((s) => ({ id: s.service.id, departure: stamp(s.departure, transport.from.timeZone), arrival: stamp(s.arrival, transport.to.timeZone), fitsDownstream: s.arrival <= airportBy, catchable: null, selected: s === selected, status: s.arrival <= airportBy ? 'Fits airport-arrival requirement' : 'Too late for airport-arrival requirement' }));
      if (!selected) { result.state = 'NO'; result.reasons.push('No entered pre-flight service meets the airport-arrival requirement.'); }
      else {
        result.originService = selected.service.id;
        const ready = selected.departure - (transport.minimumBeforeDeparture! + cushion) * MINUTE;
        const start = ready - total(input.homeAccess) * MINUTE;
        result.homeDeparture = stamp(start, input.home.timeZone);
        segment(`Home → ${transport.from.name}`, start, ready, input.home.timeZone, transport.from.timeZone, input.homeAccess.buffer!);
        connection(selected.service.id, ready, selected.departure, transport.minimumBeforeDeparture!, transport.from.timeZone);
        segment(`At ${transport.from.name} before departure`, ready, selected.departure, transport.from.timeZone, transport.from.timeZone, transport.minimumBeforeDeparture! + cushion);
        segment(`${transport.mode}: ${selected.service.id} · ${transport.from.name} → ${transport.to.name}`, selected.departure, selected.arrival, transport.from.timeZone, transport.to.timeZone);
        airportAt = selected.arrival;
      }
    }
    if (result.homeDeparture) {
      result.backwards.push({ label: 'Leave home by (includes chosen connection cushion)', by: result.homeDeparture });
      if (Date.parse(result.homeDeparture.utcIso) < now) { result.state = 'NO'; result.reasons.push('The calculated home-departure time has already passed.'); }
    }
    if (airportAt !== undefined) {
      connection('Gate / boarding before flight', airportAt + (departureAllowance - input.departureProcess.boarding!) * MINUTE, departure, input.departureProcess.boarding!, input.departureAirport.timeZone);
      let cursor = airportAt;
      for (const [key, label] of [['terminalTransfer', 'Transfer to terminal'], ['checkIn', 'Check-in / bag drop'], ['security', 'Security'], ['boarding', 'Gate / boarding allowance']] as const) {
        const end = cursor + input.departureProcess[key]! * MINUTE;
        segment(label, cursor, end, input.departureAirport.timeZone); cursor = end;
      }
      if (cursor < departure) segment('Remaining pre-flight margin', cursor, departure, input.departureAirport.timeZone);
    }
    segment(`Flight: ${flight.label}`, departure, landing, input.departureAirport.timeZone, input.arrivalAirport.timeZone);
    let ready = landing;
    for (const [key, label] of [['disembark', 'Taxiing / disembarkation'], ['immigration', 'Immigration'], ['baggage', 'Baggage collection'], ['customs', 'Customs / exit'], ['walkToTransport', 'Walk / transfer to transport']] as const) {
      const end = ready + input.arrivalProcess[key]! * MINUTE;
      segment(label, ready, end, input.arrivalAirport.timeZone); ready = end;
    }
    let finalStart: number | undefined = ready;
    if (turnUpOnward) {
      const transport = turnUpOnward;
      result.readyForOnward = stamp(ready, transport.from.timeZone);
      const outcome = planTurnUpAndGo(transport, ready);
      const { availability, wait } = outcome;
      result.turnUpAndGo = {
        state: availability.state, mode: transport.mode, readyAt: availability.readyAt,
        windowClosesAt: availability.windowClosesAt, nextOpening: availability.nextOpening,
        waitUntilOpeningMinutes: availability.waitUntilOpeningMinutes,
        waitLabel: wait.label, waitBasis: wait.basis, journeyMinutesBasis: transport.journeyMinutesBasis,
        timingConfirmed: outcome.timingConfirmed, missing: outcome.missing, notes: availability.notes,
      };
      if (availability.dstAmbiguous) result.reasons.push(`${transport.mode} operating hours fall on a clock change; the boundary is ambiguous by up to an hour and needs confirmation.`);
      if (availability.state === 'SERVICE CLOSED AT READY TIME') {
        result.state = 'NO'; finalStart = undefined;
        const reopening = availability.nextOpening
          ? ` NEXT OPERATING WINDOW: ${availability.nextOpening.dateIso} ${availability.nextOpening.timeHHmm} ${availability.nextOpening.timeZone} (${availability.waitUntilOpeningMinutes} min away). That is a reopening time, not a departure.`
          : '';
        result.reasons.push(`SERVICE CLOSED AT YOUR READY TIME: the ${transport.mode} at ${transport.from.name} is outside its published operating hours when you are ready.${reopening}`);
      } else if (!outcome.timingConfirmed) {
        // Availability is known; timing is not. Say exactly that, and name the gap.
        result.state = 'CANNOT CONFIRM'; finalStart = undefined;
        result.reasons.push(`SERVICE AVAILABLE at your ready time, but CANNOT CONFIRM EXACT ARRIVAL: ${outcome.missing.join('; ')}. ${wait.label}`);
      } else {
        result.waitMinutes = (outcome.boardingMs! - ready) / MINUTE;
        segment(`${transport.mode} at ${transport.from.name}: station access + planning wait (EXACT DEPARTURE NOT PROVIDED)`, ready, outcome.boardingMs!, transport.from.timeZone, transport.from.timeZone, transport.minimumBeforeDeparture!);
        segment(`${transport.mode}: ${transport.from.name} → ${transport.to.name}`, outcome.boardingMs!, outcome.arrivalMs!, transport.from.timeZone, transport.to.timeZone);
        finalStart = outcome.arrivalMs!;
      }
    } else if (scheduledOnward) {
      const transport = scheduledOnward;
      result.readyForOnward = stamp(ready, transport.from.timeZone);
      const catchableServices = onwardServices.filter((s) => s.departure >= ready + (transport.minimumBeforeDeparture! + cushion) * MINUTE)
        .sort((a, b) => a.departure - b.departure || a.arrival - b.arrival);
      const selected = catchableServices.find((s) => s.arrival <= latestFinalMileStart);
      // Preserve an explicitly non-qualifying example so deadline and buffer failures remain explainable.
      const assessed = selected ?? catchableServices[0];
      result.onwardServices = onwardServices.map((s) => {
        const fitsDownstream = s.arrival <= latestFinalMileStart;
        const catchable = s.departure >= ready + (transport.minimumBeforeDeparture! + cushion) * MINUTE;
        const finalArrival = s.arrival + finalDuration * MINUTE;
        return { id: s.service.id, departure: stamp(s.departure, transport.from.timeZone), arrival: stamp(s.arrival, transport.to.timeZone), fitsDownstream, catchable, selected: s === selected,
          status: !catchable ? 'NOT CATCHABLE with boarding allowance and extra cushion' : finalArrival > deadline ? 'MISSES DEADLINE' : !fitsDownstream ? (finalArrival === deadline ? 'AT DEADLINE, BUT BUFFER NOT MET' : 'BEFORE DEADLINE, BUT BUFFER NOT MET') : 'Usable under entered allowances and cushion' };
      });
      if (!selected) {
        result.state = 'NO'; finalStart = undefined;
        result.reasons.push('No entered onward service is both catchable with your boarding allowance and extra cushion and compatible with the final deadline and buffer.');
        if (!assessed && latestOnward) connection(latestOnward.service.id, ready, latestOnward.departure, transport.minimumBeforeDeparture!, transport.from.timeZone, cushion);
      }
      if (assessed) {
        if (selected) result.onwardService = selected.service.id;
        else result.diagnosticOnwardService = assessed.service.id;
        result.waitMinutes = (assessed.departure - ready) / MINUTE;
        connection(assessed.service.id, ready, assessed.departure, transport.minimumBeforeDeparture!, transport.from.timeZone, cushion);
        segment(`${selected ? 'Wait / boarding' : 'Non-qualifying alternative: wait / boarding'} at ${transport.from.name}`, ready, assessed.departure, transport.from.timeZone);
        segment(`${selected ? '' : 'Non-qualifying alternative: '}${transport.mode}: ${assessed.service.id} · ${transport.from.name} → ${transport.to.name}`, assessed.departure, assessed.arrival, transport.from.timeZone, transport.to.timeZone);
        finalStart = assessed.arrival;
        // "What if I miss it?" (Testers 1 and 2 both asked this) — the next
        // entered service that departs after the one this plan relies on,
        // whichever service that is. Never filtered by the boarding/cushion
        // requirement that produced `assessed`: once missed, that
        // requirement no longer applies — only whether a later entered
        // departure exists and, if so, whether it still meets the deadline.
        const nextService = onwardServices.filter((s) => s.departure > assessed.departure).sort((a, b) => a.departure - b.departure)[0];
        if (nextService) {
          const nextFinalArrival = nextService.arrival + finalDuration * MINUTE;
          result.fallbackOnward = {
            hasNextEntered: true,
            nextService: { id: nextService.service.id, departure: stamp(nextService.departure, transport.from.timeZone), arrival: stamp(nextService.arrival, transport.to.timeZone) },
            finalArrivalIfUsed: stamp(nextFinalArrival, input.destination.timeZone),
            meetsDeadline: nextFinalArrival <= deadline,
            meetsDeadlineWithBuffer: nextFinalArrival <= finalTarget,
          };
        } else {
          result.fallbackOnward = { hasNextEntered: false };
        }
      }
    }
    if (finalStart !== undefined) {
      const finish = finalStart + finalDuration * MINUTE;
      segment(`${input.finalMile.mode}: final mile to ${input.destination.name}`, finalStart, finish, input.onward?.to.timeZone ?? input.arrivalAirport.timeZone, input.destination.timeZone, input.finalMile.buffer!);
      result.finalArrival = stamp(finish, input.destination.timeZone);
      result.deadlineMargin = (deadline - finish) / MINUTE;
      if (finish > deadline) {
        result.state = 'NO'; result.deadlineStatus = 'MISSES DEADLINE';
        result.reasons.push(`Arrives ${-result.deadlineMargin} min after the clock deadline.`);
      } else if (finish > finalTarget) {
        result.state = 'NO'; result.deadlineStatus = finish === deadline ? 'AT DEADLINE, BUT BUFFER NOT MET' : 'BEFORE DEADLINE, BUT BUFFER NOT MET';
        result.reasons.push(`Arrives ${result.deadlineMargin === 0 ? 'exactly at' : `${result.deadlineMargin} min before`} the clock deadline, but the required ${input.finalBuffer} min final buffer is not met. Effective latest arrival: ${result.effectiveLatestArrival.dateIso} ${result.effectiveLatestArrival.timeHHmm} ${result.effectiveLatestArrival.timeZone}.`);
      } else { result.deadlineStatus = 'MEETS REQUIREMENT'; }
    }
    result.tightest = [...result.connections].sort((a, b) => a.spare - b.spare)[0];
    // Whether the plan works (`state`) and how much slack it has
    // (`confidence`) are two different questions — see the PLAN FRAGILITY
    // CORRECTION doc comment above. A large final-deadline margin must
    // never stand in for, or hide, a thin intermediate connection.
    if (result.state === 'YES') result.confidence = result.tightest && result.tightest.state !== 'COMFORTABLE' ? 'FRAGILE' : 'ROBUST';
    return result;
  });
  let tradeOff: string | undefined;
  if (options.length === 2) {
    const workable = options.filter((o) => o.state === 'YES');
    const missed = options.find((o) => o.state === 'NO');
    if (workable.length === 1 && missed && workable[0].priceGBP !== null && missed.priceGBP !== null) {
      const delta = workable[0].priceGBP! - missed.priceGBP;
      tradeOff = `${workable[0].label} has an entered fare £${Math.abs(delta).toFixed(2)} ${delta >= 0 ? 'higher' : 'lower'} than ${missed.label} and fits the entered chain${workable[0].onwardService ? ` using ${workable[0].onwardService}` : ''}. ${missed.label} does not fit this chain. These are entered fares, not verified like-for-like payable totals or a purchase recommendation.`;
    }
  }
  return { errors, options, tradeOff };
}
