import { getCatalogueAirport, type CatalogueAirport } from './airport-catalogue';
import { fetchIdentityResults, diagnoseAirportIdentity, evaluateAirportIdentity, MAX_IDENTITY_DISTANCE_KM, NAME_HIT_THRESHOLD, type IdentityCandidateDiagnostic, type AirportIdentityFailure } from './airport-identity';
import { resolveAirportProfile, type CapabilityEvidence } from './airport-capability';
import { getCountryName } from './airport-search';
import { resolveRoutingOrigin } from './airport-registry';
import { computeRoadJourney } from './road-journey';
import type { RoadOutcome } from './road-types';

/**
 * Operator-only live capability probe (Phase C). Server-side, run from
 * scripts/arrive-by-capability-probe.ts -- never reachable from a public
 * route and never sharing a visitor's rate-limit bucket (it does not go
 * through the API). For one airport it records the facts:
 *
 *   1. identity: does Google agree this named airport is where the catalogue says?
 *   2. drive:    can the SAME engine production uses compute a traffic-aware
 *                DRIVE route from the airport to a real nearby destination,
 *                under the airport's real destination policy?
 *   3. timezone: does Google's Time Zone API agree with the catalogue zone?
 *
 * and produces a verdict plus a capability recommendation. It NEVER releases
 * an airport: a PASS becomes capability evidence only, and public release is
 * the separate gate in airport-release.ts.
 *
 * Nothing stored here can contain the API key: records hold only the fields
 * below (no request URLs, no raw Google payloads), and serializeProbeRecord
 * refuses to emit anything containing the key.
 */

export type ProbeVerdict = 'PASS' | 'FAIL' | 'NEEDS_REVIEW';

export type ProbeFailureClass =
  | 'airport_identity'
  | 'no_drive_route'
  | 'destination_resolution'
  | 'country_policy'
  | 'timezone'
  | 'google_error'
  | 'catalogue_data'
  | 'other';

export interface DrivePolicyCheck {
  destination: string;
  /** What the configured policy SHOULD do with this destination. */
  expected: 'ROUTE' | 'REFUSE_WRONG_COUNTRY';
  outcome: RoadOutcome | 'ERROR';
  clarificationReason?: string;
  driveDurationSeconds?: number;
  distanceMeters?: number;
  /** True when the observed behaviour matched `expected`. */
  matchedExpectation: boolean;
}

export interface ProbeRecord {
  iata: string;
  icao: string;
  airportName: string;
  city: string;
  countryCode: string;
  catalogueLat: number;
  catalogueLng: number;
  catalogueTimeZone: string;
  region: string;
  /** True for MAN/ISB/LHE/KHI: probed for comparison only; no evidence is ever produced for an override. */
  control: boolean;
  identity: {
    ok: boolean;
    failure?: AirportIdentityFailure;
    matchedAddress?: string;
    distanceKm?: number;
    /** Top candidates with the numbers the threshold study needs. */
    candidates: IdentityCandidateDiagnostic[];
    googleStatus?: string;
    /** Set only when the country-restricted lookup failed and one unrestricted lookup found an agreeing airport in a DIFFERENT country than the catalogue's. */
    unrestrictedCountryMismatch?: { googleCountry: string; address: string; distanceKm: number };
  };
  drive: {
    destination: string;
    outcome: RoadOutcome | 'ERROR';
    destinationConfidence?: string;
    resolvedDestination?: string;
    clarificationReason?: string;
    durationSeconds?: number;
    distanceMeters?: number;
  };
  /** Every destination tried for the primary probe, in order (the deciding one is `drive`). */
  driveAttempts: Array<{ destination: string; outcome: RoadOutcome | 'ERROR'; clarificationReason?: string }>;
  policyChecks: DrivePolicyCheck[];
  timezone: { catalogue: string; google?: string; status: 'MATCH' | 'MISMATCH' | 'NOT_CHECKED' };
  verdict: ProbeVerdict;
  failureClass?: ProbeFailureClass;
  notes: string[];
  recommendation: 'road_supported' | 'route_testable' | 'none';
  probedAt: string;
  evidenceSource: string;
  thresholds: { maxIdentityDistanceKm: number; nameHitThreshold: number };
}

export interface ProbeSpec {
  iata: string;
  region: string;
  /** Primary probe destination -- decides the capability verdict. Defaults to the airport's city. */
  destination?: string;
  /**
   * Tried in order only if the primary destination does not resolve to a confident place. A destination that
   * fails to resolve says something about the destination-resolution engine, not the airport, so it is recorded
   * as a finding and the airport is judged on the first destination that resolves.
   */
  fallbackDestinations?: string[];
  /** Extra destinations that test the configured country policy. */
  policyChecks?: Array<{ destination: string; expected: 'ROUTE' | 'REFUSE_WRONG_COUNTRY' }>;
  /** Free-text reason this airport is in the study (special geography). */
  purpose?: string;
}

const CONTROL_CODES = new Set(['MAN', 'ISB', 'LHE', 'KHI']);
const EVIDENCE_SOURCE = 'scripts/arrive-by-capability-probe.ts (Google Geocoding, Routes computeRoutes DRIVE, Time Zone)';

/** The offset (minutes) of an IANA zone at a fixed instant -- lets us treat alias names for the same zone as equal. */
function offsetMinutes(timeZone: string, iso: string): number | undefined {
  try {
    const at = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at.getTime()) / 60000);
  } catch {
    return undefined;
  }
}

/** Same zone if the names match or every sampled offset agrees (Asia/Calcutta vs Asia/Kolkata). Exported for tests. */
export function sameTimeZone(a: string, b: string): boolean {
  if (a === b) return true;
  const samples = ['2027-01-15T12:00:00Z', '2027-04-15T12:00:00Z', '2027-07-15T12:00:00Z', '2027-10-15T12:00:00Z'];
  return samples.every((iso) => {
    const x = offsetMinutes(a, iso);
    const y = offsetMinutes(b, iso);
    return x !== undefined && x === y;
  });
}

async function googleTimeZone(apiKey: string, airport: CatalogueAirport): Promise<string | undefined> {
  const url = new URL('https://maps.googleapis.com/maps/api/timezone/json');
  url.searchParams.set('location', `${airport.lat},${airport.lng}`);
  url.searchParams.set('timestamp', String(Math.floor(Date.UTC(2027, 0, 15, 12) / 1000)));
  url.searchParams.set('key', apiKey);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const json = (await response.json()) as { status?: string; timeZoneId?: string };
    return json.status === 'OK' ? json.timeZoneId : undefined;
  } catch {
    return undefined;
  }
}

/** Tomorrow's date in the airport's own timezone, as YYYY-MM-DD -- a fixed local landing so traffic-aware routing is asked for a realistic future departure. */
function tomorrowLocal(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now.getTime() + 24 * 3600 * 1000));
}

async function runDrive(apiKey: string, airportCode: string, destination: string, now: Date) {
  const profile = resolveAirportProfile(airportCode);
  if (!profile || profile.destinationRules.expectedCountryCodes === 'POLICY_PENDING') throw new Error('no profile');
  return computeRoadJourney(
    apiKey,
    { code: profile.code, displayName: profile.displayName, timeZone: profile.timeZone, origin: resolveRoutingOrigin(profile) },
    { airportCode: profile.code, landingAt: `${tomorrowLocal(profile.timeZone, now)}T12:00`, airportExitBufferMinutes: 0, destination, pickupMode: 'other' },
    { expectedCountryCodes: profile.destinationRules.expectedCountryCodes, regionBias: profile.destinationRules.regionBias },
  );
}

/** Pure verdict logic, exported so it is tested without any network call. */
export function classifyProbe(input: {
  identityOk: boolean;
  identityFailure?: AirportIdentityFailure;
  identityHasPlausibleCandidate: boolean;
  /** Google places the airport in a different country than the catalogue (territory / country-code data issue). */
  identityCountryMismatch?: boolean;
  drive: { outcome: RoadOutcome | 'ERROR'; destinationConfidence?: string; clarificationReason?: string };
  timezoneStatus: 'MATCH' | 'MISMATCH' | 'NOT_CHECKED';
  policyChecksAllMatched: boolean;
}): { verdict: ProbeVerdict; failureClass?: ProbeFailureClass; notes: string[]; recommendation: ProbeRecord['recommendation'] } {
  const notes: string[] = [];
  const { drive } = input;

  if (drive.outcome === 'ERROR') {
    return { verdict: 'FAIL', failureClass: 'google_error', notes: ['The journey probe threw before a result.'], recommendation: input.identityOk ? 'route_testable' : 'none' };
  }

  let driveClass: ProbeFailureClass | undefined;
  if (drive.outcome !== 'ETA_ONLY') {
    if (drive.outcome === 'DESTINATION_NEEDS_CLARIFICATION' && drive.clarificationReason === 'WRONG_COUNTRY') driveClass = 'country_policy';
    else if (drive.destinationConfidence === 'CONFIRMED' && drive.outcome === 'ROUTE_UNAVAILABLE') driveClass = 'no_drive_route';
    else driveClass = 'destination_resolution';
    notes.push(`Primary drive probe did not produce a route (${drive.outcome}).`);
  }

  // Identity failures: a plausible airport-typed candidate in the right country that merely
  // misses a threshold is a human-review case, not a silent pass and not a hard fail.
  if (!input.identityOk && input.identityCountryMismatch) {
    notes.push('Google places this airport in a different country than the catalogue does.');
    return { verdict: 'NEEDS_REVIEW', failureClass: 'catalogue_data', notes, recommendation: 'none' };
  }
  if (!input.identityOk) {
    const reviewable = input.identityHasPlausibleCandidate && (input.identityFailure === 'TOO_FAR' || input.identityFailure === 'NAME_MISMATCH' || input.identityFailure === 'NOT_AN_AIRPORT');
    notes.push(`Identity: ${input.identityFailure ?? 'no agreeing result'}.`);
    if (reviewable && !driveClass) return { verdict: 'NEEDS_REVIEW', failureClass: 'airport_identity', notes, recommendation: 'none' };
    return { verdict: reviewable ? 'NEEDS_REVIEW' : 'FAIL', failureClass: 'airport_identity', notes, recommendation: 'none' };
  }

  if (driveClass) {
    // Identity is fine; the road path is not. A destination that merely needs confirmation is a review, not a failure of the airport.
    const review = driveClass === 'destination_resolution';
    return { verdict: review ? 'NEEDS_REVIEW' : 'FAIL', failureClass: driveClass, notes, recommendation: 'route_testable' };
  }

  if (input.timezoneStatus === 'MISMATCH') {
    notes.push('Google Time Zone disagrees with the catalogue zone.');
    return { verdict: 'NEEDS_REVIEW', failureClass: 'timezone', notes, recommendation: 'route_testable' };
  }
  if (!input.policyChecksAllMatched) {
    notes.push('A destination-policy check did not behave as configured.');
    return { verdict: 'NEEDS_REVIEW', failureClass: 'country_policy', notes, recommendation: 'route_testable' };
  }
  if (input.timezoneStatus === 'NOT_CHECKED') notes.push('Timezone not cross-checked (Time Zone API unavailable); catalogue zone derived offline.');
  return { verdict: 'PASS', notes, recommendation: 'road_supported' };
}

export async function probeAirport(apiKey: string, spec: ProbeSpec, now: Date = new Date()): Promise<ProbeRecord> {
  const airport = getCatalogueAirport(spec.iata);
  if (!airport) throw new Error(`${spec.iata} is not in the catalogue.`);
  const control = CONTROL_CODES.has(airport.iata);

  // 1. Identity
  const fetched = await fetchIdentityResults(apiKey, airport);
  const evaluation = fetched.status === 'OK' ? evaluateAirportIdentity(airport, fetched.results) : ({ ok: false, reason: fetched.status === 'ZERO_RESULTS' ? 'NO_RESULT' : 'REQUEST_FAILED' } as const);
  const candidates = diagnoseAirportIdentity(airport, fetched.results).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  // Plausible = right country and either typed airport, or (Google typed it as a transit station etc.) a strong name match within range.
  const plausible = candidates.some((c) => c.country === airport.countryCode && (c.types.includes('airport') || (c.nameHitRatio >= NAME_HIT_THRESHOLD && c.distanceKm <= MAX_IDENTITY_DISTANCE_KM)));
  let unrestrictedCountryMismatch: ProbeRecord['identity']['unrestrictedCountryMismatch'];
  if (!evaluation.ok && !plausible) {
    const wide = await fetchIdentityResults(apiKey, airport, { restrictCountry: false });
    const hit = diagnoseAirportIdentity(airport, wide.results).find((c) => c.types.includes('airport') && c.distanceKm <= MAX_IDENTITY_DISTANCE_KM && (c.iataInAddress || c.nameHitRatio >= NAME_HIT_THRESHOLD) && c.country && c.country !== airport.countryCode);
    if (hit && hit.country) unrestrictedCountryMismatch = { googleCountry: hit.country, address: hit.address, distanceKm: hit.distanceKm };
  }

  // 2. Drive (primary): the first destination that resolves confidently decides the airport.
  const destinations = [spec.destination ?? `${airport.city}, ${getCountryName(airport.countryCode)}`, ...(spec.fallbackDestinations ?? [])];
  const driveAttempts: ProbeRecord['driveAttempts'] = [];
  let drive: ProbeRecord['drive'] = { destination: destinations[0], outcome: 'ERROR' };
  const notesFromAttempts: string[] = [];
  for (const [index, destination] of destinations.entries()) {
    let attempt: ProbeRecord['drive'];
    try {
      const result = await runDrive(apiKey, airport.iata, destination, now);
      attempt = {
        destination,
        outcome: result.outcome,
        destinationConfidence: result.destinationConfidence,
        resolvedDestination: result.resolvedDestination,
        clarificationReason: result.clarificationReason,
        durationSeconds: result.driveDurationSeconds,
        distanceMeters: result.distanceMeters,
      };
    } catch {
      attempt = { destination, outcome: 'ERROR' };
    }
    driveAttempts.push({ destination, outcome: attempt.outcome, clarificationReason: attempt.clarificationReason });
    if (index === 0 || attempt.outcome === 'ETA_ONLY') drive = attempt;
    if (attempt.outcome === 'ETA_ONLY') {
      if (index > 0) {
        const first = driveAttempts[0];
        notesFromAttempts.push(`Primary destination "${destinations[0]}" did not resolve confidently (${first.outcome}${first.clarificationReason ? ` / ${first.clarificationReason}` : ''}); airport judged on "${destination}". That is a destination-resolution finding, not an airport failure.`);
      }
      break;
    }
  }

  // 2b. Policy checks
  const policyChecks: DrivePolicyCheck[] = [];
  for (const check of spec.policyChecks ?? []) {
    try {
      const result = await runDrive(apiKey, airport.iata, check.destination, now);
      const refused = result.outcome === 'DESTINATION_NEEDS_CLARIFICATION' && result.clarificationReason === 'WRONG_COUNTRY';
      const routed = result.outcome === 'ETA_ONLY';
      policyChecks.push({
        destination: check.destination,
        expected: check.expected,
        outcome: result.outcome,
        clarificationReason: result.clarificationReason,
        driveDurationSeconds: result.driveDurationSeconds,
        distanceMeters: result.distanceMeters,
        matchedExpectation: check.expected === 'ROUTE' ? routed : refused,
      });
    } catch {
      policyChecks.push({ destination: check.destination, expected: check.expected, outcome: 'ERROR', matchedExpectation: false });
    }
  }

  // 3. Timezone
  const googleZone = await googleTimeZone(apiKey, airport);
  const timezone: ProbeRecord['timezone'] = googleZone
    ? { catalogue: airport.timeZone, google: googleZone, status: sameTimeZone(airport.timeZone, googleZone) ? 'MATCH' : 'MISMATCH' }
    : { catalogue: airport.timeZone, status: 'NOT_CHECKED' };

  const classified = classifyProbe({
    identityOk: evaluation.ok,
    identityFailure: evaluation.ok ? undefined : evaluation.reason,
    identityHasPlausibleCandidate: plausible,
    identityCountryMismatch: Boolean(unrestrictedCountryMismatch),
    drive,
    timezoneStatus: timezone.status,
    policyChecksAllMatched: policyChecks.every((check) => check.matchedExpectation),
  });

  return {
    iata: airport.iata,
    icao: airport.icao,
    airportName: airport.name,
    city: airport.city,
    countryCode: airport.countryCode,
    catalogueLat: airport.lat,
    catalogueLng: airport.lng,
    catalogueTimeZone: airport.timeZone,
    region: spec.region,
    control,
    identity: {
      ok: evaluation.ok,
      failure: evaluation.ok ? undefined : evaluation.reason,
      matchedAddress: evaluation.ok ? evaluation.matchedAddress : undefined,
      distanceKm: evaluation.ok ? evaluation.distanceKm : undefined,
      candidates,
      googleStatus: fetched.googleStatus,
      unrestrictedCountryMismatch,
    },
    drive,
    driveAttempts,
    policyChecks,
    timezone,
    verdict: classified.verdict,
    failureClass: classified.failureClass,
    notes: [...(spec.purpose ? [`Study purpose: ${spec.purpose}`] : []), ...notesFromAttempts, ...classified.notes],
    // An override (MAN/ISB/LHE/KHI) never receives generic evidence.
    recommendation: control ? 'none' : classified.recommendation,
    probedAt: now.toISOString(),
    evidenceSource: EVIDENCE_SOURCE,
    thresholds: { maxIdentityDistanceKm: MAX_IDENTITY_DISTANCE_KM, nameHitThreshold: NAME_HIT_THRESHOLD },
  };
}

/** A record's contribution to the capability evidence table, or undefined when it earns none. Never produces a release. */
export function toEvidenceEntry(record: ProbeRecord): (CapabilityEvidence & { iata: string }) | undefined {
  if (record.control || record.recommendation === 'none') return undefined;
  const date = record.probedAt.slice(0, 10);
  if (record.recommendation === 'road_supported') {
    return {
      iata: record.iata,
      status: 'road_supported',
      verifiedDate: date,
      note: `Phase C live probe PASS: Google identity agrees (${record.identity.distanceKm} km from catalogue point); traffic-aware DRIVE to "${record.drive.destination}" ${Math.round((record.drive.durationSeconds ?? 0) / 60)} min. Capability only; NOT released.`,
      checks: { identityVerified: true, routeProbed: true },
    };
  }
  return {
    iata: record.iata,
    status: 'route_testable',
    verifiedDate: date,
    note: `Phase C live probe ${record.verdict}${record.failureClass ? ` (${record.failureClass})` : ''}: identity agrees but the road path is not proven. ${record.notes.join(' ')}`.trim(),
    checks: { identityVerified: true, routeProbed: false },
  };
}

/** JSON for storage. Throws if the string form contains the API key, so a secret can never be committed by accident. */
export function serializeProbeRecords(records: ProbeRecord[], apiKey?: string): string {
  const json = JSON.stringify(records, null, 2);
  if (apiKey && apiKey.length >= 8 && json.includes(apiKey)) throw new Error('Refusing to serialize: output contains the API key.');
  if (/[?&]key=|AIza[0-9A-Za-z_-]{20,}/.test(json)) throw new Error('Refusing to serialize: output looks like it contains an API key.');
  return json;
}
