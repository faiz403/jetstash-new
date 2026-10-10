import { describe, expect, it } from 'vitest';
import { scheduledFlightForSolver, withScheduledFlightAssumption } from '@/lib/arrive-by-journey/scheduled-flight';
import type { JourneyPlan } from '@/lib/arrive-by-journey/types';

const flight = { departsLocal: '2026-10-09T14:00', arrivesLocal: '2026-10-10T04:30', declaredConnections: 1 };
const plan = { state: 'POSSIBLE_WITH_MARGIN', stateLabel: 'POSSIBLE WITH MARGIN', reasons: [], flight: { departsIso: '2026-10-09T13:00:00.000Z', arrivesIso: '2026-10-09T23:30:00.000Z', elapsedMinutes: 630, departZone: 'Europe/London', arriveZone: 'Asia/Karachi' }, timeline: [] } as JourneyPlan;

describe('opaque scheduled-flight anchor', () => {
  it('requires explicit caller policy and preserves original input and entered times', () => {
    expect(scheduledFlightForSolver(flight)).toBe(flight);
    expect(scheduledFlightForSolver(flight, 'FINAL_ARRIVAL_ANCHOR')).toEqual({ ...flight, declaredConnections: 0 });
    expect(flight.declaredConnections).toBe(1);
  });

  it('leaves non-connecting journeys identical', () => {
    const direct = { ...flight, declaredConnections: 0 };
    expect(scheduledFlightForSolver(direct, 'FINAL_ARRIVAL_ANCHOR')).toBe(direct);
    expect(withScheduledFlightAssumption(plan, direct, 'Islamabad International Airport', 'FINAL_ARRIVAL_ANCHOR')).toBe(plan);
  });

  it('does not turn an unsupported/invalid result without a flight anchor into a connection promise', () => {
    const unsupported = { ...plan, flight: undefined, state: 'CANNOT_CONFIRM' } as JourneyPlan;
    expect(withScheduledFlightAssumption(unsupported, flight, 'Unsupported', 'FINAL_ARRIVAL_ANCHOR')).toBe(unsupported);
  });

  it('keeps ground-route failure separate while stating the final-arrival assumption', () => {
    const unavailable = { ...plan, state: 'CANNOT_CONFIRM', notEvidenced: { reason: 'ARRIVAL_ROUTE_UNAVAILABLE' } } as JourneyPlan;
    const decorated = withScheduledFlightAssumption(unavailable, flight, 'Islamabad International Airport', 'FINAL_ARRIVAL_ANCHOR');
    expect(decorated.notEvidenced?.reason).toBe('ARRIVAL_ROUTE_UNAVAILABLE');
    expect(decorated.scheduledFlightAssumption?.arrivesIso).toBe('2026-10-09T23:30:00.000Z');
  });
});
