/**
 * Global Arrive By airport registry — the one place a supported airport's
 * routing origin, journey engine and destination policy are configured,
 * replacing an implicit "Manchester vs Pakistan" product split with
 * per-airport configuration. See docs/product/ARRIVE_BY_MVP.md for the
 * Manchester engine and lib/arrive-by-pakistan/ for the Pakistan engine —
 * this registry does not replace either engine, it describes which
 * airports may use which one and under what conditions.
 *
 * Deliberately minimal: this is a data + validation module, not a router.
 * Nothing here builds a public UI, a public API route, or an /arrive-by
 * shell — that is later work, gated by `publiclyEnabled` staying false
 * until an airport's validation genuinely earns it.
 */

import { resolveExpectedCountryCodes, assertValidDestinationPolicy, type DestinationPolicy } from './destination-policy';

export type JourneyEngine = 'TRANSIT_FIRST' | 'ROAD_PICKUP_FIRST';
// HYBRID is deliberately NOT part of this type. No engine implementation
// exists for it yet — adding it to AirportProfile.journeyEngine before a
// real airport's evidence requires it would let a profile be configured
// against an engine nothing can actually run. Add it here, with its own
// implementation and tests, only when that evidence exists.

export type AirportValidationStatus = 'configured' | 'internally_testable' | 'founder_validated' | 'public_beta' | 'public';

export type Origin =
  | { kind: 'address'; value: string }
  | { kind: 'coordinate'; lat: number; lng: number };

export interface AirportRouting {
  /** Used when no terminal is given, or when terminalRequired is false. */
  defaultOrigin: Origin;
  /** Per-terminal overrides, keyed by whatever label that airport actually uses (e.g. 'T2', 'T5') — not a fixed enum, since airports don't share one terminal-naming scheme. */
  terminals?: Record<string, Origin>;
  /**
   * True only when the onward journey genuinely differs enough by terminal
   * that `defaultOrigin` alone would be unsafe to route from (e.g. Heathrow
   * T5 vs T4). False means a single origin is an honest representation of
   * this airport today — not a claim that the airport has only one
   * terminal.
   */
  terminalRequired: boolean;
  /**
   * How precise the routing origin is. 'airport' (the default when omitted)
   * means a generic airport-level point -- the UI must label the result
   * "Airport-level estimate". 'terminal' only where a specific terminal's
   * origin has genuinely been validated (today: Manchester Terminal 2).
   */
  originPrecision?: 'airport' | 'terminal';
}

/**
 * A destination-country policy that has been explicitly decided is either
 * an array of ISO 3166-1 alpha-2 codes (possibly empty, meaning "no
 * restriction" — but that must itself be a validated decision, not a
 * default) or nothing has been decided yet. The sentinel makes "not decided"
 * a distinct, visible state rather than indistinguishable from "decided:
 * unrestricted" via a merely-absent field.
 */
export const POLICY_PENDING = 'POLICY_PENDING' as const;

export interface AirportDestinationRules {
  expectedCountryCodes: string[] | typeof POLICY_PENDING;
  /** Google Geocoding API's own `region` bias parameter, e.g. 'pk', 'in'. Optional even once a country policy is decided. */
  regionBias?: string;
  /**
   * The named policy behind `expectedCountryCodes` (see destination-policy.ts).
   * Optional so existing hand-written profiles keep working unchanged; when
   * present it MUST resolve to exactly `expectedCountryCodes` -- checked in
   * assertValidAirportProfile so the two can never drift apart.
   */
  policy?: DestinationPolicy;
}

export interface AirportProfile {
  code: string;
  displayName: string;
  city: string;
  countryCode: string;
  timeZone: string;
  routing: AirportRouting;
  journeyEngine: JourneyEngine;
  destinationRules: AirportDestinationRules;
  validationStatus: AirportValidationStatus;
  publiclyEnabled: boolean;
}

/** True only for the validation states allowed to reach the public. Enforced at registration time below, not left to callers to remember. */
export function canEnablePublicly(status: AirportValidationStatus): boolean {
  return status === 'public_beta' || status === 'public';
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value) && value !== 0;
}

/**
 * Rejects the classic "looks configured but isn't real" failure modes: a
 * (0,0) null-island placeholder, an empty address string, or a terminal map
 * entry present in name but not actually populated. An absent-but-declared
 * required field (e.g. `terminals` missing while `terminalRequired` is
 * true) is caught separately in `assertValidAirportProfile`.
 */
function isValidOrigin(origin: Origin | undefined): boolean {
  if (!origin) return false;
  if (origin.kind === 'address') return origin.value.trim().length > 0;
  return isFiniteCoordinate(origin.lat) && isFiniteCoordinate(origin.lng) && Math.abs(origin.lat) <= 90 && Math.abs(origin.lng) <= 180;
}

/**
 * Throws on anything that would make this profile unsafe to treat as
 * routable — called once, at module load, for every entry in
 * ARRIVE_BY_AIRPORTS, so a bad entry fails at build/test time rather than
 * silently reaching a real journey computation. Exported so tests can prove
 * the guard itself rejects a fabricated bad profile, not just that the
 * shipped registry happens to be clean.
 */
export function assertValidAirportProfile(profile: AirportProfile): void {
  const prefix = `Airport profile ${profile.code}`;
  if (!isValidOrigin(profile.routing.defaultOrigin)) {
    throw new Error(`${prefix}: defaultOrigin is missing or not a real routing origin.`);
  }
  if (profile.routing.terminalRequired) {
    const terminals = profile.routing.terminals;
    if (!terminals || Object.keys(terminals).length === 0) {
      throw new Error(`${prefix}: terminalRequired is true but no terminal origins are configured.`);
    }
    for (const [label, origin] of Object.entries(terminals)) {
      if (!isValidOrigin(origin)) throw new Error(`${prefix}: terminal ${label} is missing a real routing origin.`);
    }
  } else if (profile.routing.terminals) {
    for (const [label, origin] of Object.entries(profile.routing.terminals)) {
      if (!isValidOrigin(origin)) throw new Error(`${prefix}: terminal ${label} is missing a real routing origin.`);
    }
  }
  if (canEnablePublicly(profile.validationStatus) && profile.destinationRules.expectedCountryCodes === POLICY_PENDING) {
    throw new Error(`${prefix}: cannot reach ${profile.validationStatus} with a pending destination-country policy.`);
  }
  if (profile.destinationRules.policy) {
    assertValidDestinationPolicy(profile.destinationRules.policy);
    const resolved = resolveExpectedCountryCodes(profile.destinationRules.policy, profile.countryCode);
    if (JSON.stringify(resolved) !== JSON.stringify(profile.destinationRules.expectedCountryCodes)) {
      throw new Error(`${prefix}: destinationRules.policy does not resolve to expectedCountryCodes.`);
    }
  }
  if (profile.publiclyEnabled && !canEnablePublicly(profile.validationStatus)) {
    throw new Error(`${prefix}: publiclyEnabled is true but validationStatus (${profile.validationStatus}) does not allow public enablement.`);
  }
}

/**
 * Real, currently-implemented airports only. Adding an entry here is a
 * validated decision, not a placeholder — an airport whose real routing
 * origin (and, for TRANSIT_FIRST engines, whose destination-country policy
 * once it is going public) hasn't been sourced belongs in product/planning
 * docs, not this array. See JETSTASH_PRINCIPLES.md and
 * docs/product/ARRIVE_BY_MVP.md for the wider roadmap (UK expansion, India,
 * Bangladesh, Qatar/UAE) — none of those are runtime entries yet.
 */
/**
 * These entries are the explicit OVERRIDE layer. The worldwide airport
 * catalogue (airport-catalogue.ts) supplies every airport's identity; a
 * profile here is only for an airport that needs behaviour the generic
 * road-first baseline can't give it (a validated terminal origin, the
 * transit-first engine, a decided destination policy). An override always
 * wins over the catalogue-derived generic profile -- see
 * airport-capability.ts's resolveAirportProfile.
 */
const AIRPORT_PROFILES: readonly AirportProfile[] = [
  {
    code: 'ISB',
    displayName: 'Islamabad International Airport',
    city: 'Islamabad',
    countryCode: 'PK',
    timeZone: 'Asia/Karachi',
    routing: { defaultOrigin: { kind: 'address', value: 'Islamabad International Airport, Pakistan' }, terminalRequired: false },
    journeyEngine: 'ROAD_PICKUP_FIRST',
    destinationRules: { expectedCountryCodes: ['PK'], regionBias: 'pk' },
    validationStatus: 'public_beta',
    publiclyEnabled: true,
  },
  {
    code: 'LHE',
    displayName: 'Allama Iqbal International Airport, Lahore',
    city: 'Lahore',
    countryCode: 'PK',
    timeZone: 'Asia/Karachi',
    routing: { defaultOrigin: { kind: 'address', value: 'Allama Iqbal International Airport, Lahore, Pakistan' }, terminalRequired: false },
    journeyEngine: 'ROAD_PICKUP_FIRST',
    destinationRules: { expectedCountryCodes: ['PK'], regionBias: 'pk' },
    validationStatus: 'public_beta',
    publiclyEnabled: true,
  },
  {
    code: 'KHI',
    displayName: 'Jinnah International Airport, Karachi',
    city: 'Karachi',
    countryCode: 'PK',
    timeZone: 'Asia/Karachi',
    routing: { defaultOrigin: { kind: 'address', value: 'Jinnah International Airport, Karachi, Pakistan' }, terminalRequired: false },
    journeyEngine: 'ROAD_PICKUP_FIRST',
    destinationRules: { expectedCountryCodes: ['PK'], regionBias: 'pk' },
    validationStatus: 'public_beta',
    publiclyEnabled: true,
  },
  {
    code: 'MAN',
    displayName: 'Manchester Airport',
    city: 'Manchester',
    countryCode: 'GB',
    timeZone: 'Europe/London',
    // Terminal 2 coordinate: the only one the founder prototype has ever
    // used or validated. terminalRequired stays false FOR NOW because that
    // single-terminal prototype is all that's implemented — this is not a
    // claim that Manchester's other terminals produce an identical onward
    // journey, only an honest description of today's actual scope.
    routing: { defaultOrigin: { kind: 'coordinate', lat: 53.367664, lng: -2.280683 }, terminalRequired: false, originPrecision: 'terminal' },
    journeyEngine: 'TRANSIT_FIRST',
    // RESOLVED (Phase 3.1, 29 Sep 2026) — an explicit founder product
    // decision, not an inference: the initial MAN Arrive By public beta
    // supports UK onward destinations only. Two earlier passes of this
    // file both considered and rejected inferring this from indirect
    // evidence (the founder UI's "UK local time" copy, the single
    // validated Sheffield scenario) as insufficient — this entry only
    // changed once the founder stated the scope directly: this beta IS
    // the UK Arrive By rollout, the transit/car engine is built and
    // tested around UK onward journeys, and cross-border destination
    // behaviour is explicitly unvalidated and out of scope until a
    // separate decision widens it. A real decision, however narrow,
    // satisfies the registry's invariant differently than an inference
    // would have — it's recorded here specifically so a future reader
    // can tell the two apart.
    destinationRules: { expectedCountryCodes: ['GB'] },
    validationStatus: 'public_beta',
    publiclyEnabled: true,
  },
];

for (const profile of AIRPORT_PROFILES) assertValidAirportProfile(profile);

const REGISTRY_BY_CODE: ReadonlyMap<string, AirportProfile> = new Map(AIRPORT_PROFILES.map((profile) => [profile.code, profile]));

export function getAirportProfile(code: string): AirportProfile | undefined {
  return REGISTRY_BY_CODE.get(code);
}

export function getPublicAirportProfiles(): AirportProfile[] {
  return AIRPORT_PROFILES.filter((profile) => profile.publiclyEnabled && canEnablePublicly(profile.validationStatus));
}

/**
 * Resolves the routing origin to use for this airport, optionally for a
 * specific terminal. Fails closed (throws) rather than silently falling
 * back to `defaultOrigin` when `terminalRequired` is true and no matching
 * terminal was given or configured — a wrong guess here would silently
 * compute the wrong onward journey.
 */
export function resolveRoutingOrigin(profile: AirportProfile, terminal?: string): Origin {
  if (profile.routing.terminalRequired) {
    const origin = terminal ? profile.routing.terminals?.[terminal] : undefined;
    if (!origin) throw new Error(`${profile.code} requires a supported terminal to compute a routing origin.`);
    return origin;
  }
  if (terminal && profile.routing.terminals?.[terminal]) return profile.routing.terminals[terminal];
  return profile.routing.defaultOrigin;
}
