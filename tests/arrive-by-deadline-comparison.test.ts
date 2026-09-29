import { describe, expect, it } from 'vitest';
import { compareArrivalDeadline, type DeadlineInput, type DeadlineOption } from '@/lib/arrive-by/deadline-comparison';

const NOW = '2026-09-20T10:00:00Z';
const option = (overrides: Partial<DeadlineOption> = {}): DeadlineOption => ({
  label: 'Option A', landing: { date: '2026-11-03', time: '14:00', timeZone: 'Asia/Karachi' },
  airportExit: { min: 45, max: 90 }, onwardTravel: { min: 30, max: 60 }, ...overrides,
});
const input = (overrides: Partial<DeadlineInput> = {}): DeadlineInput => ({
  deadline: { date: '2026-11-03', time: '18:00', timeZone: 'Asia/Karachi' },
  bufferMinutes: 60, options: [option()], ...overrides,
});
function result(value: DeadlineInput) {
  const compared = compareArrivalDeadline(value, NOW);
  if (compared.state !== 'compared') throw Error(JSON.stringify(compared));
  return compared;
}

describe('Arrive By actual-option deadline comparison', () => {
  it('adds exit and onward travel before evaluating a personal buffer', () => {
    const actual = result(input()).options[0];
    expect(actual.state).toBe('before_with_buffer');
    expect(actual.arrival?.earliest.timeHHmm).toBe('15:15');
    expect(actual.arrival?.latest.timeHHmm).toBe('16:30');
    expect(actual.marginMinutes).toEqual({ min: 90, max: 165 });
    expect(actual.bufferRemainingMinutes).toBe(30);
  });
  it('distinguishes meeting the deadline from retaining the chosen buffer', () => {
    const actual = result(input({ bufferMinutes: 120 })).options[0];
    expect(actual.state).toBe('before_without_buffer');
    expect(actual.bufferRemainingMinutes).toBe(-30);
  });
  it('reports an interval crossing the deadline without choosing its optimistic end', () => {
    expect(result(input({ options: [option({ onwardTravel: { min: 30, max: 180 } })] })).options[0].state).toBe('overlaps_deadline');
  });
  it('reports an entirely late range', () => {
    expect(result(input({ options: [option({ onwardTravel: { min: 240, max: 300 } })] })).options[0].state).toBe('after_deadline');
  });
  it('keeps two different arrival airports/time zones comparable as instants', () => {
    const a = option();
    const b = option({ label: 'Option B', landing: { date: '2026-11-03', time: '13:00', timeZone: 'Asia/Dubai' } });
    const actual = result(input({ options: [a, b] }));
    expect(actual.options[0].arrival).toEqual(actual.options[1].arrival);
  });
  it('handles next-day final arrival explicitly', () => {
    const actual = result(input({ deadline: { date: '2026-11-04', time: '03:00', timeZone: 'Asia/Karachi' }, options: [option({ landing: { date: '2026-11-03', time: '23:00', timeZone: 'Asia/Karachi' } })] })).options[0];
    expect(actual.arrival?.earliest.dateIso).toBe('2026-11-04');
    expect(actual.arrival?.latest.timeHHmm).toBe('01:30');
  });
  it.each(['airportExit', 'onwardTravel'] as const)('never treats unknown %s as zero', (field) => {
    const actual = result(input({ options: [option({ [field]: null })] })).options[0];
    expect(actual.state).toBe('incomplete');
    expect(actual.arrival).toBeUndefined();
    expect(actual.marginMinutes).toBeUndefined();
  });
  it.each([{ min: NaN, max: 30 }, { min: 60, max: 30 }, { min: -1, max: 30 }, { min: 0.5, max: 30 }, { min: 0, max: Infinity }, { min: 0, max: 10081 }])('rejects invalid ranges %j', (range) => {
    expect(result(input({ options: [option({ onwardTravel: range })] })).options[0].state).toBe('incomplete');
  });
  it('accepts an explicitly entered zero onward journey', () => {
    expect(result(input({ options: [option({ onwardTravel: { min: 0, max: 0 } })] })).options[0].arrival?.latest.timeHHmm).toBe('15:30');
  });
  it('treats exact deadline and buffer boundaries inclusively without extra slack', () => {
    const actual = result(input({ bufferMinutes: 0, options: [option({ airportExit: { min: 120, max: 120 }, onwardTravel: { min: 120, max: 120 } })] })).options[0];
    expect(actual.state).toBe('before_with_buffer');
    expect(actual.bufferRemainingMinutes).toBe(0);
  });
  it.each(['2027-03-28', '2026-10-25'])('does not guess a UK clock-change deadline (%s)', (date) => {
    expect(compareArrivalDeadline(input({ deadline: { date, time: '01:30', timeZone: 'Europe/London' } }), NOW).state).toBe('invalid');
  });
  it('does not guess a clock-change landing time', () => {
    expect(result(input({ options: [option({ landing: { date: '2026-10-25', time: '01:30', timeZone: 'Europe/London' } })] })).options[0].state).toBe('incomplete');
  });
  it.each(['2026-02-30', '', '2026-13-01'])('rejects an invalid deadline date %s', (date) => {
    expect(compareArrivalDeadline(input({ deadline: { date, time: '18:00', timeZone: 'Asia/Karachi' } }), NOW).state).toBe('invalid');
  });
  it('rejects a past deadline', () => {
    expect(compareArrivalDeadline(input(), '2026-12-01T00:00:00Z').state).toBe('invalid');
  });
  it('rejects an invalid zone instead of applying the browser zone', () => {
    expect(compareArrivalDeadline(input({ deadline: { date: '2026-11-03', time: '18:00', timeZone: 'Wrong/Zone' } }), NOW).state).toBe('invalid');
  });
  it('keeps a complete option useful when the second is incomplete', () => {
    expect(result(input({ options: [option(), option({ airportExit: null })] })).options.map((item) => item.state)).toEqual(['before_with_buffer', 'incomplete']);
  });
  it.each([NaN, -1, Infinity, 0.5, 10081])('requires an explicit valid buffer %s', (bufferMinutes) => {
    expect(compareArrivalDeadline(input({ bufferMinutes }), NOW).state).toBe('invalid');
  });
  it('supports ordinary UK winter/summer offsets without fixed-offset arithmetic', () => {
    const actual = result(input({ deadline: { date: '2026-10-20', time: '18:00', timeZone: 'Asia/Karachi' }, options: [option({ landing: { date: '2026-10-20', time: '10:00', timeZone: 'Europe/London' } })] })).options[0];
    expect(actual.landing?.timeHHmm).toBe('14:00');
  });
});
