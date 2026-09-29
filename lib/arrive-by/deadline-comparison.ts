import { addMinutesUtc, toZonedDateTime, zonedTimeToUtc } from './timezones';
import type { ZonedDateTime } from './types';

export interface LocalMoment { date: string; time: string; timeZone: string }
export interface MinuteRange { min: number; max: number }
export interface DeadlineOption {
  label: string;
  landing: LocalMoment;
  airportExit: MinuteRange | null;
  onwardTravel: MinuteRange | null;
}
export interface DeadlineInput {
  deadline: LocalMoment;
  bufferMinutes: number;
  options: DeadlineOption[];
}
export type DeadlineState = 'before_with_buffer' | 'before_without_buffer' | 'overlaps_deadline' | 'after_deadline' | 'incomplete';
export interface DeadlineOptionResult {
  label: string;
  state: DeadlineState;
  missing: string[];
  landing?: ZonedDateTime;
  arrival?: { earliest: ZonedDateTime; latest: ZonedDateTime };
  marginMinutes?: { min: number; max: number };
  bufferRemainingMinutes?: number;
  airportExit?: MinuteRange;
  onwardTravel?: MinuteRange;
}
export type DeadlineComparison =
  | { state: 'invalid'; errors: string[] }
  | { state: 'compared'; deadline: ZonedDateTime; bufferMinutes: number; options: DeadlineOptionResult[] };

export function parseLocalMoment(value: LocalMoment): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) return null;
  const calendar = new Date(`${value.date}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.date) return null;
  try {
    const converted = zonedTimeToUtc(value.date, value.time, value.timeZone);
    const roundTrip = toZonedDateTime(converted.utcIso, value.timeZone);
    if (converted.dstTransitionAmbiguous || roundTrip.dateIso !== value.date || roundTrip.timeHHmm !== value.time) return null;
    return converted.utcIso;
  } catch { return null; }
}

function validRange(value: MinuteRange | null): value is MinuteRange {
  return value !== null && Number.isSafeInteger(value.min) && Number.isSafeInteger(value.max)
    && value.min >= 0 && value.max >= value.min && value.max <= 10080;
}

/** Arithmetic on traveller-entered options, never verification of a service or connection. */
export function compareArrivalDeadline(input: DeadlineInput, nowIso: string): DeadlineComparison {
  const deadlineUtc = parseLocalMoment(input.deadline);
  const now = Date.parse(nowIso);
  const errors: string[] = [];
  if (!deadlineUtc) errors.push('Enter a valid, unambiguous deadline in the destination time zone. Times during a clock change need confirmation.');
  else if (!Number.isFinite(now) || Date.parse(deadlineUtc) <= now) errors.push('The deadline must be in the future.');
  if (!Number.isSafeInteger(input.bufferMinutes) || input.bufferMinutes < 0 || input.bufferMinutes > 10080) errors.push('Enter a buffer between 0 and 10,080 whole minutes.');
  if (input.options.length < 1 || input.options.length > 2) errors.push('Enter one or two flight options.');
  if (errors.length || !deadlineUtc) return { state: 'invalid', errors };
  const deadline = toZonedDateTime(deadlineUtc, input.deadline.timeZone);
  const options = input.options.map((option, index): DeadlineOptionResult => {
    const label = option.label.trim() || `Option ${index + 1}`;
    const landingUtc = parseLocalMoment(option.landing);
    const missing: string[] = [];
    if (!landingUtc) missing.push('Confirm the landing date, time and time zone; a clock-change time cannot be assumed.');
    else if (Date.parse(landingUtc) <= now) missing.push('Enter a future scheduled landing time.');
    if (!validRange(option.airportExit)) missing.push('Enter the airport-exit range, including immigration and any baggage collection.');
    if (!validRange(option.onwardTravel)) missing.push('Enter the onward-travel range, including waiting for transport. Use 0 only if your destination is the airport exit.');
    if (missing.length || !landingUtc || !validRange(option.airportExit) || !validRange(option.onwardTravel)) return { label, state: 'incomplete', missing };
    const earliestUtc = addMinutesUtc(landingUtc, option.airportExit.min + option.onwardTravel.min);
    const latestUtc = addMinutesUtc(landingUtc, option.airportExit.max + option.onwardTravel.max);
    const min = (Date.parse(deadlineUtc) - Date.parse(latestUtc)) / 60000;
    const max = (Date.parse(deadlineUtc) - Date.parse(earliestUtc)) / 60000;
    const state: DeadlineState = min >= input.bufferMinutes ? 'before_with_buffer'
      : min >= 0 ? 'before_without_buffer' : max >= 0 ? 'overlaps_deadline' : 'after_deadline';
    return {
      label, state, missing, landing: toZonedDateTime(landingUtc, input.deadline.timeZone),
      arrival: { earliest: toZonedDateTime(earliestUtc, input.deadline.timeZone), latest: toZonedDateTime(latestUtc, input.deadline.timeZone) },
      marginMinutes: { min, max }, bufferRemainingMinutes: min - input.bufferMinutes,
      airportExit: option.airportExit, onwardTravel: option.onwardTravel,
    };
  });
  return { state: 'compared', deadline, bufferMinutes: input.bufferMinutes, options };
}
