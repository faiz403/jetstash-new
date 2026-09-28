import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveDestination,
  isDefinitelyNotExpectedCountry,
  extractPrimaryInputPlace,
  deriveResolvedPrimaryPlace,
  placesMatch,
  isNamedVenueResult,
  type AddressComponent,
} from '@/lib/arrive-by-shared/destination-resolution';

/**
 * Proves the generalised shared resolver preserves every Pakistan
 * regression case it was built from, now driven through
 * `expectedCountryCodes`/`regionBias` config rather than a hardcoded
 * country — plus the new no-gate behaviour any engine without a decided
 * destination policy (e.g. Manchester today) relies on.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockGeocodeResponse(body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
}

const pkComponent = (types: string[], long = 'New Mirpur City'): AddressComponent => ({ long_name: long, short_name: long, types });

describe('isDefinitelyNotExpectedCountry — generalised country gate', () => {
  it('never rejects when no expectedCountryCodes are configured (Manchester\'s current, pending policy)', () => {
    const components: AddressComponent[] = [{ long_name: 'India', short_name: 'IN', types: ['country'] }];
    expect(isDefinitelyNotExpectedCountry(components, undefined)).toBe(false);
    expect(isDefinitelyNotExpectedCountry(components, [])).toBe(false);
  });

  it('rejects a country component outside expectedCountryCodes', () => {
    const components: AddressComponent[] = [{ long_name: 'India', short_name: 'IN', types: ['country'] }];
    expect(isDefinitelyNotExpectedCountry(components, ['PK'])).toBe(true);
  });

  it('accepts a country component matching expectedCountryCodes', () => {
    const components: AddressComponent[] = [{ long_name: 'Pakistan', short_name: 'PK', types: ['country'] }];
    expect(isDefinitelyNotExpectedCountry(components, ['PK'])).toBe(false);
  });

  it('accepts multi-country configuration (e.g. a future GB + IE onward-travel airport)', () => {
    const components: AddressComponent[] = [{ long_name: 'Ireland', short_name: 'IE', types: ['country'] }];
    expect(isDefinitelyNotExpectedCountry(components, ['GB', 'IE'])).toBe(false);
  });

  it('never rejects on absent country data — a bare locality-only response is not itself suspicious', () => {
    expect(isDefinitelyNotExpectedCountry([{ long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality'] }], ['PK'])).toBe(false);
  });
});

describe('resolveDestination — Pakistan regression preservation (via expectedCountryCodes: [\'PK\'])', () => {
  const pakistanConfig = { expectedCountryCodes: ['PK'], regionBias: 'pk' };

  it('wrong-country rejection: a genuinely non-Pakistan result is rejected', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'Mumbai, India', place_id: 'p1', types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [pkComponent(['locality'], 'Mumbai'), { long_name: 'India', short_name: 'IN', types: ['country'] }],
      }],
    });
    const result = await resolveDestination('key', 'Mumbai', pakistanConfig);
    expect(result).toMatchObject({ confidence: 'NEEDS_CLARIFICATION', clarificationReason: 'WRONG_COUNTRY' });
  });

  it('primary-place mismatch: "Chakswari" resolving to "New Mirpur City" is caught (the original live finding)', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City, Azad Kashmir, Pakistan', place_id: 'p2', types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [pkComponent(['locality'])],
      }],
    });
    const result = await resolveDestination('key', 'Chakswari, Mirpur, Azad Kashmir, Pakistan', pakistanConfig);
    expect(result).toMatchObject({ confidence: 'NEEDS_CLARIFICATION', clarificationReason: 'PRIMARY_PLACE_MISMATCH' });
  });

  it('partial-match on a venue is exempted (Nishat Hotel, Johar Town) and becomes NEEDS_CONFIRMATION', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'Nishat Hotel, Johar Town, Lahore, Pakistan', place_id: 'p3', partial_match: true,
        types: ['lodging', 'establishment', 'point_of_interest'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Johar Town', short_name: 'Johar Town', types: ['sublocality_level_1'] }],
      }],
    });
    const result = await resolveDestination('key', 'Nishat Hotel Johar Town', pakistanConfig);
    expect(result).toMatchObject({ confidence: 'NEEDS_CONFIRMATION', placeId: 'p3' });
  });

  it('multi-POI selection: two genuinely different real venues produce NEEDS_SELECTION with both candidates', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [
        { formatted_address: 'Nishat Hotel, Johar Town, Lahore, Pakistan', place_id: 'venue-a', types: ['lodging', 'establishment', 'point_of_interest'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Nishat Hotel, Gulberg, Lahore, Pakistan', place_id: 'venue-b', types: ['lodging', 'establishment', 'point_of_interest'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await resolveDestination('key', 'Nishat Hotel Lahore', pakistanConfig);
    expect(result.confidence).toBe('NEEDS_SELECTION');
    expect(result.candidates).toEqual([
      { placeId: 'venue-a', formattedAddress: 'Nishat Hotel, Johar Town, Lahore, Pakistan' },
      { placeId: 'venue-b', formattedAddress: 'Nishat Hotel, Gulberg, Lahore, Pakistan' },
    ]);
  });

  it('a real venue plus a same-named non-venue area polygon (Aga Khan University Hospital) collapses to a single confirmation, not a false ambiguity', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [
        { formatted_address: 'Aga Khan University Hospital, Karachi, Pakistan', place_id: 'hospital', types: ['hospital', 'establishment', 'point_of_interest'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Aga Khan University Hospital, Karachi, Pakistan', place_id: 'area-polygon', types: ['sublocality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await resolveDestination('key', 'Aga Khan University Hospital', pakistanConfig);
    expect(result).toMatchObject({ confidence: 'NEEDS_CONFIRMATION', placeId: 'hospital' });
  });

  it('Sujawal-style locality ambiguity (zero venue candidates) keeps the original MULTIPLE_CANDIDATES rejection', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [
        { formatted_address: 'Sujawal, Sindh, Pakistan', place_id: 'sujawal-1', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Sujawal District, Sindh, Pakistan', place_id: 'sujawal-2', types: ['administrative_area_level_2', 'political'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await resolveDestination('key', 'Sujawal', pakistanConfig);
    expect(result).toMatchObject({ confidence: 'NEEDS_CLARIFICATION', clarificationReason: 'MULTIPLE_CANDIDATES' });
  });

  it('a geocode failure returns UNRESOLVED, never a guess', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch;
    const result = await resolveDestination('key', 'Anywhere', pakistanConfig);
    expect(result).toMatchObject({ confidence: 'UNRESOLVED', clarificationReason: 'GEOCODE_FAILED' });
  });
});

describe('resolveDestination — no country gate when config is empty (Manchester\'s current policy-pending state)', () => {
  it('a destination outside any particular country still reaches CONFIRMED when no expectedCountryCodes are given', async () => {
    mockGeocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'Sheffield, UK', place_id: 'sheffield-1', types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Sheffield', short_name: 'Sheffield', types: ['locality'] }],
      }],
    });
    const result = await resolveDestination('key', 'Sheffield', {});
    expect(result.confidence).toBe('CONFIRMED');
  });
});

describe('shared pure helpers — unchanged from the original Pakistan-only versions', () => {
  it('extractPrimaryInputPlace / deriveResolvedPrimaryPlace / placesMatch / isNamedVenueResult behave exactly as before', () => {
    expect(extractPrimaryInputPlace('Chakswari, Mirpur, Azad Kashmir')).toBe('chakswari');
    expect(deriveResolvedPrimaryPlace([{ long_name: 'Saddar', short_name: 'Saddar', types: ['sublocality_level_1'] }, { long_name: 'Rawalpindi', short_name: 'Rawalpindi', types: ['locality'] }])).toBe('Saddar');
    expect(placesMatch('chakswari', 'New Mirpur City')).toBe(false);
    expect(placesMatch('saddar', 'Saddar')).toBe(true);
    expect(isNamedVenueResult(['lodging', 'establishment', 'point_of_interest'])).toBe(true);
    expect(isNamedVenueResult(['locality', 'political'])).toBe(false);
  });
});
