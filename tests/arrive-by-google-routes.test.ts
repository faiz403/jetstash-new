import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/founder/arrive-by/google/route';
import { topLevelOutcome, topLevelVerdict } from '@/components/founder/arrive-by-google';
import {
  buildGooglePrototypeResult,
  effectiveLatestArrival,
  googleDriveRequest,
  googleRoutesRequest,
  normaliseGoogleItinerary,
  type GooglePrototypeInput,
  type GoogleRoutesResponse,
} from '@/lib/arrive-by/google-routes';

const transit = (
  departureStop: string,
  departureTime: string,
  arrivalStop: string,
  arrivalTime: string,
  lineName: string,
  lineShortName: string,
  vehicleType: string,
) => ({
  travelMode: 'TRANSIT',
  transitDetails: {
    stopDetails: {
      departureStop: { name: departureStop }, departureTime,
      arrivalStop: { name: arrivalStop }, arrivalTime,
    },
    transitLine: { name: lineName, nameShort: lineShortName, agencies: [{ name: lineShortName }], vehicle: { type: vehicleType } },
    headsign: arrivalStop,
    stopCount: 2,
  },
});

const walk = (seconds: number, distanceMeters: number) => ({
  travelMode: 'WALK', staticDuration: `${seconds}s`, distanceMeters,
});

const primaryResponse: GoogleRoutesResponse = {
  routes: [{
    duration: '7824s', distanceMeters: 91300,
    legs: [{ steps: [
      walk(0, 0), walk(519, 605), walk(23, 14), walk(29, 28), walk(58, 57),
      transit('Manchester Airport', '2026-09-25T11:17:00Z', 'Manchester Piccadilly', '2026-09-25T11:31:00Z', 'Blackpool North - Manchester Airport', 'Northern', 'HEAVY_RAIL'),
      walk(0, 0),
      transit('Manchester Piccadilly', '2026-09-25T11:43:00Z', 'Sheffield', '2026-09-25T12:33:00Z', 'Norwich - Liverpool Lime Street', 'EMR', 'HEAVY_RAIL'),
      walk(67, 66), walk(87, 94), walk(57, 51), walk(34, 38),
      transit('Paternoster Row/SS2', '2026-09-25T12:48:00Z', 'Brocco Bank/Endcliffe Terrace Road', '2026-09-25T13:15:42Z', 'Millhouses - Sheffield Centre', '6', 'BUS'),
      walk(72, 81),
    ] }],
  }],
};

const fallbackResponse: GoogleRoutesResponse = {
  routes: [{
    duration: '7865s', distanceMeters: 89400,
    legs: [{ steps: [
      walk(0, 0), walk(519, 605), walk(23, 14), walk(29, 28), walk(58, 57),
      transit('Manchester Airport', '2026-09-25T11:48:00Z', 'Manchester Piccadilly', '2026-09-25T12:01:00Z', 'Blackpool North - Manchester Airport', 'Northern', 'HEAVY_RAIL'),
      transit('Manchester Piccadilly', '2026-09-25T12:13:00Z', 'Sheffield', '2026-09-25T13:09:00Z', 'Cleethorpes - Liverpool Lime Street', 'TransPennine Express', 'HEAVY_RAIL'),
      walk(0, 0),
      transit('Pond Street FS4', '2026-09-25T13:23:27Z', 'Glossop Road/Newbould Lane', '2026-09-25T13:41:59Z', 'Fulwood - Halfway', '120', 'BUS'),
      walk(56, 56), walk(141, 191), walk(200, 225),
    ] }],
  }],
};

const input: GooglePrototypeInput = {
  originId: 'man-terminal-2',
  availableAt: '2026-09-25T12:00',
  destination: 'Sheffield Botanical Gardens, Clarkehouse Road, Sheffield S10 2LN',
  deadline: '2026-09-25T14:30',
  deadlineReason: 'Family event starts',
};

describe('Google Routes normalisation', () => {
  it('retains the actual walk, rail and local-bus chain while combining fragmented walks', () => {
    const itinerary = normaliseGoogleItinerary(primaryResponse);
    expect(itinerary.firstImportantService).toMatchObject({ lineShortName: 'Northern', departureStop: 'Manchester Airport' });
    expect(itinerary.legs.map((leg) => leg.kind)).toEqual(['walk', 'transit', 'transit', 'walk', 'transit', 'walk']);
    expect(itinerary.legs.filter((leg) => leg.kind === 'transit')).toHaveLength(3);
    expect(itinerary.legs[0]).toMatchObject({ kind: 'walk', durationSeconds: 629, distanceMeters: 704 });
  });

  it('drops meaningless zero-duration walk noise instead of presenting a fake leg', () => {
    const itinerary = normaliseGoogleItinerary(primaryResponse);
    expect(itinerary.legs.filter((leg) => leg.kind === 'walk' && leg.durationSeconds === 0 && leg.distanceMeters === 0)).toEqual([]);
  });

  it('fails clearly when Google returns no route instead of inventing a journey', () => {
    expect(() => normaliseGoogleItinerary({ routes: [] })).toThrow('Google did not return a journey');
  });
});

describe('Google itinerary to unchanged Arrive By engine', () => {
  it('proves the primary journey fits and the missed-service fallback is late', () => {
    const result = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z');
    expect(result.judgement).toMatchObject({ meetsDeadline: true, minutesFromDeadline: 13 });
    expect(result.fallbackJudgement).toMatchObject({ meetsDeadline: false, minutesFromDeadline: 19 });
    expect(result.engine).toMatchObject({
      state: 'YES', selectedService: 'Google primary journey', finalArrival: '2026-09-25T14:17', deadlineMargin: 13,
      fallbackService: 'Google missed-service journey', fallbackArrival: '2026-09-25T14:49', fallbackMeetsDeadline: false,
    });
    expect(result.primary.legs.some((leg) => leg.kind === 'transit' && leg.lineShortName === '6')).toBe(true);
    expect(result.fallback.legs.some((leg) => leg.kind === 'transit' && leg.lineShortName === '120')).toBe(true);
  });

  it('uses the precise Terminal 2 coordinate rather than the broad address that snapped to the station', () => {
    expect(googleRoutesRequest(input, { departureTime: '2026-09-25T11:00:00Z' }).origin).toEqual({
      location: { latLng: { latitude: 53.367664, longitude: -2.280683 } },
    });
  });

  it('keeps blank readiness location-based and does not invent a commitment buffer', () => {
    const result = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z');
    expect(result.readinessMinutes).toBe(0);
    expect(result.effectiveLatestArrival).toBe('2026-09-25T13:30:00.000Z');
    expect(result.judgement.meetsDeadline).toBe(true);
  });

  it('subtracts only the explicitly entered readiness minutes from the commitment time', () => {
    const withReadiness = { ...input, readinessMinutes: 15 };
    expect(effectiveLatestArrival(withReadiness)).toMatchObject({
      commitmentIso: '2026-09-25T13:30:00.000Z', iso: '2026-09-25T13:15:00.000Z', readinessMinutes: 15,
    });
  });

  it('fails when a journey physically reaches the location before commitment but misses ready-by', () => {
    const result = buildGooglePrototypeResult({ ...input, readinessMinutes: 15 }, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z');
    expect(result.judgement).toMatchObject({ meetsDeadline: false, minutesFromDeadline: 2 });
    expect(result.deadline).toBe('2026-09-25T13:30:00.000Z');
    expect(result.effectiveLatestArrival).toBe('2026-09-25T13:15:00.000Z');
  });

  it('does not request or show a car rescue when the missed-service transit fallback still works', () => {
    const result = buildGooglePrototypeResult({ ...input, deadline: '2026-09-25T15:00' }, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z');
    expect(result.fallbackJudgement.meetsDeadline).toBe(true);
    expect(result.carRescue).toBeUndefined();
  });

  it('compares a traffic-aware direct DRIVE rescue with the effective ready-by time', () => {
    const drive: GoogleRoutesResponse = { routes: [{ duration: '3600s', staticDuration: '3300s', distanceMeters: 60500 }] };
    const result = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z', drive);
    expect(result.fallbackJudgement.meetsDeadline).toBe(false);
    expect(result.carRescue).toMatchObject({
      status: 'AVAILABLE', trafficAware: true, meetsReadyBy: true,
      departureTime: '2026-09-25T11:17:00Z', arrivalTime: '2026-09-25T12:17:00.000Z', durationSeconds: 3600,
    });
  });

  it('still requests the car rescue when the physical primary arrival itself misses an entered ready-by allowance', () => {
    const drive: GoogleRoutesResponse = { routes: [{ duration: '3600s', distanceMeters: 60500 }] };
    const result = buildGooglePrototypeResult({ ...input, readinessMinutes: 15 }, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z', drive);
    expect(result.judgement.meetsDeadline).toBe(false);
    expect(result.fallbackJudgement.meetsDeadline).toBe(false);
    expect(result.carRescue).toMatchObject({ status: 'AVAILABLE', trafficAware: true });
  });

  it('reports honestly when the direct DRIVE rescue also misses ready-by', () => {
    const drive: GoogleRoutesResponse = { routes: [{ duration: '12000s', distanceMeters: 60500 }] };
    const result = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z', drive);
    expect(result.carRescue).toMatchObject({ status: 'AVAILABLE', meetsReadyBy: false, minutesFromReadyBy: 67 });
  });

  it('fails closed when Google has no usable DRIVE route', () => {
    const result = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z', { routes: [] });
    expect(result.carRescue).toEqual({ status: 'UNAVAILABLE', trafficAware: true });
  });

  it('asks Google for one traffic-aware direct drive only from the missed-service moment', () => {
    expect(googleDriveRequest(input, '2026-09-25T11:17:00Z')).toMatchObject({
      travelMode: 'DRIVE', departureTime: '2026-09-25T11:17:00Z', routingPreference: 'TRAFFIC_AWARE_OPTIMAL', trafficModel: 'BEST_GUESS', computeAlternativeRoutes: false,
    });
  });
});

describe('server-only API key and clear API failure', () => {
  const previousKey = process.env.GOOGLE_ROUTES_API_KEY;
  afterEach(() => {
    if (previousKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
    else process.env.GOOGLE_ROUTES_API_KEY = previousKey;
  });

  it('returns a clear unavailable response when the server key is absent', async () => {
    delete process.env.GOOGLE_ROUTES_API_KEY;
    const response = await POST(new NextRequest('http://localhost/api/founder/arrive-by/google', {
      method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' },
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Live journey lookup is not configured.' });
  });

  it('keeps the key in the server route and out of the client and tracked environment files', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/founder/arrive-by/google/route.ts'), 'utf8');
    const client = readFileSync(join(process.cwd(), 'components/founder/arrive-by-google.tsx'), 'utf8');
    const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');
    expect(route).toContain('process.env.GOOGLE_ROUTES_API_KEY');
    expect(route).toContain("'X-Goog-Api-Key': apiKey");
    expect(client).not.toMatch(/GOOGLE_ROUTES_API_KEY|X-Goog-Api-Key|AIza/);
    expect(gitignore).toMatch(/^\.env\*/m);
  });
});

describe('ready-by and rescue presentation boundaries', () => {
  const client = readFileSync(join(process.cwd(), 'components/founder/arrive-by-google.tsx'), 'utf8');
  const api = readFileSync(join(process.cwd(), 'app/api/founder/arrive-by/google/route.ts'), 'utf8');

  it('keeps blank readiness wording location-based and names both physical-arrival facts when entered', () => {
    expect(client).toContain('you can reach ${result.destination} by ${deadlineClock}');
    expect(client).toContain('Expected physical arrival');
    expect(client).toContain('need to physically arrive by');
    expect(client).not.toContain('you’ll make the event');
  });

  it('makes the conditional rescue assumption and estimate limits explicit', () => {
    expect(client).toContain('A car/taxi/pick-up could get you there in time based on the driving estimate.');
    expect(client).toContain('Estimated margin: about');
    expect(client).toContain('Estimated shortfall: about');
    expect(client).toContain('It assumes you could leave by car as soon as the missed service departs.');
    expect(client).toContain('It does not include time to find or wait for a taxi, car or pick-up');
    expect(client).toContain('availability is not guaranteed');
    expect(client).toContain('border-ink-200 bg-sand-50');
  });

  it('calls DRIVE only after the returned transit fallback has failed', () => {
    expect(api).toContain('if (preliminary.carRescue)');
    expect(api).toContain('googleDriveRequest(input, primary.firstImportantService.departureTime)');
  });

  it('keeps the positive transit verdict when the primary transit plan succeeds', () => {
    const result = buildGooglePrototypeResult(input, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z');
    expect(topLevelOutcome(result)).toBe('TRANSIT_WORKS');
    expect(topLevelVerdict(result, '14:30')).toBe(`Yes — you can reach ${input.destination} by 14:30`);
  });

  it('uses a qualified car-rescue verdict when transit fails but the existing driving estimate succeeds', () => {
    const drive: GoogleRoutesResponse = { routes: [{ duration: '3600s', distanceMeters: 60500 }] };
    const result = buildGooglePrototypeResult({ ...input, readinessMinutes: 15 }, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z', drive);
    expect(result.judgement.meetsDeadline).toBe(false);
    expect(result.carRescue).toMatchObject({ status: 'AVAILABLE', meetsReadyBy: true });
    expect(topLevelOutcome(result)).toBe('CAR_MAY_WORK');
    expect(topLevelVerdict(result, '14:30')).toBe('Public transport is too late, but a car may still get you there in time.');
    expect(topLevelVerdict(result, '14:30')).not.toMatch(/^No\b/);
  });

  it.each([
    ['an unavailable car rescue', { routes: [] } satisfies GoogleRoutesResponse],
    ['a car rescue that also misses ready-by', { routes: [{ duration: '12000s', distanceMeters: 60500 }] } satisfies GoogleRoutesResponse],
  ])('uses the true negative verdict for %s', (_label, drive) => {
    const result = buildGooglePrototypeResult({ ...input, readinessMinutes: 15 }, primaryResponse, fallbackResponse, '2026-09-24T12:00:00Z', drive);
    expect(result.judgement.meetsDeadline).toBe(false);
    expect(topLevelOutcome(result)).toBe('NO_CHECKED_OPTION_WORKS');
    expect(topLevelVerdict(result, '14:30')).toBe('No — none of the checked options get you there in time.');
  });
});
