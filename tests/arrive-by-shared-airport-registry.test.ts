import { describe, it, expect } from 'vitest';
import {
  getAirportProfile,
  getPublicAirportProfiles,
  resolveRoutingOrigin,
  canEnablePublicly,
  assertValidAirportProfile,
  POLICY_PENDING,
  type AirportProfile,
} from '@/lib/arrive-by-shared/airport-registry';

describe('airport registry — Phase 2 foundation', () => {
  it('ISB is a valid, publicly enabled, road-pickup-first Pakistan profile', () => {
    const profile = getAirportProfile('ISB');
    expect(profile).toMatchObject({
      countryCode: 'PK', timeZone: 'Asia/Karachi', journeyEngine: 'ROAD_PICKUP_FIRST',
      validationStatus: 'public_beta', publiclyEnabled: true,
    });
    expect(profile?.destinationRules.expectedCountryCodes).toEqual(['PK']);
    expect(profile?.routing.defaultOrigin).toMatchObject({ kind: 'address' });
  });

  it('LHE is a valid, publicly enabled, road-pickup-first Pakistan profile', () => {
    const profile = getAirportProfile('LHE');
    expect(profile).toMatchObject({ journeyEngine: 'ROAD_PICKUP_FIRST', validationStatus: 'public_beta', publiclyEnabled: true });
  });

  it('KHI is a valid, publicly enabled, road-pickup-first Pakistan profile', () => {
    const profile = getAirportProfile('KHI');
    expect(profile).toMatchObject({ journeyEngine: 'ROAD_PICKUP_FIRST', validationStatus: 'public_beta', publiclyEnabled: true });
  });

  it('MAN is a valid but non-public transit-first profile with a pending destination policy', () => {
    const profile = getAirportProfile('MAN');
    expect(profile).toMatchObject({
      countryCode: 'GB', timeZone: 'Europe/London', journeyEngine: 'TRANSIT_FIRST',
      validationStatus: 'internally_testable', publiclyEnabled: false,
    });
    expect(profile?.destinationRules.expectedCountryCodes).toBe(POLICY_PENDING);
    expect(profile?.routing.defaultOrigin).toMatchObject({ kind: 'coordinate', lat: 53.367664, lng: -2.280683 });
  });

  it('an unsupported airport code resolves safely to undefined, never a fabricated profile', () => {
    expect(getAirportProfile('LHR')).toBeUndefined();
    expect(getAirportProfile('DEL')).toBeUndefined();
    expect(getAirportProfile('')).toBeUndefined();
  });

  it('getPublicAirportProfiles returns only ISB/LHE/KHI — MAN is excluded despite being a valid profile', () => {
    const codes = getPublicAirportProfiles().map((profile) => profile.code).sort();
    expect(codes).toEqual(['ISB', 'KHI', 'LHE']);
  });

  it('canEnablePublicly is true only for public_beta and public', () => {
    expect(canEnablePublicly('configured')).toBe(false);
    expect(canEnablePublicly('internally_testable')).toBe(false);
    expect(canEnablePublicly('founder_validated')).toBe(false);
    expect(canEnablePublicly('public_beta')).toBe(true);
    expect(canEnablePublicly('public')).toBe(true);
  });

  it('resolveRoutingOrigin returns the default origin for a non-terminal-required airport', () => {
    const profile = getAirportProfile('MAN')!;
    expect(resolveRoutingOrigin(profile)).toEqual(profile.routing.defaultOrigin);
    expect(resolveRoutingOrigin(profile, 'T2')).toEqual(profile.routing.defaultOrigin);
  });

  it('resolveRoutingOrigin fails closed when terminalRequired is true and no terminal is given', () => {
    const profile: AirportProfile = {
      code: 'LHR', displayName: 'Test Heathrow', city: 'London', countryCode: 'GB', timeZone: 'Europe/London',
      routing: {
        defaultOrigin: { kind: 'coordinate', lat: 51.4700, lng: -0.4543 },
        terminals: { T5: { kind: 'coordinate', lat: 51.4723, lng: -0.4880 } },
        terminalRequired: true,
      },
      journeyEngine: 'TRANSIT_FIRST',
      destinationRules: { expectedCountryCodes: POLICY_PENDING },
      validationStatus: 'configured',
      publiclyEnabled: false,
    };
    expect(() => resolveRoutingOrigin(profile)).toThrow(/requires a supported terminal/);
    expect(() => resolveRoutingOrigin(profile, 'T4')).toThrow(/requires a supported terminal/);
  });

  it('resolveRoutingOrigin returns the known terminal origin when terminalRequired is true and the terminal matches', () => {
    const profile: AirportProfile = {
      code: 'LHR', displayName: 'Test Heathrow', city: 'London', countryCode: 'GB', timeZone: 'Europe/London',
      routing: {
        defaultOrigin: { kind: 'coordinate', lat: 51.4700, lng: -0.4543 },
        terminals: { T5: { kind: 'coordinate', lat: 51.4723, lng: -0.4880 } },
        terminalRequired: true,
      },
      journeyEngine: 'TRANSIT_FIRST',
      destinationRules: { expectedCountryCodes: POLICY_PENDING },
      validationStatus: 'configured',
      publiclyEnabled: false,
    };
    expect(resolveRoutingOrigin(profile, 'T5')).toEqual({ kind: 'coordinate', lat: 51.4723, lng: -0.4880 });
  });

  const validBase: AirportProfile = {
    code: 'XX', displayName: 'Test Airport', city: 'Testville', countryCode: 'XX', timeZone: 'UTC',
    routing: { defaultOrigin: { kind: 'address', value: 'Somewhere real' }, terminalRequired: false },
    journeyEngine: 'ROAD_PICKUP_FIRST',
    destinationRules: { expectedCountryCodes: ['XX'] },
    validationStatus: 'configured',
    publiclyEnabled: false,
  };

  it('rejects a (0,0) placeholder coordinate origin', () => {
    const bad: AirportProfile = { ...validBase, routing: { defaultOrigin: { kind: 'coordinate', lat: 0, lng: 0 }, terminalRequired: false } };
    expect(() => assertValidAirportProfile(bad)).toThrow(/not a real routing origin/);
  });

  it('rejects an empty-string address origin', () => {
    const bad: AirportProfile = { ...validBase, routing: { defaultOrigin: { kind: 'address', value: '   ' }, terminalRequired: false } };
    expect(() => assertValidAirportProfile(bad)).toThrow(/not a real routing origin/);
  });

  it('rejects terminalRequired: true with no terminals configured', () => {
    const bad: AirportProfile = { ...validBase, routing: { defaultOrigin: validBase.routing.defaultOrigin, terminalRequired: true } };
    expect(() => assertValidAirportProfile(bad)).toThrow(/no terminal origins are configured/);
  });

  it('rejects a terminal entry with a fake origin', () => {
    const bad: AirportProfile = {
      ...validBase,
      routing: { defaultOrigin: validBase.routing.defaultOrigin, terminals: { T1: { kind: 'coordinate', lat: 0, lng: 0 } }, terminalRequired: true },
    };
    expect(() => assertValidAirportProfile(bad)).toThrow(/terminal T1 is missing a real routing origin/);
  });

  it('rejects a profile whose validationStatus allows public enablement but whose destination policy is still pending', () => {
    const bad: AirportProfile = { ...validBase, destinationRules: { expectedCountryCodes: POLICY_PENDING }, validationStatus: 'public_beta' };
    expect(() => assertValidAirportProfile(bad)).toThrow(/pending destination-country policy/);
  });

  it('rejects a profile with publiclyEnabled true but a validationStatus that does not allow it', () => {
    const bad: AirportProfile = { ...validBase, validationStatus: 'internally_testable', publiclyEnabled: true };
    expect(() => assertValidAirportProfile(bad)).toThrow(/does not allow public enablement/);
  });

  it('accepts a genuinely valid profile without throwing', () => {
    expect(() => assertValidAirportProfile(validBase)).not.toThrow();
  });
});
