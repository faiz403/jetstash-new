import { describe, expect, it } from 'vitest';
import { describePlace } from '../lib/arrive-by-shared/place-display';
import { calendarDayOffset, dateLabelOf, describeDay } from '../lib/arrive-by-journey/local-time';
import { solveJourney } from '../lib/arrive-by-journey/solver';

const c = (long_name: string, ...types: string[]) => ({ long_name, short_name: long_name, types });

describe('describePlace: names only from Google, never invented', () => {
  it('Newport shows the region so it cannot be mistaken for another Newport', () => {
    const text = describePlace({ types: ['locality', 'political'], address_components: [c('Newport', 'locality'), c('Newport', 'administrative_area_level_2'), c('Wales', 'administrative_area_level_1'), c('United Kingdom', 'country')] });
    expect(text).toBe('Newport, Wales, United Kingdom');
  });
  it('uses a venue name only when Google supplied an establishment/POI component', () => {
    const text = describePlace({ types: ['lodging', 'establishment'], address_components: [c('Palm Jumeirah', 'point_of_interest', 'establishment'), c('Nakhlat Jumeira', 'sublocality'), c('Dubai', 'locality'), c('United Arab Emirates', 'country')] });
    expect(text).toBe('Palm Jumeirah (hotel), Nakhlat Jumeira, Dubai, United Arab Emirates');
  });
  it('hides plus codes and states the kind + street when no name exists', () => {
    const plus = describePlace({ types: ['lodging'], address_components: [c('VQ8F+2X', 'point_of_interest'), c('The Palm', 'sublocality'), c('Dubai', 'locality'), c('United Arab Emirates', 'country')] });
    expect(plus).not.toContain('VQ8F');
    const street = describePlace({ types: ['lodging', 'establishment'], address_components: [c('146', 'street_number'), c('Praed Street', 'route'), c('London', 'postal_town'), c('W2 1EE', 'postal_code'), c('United Kingdom', 'country')] });
    expect(street).toBe('Hotel at 146 Praed Street, London W2 1EE, United Kingdom');
    expect(street).not.toMatch(/Hilton/);
  });
  it('names a station when Google names it', () => {
    expect(describePlace({ types: ['train_station', 'transit_station'], address_components: [c('Preston Railway Station', 'establishment', 'point_of_interest'), c('Preston', 'postal_town'), c('United Kingdom', 'country')] })).toBe('Preston Railway Station, Preston, United Kingdom');
  });
});

describe('date clarity', () => {
  const DEP = 'Europe/London';
  it('labels next-day arrival explicitly', () => {
    const leave = Date.parse('2026-10-09T20:00:00Z');
    const arrive = Date.parse('2026-10-10T01:30:00Z');
    expect(calendarDayOffset(leave, DEP, arrive, 'Asia/Karachi')).toBe(1);
    expect(calendarDayOffset(leave, DEP, Date.parse('2026-10-10T08:00:00Z'), 'Asia/Karachi')).toBe(1);
    expect(describeDay(dateLabelOf(Date.parse('2026-10-10T08:00:00Z'), 'Asia/Karachi'), 1)).toBe('Sat 10 Oct (next day)');
    expect(describeDay('Fri 9 Oct', 0)).toBe('Fri 9 Oct');
  });
});

describe('solver: CANNOT CONFIRM never carries a leave-time headline', () => {
  const MAN = { code: 'MAN', name: 'Manchester Airport', timeZone: 'Europe/London' };
  const ISB = { code: 'ISB', name: 'Islamabad International Airport', timeZone: 'Asia/Karachi' };
  const flight = { departsLocal: '2027-01-15T23:00', arrivesLocal: '2027-01-16T07:00' };
  const leg = (minutes: number) => ({ status: 'OK' as const, expectedSeconds: minutes * 60, evidence: { kind: 'ENTERED' as const, source: 'test' } });
  const base = { startLabel: 'Preston, Lancashire', destinationLabel: 'Mirpur, Azad Kashmir', departureAirport: MAN, arrivalAirport: ISB, flight, preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60, pickupWaitMinutes: 15 } };
  it('a confirmable overnight plan carries dates and a next-day marker', () => {
    const good = solveJourney({ ...base, originLeg: leg(55), arrivalLeg: leg(170) });
    expect(good.headline).toBeDefined();
    expect(good.leaveBy?.dateLabel).toBe('Fri 15 Jan');
    expect(good.finalArrival).toMatchObject({ dateLabel: 'Sat 16 Jan', dayOffset: 1 });
  });
  it('an unconfirmable plan drops the headline', () => {
    const bad = solveJourney({ ...base, originLeg: leg(55), arrivalLeg: { status: 'NOT_EVIDENCED', reason: 'ARRIVAL_ROUTE_UNAVAILABLE' } });
    expect(bad.state).toBe('CANNOT_CONFIRM');
    expect(bad.headline).toBeUndefined();
  });
});

describe('privacy: place labels are not sent to analytics or logs', () => {
  it('journey code never imports analytics or logs place data', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['lib/arrive-by-shared/place-display.ts', 'lib/arrive-by-journey/plan.ts', 'components/founder/arrive-by-journey.tsx']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/lib\/analytics|track\(|console\.(log|info|warn|error)/);
    }
    // The route's only console call is the budget-allowance alert, which carries counts and a month, never a place.
    const route = readFileSync('app/api/founder/arrive-by-journey/route.ts', 'utf8');
    expect(route).not.toMatch(/lib\/analytics|track\(/);
    for (const line of route.split('\n').filter((l) => /console\./.test(l))) expect(line).not.toMatch(/start|destination|place|address/i);
  });
});
