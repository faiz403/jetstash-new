import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { exampleDoorJourney, blankTurnUpAndGo } from '@/lib/arrive-by/door-example';
import { planDoorJourney, type DoorJourney } from '@/lib/arrive-by/door-to-door';
import {
  addCalendarDays, assessAvailability, latestSafeReadyTime, planTurnUpAndGo, planningWait,
  validateTurnUpAndGo, weekdayOf, type TurnUpAndGoTransport,
} from '@/lib/arrive-by/turn-up-and-go';

const NOW = '2026-09-20T12:00:00Z';
const DUBAI = 'Asia/Dubai';
const at = (iso: string) => Date.parse(iso);

/**
 * Turn-up-and-go transport (Arrive By Type B).
 *
 * These fixtures are deliberately fictional planning inputs, not evidence
 * about any real operator. The point under test is that the engine reports
 * only what its inputs support: availability always, timing only when a
 * duration and a wait basis exist, and never an individual departure.
 */
function metro(overrides: Partial<TurnUpAndGoTransport> = {}): TurnUpAndGoTransport {
  return {
    ...blankTurnUpAndGo(DUBAI, DUBAI),
    from: { name: 'Airport metro station', timeZone: DUBAI },
    to: { name: 'City centre station', timeZone: DUBAI },
    minimumBeforeDeparture: 5,
    // Mon-Thu 05:00 to midnight; Friday runs an hour later into the next day.
    operatingWindows: [
      { days: ['mon', 'tue', 'wed', 'thu'], opens: '05:00', closes: '00:00', closesNextDay: true },
      { days: ['fri'], opens: '05:00', closes: '01:00', closesNextDay: true },
    ],
    journeyMinutes: 35,
    journeyMinutesBasis: 'OFFICIAL',
    headwayMinutes: { min: 5, max: 7 },
    plannedWaitMinutes: null,
    ...overrides,
  };
}

describe('operating windows decide availability, in the stop’s own time zone', () => {
  it('reports SERVICE AVAILABLE inside a window', () => {
    // Tuesday 20:30 local, comfortably inside 05:00-00:00.
    const result = assessAvailability(metro(), at('2026-11-10T16:30:00Z'));
    expect(result.state).toBe('SERVICE AVAILABLE');
    expect(result.windowClosesAt?.timeHHmm).toBe('00:00');
  });

  it('reports SERVICE CLOSED AT READY TIME outside a window, with the next opening as a reopening rather than a departure', () => {
    // Wednesday 00:50 local — 50 minutes after the Tuesday window closed.
    const result = assessAvailability(metro(), at('2026-11-10T20:50:00Z'));
    expect(result.state).toBe('SERVICE CLOSED AT READY TIME');
    expect(result.nextOpening?.dateIso).toBe('2026-11-11');
    expect(result.nextOpening?.timeHHmm).toBe('05:00');
    expect(result.waitUntilOpeningMinutes).toBe(250);
    expect(result.notes.join(' ')).toContain('not a specific departure');
  });

  it('treats a window crossing midnight as still open after midnight', () => {
    // Saturday 00:30 local falls inside the Friday 05:00-01:00 window.
    const result = assessAvailability(metro(), at('2026-11-13T20:30:00Z'));
    expect(result.state).toBe('SERVICE AVAILABLE');
  });

  it('honours weekday-specific windows: the Friday extension does not apply on a Tuesday', () => {
    // Wednesday 00:30 local — inside Friday's extension, but this is not Friday.
    expect(assessAvailability(metro(), at('2026-11-10T20:30:00Z')).state).toBe('SERVICE CLOSED AT READY TIME');
  });

  it('is open one minute before closing and closed exactly at closing', () => {
    expect(assessAvailability(metro(), at('2026-11-10T19:59:00Z')).state).toBe('SERVICE AVAILABLE');
    expect(assessAvailability(metro(), at('2026-11-10T20:00:00Z')).state).toBe('SERVICE CLOSED AT READY TIME');
  });

  it('is closed one minute before opening and open exactly at opening', () => {
    expect(assessAvailability(metro(), at('2026-11-11T00:59:00Z')).state).toBe('SERVICE CLOSED AT READY TIME');
    expect(assessAvailability(metro(), at('2026-11-11T01:00:00Z')).state).toBe('SERVICE AVAILABLE');
  });

  it('finds a reopening across a multi-day gap rather than giving up', () => {
    const weekendOnly = metro({ operatingWindows: [{ days: ['sat'], opens: '09:00', closes: '18:00', closesNextDay: false }] });
    const result = assessAvailability(weekendOnly, at('2026-11-10T16:00:00Z'));
    expect(result.state).toBe('SERVICE CLOSED AT READY TIME');
    expect(result.nextOpening?.dateIso).toBe('2026-11-14');
  });
});

describe('a wait is planned from evidence, never from an invented departure', () => {
  it('plans on the longest published gap when an official frequency exists', () => {
    const wait = planningWait(metro());
    expect(wait).toMatchObject({ minutes: 7, basis: 'OFFICIAL' });
    expect(wait.label).toContain('every 5-7 min');
  });

  it('uses an entered allowance when no official frequency exists, and labels it an assumption', () => {
    const wait = planningWait(metro({ headwayMinutes: null, plannedWaitMinutes: 10 }));
    expect(wait).toMatchObject({ minutes: 10, basis: 'ASSUMPTION' });
    expect(wait.label).toContain('ASSUMPTION');
  });

  it('refuses to invent a wait when neither exists', () => {
    const wait = planningWait(metro({ headwayMinutes: null, plannedWaitMinutes: null }));
    expect(wait).toMatchObject({ minutes: null, basis: 'NONE' });
    expect(wait.label).toContain('EXACT DEPARTURE NOT PROVIDED');
  });

  it('names no individual service, only a boarding instant derived from the planned wait', () => {
    const outcome = planTurnUpAndGo(metro(), at('2026-11-10T16:30:00Z'));
    expect(outcome.timingConfirmed).toBe(true);
    // A timetabled leg would carry a service identity; this one must not.
    expect(Object.keys(outcome)).not.toContain('service');
    expect(JSON.stringify(outcome)).not.toMatch(/"id"|serviceId|departureId/i);
  });
});

describe('timing is reported only when the inputs support it', () => {
  it('confirms boarding and arrival when duration and official frequency are both present', () => {
    const outcome = planTurnUpAndGo(metro(), at('2026-11-10T16:30:00Z'));
    // ready 20:30 + 5 access + 7 worst-case wait = 20:42 boarding, + 35 = 21:17 arrival.
    expect(new Date(outcome.boardingMs!).toISOString()).toBe('2026-11-10T16:42:00.000Z');
    expect(new Date(outcome.arrivalMs!).toISOString()).toBe('2026-11-10T17:17:00.000Z');
    expect(outcome.missing).toEqual([]);
  });

  it('states availability but refuses an arrival time when the journey duration is unknown', () => {
    const outcome = planTurnUpAndGo(metro({ journeyMinutes: null }), at('2026-11-10T16:30:00Z'));
    expect(outcome.availability.state).toBe('SERVICE AVAILABLE');
    expect(outcome.timingConfirmed).toBe(false);
    expect(outcome.arrivalMs).toBeNull();
    expect(outcome.missing).toContain('journey duration for this leg');
  });

  it('states availability but refuses an arrival time when nothing supports a wait', () => {
    const outcome = planTurnUpAndGo(metro({ headwayMinutes: null, plannedWaitMinutes: null }), at('2026-11-10T16:30:00Z'));
    expect(outcome.availability.state).toBe('SERVICE AVAILABLE');
    expect(outcome.timingConfirmed).toBe(false);
    expect(outcome.missing).toContain('official service frequency or an entered planning wait allowance');
  });

  it('refuses timing when the access allowance and wait would run past closing', () => {
    // Ready 23:57, closes 00:00: 5 min access + 7 min wait cannot be served.
    const outcome = planTurnUpAndGo(metro(), at('2026-11-10T19:57:00Z'));
    expect(outcome.availability.state).toBe('SERVICE AVAILABLE');
    expect(outcome.timingConfirmed).toBe(false);
    expect(outcome.availability.notes.join(' ')).toContain('run past the published closing time');
  });
});

describe('the backwards boundary is a ready time, not a service', () => {
  it('derives a latest safe ready time when the evidence supports one', () => {
    const boundary = latestSafeReadyTime(metro(), at('2026-11-10T17:00:00Z'));
    // 21:00 arrival - 35 journey - 7 wait - 5 access = 20:13 local.
    expect(new Date(boundary.ms!).toISOString()).toBe('2026-11-10T16:13:00.000Z');
  });

  it('cannot confirm a boundary without a journey duration', () => {
    const boundary = latestSafeReadyTime(metro({ journeyMinutes: null }), at('2026-11-10T17:00:00Z'));
    expect(boundary.ms).toBeNull();
    expect(boundary.reason).toContain('CANNOT CONFIRM');
  });

  it('cannot confirm a boundary that would fall outside operating hours', () => {
    const boundary = latestSafeReadyTime(metro(), at('2026-11-11T01:30:00Z'));
    expect(boundary.ms).toBeNull();
    expect(boundary.reason).toContain('outside the published operating hours');
  });
});

describe('validation demands evidence rather than assuming defaults', () => {
  it('rejects a leg with no operating window', () => {
    const errors: string[] = [];
    validateTurnUpAndGo(metro({ operatingWindows: [] }), 'After flight', errors);
    expect(errors.join(' ')).toContain('NO OPERATING WINDOW PROVIDED');
  });

  it('rejects a window that closes at or before it opens without the next-day flag', () => {
    const errors: string[] = [];
    validateTurnUpAndGo(metro({ operatingWindows: [{ days: ['mon'], opens: '05:00', closes: '00:00', closesNextDay: false }] }), 'After flight', errors);
    expect(errors.join(' ')).toContain('closing the next day');
  });

  it('rejects a missing access allowance rather than treating unknown as zero', () => {
    const errors: string[] = [];
    validateTurnUpAndGo(metro({ minimumBeforeDeparture: null }), 'After flight', errors);
    expect(errors.join(' ')).toContain('station access allowance');
  });
});

describe('calendar helpers are offset-independent', () => {
  it('reads weekdays from plain calendar dates', () => {
    expect(weekdayOf('2026-11-10')).toBe('tue');
    expect(weekdayOf('2026-11-13')).toBe('fri');
  });

  it('moves calendar dates across month and year boundaries', () => {
    expect(addCalendarDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

/** Fictional planning fixture: two arrival times either side of a closing time. */
function dubaiJourney(change?: (input: DoorJourney) => void): DoorJourney {
  const input = exampleDoorJourney() as DoorJourney;
  input.arrivalAirport = { name: 'Arrival airport', timeZone: DUBAI };
  input.destination = { name: 'City flat', timeZone: DUBAI };
  input.deadline = { date: '2026-11-11', time: '23:00', timeZone: DUBAI };
  input.onward = metro();
  input.finalMile = { kind: 'flexible', mode: 'walk', minutes: 10, buffer: 5 };
  input.flights = [
    { label: 'Earlier arrival', priceGBP: 500, departure: { date: '2026-11-10', time: '09:50', timeZone: 'Europe/London' }, landing: { date: '2026-11-10', time: '20:40', timeZone: DUBAI } },
    { label: 'Later arrival', priceGBP: 420, departure: { date: '2026-11-10', time: '13:30', timeZone: 'Europe/London' }, landing: { date: '2026-11-11', time: '00:25', timeZone: DUBAI } },
  ];
  change?.(input);
  return input;
}

describe('two flights either side of a closing time are represented differently', () => {
  it('shows the service available for the earlier arrival and closed for the later one', () => {
    const result = planDoorJourney(dubaiJourney(), NOW);
    expect(result.errors).toEqual([]);
    const [earlier, later] = result.options;
    expect(earlier.turnUpAndGo?.state).toBe('SERVICE AVAILABLE');
    expect(later.turnUpAndGo?.state).toBe('SERVICE CLOSED AT READY TIME');
    expect(later.state).toBe('NO');
    expect(later.reasons.join(' ')).toContain('SERVICE CLOSED AT YOUR READY TIME');
    expect(later.reasons.join(' ')).toContain('NEXT OPERATING WINDOW');
  });

  it('offers the closed option no invented departure, only a reopening time', () => {
    const later = planDoorJourney(dubaiJourney(), NOW).options[1];
    expect(later.turnUpAndGo?.nextOpening?.timeHHmm).toBe('05:00');
    expect(later.onwardService).toBeUndefined();
    expect(later.latestDeadlineService).toBeUndefined();
  });

  it('a flexible final mile still covers the journey when the transit leg is dropped', () => {
    const result = planDoorJourney(dubaiJourney((input) => {
      input.onward = null;
      input.finalMile = { kind: 'flexible', mode: 'taxi', minutes: 40, buffer: 15 };
    }), NOW);
    // With a taxi instead of transit, the late arrival is no longer blocked by opening hours.
    expect(result.options[1].turnUpAndGo).toBeUndefined();
    expect(result.options[1].reasons.join(' ')).not.toContain('SERVICE CLOSED');
  });

  it('slower airport processing can move a traveller from service-open to service-closed', () => {
    const slow = planDoorJourney(dubaiJourney((input) => {
      input.arrivalProcess = { disembark: 20, immigration: 120, baggage: 45, customs: 20, walkToTransport: 20 };
    }), NOW);
    expect(slow.options[0].turnUpAndGo?.state).toBe('SERVICE CLOSED AT READY TIME');
    expect(slow.options[0].state).toBe('NO');
  });

  it('reports CANNOT CONFIRM rather than a false arrival when the wait basis is missing', () => {
    const result = planDoorJourney(dubaiJourney((input) => {
      input.onward = metro({ headwayMinutes: null, plannedWaitMinutes: null });
    }), NOW);
    const earlier = result.options[0];
    expect(earlier.state).toBe('CANNOT CONFIRM');
    expect(earlier.finalArrival).toBeUndefined();
    expect(earlier.reasons.join(' ')).toContain('CANNOT CONFIRM EXACT ARRIVAL');
    expect(earlier.turnUpAndGo?.missing.join(' ')).toContain('official service frequency');
  });

  it('carries the evidence basis of every planning input into the result', () => {
    const result = planDoorJourney(dubaiJourney((input) => {
      input.onward = metro({ headwayMinutes: null, plannedWaitMinutes: 10, journeyMinutesBasis: 'ASSUMPTION' });
    }), NOW);
    expect(result.options[0].turnUpAndGo).toMatchObject({ waitBasis: 'ASSUMPTION', journeyMinutesBasis: 'ASSUMPTION' });
  });

  it('expresses the backwards boundary as a ready time rather than a named service', () => {
    const earlier = planDoorJourney(dubaiJourney(), NOW).options[0];
    expect(earlier.latestSafeReadyTime).toBeDefined();
    expect(earlier.backwards.some((step) => step.label.includes('Latest safe ready time'))).toBe(true);
    expect(earlier.backwards.some((step) => step.label.includes('Latest downstream-compatible'))).toBe(false);
  });
});

describe('fixed-timetable behaviour is untouched by the new transport type', () => {
  it('still selects the earliest qualifying onward service and keeps the latest as a boundary', () => {
    const result = planDoorJourney(exampleDoorJourney(), NOW);
    const option = result.options[1];
    expect(option.onwardService).toBe('Example onward 17:10');
    expect(option.latestDeadlineService?.id).toBe('Example onward 17:35');
    expect(option.turnUpAndGo).toBeUndefined();
    expect(option.latestSafeReadyTime).toBeUndefined();
  });

  it('still selects the latest qualifying pre-flight service, on the opposite rule to the onward leg', () => {
    // Pre-flight deliberately takes the LATEST train that still meets the
    // airport-arrival requirement; onward takes the EARLIEST that qualifies.
    expect(planDoorJourney(exampleDoorJourney(), NOW).options[1].originService).toBe('Example train 05:48');
  });
});

describe('the interface cannot invite an invented departure', () => {
  const component = readFileSync('components/founder/arrive-by-door-to-door.tsx', 'utf8');

  it('offers a transport-type choice between fixed timetable and turn-up-and-go', () => {
    expect(component).toContain('Fixed timetable');
    expect(component).toContain('Turn-up-and-go');
  });

  it('gives the turn-up-and-go editor operating windows but no departure-time field', () => {
    const editor = component.slice(component.indexOf('function TurnUpAndGoFields'), component.indexOf('export function ArriveByDoorToDoor'));
    expect(editor).toContain('Add operating window');
    // <Moment> is how a departure date+time is entered for a timetabled leg.
    // Its absence here is what stops a tester inventing one.
    expect(editor).not.toContain('<Moment');
    expect(editor).not.toContain('Add onward service');
  });

  it('states plainly that no exact departure is provided', () => {
    expect(component).toContain('EXACT DEPARTURE NOT PROVIDED');
  });
});
