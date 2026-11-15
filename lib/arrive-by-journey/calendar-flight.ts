import { formatLocalDateTime, parseLocalDateTime } from './local-time';

export const MAX_FLIGHT_CALENDAR_BYTES = 128 * 1024;
const MAX_EVENTS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
// More observances than any real zone declares; anything larger is treated as unsupported.
const MAX_OBSERVANCES = 10;

export interface CalendarFlightEvent {
  id: string;
  title: string;
  departsMs: number;
  arrivesMs: number;
}

interface CalendarProperty { header: string; value: string }

/** A TZID-qualified time the standard database converted: the zone (as the database names it), the name the file used, the instant produced and the wall-clock time the file gave (as UTC milliseconds). */
interface ZoneCheck { zone: string; label: string; instantMs: number; localMs: number }

/** Yearly "nth weekday of a month" rule, the only recurrence shape calendars use for clock changes. */
interface YearlyRule { month: number; nth: number; weekday: number; untilMs?: number }

/** One STANDARD or DAYLIGHT observance of a calendar's own VTIMEZONE. Times are wall-clock values stored as UTC milliseconds. */
interface Observance { startLocalMs?: number; fromMs?: number; toMs?: number; rule?: YearlyRule; seen: Set<string> }

interface ZoneDefinition { observances: Observance[]; usable: boolean }

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const canonicalZone = (zone: string): string => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: zone }).resolvedOptions().timeZone; } catch { return zone; }
};

function offsetOf(value: string): number | null {
  const match = /^([+-])([01]\d|2[0-3])([0-5]\d)([0-5]\d)?$/.exec(value);
  return match ? (match[1] === '-' ? -1 : 1) * ((Number(match[2]) * 60 + Number(match[3])) * 60 + Number(match[4] ?? 0)) * 1000 : null;
}

function localMsOf(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})T([01]\d|2[0-3])([0-5]\d)([0-5]\d)$/.exec(value);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  return new Date(ms).getUTCDate() === Number(match[3]) && new Date(ms).getUTCMonth() === Number(match[2]) - 1 ? ms : null;
}

/** Only YEARLY;BYMONTH;BYDAY=<n><weekday> with n from 1 to 4 or -1 to -4 (optionally INTERVAL=1, UNTIL, WKST) is understood: every such month has that day each year. Anything else is unsupported. */
function yearlyRuleOf(value: string): YearlyRule | null {
  const parts = new Map<string, string>();
  for (const part of value.split(';')) {
    const [key, ...rest] = part.split('=');
    const name = key.toUpperCase();
    if (!name || !rest.length || parts.has(name) || !['FREQ', 'BYMONTH', 'BYDAY', 'INTERVAL', 'UNTIL', 'WKST'].includes(name)) return null;
    parts.set(name, rest.join('=').toUpperCase());
  }
  const month = /^(\d{1,2})$/.exec(parts.get('BYMONTH') ?? '');
  const day = /^([+-]?[1-4])(SU|MO|TU|WE|TH|FR|SA)$/.exec(parts.get('BYDAY') ?? '');
  if (parts.get('FREQ') !== 'YEARLY' || !month || !day || Number(month[1]) < 1 || Number(month[1]) > 12) return null;
  if (parts.has('INTERVAL') && parts.get('INTERVAL') !== '1') return null;
  if (parts.has('WKST') && !WEEKDAYS.includes(parts.get('WKST') as string)) return null;
  const rule: YearlyRule = { month: Number(month[1]) - 1, nth: Number(day[1]), weekday: WEEKDAYS.indexOf(day[2]) };
  if (parts.has('UNTIL')) {
    const until = /^(\d{8}T\d{6})Z$/.exec(parts.get('UNTIL') ?? '');
    const untilMs = until ? localMsOf(until[1]) : null;
    if (untilMs === null) return null;
    rule.untilMs = untilMs;
  }
  return rule;
}

function dayOfMonth(year: number, { month, nth, weekday }: YearlyRule): number | null {
  if (nth > 0) {
    const day = 1 + ((weekday - new Date(Date.UTC(year, month, 1)).getUTCDay() + 7) % 7) + (nth - 1) * 7;
    return day <= new Date(Date.UTC(year, month + 1, 0)).getUTCDate() ? day : null;
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  const day = last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7) - (-nth - 1) * 7;
  return day >= 1 ? day : null;
}

/** The latest moment, at or before `instantMs`, that this observance came into force; null if none yet. */
function latestOnset(observance: Observance, instantMs: number): number | null {
  const startLocalMs = observance.startLocalMs as number;
  const fromMs = observance.fromMs as number;
  const { rule } = observance;
  const onsets = [startLocalMs - fromMs];
  if (rule) {
    const timeOfDay = ((startLocalMs % DAY_MS) + DAY_MS) % DAY_MS;
    // Local and UTC years can differ by a day, so look a year either side; once a rule has ended its last yearly instance is the latest that can apply.
    const year = Math.min(new Date(instantMs).getUTCFullYear(), rule.untilMs === undefined ? Infinity : new Date(rule.untilMs).getUTCFullYear());
    for (const candidate of [year - 1, year, year + 1]) {
      const day = dayOfMonth(candidate, rule);
      if (day === null) continue;
      const local = Date.UTC(candidate, rule.month, day) + timeOfDay;
      const utc = local - fromMs;
      if (local >= startLocalMs && (rule.untilMs === undefined || utc <= rule.untilMs)) onsets.push(utc);
    }
  }
  const started = onsets.filter((onset) => onset <= instantMs);
  return started.length ? Math.max(...started) : null;
}

/** The offset a calendar's own definition applies at an instant, or null when that is unclear. */
function embeddedOffsetAt(definition: ZoneDefinition, instantMs: number): number | null {
  let best: { onset: number; toMs: number } | undefined;
  let tie = false;
  for (const observance of definition.observances) {
    const onset = latestOnset(observance, instantMs);
    if (onset === null) continue;
    if (!best || onset > best.onset) { best = { onset, toMs: observance.toMs as number }; tie = false; }
    else if (onset === best.onset && observance.toMs !== best.toMs) tie = true;
  }
  if (tie) return null;
  if (best) return best.toMs;
  // Before every onset, the earliest observance's "from" offset applies.
  const earliest = [...definition.observances].sort((a, b) => (a.startLocalMs as number) - (b.startLocalMs as number))[0];
  return earliest.fromMs as number;
}

function instant(property: CalendarProperty): { ms: number; check?: ZoneCheck } {
  const parameters = property.header.split(';').slice(1);
  const values = parameters.filter((p) => p.toUpperCase().startsWith('VALUE='));
  const zones = parameters.filter((p) => p.toUpperCase().startsWith('TZID='));
  if (values.length > 1 || zones.length > 1 || (values.length && values[0].split('=')[1].toUpperCase() !== 'DATE-TIME')) throw new Error('Use a timed flight event, not an all-day event.');
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})([0-5]\d)([0-5]\d)(Z)?$/.exec(property.value);
  if (!match) throw new Error('The calendar date or time could not be read.');
  if (match[7] && zones.length) throw new Error('The calendar gives conflicting time zones.');
  // Floating times are deliberately refused: the browser's time zone is not an airport's time zone.
  const zone = match[7] ? 'UTC' : zones[0]?.slice(5).replace(/^"(.*)"$/, '$1');
  if (!zone) throw new Error('The calendar does not specify a time zone. Enter the flight times manually.');
  const local = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
  const parsed = parseLocalDateTime(local, zone);
  if (!parsed.ok) throw new Error('The calendar time or time zone is invalid or ambiguous. Enter the flight times manually.');
  const ms = parsed.ms + Number(match[6]) * 1000;
  const localMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  return { ms, check: match[7] ? undefined : { zone: canonicalZone(zone), label: zone, instantMs: ms, localMs } };
}

/**
 * Times are always converted with the standard time-zone database, never with a calendar's own rules. If the file
 * also embeds a definition for the same zone, that definition must be one this reader can evaluate, and it must show
 * the flight's wall-clock time at exactly one instant, the instant the database produced. A definition that gives a
 * different instant, shows that wall time twice (an overlap) or never (a gap) is refused rather than imported at a
 * time the traveller's own calendar might read differently.
 */
function assertZoneAgrees({ zone, label, instantMs, localMs }: ZoneCheck, definitions: Map<string, ZoneDefinition[]>): void {
  const matches = definitions.get(zone);
  if (!matches) return;
  if (matches.length > 1 || !matches[0].usable) throw new Error(`The calendar defines the time zone ${label} in a way that cannot be checked safely. Enter the flight times manually.`);
  const definition = matches[0];
  const offsets = new Set(definition.observances.flatMap((observance) => [observance.fromMs as number, observance.toMs as number]));
  const instants = new Set<number>();
  for (const offset of offsets) if (embeddedOffsetAt(definition, localMs - offset) === offset) instants.add(localMs - offset);
  if (instants.size !== 1 || !instants.has(instantMs)) {
    throw new Error(`The calendar describes the time zone ${label} differently from the standard time-zone database, so its times could not safely be imported. Enter the flight times manually.`);
  }
}

/** Restricted RFC 5545 reader, run in the browser only. No remote attachments, recurrence expansion or calendar timezone code is executed. */
export function parseFlightCalendar(text: string): { events: CalendarFlightEvent[]; skipped: number } {
  if (new TextEncoder().encode(text).length > MAX_FLIGHT_CALENDAR_BYTES) throw new Error('Choose a flight calendar file smaller than 128 KB.');
  if (text.includes('\0')) throw new Error('This calendar file could not be read.');
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  if (!lines.some((line) => line.toUpperCase() === 'BEGIN:VCALENDAR')) throw new Error('Choose an .ics calendar file from your flight booking.');
  const candidates: { event: CalendarFlightEvent; checks: ZoneCheck[] }[] = [];
  const definitions = new Map<string, ZoneDefinition[]>();
  let properties: Record<string, CalendarProperty[]> | undefined;
  let zone: { tzids: string[]; observances: Observance[]; usable: boolean } | undefined;
  let observance: Observance | undefined;
  const components: string[] = [];
  let closed = false;
  let total = 0;
  let skipped = 0;
  let lastError = '';
  for (const line of lines) {
    if (!line) continue;
    if (/^BEGIN:/i.test(line)) {
      const component = line.slice(6).toUpperCase();
      if (!components.length && (component !== 'VCALENDAR' || closed)) throw new Error('This calendar contains an incomplete event or calendar.');
      if (component === 'VCALENDAR' && components.length) throw new Error('This calendar contains an incomplete event or calendar.');
      if (component === 'VEVENT') {
        if (properties || components.length !== 1) throw new Error('This calendar contains an incomplete event.');
        if (++total > MAX_EVENTS) throw new Error('Choose a calendar file with no more than 50 events.');
        properties = {};
      }
      if (component === 'VTIMEZONE' && components.length === 1) zone = { tzids: [], observances: [], usable: true };
      else if (zone) {
        // Inside a VTIMEZONE only STANDARD/DAYLIGHT observances directly under it are understood; anything else is unsupported.
        if (components.length === 2 && (component === 'STANDARD' || component === 'DAYLIGHT')) observance = { seen: new Set() };
        else zone.usable = false;
      }
      components.push(component);
      continue;
    }
    if (/^END:/i.test(line)) {
      const component = line.slice(4).toUpperCase();
      if (components.pop() !== component) throw new Error('This calendar contains an incomplete event or calendar.');
      if (component === 'VCALENDAR') closed = true;
      if (zone && observance && components.length === 2 && (component === 'STANDARD' || component === 'DAYLIGHT')) {
        const { startLocalMs, fromMs, toMs, rule } = observance;
        const started = startLocalMs === undefined ? null : new Date(startLocalMs);
        // A recurring observance's DTSTART must itself fall on the rule's day; otherwise its meaning is undefined.
        const synchronised = !rule || (started !== null && started.getUTCMonth() === rule.month && started.getUTCDate() === dayOfMonth(started.getUTCFullYear(), rule));
        if (startLocalMs === undefined || fromMs === undefined || toMs === undefined || !synchronised || zone.observances.length >= MAX_OBSERVANCES) zone.usable = false;
        else zone.observances.push(observance);
        observance = undefined;
        continue;
      }
      if (component === 'VTIMEZONE' && zone && components.length === 1) {
        const finished = zone;
        zone = undefined;
        // A definition naming several zones, or none, or with no observances, cannot vouch for any of them.
        const usable = finished.usable && finished.tzids.length === 1 && finished.observances.length > 0;
        for (const tzid of finished.tzids.length ? finished.tzids.map(canonicalZone) : ['']) definitions.set(tzid, [...(definitions.get(tzid) ?? []), { observances: finished.observances, usable }]);
        continue;
      }
      if (component !== 'VEVENT' || !properties) continue;
      const event = properties;
      properties = undefined;
      try {
        if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some((name) => event[name]) || event.STATUS?.some((p) => p.value.toUpperCase() === 'CANCELLED')) throw new Error('Recurring and cancelled events are not imported.');
        if (event.DTSTART?.length !== 1 || event.DTEND?.length !== 1) throw new Error('The calendar must give one departure and one arrival time for the event.');
        const departs = instant(event.DTSTART[0]);
        const arrives = instant(event.DTEND[0]);
        if (arrives.ms <= departs.ms || arrives.ms - departs.ms > 72 * 60 * 60 * 1000) throw new Error('Choose a flight event that ends after departure and lasts no more than 72 hours.');
        const title = (event.SUMMARY?.[0]?.value ?? 'Flight calendar event').replace(/\\([nN,;\\])/g, (_, c: string) => /n/i.test(c) ? ' ' : c).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
        candidates.push({
          event: { id: String(total), title: title || 'Flight calendar event', departsMs: departs.ms, arrivesMs: arrives.ms },
          checks: [departs.check, arrives.check].filter((check): check is ZoneCheck => check !== undefined),
        });
      } catch (error) {
        skipped++; lastError = error instanceof Error ? error.message : 'The event could not be read.';
      }
      continue;
    }
    if (!components.length) throw new Error('Choose a complete .ics calendar file from your flight booking.');
    if (components.length === 1 && /^METHOD:CANCEL$/i.test(line)) throw new Error('This is a cancelled calendar invitation. Use the current flight booking.');
    if (zone && components[1] === 'VTIMEZONE') {
      // Only the zone's name and its observances' start, offsets and yearly rule are read; no calendar code is executed.
      const colon = line.indexOf(':');
      const header = colon < 0 ? line : line.slice(0, colon);
      const name = header.split(';')[0].toUpperCase();
      const value = colon < 0 ? '' : line.slice(colon + 1);
      if (components.length === 2) {
        if (name === 'TZID') zone.tzids.push(value.replace(/^"(.*)"$/, '$1'));
      } else if (components.length === 3 && observance) {
        const duplicate = observance.seen.has(name);
        observance.seen.add(name);
        if (['RDATE', 'EXDATE'].includes(name) || (['DTSTART', 'TZOFFSETFROM', 'TZOFFSETTO', 'RRULE'].includes(name) && duplicate)) zone.usable = false;
        else if (name === 'DTSTART') {
          const start = header.includes(';') ? null : localMsOf(value);
          if (start === null) zone.usable = false; else observance.startLocalMs = start;
        } else if (name === 'TZOFFSETFROM' || name === 'TZOFFSETTO') {
          const offset = offsetOf(value);
          if (offset === null) zone.usable = false; else if (name === 'TZOFFSETFROM') observance.fromMs = offset; else observance.toMs = offset;
        } else if (name === 'RRULE') {
          const rule = yearlyRuleOf(value);
          if (rule === null) zone.usable = false; else observance.rule = rule;
        }
      }
      continue;
    }
    if (!properties || components.length !== 2 || components[1] !== 'VEVENT') continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const header = line.slice(0, colon);
    const name = header.split(';')[0].toUpperCase();
    if (!['DTSTART', 'DTEND', 'SUMMARY', 'STATUS', 'RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].includes(name)) continue;
    (properties[name] ??= []).push({ header, value: line.slice(colon + 1) });
  }
  if (properties || components.length || !closed) throw new Error('This calendar contains an incomplete event or calendar.');
  const events: CalendarFlightEvent[] = [];
  for (const { event, checks } of candidates) {
    try {
      checks.forEach((check) => assertZoneAgrees(check, definitions));
      events.push(event);
    } catch (error) {
      skipped++; lastError = error instanceof Error ? error.message : 'The event could not be read.';
    }
  }
  if (!events.length) throw new Error(lastError || 'No timed flight events were found. Enter the flight times manually.');
  return { events, skipped };
}

/** Convert calendar instants to the selected airports' clocks, never the device's clock. Round conservatively. */
export function calendarFlightTimes(event: CalendarFlightEvent, departureZone: string, arrivalZone: string): { departsLocal: string; arrivesLocal: string } {
  const departure = Math.floor(event.departsMs / 60000) * 60000;
  const arrival = Math.ceil(event.arrivesMs / 60000) * 60000;
  try {
    const departsLocal = formatLocalDateTime(departure, departureZone);
    const arrivesLocal = formatLocalDateTime(arrival, arrivalZone);
    const start = parseLocalDateTime(departsLocal, departureZone);
    const end = parseLocalDateTime(arrivesLocal, arrivalZone);
    if (!start.ok || !end.ok || start.ms !== departure || end.ms !== arrival) throw new Error('ambiguous');
    return { departsLocal, arrivesLocal };
  } catch {
    throw new Error('These times are ambiguous on an airport clock-change day. Enter and check the flight times manually.');
  }
}
