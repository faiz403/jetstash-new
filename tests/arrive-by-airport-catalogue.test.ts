import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { assertValidCatalogueAirport, getCatalogueAirport, getCatalogueAirports, type CatalogueAirport } from '@/lib/arrive-by-shared/airport-catalogue';
import { getAirportProfile } from '@/lib/arrive-by-shared/airport-registry';

/**
 * Worldwide airport catalogue integrity. The catalogue is generated from
 * OurAirports (Public Domain) by scripts/generate-arrive-by-airport-catalogue.mjs;
 * these tests pin the invariants the rest of Arrive By relies on rather than
 * trusting the generated file.
 */

const valid: CatalogueAirport = { iata: 'AAA', icao: 'AAAA', name: 'Test Airport', city: 'Testville', countryCode: 'GB', lat: 51.5, lng: -0.1, timeZone: 'Europe/London', size: 'M' };
const provenance = JSON.parse(readFileSync(join(process.cwd(), 'lib', 'arrive-by-shared', 'catalogue', 'airports.provenance.json'), 'utf8'));

/** UTC offset in minutes for an IANA zone at a fixed instant, via Intl -- never the machine's own timezone. */
function offsetMinutes(timeZone: string, iso: string): number {
  const at = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

describe('catalogue integrity', () => {
  const airports = getCatalogueAirports();

  it('is a worldwide-scale catalogue that matches its provenance record', () => {
    expect(airports.length).toBe(provenance.included);
    expect(airports.length).toBeGreaterThan(3500);
    expect(new Set(airports.map((a) => a.countryCode)).size).toBeGreaterThan(200);
  });

  it('has no duplicate IATA codes and every entry passes the validator', () => {
    expect(new Set(airports.map((a) => a.iata)).size).toBe(airports.length);
    for (const airport of airports) expect(() => assertValidCatalogueAirport(airport)).not.toThrow();
  });

  it('every entry has a real IANA timezone, real coordinates and an ISO country', () => {
    for (const a of airports) {
      expect(a.timeZone).toMatch(/^[A-Za-z_]+\/[A-Za-z_/+-]+$|^UTC$/);
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lng)).toBeLessThanOrEqual(180);
      expect(a.countryCode).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('records source, licence and hash in its provenance', () => {
    expect(provenance.licence).toMatch(/Public Domain/);
    expect(provenance.url).toMatch(/ourairports/);
    expect(provenance.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the exported guard accepts a good entry and rejects fabricated bad ones', () => {
    expect(() => assertValidCatalogueAirport(valid)).not.toThrow();
    expect(() => assertValidCatalogueAirport({ ...valid, iata: 'ab' })).toThrow(/IATA/);
    expect(() => assertValidCatalogueAirport({ ...valid, iata: 'abc' })).toThrow(/IATA/);
    expect(() => assertValidCatalogueAirport({ ...valid, timeZone: '' })).toThrow(/timeZone is missing/);
    expect(() => assertValidCatalogueAirport({ ...valid, timeZone: 'Mars/Olympus' })).toThrow(/valid IANA/);
    expect(() => assertValidCatalogueAirport({ ...valid, lat: 91 })).toThrow(/coordinates/);
    expect(() => assertValidCatalogueAirport({ ...valid, lng: NaN })).toThrow(/coordinates/);
    expect(() => assertValidCatalogueAirport({ ...valid, lat: 0, lng: 0 })).toThrow(/null-island/);
    expect(() => assertValidCatalogueAirport({ ...valid, countryCode: 'GBR' })).toThrow(/countryCode/);
    expect(() => assertValidCatalogueAirport({ ...valid, name: '  ' })).toThrow(/name is empty/);
    expect(() => assertValidCatalogueAirport({ ...valid, icao: 'ab' })).toThrow(/ICAO/);
  });
});

describe('public-airport filter (scheduled service and IATA-coded; no heliports, seaplane bases or closed fields)', () => {
  it('contains the representative airports with correct identity', () => {
    const expected: Record<string, [string, string]> = {
      LHR: ['GB', 'Europe/London'], MAN: ['GB', 'Europe/London'], ISB: ['PK', 'Asia/Karachi'], LHE: ['PK', 'Asia/Karachi'], KHI: ['PK', 'Asia/Karachi'],
      DEL: ['IN', 'Asia/Kolkata'], BOM: ['IN', 'Asia/Kolkata'], AMD: ['IN', 'Asia/Kolkata'], DAC: ['BD', 'Asia/Dhaka'], DXB: ['AE', 'Asia/Dubai'], DOH: ['QA', 'Asia/Qatar'],
      JFK: ['US', 'America/New_York'], LAX: ['US', 'America/Los_Angeles'], SYD: ['AU', 'Australia/Sydney'], AKL: ['NZ', 'Pacific/Auckland'], JNB: ['ZA', 'Africa/Johannesburg'],
      SIN: ['SG', 'Asia/Singapore'], HKG: ['HK', 'Asia/Hong_Kong'], GRU: ['BR', 'America/Sao_Paulo'], MEX: ['MX', 'America/Mexico_City'], YYZ: ['CA', 'America/Toronto'],
    };
    for (const [code, [country, tz]] of Object.entries(expected)) {
      const a = getCatalogueAirport(code);
      expect(a, code).toBeDefined();
      expect(a!.countryCode, code).toBe(country);
      expect(a!.timeZone, code).toBe(tz);
    }
  });

  it('does not drop airports on a name-based military guess: scheduled-service "Air Station" airports stay catalogued', () => {
    // Bareilly (civil enclave) and Nikolski have scheduled passenger service despite their names; the capability gate, not the filter, decides usability.
    for (const code of ['BEK', 'IKO', 'BGW', 'NKM', 'KWA']) expect(getCatalogueAirport(code), code).toBeDefined();
    expect(provenance.excluded.military).toBeUndefined();
  });

  it('never carries private-strip style codes (a 3-letter IATA is required)', () => {
    expect(getCatalogueAirport('00A')).toBeUndefined();
    for (const a of getCatalogueAirports()) expect(a.iata).toMatch(/^[A-Z]{3}$/);
  });

  it('lookup normalises case/whitespace and rejects anything else', () => {
    expect(getCatalogueAirport(' lhr ')?.iata).toBe('LHR');
    expect(getCatalogueAirport('LH')).toBeUndefined();
    expect(getCatalogueAirport("LHR'; DROP")).toBeUndefined();
    expect(getCatalogueAirport('')).toBeUndefined();
    expect(getCatalogueAirport(null)).toBeUndefined();
  });
});

describe('special-profile overrides agree with the catalogue', () => {
  it('every registry override exists in the catalogue with the same country and timezone', () => {
    for (const code of ['MAN', 'ISB', 'LHE', 'KHI']) {
      const profile = getAirportProfile(code)!;
      const catalogued = getCatalogueAirport(code)!;
      expect(catalogued, code).toBeDefined();
      expect(catalogued.countryCode, code).toBe(profile.countryCode);
      expect(catalogued.timeZone, code).toBe(profile.timeZone);
    }
  });
});

describe('timezone edge cases (real IANA offsets, fixed instants, no machine-timezone dependence)', () => {
  const tz = (code: string) => getCatalogueAirport(code)!.timeZone;

  it('DST: London is +0 in January and +60 in July; Dubai never shifts', () => {
    expect(offsetMinutes(tz('LHR'), '2026-01-15T12:00:00Z')).toBe(0);
    expect(offsetMinutes(tz('LHR'), '2026-07-15T12:00:00Z')).toBe(60);
    expect(offsetMinutes(tz('DXB'), '2026-01-15T12:00:00Z')).toBe(240);
    expect(offsetMinutes(tz('DXB'), '2026-07-15T12:00:00Z')).toBe(240);
  });

  it('non-DST countries stay fixed year-round (Pakistan, Bangladesh)', () => {
    for (const code of ['ISB', 'LHE', 'KHI']) {
      expect(offsetMinutes(tz(code), '2026-01-15T12:00:00Z')).toBe(300);
      expect(offsetMinutes(tz(code), '2026-07-15T12:00:00Z')).toBe(300);
    }
    expect(offsetMinutes(tz('DAC'), '2026-07-15T12:00:00Z')).toBe(360);
  });

  it('half-hour offsets: India +5:30 all year; Adelaide +10:30 in southern summer, +9:30 in winter', () => {
    expect(offsetMinutes(tz('DEL'), '2026-01-15T12:00:00Z')).toBe(330);
    expect(offsetMinutes(tz('ADL'), '2026-01-15T12:00:00Z')).toBe(630);
    expect(offsetMinutes(tz('ADL'), '2026-07-15T12:00:00Z')).toBe(570);
  });

  it('quarter-hour offsets: Kathmandu +5:45', () => {
    expect(getCatalogueAirport('KTM')).toBeDefined();
    expect(offsetMinutes(tz('KTM'), '2026-07-15T12:00:00Z')).toBe(345);
  });

  it('offsets beyond +10 and negative offsets: Auckland +13 in January, New York -5 / -4, Honolulu -10', () => {
    expect(offsetMinutes(tz('AKL'), '2026-01-15T12:00:00Z')).toBe(780);
    expect(offsetMinutes(tz('SYD'), '2026-01-15T12:00:00Z')).toBe(660);
    expect(offsetMinutes(tz('JFK'), '2026-01-15T12:00:00Z')).toBe(-300);
    expect(offsetMinutes(tz('JFK'), '2026-07-15T12:00:00Z')).toBe(-240);
    expect(offsetMinutes(tz('HNL'), '2026-07-15T12:00:00Z')).toBe(-600);
  });

  it('a zone east of the date line and one west of it are a calendar day apart at the same instant', () => {
    const instant = '2026-03-10T11:30:00Z';
    const day = (zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
    expect(day(tz('AKL'))).toBe('2026-03-11'); // UTC+13 in March (NZDT)
    expect(day(tz('HNL'))).toBe('2026-03-10'); // UTC-10
  });
});
