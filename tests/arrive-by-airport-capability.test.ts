import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AIRPORT_LEVEL_ESTIMATE_LABEL,
  ROAD_CAPABILITY_EVIDENCE,
  assertValidCapabilityEvidence,
  buildGenericAirportProfile,
  getAirportCapability,
  getEstimateLabel,
  getShellAirportLookup,
  isJourneyEligibleStatus,
  resolveAirportProfile,
  type CapabilityEvidence,
} from '@/lib/arrive-by-shared/airport-capability';
import { ARRIVE_BY_RELEASED_AIRPORTS } from '@/lib/arrive-by-shared/airport-release';
import { getCatalogueAirport, getCatalogueAirports } from '@/lib/arrive-by-shared/airport-catalogue';
import {
  assertValidDestinationPolicy,
  getGenericDestinationPolicy,
  policyFromExpectedCountryCodes,
  resolveExpectedCountryCodes,
} from '@/lib/arrive-by-shared/destination-policy';
import { assertValidAirportProfile, getAirportProfile, getPublicAirportProfiles, type AirportProfile } from '@/lib/arrive-by-shared/airport-registry';
import { resolveShellDispatch } from '@/lib/arrive-by-shared/shell-dispatch';

const evidence = (status: CapabilityEvidence['status']): CapabilityEvidence => ({ status, verifiedDate: '2026-09-30', note: 'test evidence', checks: { identityVerified: true, routeProbed: true } });
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('capability gate — Phase A ships no worldwide enablement', () => {
  it('nothing beyond the four special profiles is publicly journey-eligible, whatever evidence is stored (release gate)', () => {
    expect(Object.keys(ARRIVE_BY_RELEASED_AIRPORTS)).toEqual([]);
    const eligible = getCatalogueAirports().filter((a) => getAirportCapability(a.iata)?.journeyEligible).map((a) => a.iata).sort();
    expect(eligible).toEqual(['ISB', 'KHI', 'LHE', 'MAN']);
  });

  it('every catalogue airport without an override is catalogued and not eligible', () => {
    for (const code of ['LHR', 'DEL', 'BOM', 'AMD', 'DAC', 'DXB', 'DOH', 'JFK', 'SYD', 'GVA', 'BSL']) {
      // Explicit empty tables: stored live evidence for these airports must not change what "no evidence" means.
      expect(getAirportCapability(code, {}, {})).toEqual({ code, status: 'catalogued', journeyEligible: false, capabilityApproved: false, releaseStatus: 'internal_only' });
    }
  });

  it('the four special profiles resolve to special_profile and stay eligible', () => {
    for (const code of ['MAN', 'ISB', 'LHE', 'KHI']) {
      expect(getAirportCapability(code)).toEqual({ code, status: 'special_profile', journeyEligible: true, capabilityApproved: true, releaseStatus: 'public' });
    }
  });

  it('the public airport list is still exactly the four validated airports', () => {
    expect(getPublicAirportProfiles().map((p) => p.code).sort()).toEqual(['ISB', 'KHI', 'LHE', 'MAN']);
  });

  it('an unknown code is undefined, distinct from a known-but-unsupported one', () => {
    expect(getAirportCapability('ZZZ')).toBeUndefined();
    expect(getAirportCapability('')).toBeUndefined();
    expect(getAirportCapability(null)).toBeUndefined();
    expect(getAirportCapability(' lhr ', {}, {})?.status).toBe('catalogued');
  });
});

describe('capability status transitions (pure resolution over an injected evidence table)', () => {
  it('road_supported evidence PLUS a release makes a catalogue airport eligible; route_testable never does', () => {
    const released = { LHR: { status: 'public_beta' as const, decidedDate: '2026-09-30', approvedNote: 'test' } };
    expect(getAirportCapability('LHR', { LHR: evidence('road_supported') }, released)).toMatchObject({ status: 'road_supported', journeyEligible: true, capabilityApproved: true, releaseStatus: 'public_beta' });
    expect(getAirportCapability('LHR', { LHR: evidence('route_testable') }, released)).toMatchObject({ status: 'route_testable', journeyEligible: false, capabilityApproved: false });
  });

  it('temporarily_unsupported beats everything, including a special profile', () => {
    expect(getAirportCapability('ISB', { ISB: evidence('temporarily_unsupported') })).toMatchObject({ status: 'temporarily_unsupported', journeyEligible: false, note: 'test evidence' });
    expect(getAirportCapability('LHR', { LHR: evidence('temporarily_unsupported') }, { LHR: { status: 'public', decidedDate: '2026-09-30', approvedNote: 'test' } })?.journeyEligible).toBe(false);
  });

  it('evidence for a code outside the catalogue never creates an airport', () => {
    expect(getAirportCapability('ZZZ', { ZZZ: evidence('road_supported') })).toBeUndefined();
  });

  it('a special profile is not downgraded by unrelated evidence', () => {
    expect(getAirportCapability('MAN', { LHR: evidence('road_supported') })?.status).toBe('special_profile');
  });

  it('only road_supported and special_profile are journey-eligible statuses', () => {
    expect(isJourneyEligibleStatus('road_supported')).toBe(true);
    expect(isJourneyEligibleStatus('special_profile')).toBe(true);
    for (const status of ['catalogued', 'route_testable', 'temporarily_unsupported'] as const) expect(isJourneyEligibleStatus(status)).toBe(false);
  });

  it('evidence entries are validated: known airport, real date, explained', () => {
    expect(() => assertValidCapabilityEvidence('LHR', evidence('road_supported'))).not.toThrow();
    expect(() => assertValidCapabilityEvidence('ZZZ', evidence('road_supported'))).toThrow(/not a known airport/);
    expect(() => assertValidCapabilityEvidence('LHR', { ...evidence('road_supported'), verifiedDate: 'yesterday' })).toThrow(/YYYY-MM-DD/);
    expect(() => assertValidCapabilityEvidence('LHR', { ...evidence('road_supported'), note: ' ' })).toThrow(/note is required/);
  });
});

describe('override layer: special profiles win over the generic catalogue profile', () => {
  it('MAN stays the explicit transit-first Terminal 2 profile', () => {
    const profile = resolveAirportProfile('man')!;
    expect(profile).toBe(getAirportProfile('MAN'));
    expect(profile.journeyEngine).toBe('TRANSIT_FIRST');
    expect(profile.routing.defaultOrigin).toEqual({ kind: 'coordinate', lat: 53.367664, lng: -2.280683 });
    expect(profile.destinationRules.expectedCountryCodes).toEqual(['GB']);
    expect(getEstimateLabel(profile)).toBeNull();
  });

  it('ISB / LHE / KHI stay the explicit Pakistan road-first profiles, unchanged', () => {
    for (const code of ['ISB', 'LHE', 'KHI']) {
      const profile = resolveAirportProfile(code)!;
      expect(profile).toBe(getAirportProfile(code));
      expect(profile.journeyEngine).toBe('ROAD_PICKUP_FIRST');
      expect(profile.destinationRules).toEqual({ expectedCountryCodes: ['PK'], regionBias: 'pk' });
      expect(profile.routing.defaultOrigin.kind).toBe('address');
    }
  });

  it('a catalogue airport with no override gets the generic road-first profile from catalogue coordinates', () => {
    const lhr = getCatalogueAirport('LHR')!;
    const profile = resolveAirportProfile('LHR')!;
    expect(profile.journeyEngine).toBe('ROAD_PICKUP_FIRST');
    expect(profile.routing.defaultOrigin).toEqual({ kind: 'coordinate', lat: lhr.lat, lng: lhr.lng });
    expect(profile.routing.terminalRequired).toBe(false);
    expect(profile.timeZone).toBe('Europe/London');
    expect(profile.countryCode).toBe('GB');
  });

  it('a generic profile is never public by itself and passes the registry validator', () => {
    for (const code of ['LHR', 'DEL', 'DXB', 'JFK', 'SYD', 'GVA']) {
      const profile = buildGenericAirportProfile(getCatalogueAirport(code)!);
      expect(profile.publiclyEnabled).toBe(false);
      expect(profile.validationStatus).toBe('configured');
      expect(() => assertValidAirportProfile(profile)).not.toThrow();
    }
  });

  it('resolveAirportProfile is undefined for a code in neither layer', () => {
    expect(resolveAirportProfile('ZZZ')).toBeUndefined();
    expect(resolveAirportProfile(null)).toBeUndefined();
  });

  it('generic airports are labelled airport-level; MAN (validated terminal) is not', () => {
    expect(getEstimateLabel(resolveAirportProfile('LHR')!)).toBe(AIRPORT_LEVEL_ESTIMATE_LABEL);
    expect(AIRPORT_LEVEL_ESTIMATE_LABEL).toBe('Airport-level estimate');
    expect(getEstimateLabel(resolveAirportProfile('ISB')!)).toBe(AIRPORT_LEVEL_ESTIMATE_LABEL);
    expect(getEstimateLabel(resolveAirportProfile('MAN')!)).toBeNull();
  });

  it('a generic profile carries no terminal map, so it can never fake terminal precision', () => {
    expect(resolveAirportProfile('DXB')!.routing.terminals).toBeUndefined();
  });
});

describe('destination policy modes', () => {
  it('SAME_COUNTRY resolves to the airport country; the generic default is explicit', () => {
    expect(resolveExpectedCountryCodes({ mode: 'SAME_COUNTRY' }, 'GB')).toEqual(['GB']);
    expect(getGenericDestinationPolicy('LHR')).toEqual({ mode: 'SAME_COUNTRY' });
    expect(resolveAirportProfile('DEL')!.destinationRules.expectedCountryCodes).toEqual(['IN']);
    expect(resolveAirportProfile('DEL')!.destinationRules.policy).toEqual({ mode: 'SAME_COUNTRY' });
  });

  it('ALLOWED_COUNTRIES resolves to its list; UNRESTRICTED_VALIDATED resolves to no gate', () => {
    expect(resolveExpectedCountryCodes({ mode: 'ALLOWED_COUNTRIES', countryCodes: ['CH', 'FR'] }, 'CH')).toEqual(['CH', 'FR']);
    expect(resolveExpectedCountryCodes({ mode: 'UNRESTRICTED_VALIDATED', validatedNote: 'validated in QA' }, 'CH')).toEqual([]);
  });

  it('invalid policies are rejected: empty list, non-ISO code, unrestricted with no evidence note', () => {
    expect(() => assertValidDestinationPolicy({ mode: 'ALLOWED_COUNTRIES', countryCodes: [] })).toThrow(/at least one/);
    expect(() => assertValidDestinationPolicy({ mode: 'ALLOWED_COUNTRIES', countryCodes: ['gb'] })).toThrow(/alpha-2/);
    expect(() => assertValidDestinationPolicy({ mode: 'UNRESTRICTED_VALIDATED', validatedNote: '' })).toThrow(/note/);
  });

  it('border airports get an explicit cross-border policy rather than a silently wrong SAME_COUNTRY', () => {
    // Catalogue country for BSL is FR (the airport is physically in France); the override adds Switzerland and Germany.
    expect(getCatalogueAirport('BSL')!.countryCode).toBe('FR');
    expect(resolveAirportProfile('BSL')!.destinationRules.expectedCountryCodes).toEqual(['CH', 'FR', 'DE']);
    expect(resolveAirportProfile('GVA')!.destinationRules.expectedCountryCodes).toEqual(['CH', 'FR']);
    expect(resolveAirportProfile('LUX')!.destinationRules.expectedCountryCodes).toEqual(['LU', 'FR', 'DE', 'BE']);
  });

  it('cross-border policy widens destinations only; it cannot make an airport public', () => {
    for (const code of ['GVA', 'BSL', 'LUX']) {
      expect(getAirportCapability(code)?.journeyEligible).toBe(false);
      expect(resolveAirportProfile(code)!.publiclyEnabled).toBe(false);
    }
  });

  it('legacy bare arrays are read as the explicit policy they always were', () => {
    expect(policyFromExpectedCountryCodes(['GB'], 'GB')).toEqual({ mode: 'SAME_COUNTRY' });
    expect(policyFromExpectedCountryCodes(['CH', 'FR'], 'CH')).toEqual({ mode: 'ALLOWED_COUNTRIES', countryCodes: ['CH', 'FR'] });
    expect(policyFromExpectedCountryCodes([], 'CH').mode).toBe('UNRESTRICTED_VALIDATED');
  });

  it('the registry rejects a profile whose named policy disagrees with its expectedCountryCodes', () => {
    const base = getAirportProfile('MAN')!;
    const drifted: AirportProfile = { ...base, destinationRules: { expectedCountryCodes: ['GB'], policy: { mode: 'ALLOWED_COUNTRIES', countryCodes: ['GB', 'IE'] } } };
    expect(() => assertValidAirportProfile(drifted)).toThrow(/does not resolve/);
    const consistent: AirportProfile = { ...base, destinationRules: { expectedCountryCodes: ['GB'], policy: { mode: 'SAME_COUNTRY' } } };
    expect(() => assertValidAirportProfile(consistent)).not.toThrow();
  });

  it('existing Manchester and Pakistan destination rules are byte-for-byte what they were', () => {
    expect(getAirportProfile('MAN')!.destinationRules).toEqual({ expectedCountryCodes: ['GB'] });
    for (const code of ['ISB', 'LHE', 'KHI']) expect(getAirportProfile(code)!.destinationRules).toEqual({ expectedCountryCodes: ['PK'], regionBias: 'pk' });
  });
});

describe('shell lookup and dispatch integration', () => {
  it('a catalogued airport dispatches to not_yet_supported (never a journey, never a made-up estimate)', () => {
    const lookup = getShellAirportLookup('lhr');
    expect(lookup).toEqual({ code: 'LHR', known: true, name: 'London Heathrow Airport', blocked: false });
    expect(resolveShellDispatch('lhr', lookup)).toEqual({ kind: 'not_yet_supported', code: 'LHR', name: 'London Heathrow Airport' });
  });

  it('an unknown code dispatches to unsupported', () => {
    expect(getShellAirportLookup('ZZZ')).toEqual({ code: 'ZZZ', known: false });
    expect(resolveShellDispatch('ZZZ', getShellAirportLookup('ZZZ')).kind).toBe('unsupported');
  });

  it('special profiles still dispatch to a journey with their lookup attached', () => {
    for (const code of ['MAN', 'ISB', 'LHE', 'KHI']) expect(resolveShellDispatch(code, getShellAirportLookup(code)).kind).toBe('journey');
  });

  it('URL input can never bypass validation: junk, injection-shaped and overlong values all fail closed', () => {
    for (const raw of ['../etc/passwd', '<script>', 'LHR%00', 'LHRX', 'lh', '%20', 'A'.repeat(500)]) {
      const dispatch = resolveShellDispatch(raw, getShellAirportLookup(raw));
      expect(['unsupported', 'selector']).toContain(dispatch.kind);
    }
  });
});

describe('bundle isolation — the ~350 KB catalogue stays out of the client', () => {
  const clientSafe = ['components/arrive-by-shell.tsx', 'lib/arrive-by-shared/shell-dispatch.ts', 'lib/arrive-by-shared/airport-search.ts', 'lib/arrive-by-shared/airport-registry.ts', 'lib/arrive-by-shared/destination-policy.ts'];

  it('client-shipped modules never import the catalogue, its JSON, catalogue search or the capability module', () => {
    for (const file of clientSafe) {
      // Real import specifiers only -- comments may legitimately name these modules.
      const specifiers = [...read(...file.split('/')).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const specifier of specifiers) expect(specifier, file).not.toMatch(/airport-catalogue|airports\.generated|catalogue-search|airport-capability/);
    }
  });

  it('the page (server component) is the only place that resolves catalogue lookups for the shell', () => {
    expect(read('app', 'arrive-by', 'page.tsx')).toContain('getShellAirportLookup');
    expect(read('components', 'arrive-by-shell.tsx')).not.toContain('getShellAirportLookup');
  });
});

describe('privacy and analytics unchanged by the catalogue', () => {
  it('no catalogue module calls analytics or storage', () => {
    for (const file of ['airport-catalogue.ts', 'airport-search.ts', 'airport-capability.ts', 'destination-policy.ts', 'catalogue-search.ts']) {
      const src = read('lib', 'arrive-by-shared', file);
      expect(src, file).not.toMatch(/track\(|localStorage|sessionStorage|document\.cookie|fetch\(/);
    }
  });
});
