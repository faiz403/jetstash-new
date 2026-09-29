/**
 * Which countries an airport's onward destination may be in.
 *
 * The original registry model -- a bare `['GB']` / `['PK']` array -- can't
 * say the difference between "same country as the airport", "this explicit
 * list" and "deliberately unrestricted", and can't express a border
 * airport (Geneva serves Switzerland AND France; EuroAirport Basel sits in
 * France). This module makes the decision explicit and named without
 * changing what destination-resolution.ts consumes: every policy resolves
 * to the same `expectedCountryCodes` array it already understands.
 *
 * No policy is ever inferred silently. A generic worldwide airport gets
 * SAME_COUNTRY as an explicit, documented conservative default (see
 * ARRIVE_BY_AIRPORT_CATALOGUE.md); cross-border behaviour is opt-in per
 * airport via CROSS_BORDER_DESTINATION_POLICIES below.
 */

export type DestinationPolicy =
  /** Destination must be in the airport's own country. The conservative generic default. */
  | { mode: 'SAME_COUNTRY' }
  /** Destination must be in one of these ISO 3166-1 alpha-2 countries (non-empty). */
  | { mode: 'ALLOWED_COUNTRIES'; countryCodes: string[] }
  /** No country gate. Only legitimate once cross-border behaviour has actually been validated, hence the required note. */
  | { mode: 'UNRESTRICTED_VALIDATED'; validatedNote: string };

export type DestinationPolicyMode = DestinationPolicy['mode'];

const COUNTRY_CODE = /^[A-Z]{2}$/;

export function assertValidDestinationPolicy(policy: DestinationPolicy): void {
  if (policy.mode === 'ALLOWED_COUNTRIES') {
    if (policy.countryCodes.length === 0) throw new Error('ALLOWED_COUNTRIES needs at least one country code; use UNRESTRICTED_VALIDATED to mean "no restriction".');
    for (const code of policy.countryCodes) {
      if (!COUNTRY_CODE.test(code)) throw new Error(`Destination policy country code "${code}" is not ISO 3166-1 alpha-2.`);
    }
  } else if (policy.mode === 'UNRESTRICTED_VALIDATED') {
    if (!policy.validatedNote.trim()) throw new Error('UNRESTRICTED_VALIDATED requires a note recording what validated it.');
  }
}

/**
 * Resolves a policy to the `expectedCountryCodes` array destination-
 * resolution.ts gates on. An empty array means "no country gate" there, so
 * only UNRESTRICTED_VALIDATED ever yields one.
 */
export function resolveExpectedCountryCodes(policy: DestinationPolicy, airportCountryCode: string): string[] {
  assertValidDestinationPolicy(policy);
  switch (policy.mode) {
    case 'SAME_COUNTRY':
      return [airportCountryCode];
    case 'ALLOWED_COUNTRIES':
      return [...policy.countryCodes];
    case 'UNRESTRICTED_VALIDATED':
      return [];
  }
}

/** Reads a legacy bare `expectedCountryCodes` array as the explicit policy it always was. */
export function policyFromExpectedCountryCodes(codes: string[], airportCountryCode: string): DestinationPolicy {
  if (codes.length === 0) return { mode: 'UNRESTRICTED_VALIDATED', validatedNote: 'Legacy empty expectedCountryCodes (no country gate).' };
  if (codes.length === 1 && codes[0] === airportCountryCode) return { mode: 'SAME_COUNTRY' };
  return { mode: 'ALLOWED_COUNTRIES', countryCodes: [...codes] };
}

/**
 * Airports whose catalogue country does not describe where a traveller
 * plausibly goes next. Deliberately short and conservative: these widen
 * SAME_COUNTRY only to the neighbouring countries the airport genuinely
 * serves, and remain UNVALIDATED against live routing until the Phase C
 * capability study -- a widened policy still cannot make an airport public,
 * because capability (airport-capability.ts) is a separate gate.
 */
export const CROSS_BORDER_DESTINATION_POLICIES: Readonly<Record<string, DestinationPolicy>> = {
  // Geneva: Swiss airport with its main catchment on the French side.
  GVA: { mode: 'ALLOWED_COUNTRIES', countryCodes: ['CH', 'FR'] },
  // EuroAirport Basel-Mulhouse-Freiburg: physically in France, serving Switzerland, France and Germany.
  BSL: { mode: 'ALLOWED_COUNTRIES', countryCodes: ['CH', 'FR', 'DE'] },
  // Luxembourg: a national airport whose commuter catchment crosses three borders.
  LUX: { mode: 'ALLOWED_COUNTRIES', countryCodes: ['LU', 'FR', 'DE', 'BE'] },
};

/** The conservative generic policy for a catalogue airport with no explicit override. */
export function getGenericDestinationPolicy(iata: string): DestinationPolicy {
  return CROSS_BORDER_DESTINATION_POLICIES[iata] ?? { mode: 'SAME_COUNTRY' };
}
