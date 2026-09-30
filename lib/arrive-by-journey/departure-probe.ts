import { getCatalogueAirport, type CatalogueAirport } from '../arrive-by-shared/airport-catalogue';
import { resolveAirportProfile } from '../arrive-by-shared/airport-capability';
import { getAirportProfile, resolveRoutingOrigin } from '../arrive-by-shared/airport-registry';
import {
  diagnoseAirportIdentity, evaluateAirportIdentity, fetchIdentityResults, MAX_IDENTITY_DISTANCE_KM, NAME_HIT_THRESHOLD,
  type AirportIdentityFailure, type IdentityCandidateDiagnostic,
} from '../arrive-by-shared/airport-identity';
import { GoogleCallLedger } from './call-budget';
import type { DepartureEvidence } from './departure-capability';
import { googleOriginLeg } from './origin-leg';
import { formatLocalDateTime } from './local-time';
import type { JourneyInput } from './types';

/**
 * Operator-only DEPARTURE capability probe (F2). Not a route; run from
 * scripts/arrive-by-departure-probe.ts with a server-side key already in the
 * environment. For one UK airport it establishes, separately from any arrival
 * evidence, that a traveller's start can be routed INTO it:
 *
 *   identity   Google agrees the airport is where its route target is
 *   route      the production origin search (googleOriginLeg: start geocode +
 *              bounded backward search, through a real call ledger) finds a
 *              verified latest departure for realistic flights at different
 *              times of day
 *
 * and it MEASURES the calls that costs, so the 10-call whole-journey ceiling
 * can be judged from data. It only ever produces DEPARTURE evidence; it never
 * touches the arrival capability table or the release table.
 */

export interface DepartureScenario {
  label: string;
  /** Flight departure clock time (UK local) on the probe date. */
  departureClock: string;
  bufferMinutes: number;
}

export const DEFAULT_SCENARIOS: DepartureScenario[] = [
  { label: 'early 06:00', departureClock: '06:00', bufferMinutes: 120 },
  { label: 'mid-morning 09:30', departureClock: '09:30', bufferMinutes: 120 },
  { label: 'evening rush 18:00', departureClock: '18:00', bufferMinutes: 120 },
];

export interface DepartureProbeSpec {
  iata: string;
  /** Primary start location; fallbacks are tried only if the primary does not resolve to a confident place. */
  start: string;
  fallbackStarts?: string[];
  purpose?: string;
  scenarios?: DepartureScenario[];
  /** False for study-only probes (long drive, very close start) that must not write evidence. */
  writesEvidence?: boolean;
}

export interface ScenarioResult {
  label: string;
  departureLocal: string;
  status: 'OK' | 'ALREADY_TOO_LATE' | 'FAILED' | 'START_NOT_CONFIRMED';
  /** Google calls spent by this scenario (start geocode + route queries). */
  calls: number;
  routeQueries: number;
  converged?: boolean;
  slackMinutes?: number;
  driveMinutes?: number;
  leaveLocal?: string;
  failure?: string;
  trace: Array<{ departureLocal: string; driveMinutes: number; slackMinutes: number }>;
}

export interface DepartureProbeRecord {
  iata: string;
  airportName: string;
  hasExplicitProfile: boolean;
  routeTarget: { kind: 'address' | 'coordinate'; lat?: number; lng?: number };
  start: string;
  identity: { ok: boolean; failure?: AirportIdentityFailure; basis?: string; distanceKm?: number; candidates: IdentityCandidateDiagnostic[] };
  scenarios: ScenarioResult[];
  verdict: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
  notes: string[];
  probedAt: string;
  purpose?: string;
  writesEvidence: boolean;
}

/** Tomorrow-plus-a-week's date in UK local time, so probes ask Google about a normal future weekday and never the past. */
function probeDate(now: Date): string {
  return formatLocalDateTime(now.getTime() + 8 * 24 * 3600 * 1000, 'Europe/London').slice(0, 10);
}

/**
 * Identity for a DEPARTURE airport. The Phase C rule (Google types it `airport`, right country, within 5 km, name or
 * IATA in the address) applies. One narrow, explicit addition: an airport with an EXPLICIT PROFILE (MAN) whose profile
 * coordinate the founder validated may be accepted when Google places a strong name match within range but types it as
 * a transit station (Google does this for Manchester Airport). The basis is recorded, never hidden.
 */
function judgeIdentity(airport: CatalogueAirport, fetched: Awaited<ReturnType<typeof fetchIdentityResults>>): DepartureProbeRecord['identity'] {
  const candidates = diagnoseAirportIdentity(airport, fetched.results).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  const evaluation = fetched.status === 'OK' ? evaluateAirportIdentity(airport, fetched.results) : ({ ok: false, reason: fetched.status === 'ZERO_RESULTS' ? 'NO_RESULT' : 'REQUEST_FAILED' } as const);
  if (evaluation.ok) return { ok: true, basis: 'Google airport-typed result agrees', distanceKm: evaluation.distanceKm, candidates };
  const profile = getAirportProfile(airport.iata);
  const nearMiss = candidates.find((c) => c.country === airport.countryCode && c.nameHitRatio >= NAME_HIT_THRESHOLD && c.distanceKm <= MAX_IDENTITY_DISTANCE_KM && c.failure === 'NOT_AN_AIRPORT');
  if (profile && profile.routing.defaultOrigin.kind === 'coordinate' && nearMiss) {
    return { ok: true, basis: 'Explicit profile coordinate; Google name match within range (Google types it as a transit station, not an airport)', distanceKm: nearMiss.distanceKm, candidates };
  }
  return { ok: false, failure: evaluation.reason, candidates };
}

export async function probeDepartureAirport(apiKey: string, spec: DepartureProbeSpec, now: Date = new Date()): Promise<DepartureProbeRecord> {
  const airport = getCatalogueAirport(spec.iata);
  if (!airport) throw new Error(`${spec.iata} is not in the catalogue.`);
  const profile = resolveAirportProfile(airport.iata);
  if (!profile) throw new Error(`${spec.iata} has no profile.`);
  const routeTarget = resolveRoutingOrigin(profile);
  const writesEvidence = spec.writesEvidence !== false;
  const notes: string[] = [];

  const identity = airport.countryCode === 'GB'
    ? judgeIdentity(airport, await fetchIdentityResults(apiKey, airport))
    : { ok: false, failure: 'WRONG_COUNTRY' as const, candidates: [] };
  if (airport.countryCode !== 'GB') notes.push('V1 departures are UK airports only.');

  const date = probeDate(now);
  const scenarios: ScenarioResult[] = [];
  let usedStart = spec.start;
  for (const scenario of spec.scenarios ?? DEFAULT_SCENARIOS) {
    const departureLocal = `${date}T${scenario.departureClock}`;
    let result: ScenarioResult | undefined;
    for (const candidateStart of [spec.start, ...(spec.fallbackStarts ?? [])]) {
      const ledger = new GoogleCallLedger(10);
      const input: JourneyInput = {
        start: candidateStart, departureAirport: airport.iata, arrivalAirport: airport.iata, destination: 'n/a',
        flight: { departsLocal: departureLocal, arrivesLocal: departureLocal },
        preferences: { departureAirportBufferMinutes: scenario.bufferMinutes, arrivalExitMinutes: 0 },
      };
      const outcome = await googleOriginLeg(
        apiKey,
        { departure: { code: airport.iata, name: airport.name, timeZone: airport.timeZone, routeTarget } },
        input, ledger, now.toISOString(),
      );
      const search = outcome.search;
      const trace = (search?.trace ?? []).map((t) => ({ departureLocal: formatLocalDateTime(t.departureMs, airport.timeZone), driveMinutes: Math.round(t.durationSeconds / 60), slackMinutes: t.slackMinutes }));
      const startOk = outcome.start?.confidence === 'CONFIRMED';
      result = {
        label: scenario.label, departureLocal,
        status: !startOk ? 'START_NOT_CONFIRMED' : search?.status === 'OK' ? 'OK' : search?.status === 'ALREADY_TOO_LATE' ? 'ALREADY_TOO_LATE' : 'FAILED',
        calls: ledger.used,
        routeQueries: search?.queries ?? 0,
        converged: search?.status === 'OK' ? search.converged : undefined,
        slackMinutes: search?.status === 'OK' ? search.slackMinutes : undefined,
        driveMinutes: search?.status === 'OK' ? Math.round(search.durationSeconds / 60) : undefined,
        leaveLocal: search?.status === 'OK' ? formatLocalDateTime(search.departureMs, airport.timeZone) : undefined,
        failure: outcome.leg.status === 'NOT_EVIDENCED' ? outcome.leg.reason : undefined,
        trace,
      };
      if (startOk) { usedStart = candidateStart; break; } // only a start that failed to resolve is retried with a fallback
    }
    scenarios.push(result as ScenarioResult);
  }

  const allOk = scenarios.length > 0 && scenarios.every((s) => s.status === 'OK');
  const verdict: DepartureProbeRecord['verdict'] =
    identity.ok && allOk ? 'PASS' : !identity.ok && identity.candidates.length > 0 && scenarios.every((s) => s.status === 'OK') ? 'NEEDS_REVIEW' : 'FAIL';
  if (!identity.ok) notes.push(`Identity: ${identity.failure}.`);
  for (const s of scenarios) if (s.status !== 'OK') notes.push(`${s.label}: ${s.status}${s.failure ? ` (${s.failure})` : ''}.`);

  return {
    iata: airport.iata, airportName: airport.name, hasExplicitProfile: Boolean(getAirportProfile(airport.iata)),
    routeTarget: routeTarget.kind === 'coordinate' ? { kind: 'coordinate', lat: routeTarget.lat, lng: routeTarget.lng } : { kind: 'address' },
    start: usedStart, identity, scenarios, verdict, notes, probedAt: now.toISOString(), purpose: spec.purpose, writesEvidence,
  };
}

/** A PASS earns departure evidence; anything else earns none. */
export function toDepartureEvidence(record: DepartureProbeRecord): DepartureEvidence | undefined {
  if (record.verdict !== 'PASS' || !record.writesEvidence) return undefined;
  const worst = Math.max(...record.scenarios.map((s) => s.routeQueries));
  return {
    iata: record.iata,
    status: 'departure_supported',
    verifiedDate: record.probedAt.slice(0, 10),
    note: `F2 live probe PASS: identity (${record.identity.basis}, ${record.identity.distanceKm} km); the production origin search from "${record.start}" found a verified latest departure in ${record.scenarios.length}/${record.scenarios.length} time-of-day scenarios (max ${worst} route queries). Directional (start to airport) evidence only; NOT release and NOT arrival evidence.`,
    checks: { identityVerified: true, routeProbed: true },
  };
}
