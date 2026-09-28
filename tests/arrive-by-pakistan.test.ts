import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PAKISTAN_AIRPORTS, PAKISTAN_AIRPORT_CODES, getPakistanAirport } from '@/lib/arrive-by-pakistan/airports';
import { localDateTimeToIso, isoToClock } from '@/lib/arrive-by-pakistan/timezone';
import { classifyOutcome, outcomeVerdict, PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES } from '@/lib/arrive-by-pakistan/outcomes';
import { geocodeDestination, computeDriveRoute } from '@/lib/arrive-by-pakistan/google-routes';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { deriveResolvedPrimaryPlace, extractPrimaryInputPlace, placesMatch } from '@/lib/arrive-by-pakistan/destination-identity';
import { formatMinutesHuman, formatSecondsHuman, roundClockToNearestFive, trafficContextSentence } from '@/lib/arrive-by-pakistan/format';

describe('airport configuration', () => {
  it('configures exactly ISB, LHE and KHI', () => {
    expect(PAKISTAN_AIRPORT_CODES.sort()).toEqual(['ISB', 'KHI', 'LHE']);
  });

  it('every airport uses Asia/Karachi and a free-text routing address, never a hand-typed coordinate', () => {
    for (const code of PAKISTAN_AIRPORT_CODES) {
      const airport = getPakistanAirport(code);
      expect(airport.timeZone).toBe('Asia/Karachi');
      expect(typeof airport.routingAddress).toBe('string');
      expect(airport.routingAddress.length).toBeGreaterThan(5);
      expect(airport.routingAddress).not.toMatch(/^-?\d+\.\d+,\s*-?\d+\.\d+$/);
    }
  });

  it('ISB is configured as Islamabad International Airport', () => {
    expect(PAKISTAN_AIRPORTS.ISB.displayName).toBe('Islamabad International Airport');
  });

  it('LHE and KHI are valid configured origins (configuration only — road behaviour is not claimed to be validated by this)', () => {
    expect(PAKISTAN_AIRPORTS.LHE.displayName).toContain('Lahore');
    expect(PAKISTAN_AIRPORTS.KHI.displayName).toContain('Karachi');
  });
});

describe('timezone handling — Asia/Karachi, no DST', () => {
  it('converts a local Pakistan date/time to the correct UTC instant', () => {
    // Pakistan Standard Time is UTC+5 year-round.
    const iso = localDateTimeToIso('2026-11-17T12:00', 'Asia/Karachi');
    expect(iso).toBe('2026-11-17T07:00:00.000Z');
  });

  it('formats an ISO instant back into Pakistan local clock time', () => {
    expect(isoToClock('2026-11-17T07:00:00.000Z', 'Asia/Karachi')).toBe('12:00');
  });

  it('rejects a malformed date/time string rather than silently misparsing it', () => {
    expect(() => localDateTimeToIso('not-a-date', 'Asia/Karachi')).toThrow();
  });

  it('does not depend on the server/browser\'s own local timezone', () => {
    const iso = localDateTimeToIso('2026-06-01T09:30', 'Asia/Karachi');
    // 09:30 PKT (UTC+5) is 04:30 UTC, regardless of what zone this test runs in.
    expect(iso).toBe('2026-06-01T04:30:00.000Z');
  });
});

describe('outcome classification', () => {
  it('classifies a confirmed destination with no deadline as ETA_ONLY', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: false })).toBe('ETA_ONLY');
  });

  it('classifies a comfortable margin as BEFORE_DEADLINE', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: 45 })).toBe(
      'BEFORE_DEADLINE',
    );
  });

  it('classifies a margin at the tight threshold as TIGHT_MARGIN, not BEFORE_DEADLINE', () => {
    expect(
      classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES }),
    ).toBe('TIGHT_MARGIN');
  });

  it('classifies a negative margin as AFTER_DEADLINE', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: -5 })).toBe(
      'AFTER_DEADLINE',
    );
  });

  it('classifies a needs-clarification destination as DESTINATION_NEEDS_CLARIFICATION regardless of route/deadline state', () => {
    expect(classifyOutcome({ destinationConfidence: 'NEEDS_CLARIFICATION', routeAvailable: true, hasDeadline: true, marginMinutes: 100 })).toBe(
      'DESTINATION_NEEDS_CLARIFICATION',
    );
  });

  it('classifies an unresolved destination as ROUTE_UNAVAILABLE', () => {
    expect(classifyOutcome({ destinationConfidence: 'UNRESOLVED', routeAvailable: false, hasDeadline: false })).toBe('ROUTE_UNAVAILABLE');
  });

  it('classifies a confirmed destination with no usable route as ROUTE_UNAVAILABLE', () => {
    expect(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: false, hasDeadline: false })).toBe('ROUTE_UNAVAILABLE');
  });

  it('never uses forbidden overstated wording', () => {
    for (const outcome of [
      'ETA_ONLY', 'BEFORE_DEADLINE', 'TIGHT_MARGIN', 'AFTER_DEADLINE', 'DESTINATION_NEEDS_CLARIFICATION', 'ROUTE_UNAVAILABLE',
    ] as const) {
      const verdict = outcomeVerdict({ outcome, destination: 'Mirpur', arrivalClock: '16:40', deadlineClock: '17:00', marginMinutes: 20 });
      const lower = verdict.toLowerCase();
      for (const forbidden of ['guaranteed', 'definitely', 'impossible', 'safe']) {
        expect(lower, `${outcome}: "${verdict}"`).not.toContain(forbidden);
      }
    }
  });
});

const originalFetch = global.fetch;

function mockGeocode(payload: unknown) {
  global.fetch = vi.fn(async (url: string | URL) => {
    if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    return new Response(JSON.stringify({ routes: [{ duration: '3600s', distanceMeters: 90000 }] }), { status: 200 });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('destination geocoding confidence', () => {
  it('classifies a clean, single, precisely-typed result as CONFIRMED', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur, AJK, Pakistan', place_id: 'abc', types: ['locality'], geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }, { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('a MISSING country address component is never treated as wrong-country — live evidence shows real Pakistan results ("New Mirpur City", "Dadyal") can return with no country/admin hierarchy at all', async () => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Mirpur', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' }, address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }] }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('classifies a result with an EXPLICIT non-Pakistan country component as NEEDS_CLARIFICATION (WRONG_COUNTRY)', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur, Some Other Country', types: ['locality'], geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }, { long_name: 'Some Other Country', short_name: 'XX', types: ['country', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('WRONG_COUNTRY');
  });

  it('classifies a partial match as NEEDS_CLARIFICATION', async () => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Somewhere else', partial_match: true, types: ['locality'], geometry: { location_type: 'APPROXIMATE' } }],
    });
    const result = await geocodeDestination('test-key', 'a vague place');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
  });

  it('classifies an overly broad place type (country/province) as NEEDS_CLARIFICATION', async () => {
    mockGeocode({ status: 'OK', results: [{ formatted_address: 'Pakistan', types: ['country'], geometry: { location_type: 'APPROXIMATE' } }] });
    const result = await geocodeDestination('test-key', 'Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
  });

  it('classifies multiple ambiguous candidates as NEEDS_CLARIFICATION', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        { formatted_address: 'Candidate A', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Candidate B', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await geocodeDestination('test-key', 'ambiguous name');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
  });

  it('classifies zero results as UNRESOLVED', async () => {
    mockGeocode({ status: 'ZERO_RESULTS', results: [] });
    const result = await geocodeDestination('test-key', 'gibberish nonsense place');
    expect(result.confidence).toBe('UNRESOLVED');
  });

  it('classifies a network failure as UNRESOLVED, never throwing', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await geocodeDestination('test-key', 'Mirpur');
    expect(result.confidence).toBe('UNRESOLVED');
  });

  it('classifies a district-level match (administrative_area_level_2) alone as NEEDS_CLARIFICATION', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur District, AJK, Pakistan', types: ['administrative_area_level_2', 'political'], geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Mirpur District', short_name: 'Mirpur District', types: ['administrative_area_level_2', 'political'] }, { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur District');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('TOO_BROAD_TYPE');
  });

  it('an APPROXIMATE location_type with a correctly-matching locality is still CONFIRMED — APPROXIMATE alone is not a failure signal', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur, Azad Jammu and Kashmir, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
    expect(result.locationType).toBe('APPROXIMATE');
  });
});

describe('primary-place identity guard — live ISB evidence: Chakswari resolved to New Mirpur City', () => {
  it('extractPrimaryInputPlace takes only the first comma-separated segment, normalized', () => {
    expect(extractPrimaryInputPlace('Chakswari, Mirpur, Azad Kashmir, Pakistan')).toBe('chakswari');
    expect(extractPrimaryInputPlace('Mirpur, Azad Jammu and Kashmir, Pakistan')).toBe('mirpur');
    expect(extractPrimaryInputPlace('Dadyal')).toBe('dadyal');
  });

  it('deriveResolvedPrimaryPlace prefers sublocality over locality — real Saddar/Rawalpindi data has both', () => {
    const components = [
      { long_name: 'Saddar', short_name: 'Saddar', types: ['political', 'sublocality', 'sublocality_level_1'] },
      { long_name: 'Rawalpindi', short_name: 'Rawalpindi', types: ['locality', 'political'] },
      { long_name: 'Punjab', short_name: 'Punjab', types: ['administrative_area_level_1', 'political'] },
    ];
    // Locality alone would wrongly pick "Rawalpindi" (the parent city) over
    // "Saddar" (the specific neighbourhood the traveller actually named).
    expect(deriveResolvedPrimaryPlace(components)).toBe('Saddar');
  });

  it('placesMatch is normalized substring containment, not a whole-string token-overlap check', () => {
    expect(placesMatch('mirpur', 'New Mirpur City')).toBe(true);
    expect(placesMatch('dadyal', 'Dadyal')).toBe(true);
    expect(placesMatch('saddar', 'Saddar')).toBe(true);
    // The exact live failure: "Chakswari" must NOT match "New Mirpur City"
    // even though the whole input string shares the word "Mirpur".
    expect(placesMatch('chakswari', 'New Mirpur City')).toBe(false);
  });

  it('Mirpur resolving to New Mirpur City is CONFIRMED — the requested identity is retained', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpur, Azad Jammu and Kashmir, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
    expect(result.resolvedPrimaryPlace).toBe('New Mirpur City');
  });

  it('Dadyal resolving to bare Dadyal is CONFIRMED', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Dadyal',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'Dadyal', short_name: 'Dadyal', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Dadyal, Azad Jammu and Kashmir, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('Saddar resolving to Saddar, Rawalpindi is CONFIRMED — the sublocality match, not the parent locality', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Saddar, Rawalpindi, 46000, Pakistan',
        types: ['political', 'sublocality', 'sublocality_level_1'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'Saddar', short_name: 'Saddar', types: ['political', 'sublocality', 'sublocality_level_1'] },
          { long_name: 'Rawalpindi', short_name: 'Rawalpindi', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Saddar, Rawalpindi, Pakistan');
    expect(result.confidence).toBe('CONFIRMED');
  });

  it('Chakswari resolving to New Mirpur City is NEEDS_CLARIFICATION — the exact live failure this guard exists for', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Chakswari, Mirpur, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
    expect(result.formattedAddress).toBe('New Mirpur City');
  });

  it('a misspelling Google itself auto-corrects ("Mirpore" -> "Mirpur") still returns NEEDS_CLARIFICATION — known, deliberate, safe-direction founder-beta limitation, not a bug to silently fix', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Mirpore, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
  });
});

describe('venue/POI destination confirmation — live evidence: real hotels/venues (Pearl Continental, Royal Palm, Badshahi Mosque) were all wrongly rejected by the locality guard', () => {
  const venueResult = (overrides: Record<string, unknown> = {}) => ({
    status: 'OK',
    results: [{
      formatted_address: '52 Canal Rd, Mughalpura, Lahore, 54840, Pakistan',
      place_id: 'venue-place-id-123',
      types: ['establishment', 'food', 'point_of_interest'],
      geometry: { location_type: 'ROOFTOP' },
      address_components: [
        { long_name: 'Mughalpura', short_name: 'Mughalpura', types: ['political', 'sublocality', 'sublocality_level_1'] },
        { long_name: 'Lahore', short_name: 'Lahore', types: ['locality', 'political'] },
        { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
      ],
      ...overrides,
    }],
  });

  it('a real venue (establishment/point_of_interest type) reaches NEEDS_CONFIRMATION, not an automatic CONFIRMED or a locality-style rejection', async () => {
    mockGeocode(venueResult());
    const result = await geocodeDestination('test-key', 'Royal Palm Golf and Country Club');
    expect(result.confidence).toBe('NEEDS_CONFIRMATION');
    expect(result.formattedAddress).toBe('52 Canal Rd, Mughalpura, Lahore, 54840, Pakistan');
    expect(result.placeId).toBe('venue-place-id-123');
  });

  it('confirmation does not happen automatically — the first computePakistanJourney call for a venue stops at DESTINATION_NEEDS_CONFIRMATION with no route/deadline', async () => {
    mockGeocode(venueResult());
    const result = await computePakistanJourney('test-key', {
      airportCode: 'LHE',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Royal Palm Golf and Country Club',
      pickupMode: 'family',
      deadline: '2026-11-17T17:00',
    });
    expect(result.outcome).toBe('DESTINATION_NEEDS_CONFIRMATION');
    expect(result.destinationConfidence).toBe('NEEDS_CONFIRMATION');
    expect(result.pendingConfirmation).toEqual({ placeId: 'venue-place-id-123', formattedAddress: '52 Canal Rd, Mughalpura, Lahore, 54840, Pakistan' });
    expect(result.expectedArrival).toBeUndefined();
    expect(result.deadline).toBeUndefined();
    expect(result.marginMinutes).toBeUndefined();
  });

  it('a matching confirmedPlaceId, re-verified live against Google, permits the route to be calculated', async () => {
    let routesCalls = 0;
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
        return new Response(JSON.stringify(venueResult()), { status: 200 });
      }
      routesCalls += 1;
      return new Response(JSON.stringify({ routes: [{ duration: '1800s', distanceMeters: 20000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'LHE',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Royal Palm Golf and Country Club',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
      confirmedPlaceId: 'venue-place-id-123',
    });
    expect(result.outcome).toBe('ETA_ONLY');
    expect(result.destinationConfidence).toBe('CONFIRMED');
    expect(routesCalls).toBe(1);
  });

  it('a confirmedPlaceId that no longer matches what Google resolves is NOT trusted blindly — confirmation cannot override a changed/different result', async () => {
    mockGeocode(venueResult({ place_id: 'a-completely-different-place-id' }));
    const result = await computePakistanJourney('test-key', {
      airportCode: 'LHE',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Royal Palm Golf and Country Club',
      pickupMode: 'family',
      confirmedPlaceId: 'venue-place-id-123',
    });
    expect(result.outcome).toBe('DESTINATION_NEEDS_CONFIRMATION');
    expect(result.destinationConfidence).toBe('NEEDS_CONFIRMATION');
  });

  it('an unresolved venue still fails closed — no placeId exists to confirm', async () => {
    mockGeocode({ status: 'ZERO_RESULTS', results: [] });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'LHE',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Some Hotel That Does Not Exist',
      pickupMode: 'family',
    });
    expect(result.outcome).toBe('ROUTE_UNAVAILABLE');
    expect(result.pendingConfirmation).toBeUndefined();
  });

  it('a venue result outside Pakistan cannot be confirmed even with a claimed matching placeId — wrong country blocks it before confirmation is ever offered', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Some Hotel, London, United Kingdom',
        place_id: 'uk-place-id',
        types: ['establishment', 'lodging', 'point_of_interest'],
        geometry: { location_type: 'ROOFTOP' },
        address_components: [
          { long_name: 'London', short_name: 'London', types: ['locality', 'political'] },
          { long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'LHE',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Some Hotel',
      pickupMode: 'family',
      confirmedPlaceId: 'uk-place-id',
    });
    expect(result.outcome).toBe('DESTINATION_NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('WRONG_COUNTRY');
    expect(result.destinationConfidence).not.toBe('CONFIRMED');
  });

  it('locality/village behaviour is unchanged: Chakswari -> New Mirpur City still blocks (not a venue type)', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Chakswari, Mirpur, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
  });

  it('locality/village behaviour is unchanged: Islamgarh -> New Mirpur City still blocks (second independent live wrong-place case)', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Islamgarh, Mirpur, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
  });

  it('a real founder failure: a single, correctly-resolved venue with partial_match=true (Nishat Hotel, Johar Town, beside Emporium Mall) still reaches NEEDS_CONFIRMATION, not a "be more specific" dead end', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Main Abdul Haque Rd, adjacent to Emporium Mall, Trade Centre Commercial Area Phase 2 Johar Town, Lahore, 54600, Pakistan',
        place_id: 'ChIJ4_tdLSsCGTkRl6Zkdabbv4c',
        types: ['establishment', 'food', 'lodging', 'point_of_interest', 'restaurant'],
        partial_match: true,
        geometry: { location_type: 'ROOFTOP' },
        address_components: [
          { long_name: 'Johar Town', short_name: 'Johar Town', types: ['political', 'sublocality', 'sublocality_level_1'] },
          { long_name: 'Lahore', short_name: 'Lahore', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Nishat Hotel Johar Town Lahore');
    expect(result.confidence).toBe('NEEDS_CONFIRMATION');
    expect(result.clarificationReason).toBeUndefined();
    expect(result.placeId).toBe('ChIJ4_tdLSsCGTkRl6Zkdabbv4c');
  });

  it('confirming that same partial_match venue result permits the route to be calculated (end-to-end, mirrors the real founder journey)', async () => {
    const nishatResult = {
      status: 'OK',
      results: [{
        formatted_address: 'Main Abdul Haque Rd, adjacent to Emporium Mall, Trade Centre Commercial Area Phase 2 Johar Town, Lahore, 54600, Pakistan',
        place_id: 'ChIJ4_tdLSsCGTkRl6Zkdabbv4c',
        types: ['establishment', 'food', 'lodging', 'point_of_interest', 'restaurant'],
        partial_match: true,
        geometry: { location_type: 'ROOFTOP' },
        address_components: [
          { long_name: 'Johar Town', short_name: 'Johar Town', types: ['political', 'sublocality', 'sublocality_level_1'] },
          { long_name: 'Lahore', short_name: 'Lahore', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    };
    let routesCalls = 0;
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) return new Response(JSON.stringify(nishatResult), { status: 200 });
      routesCalls += 1;
      return new Response(JSON.stringify({ routes: [{ duration: '6540s', distanceMeters: 12000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'LHE',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Nishat Hotel Johar Town Lahore',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
      deadline: '2026-11-17T17:00',
      confirmedPlaceId: 'ChIJ4_tdLSsCGTkRl6Zkdabbv4c',
    });
    expect(result.outcome).not.toBe('DESTINATION_NEEDS_CONFIRMATION');
    expect(result.destinationConfidence).toBe('CONFIRMED');
    expect(result.expectedArrival).toBeDefined();
    expect(routesCalls).toBe(1);
  });

  it('a real, correctly-resolved venue with partial_match=true does NOT bypass the wrong-country guard', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Some Hotel, London, United Kingdom',
        place_id: 'uk-partial-place-id',
        types: ['establishment', 'lodging', 'point_of_interest'],
        partial_match: true,
        geometry: { location_type: 'ROOFTOP' },
        address_components: [
          { long_name: 'London', short_name: 'London', types: ['locality', 'political'] },
          { long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Some Hotel London');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('WRONG_COUNTRY');
  });

  it('two genuinely different real venues sharing a similar name ("Nishat Hotel" — Johar Town vs a separate hotel in Gulberg III) now return NEEDS_SELECTION with both real candidates — superseded by the multi-POI selection fix (was MULTIPLE_CANDIDATES, a dead end; a genuine choice is now offered instead of automatically picking one)', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        {
          formatted_address: 'Main Abdul Haque Rd, adjacent to Emporium Mall, Trade Centre Commercial Area Phase 2 Johar Town, Lahore, 54600, Pakistan',
          place_id: 'ChIJ4_tdLSsCGTkRl6Zkdabbv4c',
          types: ['establishment', 'food', 'lodging', 'point_of_interest', 'restaurant'],
          partial_match: true,
          geometry: { location_type: 'ROOFTOP' },
        },
        {
          formatted_address: '9-A Mian Mehmood Ali Kasoori Rd, Block A3 Block A 3 Gulberg III, Lahore, 54660, Pakistan',
          place_id: 'ChIJ-aN4wE0EGTkRX5t87J08fgo',
          types: ['establishment', 'food', 'lodging', 'point_of_interest', 'restaurant'],
          partial_match: true,
          geometry: { location_type: 'ROOFTOP' },
        },
      ],
    });
    const result = await geocodeDestination('test-key', 'Nishat Hotel Lahore');
    expect(result.confidence).toBe('NEEDS_SELECTION');
    expect(result.candidates?.length).toBe(2);
  });

  it('a confirm-time re-check that now returns PARTIAL_MATCH (locality, not venue) is not overridden by a stale confirmedPlaceId', async () => {
    mockGeocode({
      status: 'OK',
      results: [{ formatted_address: 'Somewhere else entirely', partial_match: true, types: ['locality'], geometry: { location_type: 'APPROXIMATE' } }],
    });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'a vague place',
      pickupMode: 'family',
      confirmedPlaceId: 'some-place-id',
    });
    expect(result.destinationConfidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PARTIAL_MATCH');
  });

  it('a confirm-time re-check that now returns MULTIPLE_CANDIDATES is not overridden by a stale confirmedPlaceId, even if it matches the top candidate', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        { formatted_address: 'Candidate A', place_id: 'candidate-a-id', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Candidate B', place_id: 'candidate-b-id', types: ['locality'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'ambiguous name',
      pickupMode: 'family',
      confirmedPlaceId: 'candidate-a-id',
    });
    expect(result.destinationConfidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('MULTIPLE_CANDIDATES');
  });
});

describe('multiple-POI selection — live evidence: "Aga Khan University Hospital Karachi" returns the real hospital POI plus a same-named sublocality polygon, not two competing hospitals', () => {
  it('a real POI plus a same-named non-venue polygon (Aga Khan Hospital + its own sublocality) is NOT ambiguous once filtered to genuine venues — classifies as the single venue, not NEEDS_SELECTION', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        {
          formatted_address: 'National Stadium Rd, Dawood Society Dawood CHS, Karachi, 74800, Pakistan',
          place_id: 'agakhan-hospital-poi',
          types: ['establishment', 'health', 'hospital', 'point_of_interest'],
          geometry: { location_type: 'GEOMETRIC_CENTER' },
          address_components: [{ long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
        },
        {
          formatted_address: 'Aga Khan University Hospital, Karachi, Pakistan',
          place_id: 'agakhan-sublocality-area',
          types: ['political', 'sublocality', 'sublocality_level_1'],
          geometry: { location_type: 'APPROXIMATE' },
          address_components: [{ long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
        },
      ],
    });
    const result = await geocodeDestination('test-key', 'Aga Khan University Hospital Karachi');
    expect(result.confidence).toBe('NEEDS_CONFIRMATION');
    expect(result.placeId).toBe('agakhan-hospital-poi');
    expect(result.candidates).toBeUndefined();
  });

  it('two genuinely different real venue POIs return NEEDS_SELECTION with only safe display fields', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        {
          formatted_address: 'Venue A, Karachi, Pakistan',
          place_id: 'venue-a-id',
          types: ['establishment', 'point_of_interest', 'hospital'],
          geometry: { location_type: 'ROOFTOP' },
        },
        {
          formatted_address: 'Venue B, Karachi, Pakistan',
          place_id: 'venue-b-id',
          types: ['establishment', 'point_of_interest', 'hospital'],
          geometry: { location_type: 'ROOFTOP' },
        },
      ],
    });
    const result = await geocodeDestination('test-key', 'Ambiguous Hospital Name Karachi');
    expect(result.confidence).toBe('NEEDS_SELECTION');
    expect(result.candidates).toEqual([
      { placeId: 'venue-a-id', formattedAddress: 'Venue A, Karachi, Pakistan' },
      { placeId: 'venue-b-id', formattedAddress: 'Venue B, Karachi, Pakistan' },
    ]);
    // Only safe display fields are exposed — no raw Google payload (no types/geometry/etc. on the candidate objects).
    expect(Object.keys(result.candidates![0])).toEqual(['placeId', 'formattedAddress']);
  });

  it('no venue-typed candidates at all (locality/village duplicate representations, e.g. Sujawal) falls back to the original MULTIPLE_CANDIDATES behaviour — the POI selector must not apply here', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        { formatted_address: 'Sujawal, Pakistan', place_id: 'sujawal-locality', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Sujawal, Pakistan', place_id: 'sujawal-admin3', types: ['administrative_area_level_3', 'political'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await geocodeDestination('test-key', 'Sujawal, Sindh, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('MULTIPLE_CANDIDATES');
    expect(result.candidates).toBeUndefined();
  });

  it('no Routes call is made while a NEEDS_SELECTION result is pending', async () => {
    let routesCalls = 0;
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
        return new Response(JSON.stringify({
          status: 'OK',
          results: [
            { formatted_address: 'Venue A, Karachi, Pakistan', place_id: 'venue-a-id', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' } },
            { formatted_address: 'Venue B, Karachi, Pakistan', place_id: 'venue-b-id', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' } },
          ],
        }), { status: 200 });
      }
      routesCalls += 1;
      return new Response(JSON.stringify({ routes: [{ duration: '3600s', distanceMeters: 90000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'KHI', landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60,
      destination: 'Ambiguous Hospital Name Karachi', pickupMode: 'family', deadline: '2026-11-17T17:00',
    });
    expect(result.outcome).toBe('DESTINATION_NEEDS_SELECTION');
    expect(result.pendingSelection?.candidates.length).toBe(2);
    expect(routesCalls).toBe(0);
    expect(result.expectedArrival).toBeUndefined();
    expect(result.marginMinutes).toBeUndefined();
  });

  it('selecting a valid candidate (re-verified server-side) permits the route to be calculated', async () => {
    let routesCalls = 0;
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
        return new Response(JSON.stringify({
          status: 'OK',
          results: [
            { formatted_address: 'Venue A, Karachi, Pakistan', place_id: 'venue-a-id', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' } },
            { formatted_address: 'Venue B, Karachi, Pakistan', place_id: 'venue-b-id', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' } },
          ],
        }), { status: 200 });
      }
      routesCalls += 1;
      return new Response(JSON.stringify({ routes: [{ duration: '3600s', distanceMeters: 90000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'KHI', landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60,
      destination: 'Ambiguous Hospital Name Karachi', pickupMode: 'family', pickupWaitMinutes: 0,
      selectedPlaceId: 'venue-b-id',
    });
    expect(result.destinationConfidence).toBe('CONFIRMED');
    expect(result.resolvedDestination).toBe('Venue B, Karachi, Pakistan');
    expect(routesCalls).toBe(1);
    expect(result.expectedArrival).toBeDefined();
  });

  it('a forged/stale/no-longer-offered selectedPlaceId is NOT trusted — falls back to the real NEEDS_SELECTION state instead of routing', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        { formatted_address: 'Venue A, Karachi, Pakistan', place_id: 'venue-a-id', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' } },
        { formatted_address: 'Venue B, Karachi, Pakistan', place_id: 'venue-b-id', types: ['establishment', 'point_of_interest'], geometry: { location_type: 'ROOFTOP' } },
      ],
    });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'KHI', landingAt: '2026-11-17T12:00', airportExitBufferMinutes: 60,
      destination: 'Ambiguous Hospital Name Karachi', pickupMode: 'family',
      selectedPlaceId: 'forged-place-id-not-in-candidate-list',
    });
    expect(result.destinationConfidence).toBe('NEEDS_SELECTION');
    expect(result.outcome).toBe('DESTINATION_NEEDS_SELECTION');
  });

  it('an explicit wrong-country single venue candidate is rejected, not offered for selection or confirmation', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Some Hospital, London, United Kingdom',
        place_id: 'uk-hospital-id',
        types: ['establishment', 'health', 'hospital', 'point_of_interest'],
        geometry: { location_type: 'ROOFTOP' },
        address_components: [
          { long_name: 'London', short_name: 'London', types: ['locality', 'political'] },
          { long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Some Hospital London');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('WRONG_COUNTRY');
  });

  it('a partial-match venue candidate found among multiple raw results can still be confirmed safely (same rule as the single-result case)', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        {
          formatted_address: 'The Real Venue, Karachi, Pakistan',
          place_id: 'real-venue-id',
          partial_match: true,
          types: ['establishment', 'point_of_interest'],
          geometry: { location_type: 'ROOFTOP' },
          address_components: [{ long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
        },
        {
          formatted_address: 'Somewhere Unrelated, Karachi, Pakistan',
          place_id: 'unrelated-locality-id',
          types: ['locality', 'political'],
          geometry: { location_type: 'APPROXIMATE' },
        },
      ],
    });
    const result = await geocodeDestination('test-key', 'The Real Venue Karachi');
    expect(result.confidence).toBe('NEEDS_CONFIRMATION');
    expect(result.placeId).toBe('real-venue-id');
  });

  it('locality multiple-candidate ambiguity remains unchanged for genuinely different villages/towns', async () => {
    mockGeocode({
      status: 'OK',
      results: [
        { formatted_address: 'Candidate Town A, Pakistan', place_id: 'town-a', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
        { formatted_address: 'Candidate Town B, Pakistan', place_id: 'town-b', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE' } },
      ],
    });
    const result = await geocodeDestination('test-key', 'ambiguous town name');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('MULTIPLE_CANDIDATES');
  });

  it('Chakswari remains blocked — unaffected by the POI-selection change (not a multi-candidate case at all)', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'New Mirpur City',
        types: ['locality', 'political'],
        geometry: { location_type: 'APPROXIMATE' },
        address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
      }],
    });
    const result = await geocodeDestination('test-key', 'Chakswari, Mirpur, Azad Kashmir, Pakistan');
    expect(result.confidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
  });

  it('the single-venue confirmation flow (Nishat Hotel Johar Town) remains unaffected by the multi-candidate refactor', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Main Abdul Haque Rd, adjacent to Emporium Mall, Johar Town, Lahore, Pakistan',
        place_id: 'nishat-johar-town',
        partial_match: true,
        types: ['establishment', 'food', 'lodging', 'point_of_interest', 'restaurant'],
        geometry: { location_type: 'ROOFTOP' },
        address_components: [{ long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
      }],
    });
    const result = await geocodeDestination('test-key', 'Nishat Hotel Johar Town Lahore');
    expect(result.confidence).toBe('NEEDS_CONFIRMATION');
    expect(result.placeId).toBe('nishat-johar-town');
  });

  it('no destination, candidate, or place_id is logged or persisted anywhere', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    for (const file of ['lib/arrive-by-pakistan/google-routes.ts', 'lib/arrive-by-pakistan/journey.ts', 'app/api/founder/arrive-by-pakistan/google/route.ts']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/console\.(log|error|warn|info)\(/);
      expect(src, file).not.toMatch(/brevo|prisma|supabase|\.insert\(|\.save\(/i);
    }
  });
});

describe('drive route computation', () => {
  it('returns AVAILABLE with parsed duration/distance on a normal response', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ routes: [{ duration: '5400s', distanceMeters: 120000 }] }), { status: 200 })) as unknown as typeof fetch;
    const result = await computeDriveRoute('test-key', 'Islamabad International Airport, Pakistan', 'Mirpur, AJK, Pakistan', '2026-11-17T07:00:00.000Z');
    expect(result.status).toBe('AVAILABLE');
    expect(result.durationSeconds).toBe(5400);
    expect(result.distanceMeters).toBe(120000);
  });

  it('fails closed to UNAVAILABLE on a malformed response rather than inventing a duration', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ routes: [] }), { status: 200 })) as unknown as typeof fetch;
    const result = await computeDriveRoute('test-key', 'origin', 'destination', '2026-11-17T07:00:00.000Z');
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.durationSeconds).toBeUndefined();
  });

  it('fails closed to UNAVAILABLE on a network error, never throwing', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    const result = await computeDriveRoute('test-key', 'origin', 'destination', '2026-11-17T07:00:00.000Z');
    expect(result.status).toBe('UNAVAILABLE');
  });
});

describe('full journey calculation', () => {
  beforeEach(() => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur, AJK, Pakistan', place_id: 'abc', types: ['locality'], geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }, { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
      }],
    });
  });

  it('returns an ETA-only outcome with no deadline supplied', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
    });
    expect(result.outcome).toBe('ETA_ONLY');
    expect(result.expectedArrival).toBeDefined();
    expect(result.marginMinutes).toBeUndefined();
    expect(result.deadline).toBeUndefined();
  });

  it('computes readyOutsideAirport and roadDeparture from landing time, exit buffer and pickup wait, in Pakistan time', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'arrange-after-landing',
      pickupWaitMinutes: 20,
    });
    expect(result.readyOutsideAirport).toBe('2026-11-17T08:00:00.000Z'); // 12:00 + 60min landing, minus 5h PKT offset = 07:00Z; +60min = 08:00Z
    expect(result.roadDeparture).toBe('2026-11-17T08:20:00.000Z');
  });

  it('produces a deadline judgement with margin when a deadline is supplied', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
      deadline: '2026-11-17T17:00',
      destinationReadinessBufferMinutes: 30,
    });
    // ready 13:00 -> drive 3600s (1h, from the shared mock) -> expected arrival 14:00
    // latest acceptable = 17:00 - 30min = 16:30 -> margin = 150 minutes
    expect(result.outcome).toBe('BEFORE_DEADLINE');
    expect(result.marginMinutes).toBe(150);
  });

  it('does not issue a deadline verdict when the destination needs clarification — fails closed instead', async () => {
    mockGeocode({ status: 'OK', results: [{ formatted_address: 'Pakistan', types: ['country'], geometry: { location_type: 'APPROXIMATE' } }] });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'somewhere vague',
      pickupMode: 'family',
      deadline: '2026-11-17T17:00',
    });
    expect(result.outcome).toBe('DESTINATION_NEEDS_CLARIFICATION');
    expect(result.expectedArrival).toBeUndefined();
    expect(result.marginMinutes).toBeUndefined();
  });

  it('fails closed to ROUTE_UNAVAILABLE when Google cannot geocode the destination at all', async () => {
    mockGeocode({ status: 'ZERO_RESULTS', results: [] });
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'gibberish',
      pickupMode: 'family',
    });
    expect(result.outcome).toBe('ROUTE_UNAVAILABLE');
  });

  it('carries Google\'s resolved destination through to the result for CONFIRMED cases', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
    });
    expect(result.resolvedDestination).toBe('Mirpur, AJK, Pakistan');
  });

  it('a primary-place mismatch (Chakswari -> New Mirpur City) fails closed: NEEDS_CLARIFICATION, no Routes call, no deadline verdict', async () => {
    let routesCalls = 0;
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
        return new Response(JSON.stringify({
          status: 'OK',
          results: [{
            formatted_address: 'New Mirpur City',
            types: ['locality', 'political'],
            geometry: { location_type: 'APPROXIMATE' },
            address_components: [
          { long_name: 'New Mirpur City', short_name: 'New Mirpur City', types: ['locality', 'political'] },
          { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] },
        ],
          }],
        }), { status: 200 });
      }
      routesCalls += 1;
      return new Response(JSON.stringify({ routes: [{ duration: '3600s', distanceMeters: 90000 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Chakswari, Mirpur, Azad Kashmir, Pakistan',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
      deadline: '2026-11-17T17:00',
      destinationReadinessBufferMinutes: 30,
    });

    expect(result.outcome).toBe('DESTINATION_NEEDS_CLARIFICATION');
    expect(result.destinationConfidence).toBe('NEEDS_CLARIFICATION');
    expect(result.clarificationReason).toBe('PRIMARY_PLACE_MISMATCH');
    expect(result.resolvedDestination).toBe('New Mirpur City');
    // Both halves of the transparency requirement: what the traveller typed
    // is preserved verbatim, alongside what Google actually resolved.
    expect(result.destination).toBe('Chakswari, Mirpur, Azad Kashmir, Pakistan');
    expect(routesCalls).toBe(0); // computeDriveRoute must never be reached
    expect(result.expectedArrival).toBeUndefined();
    expect(result.deadline).toBeUndefined();
    expect(result.marginMinutes).toBeUndefined();
  });

  it('echoes the deadline reason back for display but never derives calculations from it', async () => {
    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      deadline: '2026-11-17T17:00',
      deadlineReason: 'wedding starts',
    });
    expect(result.deadlineReason).toBe('wedding starts');
  });
});

describe('privacy — no destination or free-text reason is logged anywhere in the API/library code', () => {
  it('the API route and library modules never call console.log/console.error with the destination or reason', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const files = [
      'app/api/founder/arrive-by-pakistan/google/route.ts',
      'lib/arrive-by-pakistan/journey.ts',
      'lib/arrive-by-pakistan/google-routes.ts',
      'lib/arrive-by-pakistan/destination-identity.ts',
      'lib/arrive-by-pakistan/format.ts',
    ];
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/console\.(log|error|warn|info)\(/);
    }
  });

  it('no file writes to a database, KV store, or persists the journey anywhere', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    for (const file of ['lib/arrive-by-pakistan/journey.ts', 'app/api/founder/arrive-by-pakistan/google/route.ts']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src, file).not.toMatch(/brevo|prisma|supabase|\.insert\(|\.save\(/i);
    }
  });
});

describe('founder-beta finishing pass', () => {
  it('the outcome vocabulary has exactly seven reachable members — no dead GOOGLE_UNAVAILABLE state', () => {
    const reachable = new Set<string>();
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: false }));
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: 45 }));
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: 10 }));
    reachable.add(classifyOutcome({ destinationConfidence: 'CONFIRMED', routeAvailable: true, hasDeadline: true, marginMinutes: -5 }));
    reachable.add(classifyOutcome({ destinationConfidence: 'NEEDS_CONFIRMATION', routeAvailable: false, hasDeadline: false }));
    reachable.add(classifyOutcome({ destinationConfidence: 'NEEDS_CLARIFICATION', routeAvailable: true, hasDeadline: false }));
    reachable.add(classifyOutcome({ destinationConfidence: 'UNRESOLVED', routeAvailable: false, hasDeadline: false }));
    expect(reachable).toEqual(new Set(['ETA_ONLY', 'BEFORE_DEADLINE', 'TIGHT_MARGIN', 'AFTER_DEADLINE', 'DESTINATION_NEEDS_CONFIRMATION', 'DESTINATION_NEEDS_CLARIFICATION', 'ROUTE_UNAVAILABLE']));
    expect(reachable.has('GOOGLE_UNAVAILABLE' as never)).toBe(false);
  });

  it('the constant name makes the tight-margin threshold\'s provisional status explicit', () => {
    expect(PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES).toBe(20);
  });

  it('the founder page clearly labels itself as a founder beta with a scope note', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx'), 'utf8');
    expect(src).toMatch(/Founder Beta/);
    expect(src).toMatch(/ISB/);
    expect(src).toMatch(/LHE/);
    expect(src).toMatch(/KHI/);
    expect(src).toMatch(/estimate, not a guarantee/i);
  });

  it('the founder page shows a known-limitations note', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx'), 'utf8');
    expect(src).toMatch(/Known limitations/i);
    expect(src).toMatch(/taxi/i);
    expect(src).toMatch(/flight tracking/i);
  });

  it('the founder page shows the assumptions used (landing time, exit buffer, pickup, road departure)', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(process.cwd(), 'components', 'founder', 'arrive-by-pakistan.tsx'), 'utf8');
    expect(src).toMatch(/Landing time/);
    expect(src).toMatch(/Airport-exit buffer/);
    expect(src).toMatch(/Ready outside airport/);
    expect(src).toMatch(/Road departure/);
  });
});

describe('ETA presentation / traffic context — founder feedback: "15:04" reads as falsely precise for a traffic-dependent estimate', () => {
  it('roundClockToNearestFive rounds to the nearest 5-minute mark', () => {
    expect(roundClockToNearestFive('2026-11-17T10:04:00.000Z', 'UTC')).toBe('10:05');
    expect(roundClockToNearestFive('2026-11-17T10:02:00.000Z', 'UTC')).toBe('10:00');
    expect(roundClockToNearestFive('2026-11-17T10:00:00.000Z', 'UTC')).toBe('10:00');
    expect(roundClockToNearestFive('2026-11-17T10:07:00.000Z', 'UTC')).toBe('10:05'); // minute 7 is closer to 5 than to 10
  });

  it('rounding wraps correctly across the hour and across midnight', () => {
    expect(roundClockToNearestFive('2026-11-17T10:58:00.000Z', 'UTC')).toBe('11:00');
    expect(roundClockToNearestFive('2026-11-17T23:58:00.000Z', 'UTC')).toBe('00:00');
  });

  it('formatMinutesHuman produces compact human duration text', () => {
    expect(formatMinutesHuman(0)).toBe('0 min');
    expect(formatMinutesHuman(35)).toBe('35 min');
    expect(formatMinutesHuman(60)).toBe('1 hr');
    expect(formatMinutesHuman(109)).toBe('1 hr 49 min');
    expect(formatMinutesHuman(198)).toBe('3 hr 18 min');
  });

  it('formatMinutesHuman treats negative minutes (a shortfall) the same as their positive magnitude — sign is the caller\'s job to label', () => {
    expect(formatMinutesHuman(-15)).toBe('15 min');
  });

  it('formatSecondsHuman converts whole seconds to the same human duration text', () => {
    expect(formatSecondsHuman(6540)).toBe('1 hr 49 min');
  });

  it('trafficContextSentence is omitted entirely when Google did not return staticDuration — never invents a comparison it cannot support', () => {
    expect(trafficContextSentence(6599, undefined)).toBeUndefined();
  });

  it('trafficContextSentence states a factual minute figure only when the gap is meaningful (>= 2 min)', () => {
    expect(trafficContextSentence(7740, 6540)).toBe('Current traffic is adding about 20 minutes.'); // (7740-6540)/60 = 20
  });

  it('trafficContextSentence uses the honest "little extra time" phrasing for a small or zero gap — the real ISB->Abbottabad case (6599s vs 6568s, ~31s difference)', () => {
    expect(trafficContextSentence(6599, 6568)).toBe('Traffic is currently adding little extra time.');
  });

  it('never invents a light/normal/heavy traffic label anywhere in the traffic-context or outcome copy', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const formatSrc = readFileSync(join(process.cwd(), 'lib', 'arrive-by-pakistan', 'format.ts'), 'utf8');
    const outcomesSrc = readFileSync(join(process.cwd(), 'lib', 'arrive-by-pakistan', 'outcomes.ts'), 'utf8');
    for (const src of [formatSrc, outcomesSrc]) {
      expect(src).not.toMatch(/'light'|'heavy'|'normal traffic'/i);
    }
  });

  it('a CONFIRMED journey carries Google\'s staticDurationSeconds through to the result when Google returned it', async () => {
    mockGeocode({
      status: 'OK',
      results: [{
        formatted_address: 'Mirpur, AJK, Pakistan', place_id: 'abc', types: ['locality'], geometry: { location_type: 'APPROXIMATE' },
        address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }, { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
      }],
    });
    global.fetch = vi.fn(async (url: string | URL) => {
      if (String(url).includes('maps.googleapis.com/maps/api/geocode')) {
        return new Response(JSON.stringify({
          status: 'OK',
          results: [{
            formatted_address: 'Mirpur, AJK, Pakistan', place_id: 'abc', types: ['locality'], geometry: { location_type: 'APPROXIMATE' },
            address_components: [{ long_name: 'Mirpur', short_name: 'Mirpur', types: ['locality', 'political'] }, { long_name: 'Pakistan', short_name: 'PK', types: ['country', 'political'] }],
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ routes: [{ duration: '6599s', staticDuration: '6568s', distanceMeters: 121206 }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await computePakistanJourney('test-key', {
      airportCode: 'ISB',
      landingAt: '2026-11-17T12:00',
      airportExitBufferMinutes: 60,
      destination: 'Mirpur',
      pickupMode: 'family',
      pickupWaitMinutes: 0,
    });
    expect(result.driveDurationSeconds).toBe(6599);
    expect(result.staticDurationSeconds).toBe(6568);
  });
});
