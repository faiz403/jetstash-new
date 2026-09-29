import { getCatalogueAirport, type CatalogueAirport } from './airport-catalogue';
import { getGenericDestinationPolicy, getRegionBias, resolveExpectedCountryCodes } from './destination-policy';
import { canEnablePublicly, getAirportProfile, type AirportProfile } from './airport-registry';
import type { AirportLookup, RoadAirportInfo } from './shell-dispatch';

/**
 * The capability gate: a catalogue airport is NOT usable just because it
 * exists. Public journey calculation proceeds only when this module says
 * so, and it fails closed -- an airport with no recorded evidence is
 * `catalogued` and cannot be calculated.
 *
 *   catalogued               In the catalogue, nothing verified. Never usable.
 *   route_testable           Identity validated and a probe DRIVE route worked.
 *                            Usable by internal/QA tooling only, never public.
 *   road_supported           Passed every generic road-first check; eligible
 *                            for the generic ROAD_PICKUP_FIRST engine publicly.
 *   special_profile          Has an explicit, publicly-enabled override in the
 *                            registry (MAN, ISB, LHE, KHI today).
 *   temporarily_unsupported  Explicitly blocked (Google can't route it, the
 *                            match was ambiguous, ...). Beats every other state,
 *                            including a special profile -- it is the kill switch.
 *
 * Phase A ships this architecture only. ROAD_CAPABILITY_EVIDENCE is empty on
 * purpose: nothing beyond the four special profiles is enabled until the
 * Phase B engine exists and Phase C has produced real evidence.
 */

export type AirportCapabilityStatus =
  | 'catalogued'
  | 'route_testable'
  | 'road_supported'
  | 'special_profile'
  | 'temporarily_unsupported';

export interface CapabilityEvidence {
  status: 'route_testable' | 'road_supported' | 'temporarily_unsupported';
  /** ISO date the evidence was gathered. */
  verifiedDate: string;
  /** What was checked / why it is blocked. Required so a status is never an unexplained flag. */
  note: string;
  /**
   * The checks behind a positive status. `route_testable` needs the Google
   * identity check (airport-identity.ts) to have passed; `road_supported`
   * needs that AND a successful probe DRIVE route. Enforced in
   * assertValidCapabilityEvidence so a status can't be recorded without them.
   */
  checks?: { identityVerified: boolean; routeProbed: boolean };
}

/** Keyed by IATA code. Add an entry only with real evidence; remove or downgrade it when that evidence stops holding. */
export const ROAD_CAPABILITY_EVIDENCE: Readonly<Record<string, CapabilityEvidence>> = {};

export interface AirportCapability {
  code: string;
  status: AirportCapabilityStatus;
  /** True only when a public journey may be calculated for this airport. */
  journeyEligible: boolean;
  /** Present for temporarily_unsupported and evidence-backed states. */
  note?: string;
}

const ELIGIBLE_STATUSES: ReadonlySet<AirportCapabilityStatus> = new Set(['road_supported', 'special_profile']);

export function isJourneyEligibleStatus(status: AirportCapabilityStatus): boolean {
  return ELIGIBLE_STATUSES.has(status);
}

export function assertValidCapabilityEvidence(code: string, evidence: CapabilityEvidence): void {
  if (!getCatalogueAirport(code) && !getAirportProfile(code)) throw new Error(`Capability evidence for ${code}: not a known airport.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.verifiedDate)) throw new Error(`Capability evidence for ${code}: verifiedDate must be YYYY-MM-DD.`);
  if (!evidence.note.trim()) throw new Error(`Capability evidence for ${code}: a note is required.`);
  if (evidence.status !== 'temporarily_unsupported' && !evidence.checks?.identityVerified) {
    throw new Error(`Capability evidence for ${code}: ${evidence.status} requires a passed airport identity check.`);
  }
  if (evidence.status === 'road_supported' && !evidence.checks?.routeProbed) {
    throw new Error(`Capability evidence for ${code}: road_supported requires a successful probe DRIVE route.`);
  }
}

for (const [code, evidence] of Object.entries(ROAD_CAPABILITY_EVIDENCE)) assertValidCapabilityEvidence(code, evidence);

/**
 * Resolves an airport's capability from the catalogue, the override
 * registry and the evidence table. Unknown codes return undefined (not
 * `catalogued`) so callers can tell "no such airport" from "known but not
 * yet supported".
 */
export function getAirportCapability(
  rawCode: string | null | undefined,
  evidenceTable: Readonly<Record<string, CapabilityEvidence>> = ROAD_CAPABILITY_EVIDENCE,
): AirportCapability | undefined {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return undefined;
  const catalogued = getCatalogueAirport(code);
  const override = getAirportProfile(code);
  if (!catalogued && !override) return undefined;

  const evidence = evidenceTable[code];
  if (evidence?.status === 'temporarily_unsupported') {
    return { code, status: 'temporarily_unsupported', journeyEligible: false, note: evidence.note };
  }
  if (override && override.publiclyEnabled && canEnablePublicly(override.validationStatus)) {
    return { code, status: 'special_profile', journeyEligible: true };
  }
  // Generic road-first eligibility needs catalogue identity -- evidence alone is never enough.
  if (catalogued && evidence?.status === 'road_supported') {
    return { code, status: 'road_supported', journeyEligible: true, note: evidence.note };
  }
  if (catalogued && evidence?.status === 'route_testable') {
    return { code, status: 'route_testable', journeyEligible: false, note: evidence.note };
  }
  return { code, status: 'catalogued', journeyEligible: false };
}

/**
 * Builds the generic worldwide ROAD_PICKUP_FIRST profile for a catalogue
 * airport: catalogue coordinates as the routing origin, an airport-level
 * (not terminal-level) estimate, and the conservative SAME_COUNTRY
 * destination policy unless a cross-border policy is recorded. Never
 * public by itself -- `configured` / `publiclyEnabled: false`; whether it
 * may be used is the capability gate's decision, not the profile's.
 */
export function buildGenericAirportProfile(airport: CatalogueAirport): AirportProfile {
  const policy = getGenericDestinationPolicy(airport.iata);
  return {
    code: airport.iata,
    displayName: airport.name,
    city: airport.city,
    countryCode: airport.countryCode,
    timeZone: airport.timeZone,
    routing: {
      defaultOrigin: { kind: 'coordinate', lat: airport.lat, lng: airport.lng },
      terminalRequired: false,
      originPrecision: 'airport',
    },
    journeyEngine: 'ROAD_PICKUP_FIRST',
    destinationRules: { expectedCountryCodes: resolveExpectedCountryCodes(policy, airport.countryCode), regionBias: getRegionBias(policy, airport.countryCode), policy },
    validationStatus: 'configured',
    publiclyEnabled: false,
  };
}

/**
 * The profile to use for an airport: an explicit registry override always
 * wins over the catalogue-derived generic profile. Returns undefined for a
 * code in neither. NOTE: this says nothing about whether the airport may be
 * used -- always check getAirportCapability(...).journeyEligible as well.
 */
export function resolveAirportProfile(rawCode: string | null | undefined): AirportProfile | undefined {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return undefined;
  const override = getAirportProfile(code);
  if (override) return override;
  const catalogued = getCatalogueAirport(code);
  return catalogued ? buildGenericAirportProfile(catalogued) : undefined;
}

export const AIRPORT_LEVEL_ESTIMATE_LABEL = 'Airport-level estimate';

/** The estimate-precision label a result must carry, or null when a validated terminal origin backs it. */
export function getEstimateLabel(profile: AirportProfile, terminal?: string): string | null {
  const terminalOrigin = terminal ? profile.routing.terminals?.[terminal] : undefined;
  if (terminalOrigin || profile.routing.originPrecision === 'terminal') return null;
  return AIRPORT_LEVEL_ESTIMATE_LABEL;
}

/**
 * The small, serialisable slice of catalogue + capability knowledge the
 * client shell needs for a requested code. Server-side only (imports the
 * catalogue); the result is passed to the client as a prop.
 */
export function getShellAirportLookup(rawCode: string | null | undefined): AirportLookup | undefined {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return undefined;
  const capability = getAirportCapability(code);
  if (!capability) return { code, known: false };
  const name = getCatalogueAirport(code)?.name ?? getAirportProfile(code)?.displayName;
  return { code, known: true, name, blocked: capability.status === 'temporarily_unsupported', road: getRoadAirportInfo(code) };
}

/** The trusted, serialisable facts the client's generic road UI needs -- only for a `road_supported` airport, only ever built server-side. */
export function getRoadAirportInfo(rawCode: string | null | undefined): RoadAirportInfo | undefined {
  const code = rawCode?.trim().toUpperCase();
  const capability = getAirportCapability(code);
  if (!code || capability?.status !== 'road_supported') return undefined;
  const profile = resolveAirportProfile(code);
  if (!profile || profile.journeyEngine !== 'ROAD_PICKUP_FIRST') return undefined;
  return { code: profile.code, displayName: profile.displayName, city: profile.city, countryCode: profile.countryCode, timeZone: profile.timeZone, estimateLabel: getEstimateLabel(profile) };
}
