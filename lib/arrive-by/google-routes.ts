import { parseLocalMoment, type LocalMoment } from './deadline-comparison';
import { planDoorJourney, type DoorJourney, type DoorOptionResult, type Service } from './door-to-door';

export const GOOGLE_ROUTE_FIELD_MASK = [
  'routes.duration',
  'routes.staticDuration',
  'routes.distanceMeters',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.transitDetails',
].join(',');

export const GOOGLE_ARRIVE_BY_ORIGINS = {
  'man-terminal-2': {
    id: 'man-terminal-2',
    label: 'Manchester Airport Terminal 2',
    latitude: 53.367664,
    longitude: -2.280683,
    timeZone: 'Europe/London',
  },
} as const;

export type GoogleOriginId = keyof typeof GOOGLE_ARRIVE_BY_ORIGINS;

export interface GooglePrototypeInput {
  originId: GoogleOriginId;
  availableAt: string;
  destination: string;
  deadline: string;
  deadlineReason?: string;
  /** Optional, user-entered minutes needed after location arrival to be ready. */
  readinessMinutes?: number;
  /**
   * Set only on a second request, after a NEEDS_CONFIRMATION destination
   * result was shown and explicitly accepted. Never trusted blindly — the
   * API route re-resolves the same destination text and only proceeds if
   * Google, right now, still independently resolves to this exact placeId.
   * See lib/arrive-by-shared/destination-resolution.ts.
   */
  confirmedPlaceId?: string;
  /**
   * Set only on a second request, after a NEEDS_SELECTION result was shown
   * and a candidate picked. Never trusted blindly — the API route
   * re-resolves and only proceeds if this placeId is still one of the
   * candidates Google independently returns right now.
   */
  selectedPlaceId?: string;
}

interface GoogleStep {
  travelMode?: string;
  staticDuration?: string;
  distanceMeters?: number;
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string };
      departureTime?: string;
      arrivalStop?: { name?: string };
      arrivalTime?: string;
    };
    transitLine?: {
      name?: string;
      nameShort?: string;
      agencies?: Array<{ name?: string }>;
      vehicle?: { type?: string; name?: { text?: string } };
    };
    headsign?: string;
    stopCount?: number;
  };
}

export interface GoogleRoutesResponse {
  routes?: Array<{
    duration?: string;
    staticDuration?: string;
    distanceMeters?: number;
    legs?: Array<{ steps?: GoogleStep[] }>;
  }>;
}

export interface GoogleWalkLeg {
  kind: 'walk';
  durationSeconds: number;
  distanceMeters: number;
}

export interface GoogleTransitLeg {
  kind: 'transit';
  departureStop: string;
  departureTime: string;
  arrivalStop: string;
  arrivalTime: string;
  lineName: string;
  lineShortName?: string;
  agency?: string;
  vehicleType?: string;
  headsign?: string;
  stopCount?: number;
}

export type GoogleJourneyLeg = GoogleWalkLeg | GoogleTransitLeg;

export interface GoogleItinerary {
  startTime: string;
  arrivalTime: string;
  firstImportantService: GoogleTransitLeg;
  durationSeconds: number;
  distanceMeters: number;
  legs: GoogleJourneyLeg[];
}

export interface GooglePrototypeJudgement {
  meetsDeadline: boolean;
  arrivalTime: string;
  minutesFromDeadline: number;
}

export interface GoogleCarRescue {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  departureTime?: string;
  arrivalTime?: string;
  durationSeconds?: number;
  staticDurationSeconds?: number;
  distanceMeters?: number;
  /** True only when the request explicitly asked Google for traffic-aware timing. */
  trafficAware: boolean;
  meetsReadyBy?: boolean;
  minutesFromReadyBy?: number;
}

interface GooglePrototypeResultBase {
  origin: { id: GoogleOriginId; label: string; timeZone: string };
  destination: string;
  /** The traveller's stated commitment time. */
  deadline: string;
  /** The latest physical arrival permitted after any user-entered readiness time. */
  effectiveLatestArrival: string;
  readinessMinutes: number;
  deadlineReason?: string;
  immediateCar?: GoogleCarRescue;
  missedServiceCarRescue?: GoogleCarRescue;
}

export interface GoogleTransitPrototypeResult extends GooglePrototypeResultBase {
  transitStatus: 'AVAILABLE';
  primary: GoogleItinerary;
  fallback: GoogleItinerary;
  judgement: GooglePrototypeJudgement;
  fallbackJudgement: GooglePrototypeJudgement;
  engine: {
    state: DoorOptionResult['state'];
    selectedService?: string;
    assessedService?: string;
    finalArrival?: string;
    deadlineMargin?: number;
    fallbackService?: string;
    fallbackArrival?: string;
    fallbackMeetsDeadline?: boolean;
  };
}

export interface GoogleNoTransitPrototypeResult extends GooglePrototypeResultBase {
  transitStatus: 'UNAVAILABLE';
  immediateCar: GoogleCarRescue;
}

/**
 * Returned when the shared destination-resolution layer hasn't reached
 * CONFIRMED yet — the transit engine is never invoked in this state (see
 * app/api/founder/arrive-by/google/route.ts). Deliberately outside
 * GooglePrototypeResultBase: it carries none of a real journey's fields,
 * only what's needed to ask a human to confirm or choose a destination.
 */
export interface GoogleDestinationPendingResult {
  transitStatus: 'DESTINATION_PENDING';
  destinationConfidence: Exclude<import('@/lib/arrive-by-shared/destination-resolution').DestinationConfidence, 'CONFIRMED'>;
  clarificationReason?: import('@/lib/arrive-by-shared/destination-resolution').DestinationClarificationReason;
  pendingConfirmation?: { placeId: string; formattedAddress: string };
  pendingSelection?: { candidates: Array<{ placeId: string; formattedAddress: string }> };
}

export type GooglePrototypeResult = GoogleTransitPrototypeResult | GoogleNoTransitPrototypeResult | GoogleDestinationPendingResult;

export interface GoogleDriveResponses {
  immediateCar?: GoogleRoutesResponse | null;
  missedServiceCarRescue?: GoogleRoutesResponse | null;
}

const durationSeconds = (value?: string): number => {
  const matched = value?.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return matched ? Math.round(Number(matched[1])) : 0;
};

const flattenSteps = (response: GoogleRoutesResponse, routeIndex = 0): GoogleStep[] =>
  (response.routes?.[routeIndex]?.legs ?? []).flatMap((leg) => leg.steps ?? []);

function transitLeg(step: GoogleStep): GoogleTransitLeg | null {
  const details = step.transitDetails;
  const stops = details?.stopDetails;
  const line = details?.transitLine;
  if (!stops?.departureTime || !stops.arrivalTime || !stops.departureStop?.name || !stops.arrivalStop?.name) return null;
  return {
    kind: 'transit',
    departureStop: stops.departureStop.name,
    departureTime: stops.departureTime,
    arrivalStop: stops.arrivalStop.name,
    arrivalTime: stops.arrivalTime,
    lineName: line?.name ?? line?.nameShort ?? 'Public transport',
    lineShortName: line?.nameShort,
    agency: line?.agencies?.map((agency) => agency.name).filter(Boolean).join(', ') || undefined,
    vehicleType: line?.vehicle?.type ?? line?.vehicle?.name?.text,
    headsign: details?.headsign,
    stopCount: details?.stopCount,
  };
}

export function normaliseGoogleItinerary(response: GoogleRoutesResponse, routeIndex = 0): GoogleItinerary {
  const route = response.routes?.[routeIndex];
  if (!route) throw new Error('Google did not return a journey for these details.');
  const steps = flattenSteps(response, routeIndex);
  const transitIndexes = steps
    .map((step, index) => transitLeg(step) ? index : -1)
    .filter((index) => index >= 0);
  if (!transitIndexes.length) throw new Error('Google did not return a public-transport journey.');

  const firstTransitIndex = transitIndexes[0];
  const lastTransitIndex = transitIndexes[transitIndexes.length - 1];
  const firstImportantService = transitLeg(steps[firstTransitIndex])!;
  const lastTransit = transitLeg(steps[lastTransitIndex])!;
  const leadingWalkSeconds = steps.slice(0, firstTransitIndex).reduce((sum, step) => sum + (step.travelMode === 'WALK' ? durationSeconds(step.staticDuration) : 0), 0);
  const trailingWalkSeconds = steps.slice(lastTransitIndex + 1).reduce((sum, step) => sum + (step.travelMode === 'WALK' ? durationSeconds(step.staticDuration) : 0), 0);
  const startMs = Date.parse(firstImportantService.departureTime) - leadingWalkSeconds * 1000;
  const arrivalMs = Date.parse(lastTransit.arrivalTime) + trailingWalkSeconds * 1000;
  if (!Number.isFinite(startMs) || !Number.isFinite(arrivalMs) || arrivalMs <= startMs) {
    throw new Error('Google returned journey times that could not be interpreted safely.');
  }

  const legs: GoogleJourneyLeg[] = [];
  let pendingWalk: GoogleWalkLeg | null = null;
  const flushWalk = () => {
    if (pendingWalk && (pendingWalk.durationSeconds > 0 || pendingWalk.distanceMeters > 0)) legs.push(pendingWalk);
    pendingWalk = null;
  };
  for (const step of steps) {
    if (step.travelMode === 'WALK') {
      pendingWalk ??= { kind: 'walk', durationSeconds: 0, distanceMeters: 0 };
      pendingWalk.durationSeconds += durationSeconds(step.staticDuration);
      pendingWalk.distanceMeters += Math.max(0, Math.round(step.distanceMeters ?? 0));
      continue;
    }
    flushWalk();
    const transit = transitLeg(step);
    if (transit) legs.push(transit);
  }
  flushWalk();

  return {
    startTime: new Date(startMs).toISOString(),
    arrivalTime: new Date(arrivalMs).toISOString(),
    firstImportantService,
    durationSeconds: durationSeconds(route.duration) || Math.round((arrivalMs - startMs) / 1000),
    distanceMeters: Math.max(0, Math.round(route.distanceMeters ?? 0)),
    legs,
  };
}

export function localDateTimeToIso(value: string, timeZone: string): string {
  const [date, time] = value.split('T');
  const iso = date && time ? parseLocalMoment({ date, time, timeZone }) : null;
  if (!iso) throw new Error('Enter a valid date and time. Clock-change times must be unambiguous.');
  return iso;
}

function localMoment(iso: string, timeZone: string, rounding: 'floor' | 'ceil' = 'floor'): LocalMoment {
  let ms = Date.parse(iso);
  if (rounding === 'ceil' && ms % 60000 !== 0) ms += 60000 - (ms % 60000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}`, timeZone };
}

function serviceFromItinerary(id: string, itinerary: GoogleItinerary, timeZone: string): Service {
  return {
    id,
    departure: localMoment(itinerary.startTime, timeZone, 'floor'),
    // The existing engine has minute precision. Round an arrival with seconds
    // up so this adapter never overstates the traveller's spare time.
    arrival: localMoment(itinerary.arrivalTime, timeZone, 'ceil'),
  };
}

function engineInput(input: GooglePrototypeInput, primary: GoogleItinerary, fallback: GoogleItinerary): DoorJourney {
  const origin = GOOGLE_ARRIVE_BY_ORIGINS[input.originId];
  const availableIso = localDateTimeToIso(input.availableAt, origin.timeZone);
  const availableMs = Date.parse(availableIso);
  const deadline = localMoment(effectiveLatestArrival(input).iso, origin.timeZone);
  return {
    home: { name: origin.label, timeZone: origin.timeZone },
    departureAirport: { name: origin.label, timeZone: origin.timeZone },
    arrivalAirport: { name: origin.label, timeZone: origin.timeZone },
    destination: { name: input.destination, timeZone: origin.timeZone },
    deadline,
    finalBuffer: 0,
    connectionCushion: 0,
    homeAccess: { minutes: 0, buffer: 0 },
    toAirport: { kind: 'flexible', mode: 'walk', minutes: 0, buffer: 0 },
    departureProcess: { terminalTransfer: 0, checkIn: 0, security: 0, boarding: 0 },
    arrivalProcess: { disembark: 0, immigration: 0, baggage: 0, customs: 0, walkToTransport: 0 },
    onward: {
      kind: 'scheduled',
      mode: 'train',
      from: { name: origin.label, timeZone: origin.timeZone },
      to: { name: input.destination, timeZone: origin.timeZone },
      minimumBeforeDeparture: 0,
      services: [
        serviceFromItinerary('Google primary journey', primary, origin.timeZone),
        serviceFromItinerary('Google missed-service journey', fallback, origin.timeZone),
      ],
    },
    finalMile: { kind: 'flexible', mode: 'walk', minutes: 0, buffer: 0 },
    flights: [{
      label: 'Ready to leave the terminal',
      priceGBP: null,
      hasUnmodelledConnection: false,
      departure: localMoment(new Date(availableMs - 60000).toISOString(), origin.timeZone),
      landing: localMoment(availableIso, origin.timeZone),
    }],
  };
}

/**
 * Arrive By never infers a venue or commitment buffer.  A blank field means
 * zero minutes, and therefore retains location-arrival wording in the UI.
 */
export function readinessMinutes(input: GooglePrototypeInput): number {
  const value = input.readinessMinutes ?? 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > 720) {
    throw new Error('Enter a readiness time from 0 to 720 minutes.');
  }
  return value;
}

export function effectiveLatestArrival(input: GooglePrototypeInput): { commitmentIso: string; iso: string; readinessMinutes: number } {
  const origin = GOOGLE_ARRIVE_BY_ORIGINS[input.originId];
  if (!origin) throw new Error('Choose a supported terminal.');
  const commitmentIso = localDateTimeToIso(input.deadline, origin.timeZone);
  const minutes = readinessMinutes(input);
  return {
    commitmentIso,
    iso: new Date(Date.parse(commitmentIso) - minutes * 60000).toISOString(),
    readinessMinutes: minutes,
  };
}

function judgement(arrivalTime: string, deadlineIso: string): GooglePrototypeJudgement {
  const meetsDeadline = Date.parse(arrivalTime) <= Date.parse(deadlineIso);
  const exactMinutes = Math.abs(Date.parse(deadlineIso) - Date.parse(arrivalTime)) / 60000;
  // Never overstate spare time and never understate lateness.
  const minutes = meetsDeadline ? Math.floor(exactMinutes) : Math.ceil(exactMinutes);
  return {
    meetsDeadline,
    arrivalTime,
    minutesFromDeadline: minutes,
  };
}

export function normaliseGoogleDriveRescue(
  response: GoogleRoutesResponse | null | undefined,
  departureTime: string,
  effectiveDeadlineIso: string,
): GoogleCarRescue {
  const route = response?.routes?.[0];
  const duration = durationSeconds(route?.duration);
  const departureMs = Date.parse(departureTime);
  if (!route || !duration || !Number.isFinite(departureMs)) {
    return { status: 'UNAVAILABLE', trafficAware: true };
  }
  const arrivalTime = new Date(departureMs + duration * 1000).toISOString();
  const result = judgement(arrivalTime, effectiveDeadlineIso);
  return {
    status: 'AVAILABLE',
    departureTime,
    arrivalTime,
    durationSeconds: duration,
    staticDurationSeconds: durationSeconds(route.staticDuration) || undefined,
    distanceMeters: Math.max(0, Math.round(route.distanceMeters ?? 0)),
    trafficAware: true,
    meetsReadyBy: result.meetsDeadline,
    minutesFromReadyBy: result.minutesFromDeadline,
  };
}

export function buildGooglePrototypeResult(
  input: GooglePrototypeInput,
  primaryResponse: GoogleRoutesResponse,
  fallbackResponse: GoogleRoutesResponse,
  nowIso: string,
  driveResponses?: GoogleDriveResponses,
): GoogleTransitPrototypeResult {
  const origin = GOOGLE_ARRIVE_BY_ORIGINS[input.originId];
  if (!origin) throw new Error('Choose a supported terminal.');
  const primary = normaliseGoogleItinerary(primaryResponse);
  const fallback = normaliseGoogleItinerary(fallbackResponse);
  const readyBy = effectiveLatestArrival(input);
  const comparison = planDoorJourney(engineInput(input, primary, fallback), nowIso);
  if (comparison.errors.length || !comparison.options[0]) {
    throw new Error(comparison.errors[0] ?? 'Arrive By could not assess this journey.');
  }
  const option = comparison.options[0];
  const assessedService = option.onwardService ?? option.diagnosticOnwardService;
  if (!assessedService) {
    throw new Error('Neither returned journey can be started from the time you are ready to leave the terminal.');
  }
  const assessedItinerary = assessedService === 'Google missed-service journey' ? fallback : primary;
  const primaryJudgement = judgement(assessedItinerary.arrivalTime, readyBy.iso);
  const fallbackJudgement = judgement(fallback.arrivalTime, readyBy.iso);
  const hasImmediateCar = Boolean(driveResponses && Object.prototype.hasOwnProperty.call(driveResponses, 'immediateCar'));
  const hasMissedServiceCar = Boolean(driveResponses && Object.prototype.hasOwnProperty.call(driveResponses, 'missedServiceCarRescue'));
  return {
    transitStatus: 'AVAILABLE',
    origin: { id: origin.id, label: origin.label, timeZone: origin.timeZone },
    destination: input.destination,
    deadline: readyBy.commitmentIso,
    effectiveLatestArrival: readyBy.iso,
    readinessMinutes: readyBy.readinessMinutes,
    deadlineReason: input.deadlineReason?.trim() || undefined,
    primary,
    fallback,
    judgement: primaryJudgement,
    fallbackJudgement,
    immediateCar: hasImmediateCar
      ? normaliseGoogleDriveRescue(driveResponses?.immediateCar, localDateTimeToIso(input.availableAt, origin.timeZone), readyBy.iso)
      : undefined,
    missedServiceCarRescue: hasMissedServiceCar
      ? normaliseGoogleDriveRescue(driveResponses?.missedServiceCarRescue, primary.firstImportantService.departureTime, readyBy.iso)
      : undefined,
    engine: {
      state: option.state,
      selectedService: option.onwardService,
      assessedService,
      finalArrival: option.finalArrival ? `${option.finalArrival.dateIso}T${option.finalArrival.timeHHmm}` : undefined,
      deadlineMargin: option.deadlineMargin,
      fallbackService: option.fallbackOnward?.nextService?.id,
      fallbackArrival: option.fallbackOnward?.finalArrivalIfUsed ? `${option.fallbackOnward.finalArrivalIfUsed.dateIso}T${option.fallbackOnward.finalArrivalIfUsed.timeHHmm}` : undefined,
      fallbackMeetsDeadline: option.fallbackOnward?.meetsDeadline,
    },
  };
}

export function buildGoogleNoTransitPrototypeResult(
  input: GooglePrototypeInput,
  driveResponse: GoogleRoutesResponse | null | undefined,
): GoogleNoTransitPrototypeResult {
  const origin = GOOGLE_ARRIVE_BY_ORIGINS[input.originId];
  if (!origin) throw new Error('Choose a supported terminal.');
  const readyBy = effectiveLatestArrival(input);
  const departureTime = localDateTimeToIso(input.availableAt, origin.timeZone);
  return {
    transitStatus: 'UNAVAILABLE',
    origin: { id: origin.id, label: origin.label, timeZone: origin.timeZone },
    destination: input.destination,
    deadline: readyBy.commitmentIso,
    effectiveLatestArrival: readyBy.iso,
    readinessMinutes: readyBy.readinessMinutes,
    deadlineReason: input.deadlineReason?.trim() || undefined,
    immediateCar: normaliseGoogleDriveRescue(driveResponse, departureTime, readyBy.iso),
  };
}

export function googleRoutesRequest(
  input: GooglePrototypeInput,
  timing: { arrivalTime: string } | { departureTime: string },
) {
  const origin = GOOGLE_ARRIVE_BY_ORIGINS[input.originId];
  if (!origin) throw new Error('Choose a supported terminal.');
  return {
    origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
    destination: { address: input.destination },
    travelMode: 'TRANSIT',
    ...timing,
    computeAlternativeRoutes: true,
    languageCode: 'en-GB',
    units: 'METRIC',
    transitPreferences: { routingPreference: 'FEWER_TRANSFERS' },
  };
}

/** A single direct traffic-aware road estimate at the caller's explicit decision time. */
export function googleDriveRequest(input: GooglePrototypeInput, departureTime: string) {
  const origin = GOOGLE_ARRIVE_BY_ORIGINS[input.originId];
  if (!origin) throw new Error('Choose a supported terminal.');
  return {
    origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
    destination: { address: input.destination },
    travelMode: 'DRIVE',
    departureTime,
    routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    trafficModel: 'BEST_GUESS',
    computeAlternativeRoutes: false,
    languageCode: 'en-GB',
    units: 'METRIC',
  };
}
