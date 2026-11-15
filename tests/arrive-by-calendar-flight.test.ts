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

const yearly = (month: number, day: string, extra = '') => `RRULE:FREQ=YEARLY;BYMONTH=${month};BYDAY=${day}${extra}`;
const observance = (kind: 'STANDARD' | 'DAYLIGHT', start: string, from: string, to: string, rule?: string) => `BEGIN:${kind}\nDTSTART:${start}\nTZOFFSETFROM:${from}\nTZOFFSETTO:${to}${rule ? `\n${rule}` : ''}\nEND:${kind}`;
const zoneDefinition = (tzid: string, ...parts: string[]) => `BEGIN:VTIMEZONE\nTZID:${tzid}\n${parts.join('\n')}\nEND:VTIMEZONE`;
const london = (until = '') => zoneDefinition('Europe/London',
  observance('DAYLIGHT', '19700329T010000', '+0000', '+0100', yearly(3, '-1SU', until)),
  observance('STANDARD', '19701025T020000', '+0100', '+0000', yearly(10, '-1SU', until)));
const kolkata = zoneDefinition('Asia/Kolkata', observance('STANDARD', '19700101T000000', '+0530', '+0530'));
const newYork = zoneDefinition('America/New_York',
  observance('DAYLIGHT', '19700308T020000', '-0500', '-0400', yearly(3, '2SU')),
  observance('STANDARD', '19701101T020000', '-0400', '-0500', yearly(11, '1SU')));
const flight = (zone: string, start: string, end: string, endZone = zone) => event(`DTSTART;TZID=${zone}:${start}\nDTEND;TZID=${endZone}:${end}\nSUMMARY:Flight`);
const winter = flight('Europe/London', '20261220T220000', '20261221T060000');
const summer = flight('Europe/London', '20260720T220000', '20260721T060000');

describe('flight calendar import: embedded time-zone definitions', () => {
  it('refuses the reproduced Europe/London +0200 definition instead of importing 22:00Z for 20 December', () => {
    const wrong = zoneDefinition('Europe/London', observance('STANDARD', '19700101T000000', '+0200', '+0200'));
    expect(() => parseFlightCalendar(calendar(wrong, winter))).toThrow(/differently from the standard time-zone database/);
  });

  it('accepts valid winter and summer definitions and reads the same instants as the standard database', () => {
    const w = parseFlightCalendar(calendar(london(), kolkata, flight('Europe/London', '20261220T220000', '20261221T113000', 'Asia/Kolkata')));
    expect([w.events[0].departsMs, w.events[0].arrivesMs]).toEqual([Date.parse('2026-12-20T22:00:00Z'), Date.parse('2026-12-21T06:00:00Z')]);
    const s = parseFlightCalendar(calendar(london(), kolkata, flight('"Europe/London"', '20260720T220000', '20260721T113000', 'Asia/Kolkata')));
    expect(s.events[0].departsMs).toBe(Date.parse('2026-07-20T21:00:00Z'));
    expect(calendarFlightTimes(s.events[0], 'Europe/London', 'Asia/Kolkata')).toEqual({ departsLocal: '2026-07-20T22:00', arrivesLocal: '2026-07-21T11:30' });
  });

  it('understands numbered weekdays and a rule end date in valid definitions', () => {
    const ny = parseFlightCalendar(calendar(newYork, flight('America/New_York', '20260720T220000', '20260721T060000'), flight('America/New_York', '20261220T220000', '20261221T060000')));
    expect(ny.events.map((e) => e.departsMs)).toEqual([Date.parse('2026-07-21T02:00:00Z'), Date.parse('2026-12-21T03:00:00Z')]);
    expect(parseFlightCalendar(calendar(london(';UNTIL=20371231T000000Z'), summer, winter)).events).toHaveLength(2);
  });

  it('accepts valid definitions on either side of both clock changes', () => {
    const spring = parseFlightCalendar(calendar(london(), flight('Europe/London', '20260328T220000', '20260329T120000')));
    expect([spring.events[0].departsMs, spring.events[0].arrivesMs]).toEqual([Date.parse('2026-03-28T22:00:00Z'), Date.parse('2026-03-29T11:00:00Z')]);
    const autumn = parseFlightCalendar(calendar(london(), flight('Europe/London', '20261024T220000', '20261025T120000')));
    expect([autumn.events[0].departsMs, autumn.events[0].arrivesMs]).toEqual([Date.parse('2026-10-24T21:00:00Z'), Date.parse('2026-10-25T12:00:00Z')]);
  });

  it('still refuses clock-change wall times when a valid definition is present', () => {
    expect(() => parseFlightCalendar(calendar(london(), event('DTSTART;TZID=Europe/London:20260329T013000\nDTEND:20260329T120000Z')))).toThrow(/ambiguous/);
    expect(() => parseFlightCalendar(calendar(london(), event('DTSTART;TZID=Europe/London:20261025T013000\nDTEND:20261025T120000Z')))).toThrow(/ambiguous/);
  });

  it('refuses a definition whose offsets are right somewhere but wrong on the flight day', () => {
    const swapped = zoneDefinition('Europe/London',
      observance('STANDARD', '19700301T020000', '+0100', '+0000', yearly(3, '1SU')),
      observance('DAYLIGHT', '19701001T010000', '+0000', '+0100', yearly(10, '1SU')));
    expect(() => parseFlightCalendar(calendar(swapped, winter))).toThrow(/differently/);
    expect(() => parseFlightCalendar(calendar(swapped, summer))).toThrow(/differently/);
    const lateSpring = zoneDefinition('Europe/London',
      observance('DAYLIGHT', '19700429T010000', '+0000', '+0100', yearly(4, '-1SU')),
      observance('STANDARD', '19701025T020000', '+0100', '+0000', yearly(10, '-1SU')));
    expect(() => parseFlightCalendar(calendar(lateSpring, flight('Europe/London', '20260405T220000', '20260406T060000')))).toThrow(/differently/);
    expect(parseFlightCalendar(calendar(lateSpring, winter)).events[0].departsMs).toBe(Date.parse('2026-12-20T22:00:00Z'));
  });

  it('refuses a definition whose rules ended before the flight', () => {
    expect(() => parseFlightCalendar(calendar(london(';UNTIL=20200101T000000Z'), summer))).toThrow(/differently/);
  });

  it('matches zone names the way the time-zone database does, so changed letter case cannot bypass the check', () => {
    const wrong = zoneDefinition('Europe/London', observance('STANDARD', '19700101T000000', '+0200', '+0200'));
    for (const name of ['europe/london', 'EUROPE/LONDON', 'Europe/london']) {
      expect(() => parseFlightCalendar(calendar(wrong, flight(name, '20261220T220000', '20261221T060000')))).toThrow(/differently/);
    }
    expect(() => parseFlightCalendar(calendar(london(), wrong, flight('europe/london', '20261220T220000', '20261221T060000')))).toThrow(/cannot be checked safely/);
    expect(parseFlightCalendar(calendar(london(), flight('europe/london', '20261220T220000', '20261221T060000'))).events).toHaveLength(1);
  });

  it('checks the arrival time zone as well as the departure time zone', () => {
    const wrongKolkata = zoneDefinition('Asia/Kolkata', observance('STANDARD', '19700101T000000', '+0500', '+0500'));
    expect(() => parseFlightCalendar(calendar(london(), wrongKolkata, flight('Europe/London', '20261220T220000', '20261221T113000', 'Asia/Kolkata')))).toThrow(/Asia\/Kolkata differently/);
  });

  const std = observance('STANDARD', '19701025T020000', '+0100', '+0000', yearly(10, '-1SU'));
  const dst = observance('DAYLIGHT', '19700329T010000', '+0000', '+0100', yearly(3, '-1SU'));
  it.each([
    ['a duplicated definition', [london(), london()]],
    ['a definition naming no observances', [zoneDefinition('Europe/London')]],
    ['two zone names in one definition', [`BEGIN:VTIMEZONE\nTZID:Europe/London\nTZID:Europe/Paris\n${std}\n${dst}\nEND:VTIMEZONE`]],
    ['a missing offset', [zoneDefinition('Europe/London', std, 'BEGIN:DAYLIGHT\nDTSTART:19700329T010000\nTZOFFSETFROM:+0000\nEND:DAYLIGHT')]],
    ['an unreadable offset', [zoneDefinition('Europe/London', observance('STANDARD', '19701025T020000', '+0100', 'abc', yearly(10, '-1SU')), dst)]],
    ['two target offsets in one observance', [zoneDefinition('Europe/London', 'BEGIN:STANDARD\nDTSTART:19701025T020000\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nTZOFFSETTO:+0000\nEND:STANDARD', 'BEGIN:DAYLIGHT\nDTSTART:19700329T010000\nTZOFFSETFROM:+0000\nEND:DAYLIGHT')]],
    ['an offset hidden in an unknown nested component', [zoneDefinition('Europe/London', 'BEGIN:STANDARD\nDTSTART:19701025T020000\nTZOFFSETFROM:+0100\nBEGIN:X-HIDDEN\nTZOFFSETTO:+0000\nEND:X-HIDDEN\nEND:STANDARD', dst)]],
    ['an observance nested inside another', [zoneDefinition('Europe/London', `BEGIN:STANDARD\nDTSTART:19701025T020000\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0000\n${dst}\nEND:STANDARD`)]],
    ['an unknown component beside the observances', [zoneDefinition('Europe/London', std, dst, 'BEGIN:X-EXTRA\nEND:X-EXTRA')]],
    ['a missing source offset', [zoneDefinition('Europe/London', 'BEGIN:STANDARD\nDTSTART:19701025T020000\nTZOFFSETTO:+0000\nEND:STANDARD', dst)]],
    ['an unreadable start time', [zoneDefinition('Europe/London', observance('STANDARD', 'not-a-date', '+0100', '+0000', yearly(10, '-1SU')), dst)]],
    ['explicit transition dates', [zoneDefinition('Europe/London', std, dst, 'BEGIN:STANDARD\nDTSTART:20261025T020000\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0000\nRDATE:20271031T020000\nEND:STANDARD')]],
    ['a rule that is not a yearly numbered weekday', [zoneDefinition('Europe/London', observance('STANDARD', '19701025T020000', '+0100', '+0000', 'RRULE:FREQ=MONTHLY;BYMONTH=10;BYDAY=-1SU'), dst)]],
    ['a rule with a count', [zoneDefinition('Europe/London', observance('STANDARD', '19701025T020000', '+0100', '+0000', yearly(10, '-1SU', ';COUNT=5')), dst)]],
    ['a rule with a set position', [zoneDefinition('Europe/London', observance('STANDARD', '19701025T020000', '+0100', '+0000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=SU;BYSETPOS=-1'), dst)]],
  ])('refuses %s rather than guessing', (_, zones) => {
    expect(() => parseFlightCalendar(calendar(...zones, winter))).toThrow(/cannot be checked safely/);
  });

  it('ignores definitions that name no zone or a zone the event does not use, and keeps files without definitions working', () => {
    const wrongParis = zoneDefinition('Europe/Paris', observance('STANDARD', '19700101T000000', '+0900', '+0900'));
    const unnamed = `BEGIN:VTIMEZONE\n${observance('STANDARD', '19700101T000000', '+0900', '+0900')}\nEND:VTIMEZONE`;
    expect(parseFlightCalendar(calendar(wrongParis, winter)).events).toHaveLength(1);
    expect(parseFlightCalendar(calendar(unnamed, winter)).events).toHaveLength(1);
    expect(parseFlightCalendar(calendar(winter)).events).toHaveLength(1);
    expect(parseFlightCalendar(calendar(wrongParis, event())).events).toHaveLength(1);
  });

  it('skips only the conflicting event and reports it, keeping a separate valid event', () => {
    const wrong = zoneDefinition('Europe/London', observance('STANDARD', '19700101T000000', '+0200', '+0200'));
    const parsed = parseFlightCalendar(calendar(wrong, winter, event()));
    expect(parsed.skipped).toBe(1);
    expect(parsed.events.map((e) => e.title)).toEqual(['Flight to Delhi']);
  });

  it('reads a definition that appears after the event that uses it', () => {
    const wrong = zoneDefinition('Europe/London', observance('STANDARD', '19700101T000000', '+0200', '+0200'));
    expect(() => parseFlightCalendar(calendar(winter, wrong))).toThrow(/differently/);
  });
});
