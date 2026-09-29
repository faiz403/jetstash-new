import { describe, it, expect } from 'vitest';
import { describeAirportResult, foldSearchText, searchAirports, type SearchableAirport } from '@/lib/arrive-by-shared/airport-search';
import { searchCatalogue } from '@/lib/arrive-by-shared/catalogue-search';

const top = (query: string) => searchCatalogue(query)[0]?.iata;

describe('worldwide airport search — the queries the brief names', () => {
  it('finds by IATA code (exact code ranks first, case-insensitive)', () => {
    expect(top('LHR')).toBe('LHR');
    expect(top('jfk')).toBe('JFK');
    expect(top('  DXB ')).toBe('DXB');
  });

  it('finds by airport name', () => {
    expect(top('Heathrow')).toBe('LHR');
    expect(searchCatalogue('Kennedy').map((a) => a.iata)).toContain('JFK');
  });

  it('finds by city', () => {
    expect(top('Delhi')).toBe('DEL');
    expect(top('Dubai')).toBe('DXB');
    expect(top('Doha')).toBe('DOH');
    expect(top('Dhaka')).toBe('DAC');
    expect(top('Sydney')).toBe('SYD');
    expect(top('Manchester')).toBe('MAN');
  });

  it('finds by country and puts the biggest airport first', () => {
    const results = searchCatalogue('united arab emirates').map((a) => a.iata);
    expect(results).toContain('DXB');
    expect(searchCatalogue('pakistan').map((a) => a.iata)).toEqual(expect.arrayContaining(['ISB']));
  });

  it('is diacritic- and punctuation-insensitive', () => {
    expect(foldSearchText('Zürich')).toBe('zurich');
    expect(top('zurich')).toBe('ZRH');
    expect(top('Zürich')).toBe('ZRH');
  });

  it('matches by ICAO code', () => {
    expect(top('EGLL')).toBe('LHR');
  });

  it('shows the two-line result the brief describes', () => {
    const lhr = searchCatalogue('LHR')[0];
    expect(describeAirportResult(lhr)).toEqual({ title: 'London Heathrow Airport', subtitle: 'LHR · London, United Kingdom' });
    const dxb = searchCatalogue('DXB')[0];
    expect(describeAirportResult(dxb).subtitle).toBe('DXB · Dubai, United Arab Emirates');
  });
});

describe('search behaviour and safety', () => {
  it('returns nothing for empty, whitespace or punctuation-only input', () => {
    expect(searchCatalogue('')).toEqual([]);
    expect(searchCatalogue('   ')).toEqual([]);
    expect(searchCatalogue('!!!')).toEqual([]);
  });

  it('respects the limit and defaults to a small page', () => {
    expect(searchCatalogue('a').length).toBeLessThanOrEqual(8);
    expect(searchCatalogue('international', { limit: 3 })).toHaveLength(3);
  });

  it('caps query length so an enormous input cannot become a scan-cost or memory problem', () => {
    const started = Date.now();
    expect(() => searchCatalogue('x'.repeat(100_000))).not.toThrow();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('is deterministic for a repeated query', () => {
    expect(searchCatalogue('london').map((a) => a.iata)).toEqual(searchCatalogue('london').map((a) => a.iata));
  });

  it('honours a caller filter before ranking (used to restrict to eligible airports)', () => {
    const onlyPakistan = searchCatalogue('international', { filter: (a) => a.countryCode === 'PK' });
    expect(onlyPakistan.length).toBeGreaterThan(0);
    expect(onlyPakistan.every((a) => a.countryCode === 'PK')).toBe(true);
  });

  it('a hostile-looking query is treated as plain text, never matched as a pattern', () => {
    expect(searchCatalogue('.*')).toEqual([]);
    expect(searchCatalogue('(((')).toEqual([]);
  });

  it('works over an explicit airport list without the catalogue (the client-safe path)', () => {
    const list: SearchableAirport[] = [
      { iata: 'MAN', icao: '', name: 'Manchester Airport', city: 'Manchester', countryCode: 'GB', size: 'L' },
      { iata: 'ISB', icao: '', name: 'Islamabad International Airport', city: 'Islamabad', countryCode: 'PK', size: 'L' },
    ];
    expect(searchAirports('isl', list).map((a) => a.iata)).toEqual(['ISB']);
    expect(searchAirports('lhr', list)).toEqual([]);
  });
});
