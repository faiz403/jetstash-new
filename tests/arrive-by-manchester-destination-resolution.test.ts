import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/founder/arrive-by/google/route';

/**
 * Proves the Phase 2 destination-resolution integration into Manchester's
 * founder route: an unresolved/unsafe destination never reaches the
 * transit/car engine, a venue needs explicit confirmation, and multiple
 * venues need an explicit selection -- exactly the same guarantees Pakistan
 * already has, now shared. As of Phase 3.1, MAN's destination-country
 * policy is the explicit founder decision expectedCountryCodes: ['GB']
 * (see lib/arrive-by-shared/airport-registry.ts), so a non-GB result is
 * now also rejected the same way Pakistan rejects a non-PK one.
 */

const baseInput = {
  originId: 'man-terminal-2',
  availableAt: '2026-09-25T12:00',
  deadline: '2026-09-25T14:30',
};

const geocodeResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const previousKey = process.env.GOOGLE_ROUTES_API_KEY;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (previousKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
  else process.env.GOOGLE_ROUTES_API_KEY = previousKey;
  vi.restoreAllMocks();
});

async function post(body: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/founder/arrive-by/google', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));
}

describe('Manchester founder route — shared destination resolution gate', () => {
  it('an unresolved destination never reaches the transit engine: no second (transit) fetch call is made', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(geocodeResponse({ status: 'ZERO_RESULTS' }));
    globalThis.fetch = fetchMock as typeof fetch;

    const apiResponse = await post({ ...baseInput, destination: 'Somewhere Unresolvable' });
    const body = await apiResponse.json();

    expect(apiResponse.status).toBe(200);
    expect(body).toMatchObject({ transitStatus: 'DESTINATION_PENDING', destinationConfidence: 'UNRESOLVED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an ambiguous locality (multiple non-venue candidates) never reaches the transit engine', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(geocodeResponse({
      status: 'OK',
      results: [
        { formatted_address: 'Newport, Wales', place_id: 'a', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Newport, Shropshire', place_id: 'b', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const apiResponse = await post({ ...baseInput, destination: 'Newport' });
    const body = await apiResponse.json();

    expect(apiResponse.status).toBe(200);
    expect(body).toMatchObject({ transitStatus: 'DESTINATION_PENDING', destinationConfidence: 'NEEDS_CLARIFICATION', clarificationReason: 'MULTIPLE_CANDIDATES' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a GB destination proceeds to normal destination resolution (the country gate does not block legitimate UK results)', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(geocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'Sheffield, UK', place_id: 'sheffield-1', types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'Sheffield', short_name: 'Sheffield', types: ['locality'] },
          { long_name: 'United Kingdom', short_name: 'GB', types: ['country'] },
        ],
      }],
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const apiResponse = await post({ ...baseInput, destination: 'Sheffield' });
    const body = await apiResponse.json();

    expect(apiResponse.status).toBe(422); // no transit mock configured -- proves the country gate passed and the engine was actually reached
    expect(body).not.toMatchObject({ transitStatus: 'DESTINATION_PENDING' });
    expect(fetchMock).toHaveBeenCalledTimes(2); // geocode + attempted transit call
  });

  it('an explicit non-GB destination is rejected before transit routing -- MAN\'s UK-only beta scope', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(geocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'Dublin, Ireland', place_id: 'dublin-1', types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'Dublin', short_name: 'Dublin', types: ['locality'] },
          { long_name: 'Ireland', short_name: 'IE', types: ['country'] },
        ],
      }],
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const apiResponse = await post({ ...baseInput, destination: 'Dublin' });
    const body = await apiResponse.json();

    expect(apiResponse.status).toBe(200);
    expect(body).toMatchObject({ transitStatus: 'DESTINATION_PENDING', destinationConfidence: 'NEEDS_CLARIFICATION', clarificationReason: 'WRONG_COUNTRY' });
    // Wrong-country result never reaches transit routing -- only the one geocode call was made.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a named venue blocks the route until explicitly confirmed, then proceeds once confirmedPlaceId matches', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const venueGeocodeBody = {
      status: 'OK',
      results: [{
        formatted_address: 'Crucible Theatre, Sheffield', place_id: 'crucible-1',
        types: ['tourist_attraction', 'establishment', 'point_of_interest'],
        geometry: { location_type: 'APPROXIMATE' },
      }],
    };

    // First call: no confirmedPlaceId yet -- must stop before any transit call.
    // Response bodies are single-use, so each mocked fetch call needs a
    // freshly constructed Response even when the JSON payload is identical.
    const firstFetch = vi.fn().mockResolvedValueOnce(geocodeResponse(venueGeocodeBody));
    globalThis.fetch = firstFetch as typeof fetch;
    const pendingResponse = await post({ ...baseInput, destination: 'Crucible Theatre' });
    const pendingBody = await pendingResponse.json();
    expect(pendingBody).toMatchObject({
      transitStatus: 'DESTINATION_PENDING',
      destinationConfidence: 'NEEDS_CONFIRMATION',
      pendingConfirmation: { placeId: 'crucible-1', formattedAddress: 'Crucible Theatre, Sheffield' },
    });
    expect(firstFetch).toHaveBeenCalledTimes(1);

    // Second call, with confirmedPlaceId: re-resolves (server never trusts
    // the client's claim blindly), matches, and now proceeds to the
    // transit engine -- which fails closed here for lack of further transit
    // mocks, proving it was genuinely reached this time, not skipped.
    const secondFetch = vi.fn().mockResolvedValueOnce(geocodeResponse(venueGeocodeBody));
    globalThis.fetch = secondFetch as typeof fetch;
    const confirmedResponse = await post({ ...baseInput, destination: 'Crucible Theatre', confirmedPlaceId: 'crucible-1' });
    expect(secondFetch).toHaveBeenCalledTimes(2); // geocode re-check + attempted transit call
    expect(confirmedResponse.status).toBe(422); // no transit mock configured -- proves the engine was actually invoked, not skipped
  });

  it('multiple genuinely different venues block the route until one is explicitly selected', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const multiVenueGeocodeBody = {
      status: 'OK',
      results: [
        { formatted_address: 'The Crown Hotel, Sheffield City Centre', place_id: 'crown-a', types: ['lodging', 'establishment', 'point_of_interest'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'The Crown Hotel, Ecclesall', place_id: 'crown-b', types: ['lodging', 'establishment', 'point_of_interest'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    };

    const firstFetch = vi.fn().mockResolvedValueOnce(geocodeResponse(multiVenueGeocodeBody));
    globalThis.fetch = firstFetch as typeof fetch;
    const pendingResponse = await post({ ...baseInput, destination: 'The Crown Hotel' });
    const pendingBody = await pendingResponse.json();
    expect(pendingBody).toMatchObject({
      transitStatus: 'DESTINATION_PENDING',
      destinationConfidence: 'NEEDS_SELECTION',
      pendingSelection: { candidates: [
        { placeId: 'crown-a', formattedAddress: 'The Crown Hotel, Sheffield City Centre' },
        { placeId: 'crown-b', formattedAddress: 'The Crown Hotel, Ecclesall' },
      ] },
    });
    expect(firstFetch).toHaveBeenCalledTimes(1);

    const secondFetch = vi.fn().mockResolvedValueOnce(geocodeResponse(multiVenueGeocodeBody));
    globalThis.fetch = secondFetch as typeof fetch;
    const selectedResponse = await post({ ...baseInput, destination: 'The Crown Hotel', selectedPlaceId: 'crown-b' });
    expect(secondFetch).toHaveBeenCalledTimes(2); // geocode re-check + attempted transit call
    expect(selectedResponse.status).toBe(422); // proves the engine was reached, not skipped
  });

  it('a forged/stale confirmedPlaceId falls through to the real (unconfirmed) classification, never trusted blindly', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const venueGeocode = geocodeResponse({
      status: 'OK',
      results: [{
        formatted_address: 'Crucible Theatre, Sheffield', place_id: 'crucible-1',
        types: ['tourist_attraction', 'establishment', 'point_of_interest'],
        geometry: { location_type: 'APPROXIMATE' },
      }],
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(venueGeocode);
    globalThis.fetch = fetchMock as typeof fetch;

    const apiResponse = await post({ ...baseInput, destination: 'Crucible Theatre', confirmedPlaceId: 'forged-place-id' });
    const body = await apiResponse.json();
    expect(body).toMatchObject({ transitStatus: 'DESTINATION_PENDING', destinationConfidence: 'NEEDS_CONFIRMATION' });
  });

  it('rejects a confirmedPlaceId/selectedPlaceId over 200 characters', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const apiResponse = await post({ ...baseInput, destination: 'Anywhere', confirmedPlaceId: 'x'.repeat(201) });
    expect(apiResponse.status).toBe(422);
  });
});
