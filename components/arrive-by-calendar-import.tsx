'use client';

import { useState, type ChangeEvent } from 'react';
import { MAX_FLIGHT_CALENDAR_BYTES, calendarFlightTimes, parseFlightCalendar, type CalendarFlightEvent } from '@/lib/arrive-by-journey/calendar-flight';

interface CalendarAirport { code: string; name: string; timeZone: string }

export function ArriveByCalendarImport({ departure, arrival, onApply }: {
  departure?: CalendarAirport;
  arrival?: CalendarAirport;
  onApply: (times: { departsLocal: string; arrivesLocal: string }) => void;
}) {
  const [events, setEvents] = useState<CalendarFlightEvent[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setEvents([]); setSelected(''); setError(''); setNotice('');
    if (!file) return;
    if (file.size > MAX_FLIGHT_CALENDAR_BYTES) { setError('Choose a flight calendar file smaller than 128 KB.'); return; }
    setReading(true);
    try {
      const parsed = parseFlightCalendar(await file.text());
      setEvents(parsed.events); setSelected(parsed.events[0].id);
      if (parsed.skipped) setNotice(`${parsed.skipped} event${parsed.skipped === 1 ? ' was' : 's were'} skipped because the times could not safely be imported.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The calendar file could not be read.'); }
    finally { setReading(false); }
  }
  const event = events.find((item) => item.id === selected);
  let times: { departsLocal: string; arrivesLocal: string } | undefined;
  let previewError = '';
  if (event && departure && arrival) {
    try { times = calendarFlightTimes(event, departure.timeZone, arrival.timeZone); }
    catch (reason) { previewError = reason instanceof Error ? reason.message : 'The times could not be converted.'; }
  }
  return <details className="rounded-sm border border-ink-200 bg-white p-3">
    <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-ink-900">Use a flight calendar file <span className="font-normal text-ink-500">(optional)</span></summary>
    <p className="mt-2 text-sm text-ink-600">If your booking includes an .ics calendar file, you can copy its times into the form. Choose your airports first and check the preview against your booking.</p>
    <p className="mt-2 text-xs text-ink-500">The file stays in your browser. It is not uploaded or saved. This does not verify a flight or check for schedule changes.</p>
    <label className="mt-3 block text-sm text-ink-900">Flight calendar file
      <input type="file" accept=".ics,text/calendar" onChange={(e) => { void readFile(e); }} disabled={reading} className="mt-1 block min-h-11 w-full text-base" />
    </label>
    {reading && <p role="status" className="mt-2 text-sm text-ink-600">Reading calendar times…</p>}
    {events.length > 1 && <label className="mt-3 block text-sm text-ink-900">Choose the flight event
      <select value={selected} onChange={(e) => { setSelected(e.target.value); setNotice(''); }} className="mt-1 min-h-11 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-base text-ink-900">
        {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>}
    {times && departure && arrival && <div className="mt-3 text-sm text-ink-700">
      <p className="font-semibold">{event?.title}</p>
      <p className="mt-1">Departs {departure.code}: {times.departsLocal.replace('T', ' ')} ({departure.timeZone})</p>
      <p>Arrives {arrival.code}: {times.arrivesLocal.replace('T', ' ')} ({arrival.timeZone})</p>
      <p className="mt-2">For a connecting journey, the event must cover your first departure and final landing. A calendar event for just one flight leg is not enough.</p>
      <button type="button" onClick={() => { if (!times) return; onApply(times); setNotice('Calendar times added. Check both airports, both dates and the connection setting before calculating.'); }} className="mt-3 min-h-11 rounded-sm border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-sand-100">Use these flight times</button>
    </div>}
    {(error || previewError) && <p role="alert" className="mt-2 text-sm text-terracotta-700">{error || previewError}</p>}
    {notice && <p role="status" className="mt-2 text-sm text-ink-600">{notice}</p>}
  </details>;
}
