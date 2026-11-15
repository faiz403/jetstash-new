import { formatLocalDateTime, parseLocalDateTime } from './local-time';

export const MAX_FLIGHT_CALENDAR_BYTES = 128 * 1024;
const MAX_EVENTS = 50;

export interface CalendarFlightEvent {
  id: string;
  title: string;
  departsMs: number;
  arrivesMs: number;
}

interface CalendarProperty { header: string; value: string }

function instant(property: CalendarProperty): number {
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
  return parsed.ms + Number(match[6]) * 1000;
}

/** Restricted RFC 5545 reader, run in the browser only. No remote attachments, recurrence expansion or calendar timezone code is executed. */
export function parseFlightCalendar(text: string): { events: CalendarFlightEvent[]; skipped: number } {
  if (new TextEncoder().encode(text).length > MAX_FLIGHT_CALENDAR_BYTES) throw new Error('Choose a flight calendar file smaller than 128 KB.');
  if (text.includes('\0')) throw new Error('This calendar file could not be read.');
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  if (!lines.some((line) => line.toUpperCase() === 'BEGIN:VCALENDAR')) throw new Error('Choose an .ics calendar file from your flight booking.');
  const events: CalendarFlightEvent[] = [];
  let properties: Record<string, CalendarProperty[]> | undefined;
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
      components.push(component);
      continue;
    }
    if (/^END:/i.test(line)) {
      const component = line.slice(4).toUpperCase();
      if (components.pop() !== component) throw new Error('This calendar contains an incomplete event or calendar.');
      if (component === 'VCALENDAR') closed = true;
      if (component !== 'VEVENT' || !properties) continue;
      const event = properties;
      properties = undefined;
      try {
        if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some((name) => event[name]) || event.STATUS?.some((p) => p.value.toUpperCase() === 'CANCELLED')) throw new Error('Recurring and cancelled events are not imported.');
        if (event.DTSTART?.length !== 1 || event.DTEND?.length !== 1) throw new Error('The calendar must give one departure and one arrival time for the event.');
        const departsMs = instant(event.DTSTART[0]);
        const arrivesMs = instant(event.DTEND[0]);
        if (arrivesMs <= departsMs || arrivesMs - departsMs > 72 * 60 * 60 * 1000) throw new Error('Choose a flight event that ends after departure and lasts no more than 72 hours.');
        const title = (event.SUMMARY?.[0]?.value ?? 'Flight calendar event').replace(/\\([nN,;\\])/g, (_, c: string) => /n/i.test(c) ? ' ' : c).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
        events.push({ id: String(total), title: title || 'Flight calendar event', departsMs, arrivesMs });
      } catch (error) {
        skipped++; lastError = error instanceof Error ? error.message : 'The event could not be read.';
      }
      continue;
    }
    if (!components.length) throw new Error('Choose a complete .ics calendar file from your flight booking.');
    if (components.length === 1 && /^METHOD:CANCEL$/i.test(line)) throw new Error('This is a cancelled calendar invitation. Use the current flight booking.');
    if (!properties || components.length !== 2 || components[1] !== 'VEVENT') continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const header = line.slice(0, colon);
    const name = header.split(';')[0].toUpperCase();
    if (!['DTSTART', 'DTEND', 'SUMMARY', 'STATUS', 'RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].includes(name)) continue;
    (properties[name] ??= []).push({ header, value: line.slice(colon + 1) });
  }
  if (properties || components.length || !closed) throw new Error('This calendar contains an incomplete event or calendar.');
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
