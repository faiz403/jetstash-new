import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleCallLedger } from '@/lib/arrive-by-journey/call-budget';
import { resolveJourneyAirports } from '@/lib/arrive-by-journey/airports';
import { transitArrivalLeg } from '@/lib/arrive-by-journey/transit-arrival-leg';
import type { JourneyInput } from '@/lib/arrive-by-journey/types';

const input: JourneyInput = {
  start: 'Preston', departureAirport: 'MAN', arrivalAirport: 'MAN', destination: 'Sheffield',
  flight: { departsLocal: '2027-01-15T08:00', arrivesLocal: '2027-01-15T10:00' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 0, finalDeadlineLocal: '2027-01-15T11:00', destinationReadinessMinutes: 0 },
};
const airportCheck = resolveJourneyAirports('MAN', 'MAN', 'internal', 'LIVE');
if (!airportCheck.ok) throw new Error('MAN capability fixture is required.');

const geocode = { status: 'OK', results: [{ formatted_address: 'Sheffield, United Kingdom', place_id: 'sheffield', types: ['locality', 'political'], geometry: { location_type: 'APPROXIMATE', location: { lat: 53.38, lng: -1.46 } }, address_components: [{ long_name: 'Sheffield', short_name: 'Sheffield', types: ['locality', 'political'] }, { long_name: 'United Kingdom', short_name: 'GB', types: ['country', 'political'] }] }] };
const transitResponse = (departure: string, arrival: string) => ({ routes: [{ duration: '1800s', distanceMeters: 50000, legs: [{ steps: [{ travelMode: 'TRANSIT', staticDuration: '1800s', transitDetails: { stopDetails: { departureStop: { name: 'Manchester Airport' }, departureTime: departure, arrivalStop: { name: 'Sheffield' }, arrivalTime: arrival }, transitLine: { name: 'Northern', nameShort: 'Northern' } } }] }] }] });
const driveResponse = { routes: [{ duration: '1800s', staticDuration: '1500s', distanceMeters: 50000 }] };

function fetchSequence(responses: Array<object | null>) {
  let routeCall = 0;
  return vi.fn(async (url: string) => {
    if (url.includes('/geocode/')) return new Response(JSON.stringify(geocode));
    const next = responses[routeCall++];
    return next ? new Response(JSON.stringify(next)) : new Response('down', { status: 500 });
  }) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe('validated MAN transit-first arrival leg', () => {
  it('shows the next viable journey and makes exactly one drive rescue only when it misses ready-by', async () => {
    const ledger = new GoogleCallLedger(10, fetchSequence([
      transitResponse('2027-01-15T10:05:00Z', '2027-01-15T10:30:00Z'),
      transitResponse('2027-01-15T10:20:00Z', '2027-01-15T11:30:00Z'), driveResponse,
    ]));
    const outcome = await transitArrivalLeg('key', airportCheck.airports, input, ledger, '2027-01-14T09:00:00Z');
    expect(outcome.leg.status).toBe('OK');
    expect(outcome.detail?.transit).toMatchObject({ firstService: 'Northern', missedServiceArrivalIso: '2027-01-15T11:30:00.000Z', missedServiceMeetsReadyBy: false, rescue: { attempted: true, available: true, meetsReadyBy: true } });
    expect(ledger.used).toBe(4); // geocode + primary transit + missed-service transit + one drive
  });

  it('does not request rescue when the missed-service journey still meets ready-by', async () => {
    const ledger = new GoogleCallLedger(10, fetchSequence([
      transitResponse('2027-01-15T10:05:00Z', '2027-01-15T10:30:00Z'),
      transitResponse('2027-01-15T10:20:00Z', '2027-01-15T10:55:00Z'),
    ]));
    const outcome = await transitArrivalLeg('key', airportCheck.airports, input, ledger, '2027-01-14T09:00:00Z');
    expect(outcome.detail?.transit?.rescue).toBeUndefined();
    expect(ledger.used).toBe(3);
  });

  it('never exceeds the cap for rescue and leaves rescue absent when no call remains', async () => {
    const ledger = new GoogleCallLedger(3, fetchSequence([
      transitResponse('2027-01-15T10:05:00Z', '2027-01-15T10:30:00Z'),
      transitResponse('2027-01-15T10:20:00Z', '2027-01-15T11:30:00Z'),
    ]));
    const outcome = await transitArrivalLeg('key', airportCheck.airports, input, ledger, '2027-01-14T09:00:00Z');
    expect(outcome.leg.status).toBe('OK');
    expect(outcome.detail?.transit?.rescue).toBeUndefined();
    expect(ledger.used).toBe(3);
  });

  it('does not pretend a missed-service answer when the provider cannot return one', async () => {
    const ledger = new GoogleCallLedger(10, fetchSequence([
      transitResponse('2027-01-15T10:05:00Z', '2027-01-15T10:30:00Z'), null,
    ]));
    const outcome = await transitArrivalLeg('key', airportCheck.airports, input, ledger, '2027-01-14T09:00:00Z');
    expect(outcome.leg.status).toBe('OK');
    expect(outcome.detail?.transit?.missedServiceArrivalIso).toBeUndefined();
    expect(outcome.detail?.transit?.rescue).toBeUndefined();
  });
});
