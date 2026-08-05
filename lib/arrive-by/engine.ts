import type {
  ArriveByInput,
  ArriveByResult,
  ArriveByPlan,
  ArriveByRouteVerificationRequired,
  ArriveByRejection,
  DepartureTiming,
  PlanningAssumption,
  ZonedDateTime,
} from './types';
import { getAirportTimeZone, getDestinationTimeZone, isValidLocalDate, isValidLocalTime, zonedTimeToUtc, toZonedDateTime, addMinutesUtc, localCalendarDayDiff } from './timezones';
import { getArriveByRouteSupport } from './route-support';
import {
  NON_LIVE_SCHEDULE_DISCLAIMER,
  DIRECT_JOURNEY_DURATION_RANGE_HOURS,
  CONNECTING_JOURNEY_DURATION_RANGE_HOURS,
  DESTINATION_PROCESSING_BUFFER_MINUTES,
  CHECKED_BAGGAGE_DESTINATION_BUFFER_MINUTES,
  STRICT_DEADLINE_BUFFER_MINUTES,
  FLEXIBLE_DEADLINE_BUFFER_MINUTES,
  STANDARD_CONNECTION_BUFFER_MINUTES,
  CAUTIOUS_CONNECTION_BUFFER_MINUTES,
  CHECKED_BAGGAGE_CONNECTION_BUFFER_MINUTES,
  OVERNIGHT_WARNING_THRESHOLD_HOURS,
  EVENING_DEPARTURE_THRESHOLD_HOUR,
  UK_AIRPORT_PREPARATION_HAND_LUGGAGE_MINUTES,
  UK_AIRPORT_PREPARATION_CHECKED_BAGGAGE_MINUTES,
  getDestinationBufferAssumptions,
  getScheduleRiskAssumption,
  getConnectionAssumptions,
  getUkPreparationAssumption,
  getDurationAssumption,
} from './config';

const UK_TIME_ZONE = 'Europe/London';

function reject(state: ArriveByRejection['state'], reason: string): ArriveByRejection {
  return { state, reason, disclaimer: NON_LIVE_SCHEDULE_DISCLAIMER };
}

/**
 * Plans an indicative Arrive By journey window. Pure and deterministic:
 * `nowIso` is the only notion of "now" the engine has, exactly like
 * data/routes.ts's getRoutePresentation(route, nowIso) — no wall-clock
 * read happens inside this function, so the same input always produces
 * the same output (see tests/arrive-by-engine.test.ts's determinism
 * check).
 *
 * Never calls a network API, never reads live schedules, never invents a
 * flight number or exact timetable — see docs/product/ARRIVE_BY_MVP.md.
 */
export function planArriveBy(input: ArriveByInput, nowIso: string): ArriveByResult {
  // ── Validation ────────────────────────────────────────────────────────
  if (!input.requiredArrivalDateLocal || !isValidLocalDate(input.requiredArrivalDateLocal)) {
    return reject('invalid_deadline', 'The required arrival date is missing or not a valid calendar date.');
  }
  if (!input.requiredArrivalTimeLocal || input.requiredArrivalTimeLocal.trim() === '') {
    return reject('invalid_deadline', 'The required arrival time is missing.');
  }
  if (!isValidLocalTime(input.requiredArrivalTimeLocal)) {
    return reject('invalid_deadline', 'The required arrival time is not a valid 24-hour HH:mm value.');
  }

  const routeSupport = getArriveByRouteSupport(input.originAirportSlug, input.destinationSlug, input.requiredArrivalDateLocal, nowIso);
  if (!routeSupport.supported) {
    const reason =
      routeSupport.reason === 'unsupported-origin-for-destination'
        ? `Arrive By does not yet support this destination from ${input.originAirportSlug}.`
        : `Arrive By does not yet support this destination.`;
    return reject('unsupported_route', reason);
  }

  const originTimeZone = getAirportTimeZone(input.originAirportSlug);
  const destinationTimeZone = getDestinationTimeZone(input.destinationSlug);
  if (!originTimeZone || !destinationTimeZone) {
    return reject('insufficient_timezone_data', 'Arrive By does not have dependable timezone data for this origin or destination.');
  }

  const requiredArrival = zonedTimeToUtc(input.requiredArrivalDateLocal, input.requiredArrivalTimeLocal, destinationTimeZone);
  const requiredArrivalUtcMs = new Date(requiredArrival.utcIso).getTime();
  const nowMs = new Date(nowIso).getTime();

  if (requiredArrivalUtcMs <= nowMs) {
    return reject('invalid_deadline', 'The required arrival date and time is already in the past.');
  }

  const requiredArrivalLocal: ZonedDateTime = { ...toZonedDateTime(requiredArrival.utcIso, destinationTimeZone) };
  const routeIdentity = { originAirportSlug: input.originAirportSlug, destinationSlug: input.destinationSlug, routeSlug: routeSupport.routeSlug };

  // ── Route not currently confirmed for this travel date ─────────────────
  if (routeSupport.journeyType === 'verification-pending' || routeSupport.journeyType === 'service-ended') {
    const result: ArriveByRouteVerificationRequired = {
      state: 'route_verification_required',
      disclaimer: NON_LIVE_SCHEDULE_DISCLAIMER,
      routeIdentity,
      journeyType: routeSupport.journeyType,
      requiredArrivalLocal,
      routeWarning: routeSupport.routeWarning ?? 'This route does not currently have a confirmed service for planning purposes.',
      assumptionsUsed: [],
      sourceProvenance: routeSupport.sourceProvenance,
    };
    return result;
  }

  const journeyType = routeSupport.journeyType; // 'direct' | 'connecting' at this point
  const baggage = input.baggage;
  const connectionPreference = input.connectionRiskPreference ?? 'standard';

  // ── Buffers (minutes) ────────────────────────────────────────────────
  const destinationBufferMinutes = DESTINATION_PROCESSING_BUFFER_MINUTES + (baggage === 'checked-baggage' ? CHECKED_BAGGAGE_DESTINATION_BUFFER_MINUTES : 0);
  const scheduleRiskAssumption = getScheduleRiskAssumption(input.deadlineStrictness);
  const scheduleRiskMinutesValue = input.deadlineStrictness === 'strict' ? STRICT_DEADLINE_BUFFER_MINUTES : FLEXIBLE_DEADLINE_BUFFER_MINUTES;

  const recommendedLatestLandingUtc = addMinutesUtc(requiredArrival.utcIso, -(destinationBufferMinutes + scheduleRiskMinutesValue));

  let durationHours: number;
  let connectionBufferMinutes = 0;
  const planningWarnings: string[] = [];

  if (journeyType === 'direct') {
    durationHours = DIRECT_JOURNEY_DURATION_RANGE_HOURS.max;
  } else {
    durationHours = CONNECTING_JOURNEY_DURATION_RANGE_HOURS.max;
    connectionBufferMinutes = connectionPreference === 'cautious' ? CAUTIOUS_CONNECTION_BUFFER_MINUTES : STANDARD_CONNECTION_BUFFER_MINUTES;
    if (baggage === 'checked-baggage') connectionBufferMinutes += CHECKED_BAGGAGE_CONNECTION_BUFFER_MINUTES;
    const totalConnectingHours = durationHours + connectionBufferMinutes / 60;
    if (totalConnectingHours >= OVERNIGHT_WARNING_THRESHOLD_HOURS) {
      planningWarnings.push(
        `This connecting journey's indicative total duration (including the connection buffer) is ${totalConnectingHours.toFixed(1)} hours or more — plan for a departure that may fall the evening or day before your deadline.`
      );
    }
  }

  // Two candidate UK departure instants, both targeting the SAME fixed
  // recommendedLatestLandingUtc: one assuming the LONGER end of the
  // duration range (a safe, worst-case-protected departure — since more
  // flight time is assumed, the traveller must leave EARLIER to still land
  // on time) and one assuming the SHORTER end (an optimistic, best-case
  // departure — since less flight time is assumed, the traveller could
  // still land on time leaving LATER). Naming these by chronological
  // outcome, not by which duration bound produced them, is what keeps the
  // window's own field names honest below — a longer duration assumption
  // does NOT mean "leave later"; it means the opposite, because the target
  // landing time is fixed. (Previously named indicativeDepartureUtc /
  // earliestDepartureUtc, which inverted this — see docs/product/ARRIVE_BY_MVP.md §16.)
  const totalFlightSideMinutes = durationHours * 60 + connectionBufferMinutes;
  const earliestSensibleDepartureUtc = addMinutesUtc(recommendedLatestLandingUtc, -totalFlightSideMinutes);

  const ukPreparation = getUkPreparationAssumption(baggage);
  const ukPreparationMinutes = baggage === 'checked-baggage' ? UK_AIRPORT_PREPARATION_CHECKED_BAGGAGE_MINUTES : UK_AIRPORT_PREPARATION_HAND_LUGGAGE_MINUTES;
  const recommendedOriginAirportArrivalUtc = addMinutesUtc(earliestSensibleDepartureUtc, -ukPreparationMinutes);

  if (new Date(recommendedOriginAirportArrivalUtc).getTime() <= nowMs) {
    return reject('invalid_deadline', 'This deadline is too close for a sensible planning window — even with no preparation time at all, there would be no time left to travel.');
  }

  // The optimistic, best-case-duration departure — the latest a traveller
  // could sensibly leave and still make it, if the flight happens to be
  // quick. Chronologically AFTER earliestSensibleDepartureUtc by
  // construction, since the short duration bound is always less than the
  // long one (DIRECT/CONNECTING_JOURNEY_DURATION_RANGE_HOURS in config.ts).
  const shortDurationHours = journeyType === 'direct' ? DIRECT_JOURNEY_DURATION_RANGE_HOURS.min : CONNECTING_JOURNEY_DURATION_RANGE_HOURS.min;
  const shortTotalMinutes = shortDurationHours * 60 + connectionBufferMinutes;
  const latestSensibleDepartureUtc = addMinutesUtc(recommendedLatestLandingUtc, -shortTotalMinutes);

  const recommendedLatestLandingLocal = toZonedDateTime(recommendedLatestLandingUtc, destinationTimeZone);
  const indicativeUkDepartureWindow = {
    earliest: toZonedDateTime(earliestSensibleDepartureUtc, UK_TIME_ZONE),
    latest: toZonedDateTime(latestSensibleDepartureUtc, UK_TIME_ZONE),
  };
  const recommendedOriginAirportArrivalLocal = toZonedDateTime(recommendedOriginAirportArrivalUtc, UK_TIME_ZONE);

  // ── Departure timing bucket ───────────────────────────────────────────
  // Both instants compared as UK-local calendar dates — "how many UK days
  // before the deadline's UK-equivalent date must the traveller be at the
  // UK airport", which is how a UK-based traveller actually thinks about it.
  const dayDiff = localCalendarDayDiff(recommendedOriginAirportArrivalUtc, requiredArrival.utcIso, UK_TIME_ZONE);
  let departureTiming: DepartureTiming;
  if (dayDiff <= 0) {
    departureTiming = 'same_day';
  } else if (dayDiff === 1) {
    const departureHour = Number(recommendedOriginAirportArrivalLocal.timeHHmm.split(':')[0]);
    departureTiming = departureHour >= EVENING_DEPARTURE_THRESHOLD_HOUR ? 'previous_evening' : 'previous_day';
  } else {
    departureTiming = 'more_than_one_day_earlier';
  }

  // ── DST ambiguity warnings ─────────────────────────────────────────────
  if (requiredArrival.dstTransitionAmbiguous) {
    planningWarnings.push('Your required arrival time falls during a daylight-saving transition at the destination — the exact UTC instant is a best-effort estimate.');
  }

  // ── Confidence and state ────────────────────────────────────────────────
  let confidence: 'normal' | 'limited' = 'normal';
  if (routeSupport.routeWarning) {
    confidence = 'limited';
    planningWarnings.push('This route has an announced future service change — see the route warning below before booking.');
  }
  const assumptionsUsed: PlanningAssumption[] = [
    getDurationAssumption(journeyType),
    ...getDestinationBufferAssumptions(baggage),
    scheduleRiskAssumption,
    ...(journeyType === 'connecting' ? getConnectionAssumptions(baggage, connectionPreference) : []),
    ukPreparation,
  ];

  const plan: ArriveByPlan = {
    state: confidence === 'limited' ? 'limited_confidence' : 'ready_for_planning',
    disclaimer: NON_LIVE_SCHEDULE_DISCLAIMER,
    routeIdentity,
    journeyType,
    confidence,
    requiredArrivalLocal,
    recommendedLatestLandingLocal,
    indicativeUkDepartureWindow,
    recommendedOriginAirportArrivalLocal,
    departureTiming,
    routeWarning: routeSupport.routeWarning,
    planningWarnings,
    assumptionsUsed,
    sourceProvenance: routeSupport.sourceProvenance,
  };
  return plan;
}
