import { describe, it, expect } from 'vitest';
import {
  getAirportTimeZone,
  getDestinationTimeZone,
  isValidLocalDate,
  isValidLocalTime,
  zonedTimeToUtc,
  utcToZoned,
  toZonedDateTime,
  addMinutesUtc,
  localCalendarDayDiff,
} from '@/lib/arrive-by/timezones';

describe('Arrive By timezones — supported lookups', () => {
  it('resolves the UK origin airport to Europe/London', () => {
    expect(getAirportTimeZone('manchester')).toBe('Europe/London');
  });

  it('resolves every supported destination to its real, distinct IANA zone', () => {
    expect(getDestinationTimeZone('dubai')).toBe('Asia/Dubai');
    expect(getDestinationTimeZone('lahore')).toBe('Asia/Karachi');
    expect(getDestinationTimeZone('islamabad')).toBe('Asia/Karachi');
    expect(getDestinationTimeZone('dhaka')).toBe('Asia/Dhaka');
    expect(getDestinationTimeZone('delhi')).toBe('Asia/Kolkata');
    expect(getDestinationTimeZone('mumbai')).toBe('Asia/Kolkata');
  });

  it('req 17: rejects an unsupported airport/destination rather than guessing a timezone', () => {
    expect(getAirportTimeZone('birmingham')).toBeNull();
    expect(getAirportTimeZone('not-a-real-airport')).toBeNull();
    expect(getDestinationTimeZone('istanbul')).toBeNull();
    expect(getDestinationTimeZone('not-a-real-destination')).toBeNull();
  });
});

describe('Arrive By timezones — date/time validation', () => {
  it('accepts real calendar dates and rejects calendar overflow', () => {
    expect(isValidLocalDate('2026-09-14')).toBe(true);
    expect(isValidLocalDate('2026-02-30')).toBe(false); // February never has 30 days
    expect(isValidLocalDate('2026-13-01')).toBe(false); // no month 13
    expect(isValidLocalDate('not-a-date')).toBe(false);
    expect(isValidLocalDate('')).toBe(false);
  });

  it('accepts real 24h times and rejects malformed ones', () => {
    expect(isValidLocalTime('14:30')).toBe(true);
    expect(isValidLocalTime('00:00')).toBe(true);
    expect(isValidLocalTime('23:59')).toBe(true);
    expect(isValidLocalTime('24:00')).toBe(false);
    expect(isValidLocalTime('12:60')).toBe(false);
    expect(isValidLocalTime('2:30')).toBe(false); // must be zero-padded HH:mm
    expect(isValidLocalTime('')).toBe(false);
  });
});

describe('req 30: timezone conversion round trips correctly', () => {
  const cases: { zone: string; date: string; time: string }[] = [
    { zone: 'Europe/London', date: '2026-01-15', time: '09:00' }, // GMT (winter)
    { zone: 'Europe/London', date: '2026-07-15', time: '09:00' }, // BST (summer)
    { zone: 'Asia/Dubai', date: '2026-09-14', time: '18:45' },
    { zone: 'Asia/Karachi', date: '2026-09-14', time: '03:15' },
    { zone: 'Asia/Dhaka', date: '2026-09-14', time: '23:50' },
    { zone: 'Asia/Kolkata', date: '2026-09-14', time: '00:05' },
  ];

  for (const { zone, date, time } of cases) {
    it(`${zone} ${date} ${time} round-trips to the same local wall-clock value`, () => {
      const { utcIso, dstTransitionAmbiguous } = zonedTimeToUtc(date, time, zone);
      const back = utcToZoned(utcIso, zone);
      expect(back).toEqual({ dateIso: date, timeHHmm: time });
      expect(dstTransitionAmbiguous).toBe(false);
    });
  }

  it('UK winter (GMT, UTC+0) and UK summer (BST, UTC+1) produce different UTC instants for the same local clock time', () => {
    const winter = zonedTimeToUtc('2026-01-15', '09:00', 'Europe/London');
    const summer = zonedTimeToUtc('2026-07-15', '09:00', 'Europe/London');
    expect(winter.utcIso).toBe('2026-01-15T09:00:00.000Z');
    expect(summer.utcIso).toBe('2026-07-15T08:00:00.000Z'); // BST is UTC+1, so 09:00 local is 08:00 UTC
  });
});

describe('req 9: daylight-saving transition handling', () => {
  it('flags the skipped hour when UK clocks spring forward (2026-03-29, 01:00 GMT jumps straight to 02:00 BST)', () => {
    const result = zonedTimeToUtc('2026-03-29', '01:30', 'Europe/London');
    expect(result.dstTransitionAmbiguous).toBe(true);
  });

  it('flags the repeated hour when UK clocks fall back (2026-10-25, 01:00-01:59 BST occurs, then repeats as GMT)', () => {
    const result = zonedTimeToUtc('2026-10-25', '01:30', 'Europe/London');
    expect(result.dstTransitionAmbiguous).toBe(true);
  });

  it('does not flag an ordinary time on the transition date itself', () => {
    const result = zonedTimeToUtc('2026-03-29', '12:00', 'Europe/London');
    expect(result.dstTransitionAmbiguous).toBe(false);
  });

  it('correctly tracks the UK offset change across the spring-forward boundary in absolute time', () => {
    const before = zonedTimeToUtc('2026-03-28', '12:00', 'Europe/London'); // still GMT
    const after = zonedTimeToUtc('2026-03-30', '12:00', 'Europe/London'); // now BST
    expect(before.utcIso).toBe('2026-03-28T12:00:00.000Z');
    expect(after.utcIso).toBe('2026-03-30T11:00:00.000Z');
  });

  it('none of the supported destination timezones observe daylight saving, so a destination-side arrival is never itself ambiguous', () => {
    for (const zone of ['Asia/Dubai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Kolkata']) {
      const janOffset = zonedTimeToUtc('2026-01-15', '12:00', zone).utcIso;
      const julOffset = zonedTimeToUtc('2026-07-15', '12:00', zone).utcIso;
      const janHour = Number(janOffset.slice(11, 13));
      const julHour = Number(julOffset.slice(11, 13));
      // The UTC hour for the same local noon should be identical across summer/winter — no seasonal offset shift.
      expect(janHour).toBe(julHour);
    }
  });
});

describe('east/west date-change handling', () => {
  it('a late-evening UK departure can correspond to an early-morning arrival two calendar days later at a far-east destination', () => {
    // Dhaka is UTC+6; a 23:00 UK-local instant in summer (UTC+1) is 22:00 UTC, which is 04:00 the NEXT day in Dhaka.
    const ukDeparture = zonedTimeToUtc('2026-07-10', '23:00', 'Europe/London');
    const dhakaLocal = utcToZoned(ukDeparture.utcIso, 'Asia/Dhaka');
    expect(dhakaLocal.dateIso).toBe('2026-07-11');
    expect(dhakaLocal.timeHHmm).toBe('04:00');
  });
});

describe('addMinutesUtc and localCalendarDayDiff', () => {
  it('adds and subtracts minutes correctly, including across a calendar day boundary', () => {
    expect(addMinutesUtc('2026-09-14T23:30:00.000Z', 45)) .toBe('2026-09-15T00:15:00.000Z');
    expect(addMinutesUtc('2026-09-14T00:15:00.000Z', -45)).toBe('2026-09-13T23:30:00.000Z');
  });

  it('computes whole local-calendar-day differences in a given timezone', () => {
    const a = zonedTimeToUtc('2026-09-14', '22:00', 'Europe/London').utcIso;
    const b = zonedTimeToUtc('2026-09-15', '06:00', 'Europe/London').utcIso;
    expect(localCalendarDayDiff(a, b, 'Europe/London')).toBe(1);
    expect(localCalendarDayDiff(a, a, 'Europe/London')).toBe(0);
  });

  it('does not miscount across a month boundary (regression: naive 1-indexed month passed straight into Date.UTC undercounts)', () => {
    const aug30 = zonedTimeToUtc('2026-08-30', '10:00', 'Europe/London').utcIso;
    const sep02 = zonedTimeToUtc('2026-09-02', '10:00', 'Europe/London').utcIso;
    expect(localCalendarDayDiff(aug30, sep02, 'Europe/London')).toBe(3);
  });
});

describe('toZonedDateTime', () => {
  it('builds a fully explicit local+UTC value', () => {
    const zdt = toZonedDateTime('2026-09-14T09:30:00.000Z', 'Asia/Karachi');
    expect(zdt).toEqual({ dateIso: '2026-09-14', timeHHmm: '14:30', timeZone: 'Asia/Karachi', utcIso: '2026-09-14T09:30:00.000Z' });
  });
});
