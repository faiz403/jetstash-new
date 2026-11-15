import { describe, expect, it } from 'vitest';
import { MAX_FLIGHT_CALENDAR_BYTES, calendarFlightTimes, parseFlightCalendar } from '@/lib/arrive-by-journey/calendar-flight';

const event = (fields = 'DTSTART:20261220T220000Z\nDTEND:20261221T060000Z\nSUMMARY:Flight to Delhi') => `BEGIN:VEVENT\n${fields}\nEND:VEVENT`;
const calendar = (...events: string[]) => `BEGIN:VCALENDAR\nVERSION:2.0\n${events.join('\n')}\nEND:VCALENDAR`;

describe('flight calendar import', () => {
  it('converts UTC instants to the selected airport clocks across the overnight date boundary', () => {
    const parsed = parseFlightCalendar(calendar(event()));
    expect(calendarFlightTimes(parsed.events[0], 'Europe/London', 'Asia/Kolkata')).toEqual({ departsLocal: '2026-12-20T22:00', arrivesLocal: '2026-12-21T11:30' });
  });

  it('reads explicit IANA zones and folds without using the device time zone', () => {
    const file = calendar(event('DTSTART;TZID="Europe/London":20260720T220000\nDTEND;TZID=Asia/Kolkata:20260721T113000\nSUMMARY:Flight to\n Delhi')).replace(/\n/g, '\r\n');
    const parsed = parseFlightCalendar(file);
    expect(parsed.events[0].title).toBe('Flight toDelhi');
    expect(calendarFlightTimes(parsed.events[0], 'Europe/London', 'Asia/Kolkata')).toEqual({ departsLocal: '2026-07-20T22:00', arrivesLocal: '2026-07-21T11:30' });
  });

  it('keeps outbound and return as separate choices instead of silently combining them', () => {
    const parsed = parseFlightCalendar(calendar(event(), event('DTSTART:20270112T020000Z\nDTEND:20270112T120000Z\nSUMMARY:Return flight')));
    expect(parsed.events.map((e) => e.title)).toEqual(['Flight to Delhi', 'Return flight']);
    expect(parsed.events[0].arrivesMs).toBe(Date.parse('2026-12-21T06:00:00Z'));
  });

  it.each([
    ['floating times', 'DTSTART:20261220T220000\nDTEND:20261221T060000', /time zone/],
    ['all-day events', 'DTSTART;VALUE=DATE:20261220\nDTEND;VALUE=DATE:20261221', /all-day/],
    ['invalid calendar dates', 'DTSTART:20260230T220000Z\nDTEND:20260301T060000Z', /invalid/],
    ['reversed dates', 'DTSTART:20261221T220000Z\nDTEND:20261220T060000Z', /ends after/],
    ['missing end', 'DTSTART:20261220T220000Z', /one departure and one arrival/],
    ['duplicate start', 'DTSTART:20261220T220000Z\nDTSTART:20261220T230000Z\nDTEND:20261221T060000Z', /one departure/],
    ['conflicting UTC and TZID', 'DTSTART;TZID=Europe/London:20261220T220000Z\nDTEND:20261221T060000Z', /conflicting/],
    ['unsupported zone', 'DTSTART;TZID=Not-A-Zone:20261220T220000\nDTEND:20261221T060000Z', /time zone/],
    ['spring clock gap', 'DTSTART;TZID=Europe/London:20260329T013000\nDTEND:20260329T120000Z', /ambiguous/],
    ['autumn clock repeat', 'DTSTART;TZID=Europe/London:20261025T013000\nDTEND:20261025T120000Z', /ambiguous/],
    ['cancelled event', 'DTSTART:20261220T220000Z\nDTEND:20261221T060000Z\nSTATUS:CANCELLED', /cancelled/],
    ['recurrence', 'DTSTART:20261220T220000Z\nDTEND:20261221T060000Z\nRRULE:FREQ=DAILY', /Recurring/],
  ])('refuses %s', (_, fields, error) => {
    expect(() => parseFlightCalendar(calendar(event(fields)))).toThrow(error);
  });

  it('does not import nested alarm properties as flight times', () => {
    const parsed = parseFlightCalendar(calendar(event('DTSTART:20261220T220000Z\nDTEND:20261221T060000Z\nBEGIN:VALARM\nDTSTART:20000101T000000Z\nEND:VALARM')));
    expect(parsed.events[0].departsMs).toBe(Date.parse('2026-12-20T22:00:00Z'));
  });

  it('reports skipped events while retaining a valid separate event', () => {
    expect(parseFlightCalendar(calendar(event('DTSTART;VALUE=DATE:20261220\nDTEND;VALUE=DATE:20261221'), event())).skipped).toBe(1);
  });

  it('rounds departure earlier and landing later when a calendar includes seconds', () => {
    const parsed = parseFlightCalendar(calendar(event('DTSTART:20261220T220030Z\nDTEND:20261221T060030Z')));
    expect(calendarFlightTimes(parsed.events[0], 'Europe/London', 'Asia/Kolkata')).toEqual({ departsLocal: '2026-12-20T22:00', arrivesLocal: '2026-12-21T11:31' });
  });

  it('refuses an imported instant whose airport wall clock would be ambiguous in the existing form', () => {
    const parsed = parseFlightCalendar(calendar(event('DTSTART:20261025T003000Z\nDTEND:20261025T120000Z')));
    expect(() => calendarFlightTimes(parsed.events[0], 'Europe/London', 'Asia/Kolkata')).toThrow(/clock-change/);
  });

  it('bounds file size and event count and refuses incomplete data', () => {
    expect(() => parseFlightCalendar('x'.repeat(MAX_FLIGHT_CALENDAR_BYTES + 1))).toThrow(/128 KB/);
    expect(() => parseFlightCalendar(calendar(...Array.from({ length: 51 }, () => event())))).toThrow(/50 events/);
    expect(() => parseFlightCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nEND:VCALENDAR')).toThrow(/incomplete/);
    expect(() => parseFlightCalendar('not a calendar')).toThrow(/\.ics/);
  });

  it('rejects events outside the calendar, nested calendars and mismatched components', () => {
    expect(() => parseFlightCalendar(`${calendar()}\n${event()}`)).toThrow(/incomplete/);
    expect(() => parseFlightCalendar(calendar(`BEGIN:VTIMEZONE\n${event()}\nEND:VTIMEZONE`))).toThrow(/incomplete/);
    expect(() => parseFlightCalendar(calendar(event('DTSTART:20261220T220000Z\nDTEND:20261221T060000Z\nBEGIN:VALARM\nEND:OTHER')))).toThrow(/incomplete/);
    expect(() => parseFlightCalendar(calendar(calendar(event())))).toThrow(/incomplete/);
    expect(() => parseFlightCalendar(`BEGIN:VCALENDAR\nMETHOD:CANCEL\n${event()}\nEND:VCALENDAR`)).toThrow(/cancelled/);
  });
});
