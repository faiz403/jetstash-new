'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { planDoorJourney, type DoorJourney, type DoorComparison, type FlexibleTransport, type ScheduledTransport, type Place, type DoorOptionResult } from '@/lib/arrive-by/door-to-door';
import { blankDoorJourney, blankScheduled, blankTurnUpAndGo, exampleDoorJourney } from '@/lib/arrive-by/door-example';
import type { OperatingWindow, TurnUpAndGoTransport, Weekday } from '@/lib/arrive-by/turn-up-and-go';
import type { LocalMoment } from '@/lib/arrive-by/deadline-comparison';
import type { ZonedDateTime } from '@/lib/arrive-by/types';

const field = 'mt-1 w-full min-w-0 rounded-sm border border-ink-200 bg-white px-3 py-2 text-base text-ink-900';
const button = 'rounded-sm border border-ink-200 px-4 py-2 text-sm font-semibold';
const zoneChoices = ['Europe/London', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Qatar', 'Asia/Riyadh', 'Asia/Dhaka'];
const flexibleModes = ['car', 'taxi', 'rickshaw', 'walk', 'family pickup'] as const;
const fmt = (value?: ZonedDateTime) => value ? `${value.dateIso} ${value.timeHHmm} · ${value.timeZone}` : 'Not established';
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
function NumberField({ label, value, change, max = 10080 }: { label: string; value: number | null; change: (value: number | null) => void; max?: number }) {
  return <label className="block min-w-0 text-sm">{label}<input aria-label={label} className={field} type="number" min="0" max={max} step="1" value={value ?? ''} onChange={(e) => change(e.target.value === '' ? null : Number(e.target.value))} /></label>;
}
function Zone({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <label className="block min-w-0 text-sm">{label}<select aria-label={label} className={field} value={value} onChange={(e) => change(e.target.value)}>{zoneChoices.map((zone) => <option key={zone}>{zone}</option>)}</select></label>;
}
function Location({ label, value, change }: { label: string; value: Place; change: (value: Place) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2"><label className="min-w-0 text-sm">{label}<input aria-label={label} maxLength={120} className={field} value={value.name} onChange={(e) => change({ ...value, name: e.target.value })} /></label><Zone label={`${label} time zone`} value={value.timeZone} change={(timeZone) => change({ ...value, timeZone })} /></div>;
}
function Moment({ label, value, change, showZone = true }: { label: string; value: LocalMoment; change: (value: LocalMoment) => void; showZone?: boolean }) {
  return <div className="grid gap-3 sm:grid-cols-3"><label className="min-w-0 text-sm">{label} date<input aria-label={`${label} date`} className={field} type="date" value={value.date} onChange={(e) => change({ ...value, date: e.target.value })} /></label><label className="min-w-0 text-sm">{label} time<input aria-label={`${label} time`} className={field} type="time" value={value.time} onChange={(e) => change({ ...value, time: e.target.value })} /></label>{showZone && <Zone label={`${label} time zone`} value={value.timeZone} change={(timeZone) => change({ ...value, timeZone })} />}</div>;
}
function Panel({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className="rounded-md border border-ink-200 bg-white p-4 sm:p-5"><summary className="cursor-pointer font-semibold">{title}</summary><div className="mt-4 space-y-4">{children}</div></details>;
}
function FlexibleFields({ title, value, change }: { title: string; value: FlexibleTransport; change: (value: FlexibleTransport) => void }) {
  return <div className="grid gap-3 sm:grid-cols-3"><label className="min-w-0 text-sm">{title} mode<select aria-label={`${title} mode`} className={field} value={value.mode} onChange={(e) => change({ ...value, mode: e.target.value as FlexibleTransport['mode'] })}>{flexibleModes.map((mode) => <option key={mode}>{mode}</option>)}</select></label><NumberField label={`${title} duration (min)`} value={value.minutes} change={(minutes) => change({ ...value, minutes })} /><NumberField label={`${title} buffer (min)`} value={value.buffer} change={(buffer) => change({ ...value, buffer })} /></div>;
}
function Timetable({ label, value, change }: { label: string; value: ScheduledTransport; change: (value: ScheduledTransport) => void }) {
  return <div className="space-y-4">
    <label className="block text-sm">{label} mode<select aria-label={`${label} mode`} className={field} value={value.mode} onChange={(e) => change({ ...value, mode: e.target.value as ScheduledTransport['mode'] })}>{['train', 'bus', 'coach', 'ferry'].map((mode) => <option key={mode}>{mode}</option>)}</select></label>
    <Location label={`${label} from stop`} value={value.from} change={(from) => change({ ...value, from, services: value.services.map((s) => ({ ...s, departure: { ...s.departure, timeZone: from.timeZone } })) })} />
    <Location label={`${label} to stop`} value={value.to} change={(to) => change({ ...value, to, services: value.services.map((s) => ({ ...s, arrival: { ...s.arrival, timeZone: to.timeZone } })) })} />
    <NumberField label={`${label} required time before departure (min)`} value={value.minimumBeforeDeparture} change={(minimumBeforeDeparture) => change({ ...value, minimumBeforeDeparture })} />
    {!value.services.length && <p className="text-sm text-terracotta-700">NO SCHEDULED SERVICE PROVIDED</p>}
    {value.services.map((service, index) => {
      const update = (next: typeof service) => change({ ...value, services: value.services.map((s, i) => i === index ? next : s) });
      return <fieldset key={index} className="space-y-3 rounded-sm border border-ink-100 bg-sand-50 p-3"><legend className="px-1 text-sm font-semibold">{label} service {index + 1}</legend>
        <label className="block text-sm">Service name<input aria-label={`${label} service ${index + 1} name`} className={field} value={service.id} maxLength={100} onChange={(e) => update({ ...service, id: e.target.value })} /></label>
        <Moment label={`${label} ${index + 1} departure`} value={service.departure} showZone={false} change={(departure) => update({ ...service, departure })} />
        <Moment label={`${label} ${index + 1} arrival`} value={service.arrival} showZone={false} change={(arrival) => update({ ...service, arrival })} />
        <p className="text-xs text-ink-500">Departure: {value.from.timeZone}. Arrival: {value.to.timeZone}. Enter the actual arrival date, including overnight services.</p>
        <button className={button} type="button" onClick={() => change({ ...value, services: value.services.filter((_, i) => i !== index) })}>Remove {label.toLowerCase()} service {index + 1}</button>
      </fieldset>;
    })}
    <button className={button} type="button" disabled={value.services.length >= 8} onClick={() => change({ ...value, services: [...value.services, { id: '', departure: { date: '', time: '', timeZone: value.from.timeZone }, arrival: { date: '', time: '', timeZone: value.to.timeZone } }] })}>Add {label.toLowerCase()} service</button>
    <p className="text-xs text-ink-500">Up to eight manually entered services. Nothing here verifies a timetable, operating day or seat availability.</p>
  </div>;
}

const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Turn-up-and-go editor. Deliberately offers no place to type a departure
 * time: the whole point of this transport type is that individual departures
 * are not published, so the form must not invite one to be invented.
 */
function TurnUpAndGoFields({ label, value, change }: { label: string; value: TurnUpAndGoTransport; change: (value: TurnUpAndGoTransport) => void }) {
  const setWindow = (index: number, next: OperatingWindow) => change({ ...value, operatingWindows: value.operatingWindows.map((w, i) => i === index ? next : w) });
  return <div className="space-y-4">
    <label className="block text-sm">{label} mode<select aria-label={`${label} mode`} className={field} value={value.mode} onChange={(e) => change({ ...value, mode: e.target.value as TurnUpAndGoTransport['mode'] })}>{['metro', 'urban rail', 'frequent bus'].map((mode) => <option key={mode}>{mode}</option>)}</select></label>
    <Location label={`${label} from stop`} value={value.from} change={(from) => change({ ...value, from })} />
    <Location label={`${label} to stop`} value={value.to} change={(to) => change({ ...value, to })} />
    <NumberField label={`${label} station access allowance (min)`} value={value.minimumBeforeDeparture} change={(minimumBeforeDeparture) => change({ ...value, minimumBeforeDeparture })} />
    {!value.operatingWindows.length && <p className="text-sm text-terracotta-700">NO OPERATING WINDOW PROVIDED</p>}
    {value.operatingWindows.map((window, index) => <fieldset key={index} className="space-y-3 rounded-sm border border-ink-100 bg-sand-50 p-3">
      <legend className="px-1 text-sm font-semibold">Operating window {index + 1}</legend>
      <div className="flex flex-wrap gap-2">{weekdays.map((day) => <label key={day} className="flex items-center gap-1 text-xs"><input type="checkbox" aria-label={`Window ${index + 1} ${day}`} checked={window.days.includes(day)} onChange={(e) => setWindow(index, { ...window, days: e.target.checked ? [...window.days, day] : window.days.filter((d) => d !== day) })} />{day}</label>)}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm">Opens<input aria-label={`Window ${index + 1} opens`} className={field} type="time" value={window.opens} onChange={(e) => setWindow(index, { ...window, opens: e.target.value })} /></label>
        <label className="min-w-0 text-sm">Closes<input aria-label={`Window ${index + 1} closes`} className={field} type="time" value={window.closes} onChange={(e) => setWindow(index, { ...window, closes: e.target.value })} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`Window ${index + 1} closes next day`} checked={window.closesNextDay} onChange={(e) => setWindow(index, { ...window, closesNextDay: e.target.checked })} />Closes after midnight, on the following day</label>
      <button className={button} type="button" onClick={() => change({ ...value, operatingWindows: value.operatingWindows.filter((_, i) => i !== index) })}>Remove window {index + 1}</button>
    </fieldset>)}
    <button className={button} type="button" disabled={value.operatingWindows.length >= 8} onClick={() => change({ ...value, operatingWindows: [...value.operatingWindows, { days: [], opens: '', closes: '', closesNextDay: false }] })}>Add operating window</button>
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberField label={`${label} journey duration (min)`} value={value.journeyMinutes} change={(journeyMinutes) => change({ ...value, journeyMinutes })} />
      <label className="block min-w-0 text-sm">Journey duration basis<select aria-label="Journey duration basis" className={field} value={value.journeyMinutesBasis} onChange={(e) => change({ ...value, journeyMinutesBasis: e.target.value as TurnUpAndGoTransport['journeyMinutesBasis'] })}><option value="OFFICIAL">OFFICIAL</option><option value="ASSUMPTION">ASSUMPTION</option></select></label>
    </div>
    <fieldset className="space-y-3 rounded-sm border border-ink-100 p-3">
      <legend className="px-1 text-sm font-semibold">How long you might wait</legend>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Official service frequency published" checked={value.headwayMinutes !== null} onChange={(e) => change({ ...value, headwayMinutes: e.target.checked ? { min: 0, max: 0 } : null })} />An official service frequency is published for this line</label>
      {value.headwayMinutes && <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Frequency: shortest gap (min)" value={value.headwayMinutes.min} change={(min) => change({ ...value, headwayMinutes: { min: min ?? 0, max: value.headwayMinutes!.max } })} />
        <NumberField label="Frequency: longest gap (min)" value={value.headwayMinutes.max} change={(max) => change({ ...value, headwayMinutes: { min: value.headwayMinutes!.min, max: max ?? 0 } })} />
      </div>}
      {!value.headwayMinutes && <NumberField label="Planning wait allowance (min) — ASSUMPTION" value={value.plannedWaitMinutes} change={(plannedWaitMinutes) => change({ ...value, plannedWaitMinutes })} />}
      <p className="text-xs text-ink-500">An official frequency plans on its longest published gap. With no official frequency, an entered allowance may be used but is reported as an assumption. With neither, availability is still reported but the arrival time is not.</p>
    </fieldset>
    <p className="text-xs text-ink-500">Turn-up-and-go transport has no individual departures to enter. Operating hours are treated as evidence; everything else is labelled by its basis.</p>
  </div>;
}

export function ArriveByDoorToDoor() {
  const [journey, setJourney] = useState<DoorJourney>(blankDoorJourney);
  const [example, setExample] = useState(false);
  const [result, setResult] = useState<DoorComparison | null>(null);
  // Optional, display-only — never sent into planDoorJourney or used in any
  // arithmetic (see door-to-door.ts's PLAN FRAGILITY CORRECTION notes).
  // Names WHY the deadline exists ("race start", "check-in closes") so the
  // headline reads as a real reason a traveller supplied, not a bare clock
  // time — Tester 2's own scenario (Abu Dhabi Grand Prix start time).
  const [deadlineReason, setDeadlineReason] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);
  function update<K extends keyof DoorJourney>(key: K, value: DoorJourney[K]) { setResult(null); setJourney((current) => ({ ...current, [key]: value })); }
  function submit(event: FormEvent) { event.preventDefault(); setResult(planDoorJourney(journey, new Date().toISOString())); }
  return <div className="mx-auto max-w-6xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Founder prototype · local · unvalidated</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">Arrive By — the whole journey, worked backwards.</h1>
    <p className="mt-3 max-w-3xl text-ink-600">Start with the place and deadline. Compare the earliest onward service that fits each flight with the latest service that still preserves your arrival requirement.</p>
    <p className="mt-2 max-w-3xl text-sm text-ink-500">Planning allowances are not guarantees. All times, fares and services are entered manually; connections within a flight itinerary need separate confirmation. Nothing is searched, saved or sent.</p>
    {/*
      START-BLANK STATE ISOLATION (24 Sep 2026): `deadlineReason` lives in
      its own React state, deliberately outside `journey` (it is display-only,
      never calculation input -- see its declaration above). That also meant
      it was the one piece of journey-specific state neither button reset:
      `journey` itself is always fully REPLACED by a fresh object here, so
      every field on it already starts clean; `deadlineReason` needed its
      own explicit reset alongside it.
    */}
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={button} onClick={() => { setJourney(exampleDoorJourney()); setExample(true); setResult(null); setDeadlineReason(''); }}>Load fictional Preston → Ahmedabad example</button><button type="button" className={button} onClick={() => { setJourney(blankDoorJourney()); setExample(false); setResult(null); setDeadlineReason(''); }}>Start blank</button></div>
    {example && <p className="mt-3 rounded-sm border border-brass/40 bg-brass-50 p-3 text-sm">FICTIONAL TEST DATA — these flights, fares, stations and services are not real travel evidence. Replace every relevant entry before using this with a traveller.</p>}
    <form noValidate onSubmit={submit} onChange={() => setResult(null)} className="mt-6 space-y-4">
      <Panel title="1. Final destination and deadline" open>
        <Location label="Final destination" value={journey.destination} change={(destination) => { setResult(null); setJourney((current) => ({ ...current, destination, deadline: { ...current.deadline, timeZone: destination.timeZone } })); }} />
        <Moment label="Final deadline" value={journey.deadline} showZone={false} change={(deadline) => update('deadline', deadline)} />
        <label className="block text-sm">Reason for this deadline (optional)<input aria-label="Reason for this deadline" maxLength={140} className={field} placeholder="e.g. race start, check-in closes, ceremony begins" value={deadlineReason} onChange={(e) => setDeadlineReason(e.target.value)} /></label>
        <p className="text-xs text-ink-500">Deadline is local to {journey.destination.timeZone}. Place names are labels, not map lookups. The reason is shown alongside the result — it is never used in any calculation.</p>
        <div className="grid gap-4 sm:grid-cols-2"><NumberField label="Required final arrival buffer (min)" value={journey.finalBuffer} change={(value) => update('finalBuffer', value)} /><NumberField label="Extra connection cushion (min)" value={journey.connectionCushion} change={(value) => update('connectionCushion', value)} /></div>
        <p className="text-xs text-ink-500">The final buffer is a required part of this plan. A journey can reach the deadline yet return NO because it does not leave that buffer; the reason is shown. Set it to 0 explicitly if the deadline alone is your constraint.</p>
        <p className="text-xs text-ink-500">Onward selection requires the boarding allowance PLUS your extra cushion before departure. Home departure also includes the cushion. Onward checks include the cushion in the required allowance. Pre-flight checks also flag spare airport time below your chosen cushion as TIGHT. These are planning assumptions, not a safety guarantee or a universal minimum.</p>
      </Panel>
      <Panel title="2. Final mile to the house, hotel or event"><FlexibleFields title="Final mile" value={journey.finalMile} change={(value) => update('finalMile', value)} /><p className="text-xs text-ink-500">From the onward service’s destination stop, or directly from the arrival airport if no scheduled service is selected. Include the full remaining journey.</p></Panel>
      <Panel title="3. Scheduled transport after the airport">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={journey.onward !== null} onChange={(e) => update('onward', e.target.checked ? blankScheduled(journey.arrivalAirport.timeZone, journey.destination.timeZone) : null)} />Use public transport after arrival</label>
        {journey.onward && <label className="block text-sm">Onward transport type<select aria-label="Onward transport type" className={field} value={journey.onward.kind} onChange={(e) => update('onward', e.target.value === 'scheduled' ? blankScheduled(journey.arrivalAirport.timeZone, journey.destination.timeZone) : blankTurnUpAndGo(journey.arrivalAirport.timeZone, journey.destination.timeZone))}>
          <option value="scheduled">Fixed timetable — train, coach, bus, ferry with published departures</option>
          <option value="turn-up-and-go">Turn-up-and-go — metro or high-frequency transit with no published departures</option>
        </select></label>}
        {journey.onward?.kind === 'scheduled' && <Timetable label="Onward" value={journey.onward} change={(value) => update('onward', value)} />}
        {journey.onward?.kind === 'turn-up-and-go' && <TurnUpAndGoFields label="Onward" value={journey.onward} change={(value) => update('onward', value)} />}
        {!journey.onward && <p className="text-sm text-ink-500">No public transport leg: the final-mile estimate covers transport from the airport to your destination.</p>}
      </Panel>
      <Panel title="4. Arrival airport and processing allowances">
        <Location label="Arrival airport" value={journey.arrivalAirport} change={(arrivalAirport) => { setResult(null); setJourney((current) => ({ ...current, arrivalAirport, flights: current.flights.map((f) => ({ ...f, landing: { ...f.landing, timeZone: arrivalAirport.timeZone } })) })); }} />
        <div className="grid gap-3 sm:grid-cols-2">{([['disembark', 'Taxiing / disembarkation'], ['immigration', 'Immigration'], ['baggage', 'Baggage collection'], ['customs', 'Customs / exit'], ['walkToTransport', 'Walk / transfer to onward transport']] as const).map(([key, label]) => <NumberField key={key} label={`${label} allowance (min)`} value={journey.arrivalProcess[key]} change={(value) => update('arrivalProcess', { ...journey.arrivalProcess, [key]: value })} />)}</div>
        <p className="text-xs text-ink-500">Do not double-count taxiing if already included in the entered arrival time. Enter 0 explicitly for stages that do not apply; blank means unknown.</p>
      </Panel>
      <Panel title="5. Flight options" open>
        <p className="text-sm text-ink-500">Both options use the airports entered in sections 4 and 6. Enter the full itinerary’s departure and arrival, including any next-day date. Internal flight connections are not evaluated.</p>
        {journey.flights.map((flight, index) => {
          const change = (next: typeof flight) => update('flights', journey.flights.map((f, i) => i === index ? next : f));
          return <fieldset key={index} className="space-y-3 rounded-sm border border-ink-200 p-3"><legend className="px-2 font-semibold">Option {index === 0 ? 'A' : 'B'}</legend>
            <label className="block text-sm">Flight label<input aria-label={`Flight ${index + 1} label`} className={field} maxLength={100} value={flight.label} onChange={(e) => change({ ...flight, label: e.target.value })} /></label>
            <Moment label={`Flight ${index + 1} departure`} value={flight.departure} showZone={false} change={(departure) => change({ ...flight, departure })} />
            <Moment label={`Flight ${index + 1} landing`} value={flight.landing} showZone={false} change={(landing) => change({ ...flight, landing })} />
            <p className="text-xs text-ink-500">Departure: {flight.departure.timeZone}. Landing: {flight.landing.timeZone}.</p>
            <NumberField label={`Flight ${index + 1} entered fare GBP (optional)`} value={flight.priceGBP} max={1000000} change={(priceGBP) => change({ ...flight, priceGBP })} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" aria-label={`Flight ${index + 1} has an unmodelled internal connection`} checked={flight.hasUnmodelledConnection} onChange={(e) => change({ ...flight, hasUnmodelledConnection: e.target.checked })} /><span>This itinerary includes a flight connection (changing planes) — Arrive By does not check connection time, terminal transfer, baggage/re-check or ticket protection</span></label>
          </fieldset>;
        })}
        <button className={button} type="button" onClick={() => update('flights', journey.flights.length === 2 ? journey.flights.slice(0, 1) : [...journey.flights, { label: 'Option B', priceGBP: null, hasUnmodelledConnection: false, departure: { date: '', time: '', timeZone: journey.departureAirport.timeZone }, landing: { date: '', time: '', timeZone: journey.arrivalAirport.timeZone } }])}>{journey.flights.length === 2 ? 'Remove flight B' : 'Add flight B'}</button>
      </Panel>
      <Panel title="6. Departure airport and check-in / security">
        <Location label="Departure airport" value={journey.departureAirport} change={(departureAirport) => { setResult(null); setJourney((current) => ({ ...current, departureAirport, flights: current.flights.map((f) => ({ ...f, departure: { ...f.departure, timeZone: departureAirport.timeZone } })) })); }} />
        <div className="grid gap-3 sm:grid-cols-2">{([['terminalTransfer', 'Station / drop-off to terminal'], ['checkIn', 'Check-in / bag drop'], ['security', 'Security'], ['boarding', 'Gate / boarding']] as const).map(([key, label]) => <NumberField key={key} label={`${label} allowance (min)`} value={journey.departureProcess[key]} change={(value) => update('departureProcess', { ...journey.departureProcess, [key]: value })} />)}</div>
        <p className="text-xs text-ink-500">These stages sum to the required lead time before departure. Use airline/airport guidance; this tool does not verify check-in or gate deadlines.</p>
      </Panel>
      <Panel title="7. Home to departure airport">
        <Location label="Home / start" value={journey.home} change={(value) => update('home', value)} />
        <label className="block text-sm">Travel type<select aria-label="Travel type to departure airport" className={field} value={journey.toAirport.kind} onChange={(e) => update('toAirport', e.target.value === 'scheduled' ? blankScheduled(journey.home.timeZone, journey.departureAirport.timeZone) : { kind: 'flexible', mode: 'car', minutes: null, buffer: null })}><option value="flexible">Car / taxi / walking / pickup</option><option value="scheduled">Scheduled train / bus / coach / ferry</option></select></label>
        {journey.toAirport.kind === 'flexible' ? <FlexibleFields title="To airport" value={journey.toAirport} change={(value) => update('toAirport', value)} /> : <>
          <div className="grid gap-3 sm:grid-cols-2"><NumberField label="Home to first stop duration (min)" value={journey.homeAccess.minutes} change={(minutes) => update('homeAccess', { ...journey.homeAccess, minutes })} /><NumberField label="Home to first stop buffer (min)" value={journey.homeAccess.buffer} change={(buffer) => update('homeAccess', { ...journey.homeAccess, buffer })} /></div>
          <Timetable label="Before flight" value={journey.toAirport} change={(value) => update('toAirport', value)} />
        </>}
      </Panel>
      <button className="w-full rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white sm:w-auto" type="submit">Work backwards through my journey</button>
    </form>
    {result && <div ref={resultRef} tabIndex={-1} role="status" aria-live="polite" className="mt-8 scroll-mt-24 rounded-md border border-brass/40 bg-sand-50 p-4 outline-brass sm:p-6">
      <h2 className="font-display text-2xl">Does the whole journey fit?</h2>
      <p className="mt-2 text-sm">Based only on the entered services and allowances. YES is conditional planning arithmetic, not verified feasibility or an arrival promise.</p>
      {deadlineReason.trim() && <p className="mt-2 text-sm text-ink-600">You need to reach {journey.destination.name || 'your destination'} by {journey.deadline.time || 'the entered time'} for {deadlineReason.trim()}.</p>}
      {result.errors.length > 0 ? <><h3 className="mt-4 font-semibold">CANNOT CONFIRM YET</h3><ul className="mt-2 list-inside list-disc space-y-1 text-sm">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></> : <>
        {result.tradeOff && <p className="mt-4 rounded-sm border border-brass/30 bg-white p-4 text-sm">{result.tradeOff}</p>}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">{result.options.map((option, index) => <OptionResult key={index} value={option} />)}</div>
      </>}
      <p className="mt-5 text-sm font-medium">Confirm every service, date, connection, document requirement and allowance before booking. Delays can exceed the entered buffers; no claim is made about options not entered.</p>
    </div>}
  </div>;
}

/**
 * "YES" is not a single answer — a plan that meets its deadline comfortably
 * and one that meets it by ten minutes on its worst connection are both
 * "YES" under the raw arithmetic, but a traveller needs to know which one
 * they have before they decide. See door-to-door.ts's PLAN FRAGILITY
 * CORRECTION notes for why this exists and what it is derived from.
 */
function headline(value: DoorOptionResult): string {
  if (value.state === 'NO') return 'NO';
  if (value.state === 'CANNOT CONFIRM') return 'CANNOT CONFIRM';
  return value.confidence === 'FRAGILE' ? 'YES — BUT THIS PLAN IS FRAGILE' : 'YES — ROBUST';
}

/** "Final arrival requirement" or the connection's own label, for the weakest-point sentence. */
function weakestPointLabel(value: DoorOptionResult): string {
  if (!value.weakestConstraint) return 'Not established';
  return value.weakestConstraint.kind === 'final-arrival' ? 'Final arrival' : value.weakestConstraint.label;
}

/**
 * WHOLE-JOURNEY CONFIDENCE CORRECTION (24 Sep 2026): a plain-language
 * already-happened shortfall, never a negative "delay that breaks the
 * plan" figure -- that framing only makes sense for a plan that still
 * currently works. See door-to-door.ts's `alreadyMisses` doc comment.
 */
function alreadyMissesText(value: DoorOptionResult): string | null {
  if (!value.alreadyMisses) return null;
  return value.alreadyMisses.kind === 'deadline'
    ? `This plan already misses your clock deadline by ${value.alreadyMisses.minutes} min.`
    : `This plan already misses your required final buffer by ${value.alreadyMisses.minutes} min.`;
}

function keyOnwardServiceText(value: DoorOptionResult): string {
  if (value.onwardService) return value.onwardService;
  if (value.turnUpAndGo) return `${value.turnUpAndGo.mode} (turn-up-and-go — no individual departure)`;
  if (value.diagnosticOnwardService) return `${value.diagnosticOnwardService} (does not qualify — shown only to explain the failure)`;
  return 'None entered or not applicable';
}

function OptionResult({ value }: { value: DoorOptionResult }) {
  const selected = value.onwardServices.find((service) => service.selected);
  const showService = (service?: { id: string; departure: ZonedDateTime; arrival: ZonedDateTime }) => service ? `${service.id} · ${fmt(service.departure)} → ${fmt(service.arrival)}` : 'None established';
  const serviceTable = (label: string, services: DoorOptionResult['originServices']) => services.length > 0 && <div><h4 className="mt-4 font-semibold">{label}</h4><ul className="mt-2 space-y-3">{services.map((service, index) => <li key={index} className="rounded-sm border border-ink-100 p-2"><strong>{service.id}{service.selected ? ' — SELECTED' : ''}</strong><p>{fmt(service.departure)} → {fmt(service.arrival)}</p><p>{service.status}</p>{service.catchable === false && !service.fitsDownstream && <p>Also too late for the downstream deadline / buffer.</p>}</li>)}</ul></div>;
  return <article className="min-w-0 break-words rounded-md border border-ink-200 bg-white p-4">
    <h3 className="font-semibold">{value.label}</h3>
    <p className="mt-2 font-display text-2xl">{headline(value)} <span className="font-sans text-xs text-ink-500">— under entered assumptions</span></p>
    {value.unmodelledFlightConnection && <p className="mt-3 rounded-sm border border-terracotta-400 bg-terracotta-50 p-3 text-sm font-medium text-terracotta-700">This journey includes a flight connection that Arrive By has not checked. Connection time, terminal transfer, baggage/re-check requirements and ticket protection may affect whether it works.</p>}
    {alreadyMissesText(value) && <p className="mt-3 rounded-sm border border-terracotta-400 bg-terracotta-50 p-3 text-sm font-medium text-terracotta-700">{alreadyMissesText(value)}</p>}
    {value.confidence === 'FRAGILE' && value.weakestConstraint && <div className="mt-3 rounded-sm border border-terracotta-400 bg-terracotta-50 p-3 text-sm">
      <p className="font-semibold text-terracotta-700">This plan works, but has very little room for delay.</p>
      <p className="mt-1">You are expected to arrive at {fmt(value.finalArrival)}{value.deadlineMargin !== undefined ? `, ${value.deadlineMargin} min before the ${fmt(value.deadline)} deadline` : ''}. However, the weakest point in this plan is {weakestPointLabel(value).toLowerCase()}. About {value.weakestConstraint.spare} min of additional delay there would break this plan.</p>
      {/* PRIMARY PLAN VS FALLBACK RESILIENCE (24 Sep 2026, SIM-1): a tight
          primary connection and a comfortable fallback are two different
          facts -- neither should be allowed to hide the other. This never
          changes `confidence` itself; it only tells the traveller a real
          recovery option exists for the tight primary plan they are seeing. */}
      {value.fallbackOnward?.hasNextEntered && value.fallbackOnward.meetsDeadline && <p className="mt-1">Your planned connection is tight, but the next entered service still gets you there in time{value.fallbackOnward.meetsDeadlineWithBuffer ? '' : ' (though without your full required buffer)'}.</p>}
    </div>}
    <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{[
      ['Which option fits', `${value.label} — ${headline(value)}`],
      ['Leave home by', fmt(value.homeDeparture)],
      ['Key pre-flight service', value.originService ?? 'None entered or not applicable'],
      ['Key onward service', keyOnwardServiceText(value)],
      ['Planned final arrival', fmt(value.finalArrival)],
      ['Deadline', fmt(value.deadline)],
      ['Connection slack', value.tightest ? `${value.tightest.label}: ${value.tightest.spare} min` : 'Not established'],
      ...(value.turnUpAndGo?.windowSpareMinutes !== undefined ? [['Operating-window slack', `${value.turnUpAndGo.mode}: ${value.turnUpAndGo.windowSpareMinutes} min`]] : []),
      ['Final-arrival slack', value.alreadyMisses ? `Already missed (see above)` : value.finalArrivalSlack !== undefined ? `${value.finalArrivalSlack} min` : 'Not established'],
      ...(value.weakestConstraint ? [['Weakest point', `${weakestPointLabel(value)} — ${value.weakestConstraint.spare} min spare`]] : []),
    ].map(([label, text]) => <div key={label}><dt className="text-ink-500">{label}</dt><dd className="mt-0.5 font-medium">{text}</dd></div>)}</dl>
    {value.fallbackOnward && <div className="mt-4 rounded-sm border border-ink-200 bg-sand-50 p-3 text-sm">
      <p className="font-semibold">If you miss {value.onwardService ?? value.diagnosticOnwardService ?? 'this connection'}</p>
      <p className="mt-1">Fallback available: {value.fallbackOnward.hasNextEntered ? 'YES' : 'NO'}</p>
      {value.fallbackOnward.hasNextEntered ? <dl className="mt-2 space-y-1">
        <div><dt className="inline text-ink-500">Next entered service: </dt><dd className="inline">{value.fallbackOnward.nextService?.id} · {fmt(value.fallbackOnward.nextService?.departure)} → {fmt(value.fallbackOnward.nextService?.arrival)}</dd></div>
        <div><dt className="inline text-ink-500">Fallback final arrival: </dt><dd className="inline">{fmt(value.fallbackOnward.finalArrivalIfUsed)}</dd></div>
        <div><dt className="inline text-ink-500">Fallback meets required arrival: </dt><dd className="inline">{value.fallbackOnward.meetsDeadline ? 'YES' : 'NO'}{value.fallbackOnward.meetsDeadline && !value.fallbackOnward.meetsDeadlineWithBuffer ? ' (without the required final buffer)' : ''}</dd></div>
      </dl> : <p className="mt-1">NO FALLBACK HAS BEEN ENTERED. This does not mean no real-world alternative exists — only that none was entered into this plan.</p>}
    </div>}
    {value.state === 'YES' ? <FullDetail value={value} selected={selected} showService={showService} serviceTable={serviceTable} /> : (
      // MOBILE HIERARCHY (24 Sep 2026): a failed option's full technical
      // detail is compressed behind an expandable summary so it does not
      // push a successful sibling option below the fold on a phone — the
      // failure headline, action summary and already-misses wording above
      // stay visible either way. Never applied to a YES option; that
      // detail is deliberately still visible by default.
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">Why this doesn't work — full detail</summary>
        <div className="mt-3">
          <FullDetail value={value} selected={selected} showService={showService} serviceTable={serviceTable} />
        </div>
      </details>
    )}
  </article>;
}

function FullDetail({ value, selected, showService, serviceTable }: {
  value: DoorOptionResult;
  selected?: DoorOptionResult['originServices'][number];
  showService: (service?: { id: string; departure: ZonedDateTime; arrival: ZonedDateTime }) => string;
  serviceTable: (label: string, services: DoorOptionResult['originServices']) => ReactNode;
}) {
  return <>
    <p className="mt-3 text-sm font-semibold">{value.deadlineStatus}{value.deadlineStatus === 'MEETS REQUIREMENT' && value.deadlineMargin === 0 ? ' — exactly at the clock deadline, zero final buffer' : ''}</p>
    {value.diagnosticOnwardService && <p className="mt-3 rounded-sm bg-sand-50 p-3 text-sm">No qualifying onward service. The arrival below assesses {value.diagnosticOnwardService} only to explain the failure; it is not a selected journey meeting your requirement.</p>}
    {value.reasons.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{value.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    <dl className="mt-4 space-y-3 text-sm">{[
      [value.diagnosticOnwardService ? 'Arrival using non-qualifying alternative' : 'Planned final arrival', fmt(value.finalArrival)],
      ['Clock deadline', fmt(value.deadline)],
      ['Required final buffer', `${value.requiredFinalBuffer} min`],
      ['Latest arrival that still works', fmt(value.effectiveLatestArrival)],
      ['Time before your deadline', value.deadlineMargin === undefined ? 'Not established' : `${value.deadlineMargin} min`],
      ['Ready for onward transport', fmt(value.readyForOnward)],
      ['First service you can realistically catch', value.turnUpAndGo ? 'Not applicable — turn-up-and-go transport has no individual departures' : showService(selected)],
      ['Latest entered service that still gets you there in time', value.turnUpAndGo
        ? (value.latestSafeReadyTime ? `Latest safe ready time: ${fmt(value.latestSafeReadyTime)} (not a departure)` : value.latestBoundaryUnavailable ?? 'Not established')
        : showService(value.latestDeadlineService)],
      [value.diagnosticOnwardService ? 'Wait for non-qualifying alternative at onward stop' : 'Wait at onward stop, including boarding allowance', value.waitMinutes === undefined ? 'Not established' : duration(value.waitMinutes)],
      ['Selected pre-flight service', value.originService ?? 'No scheduled service selected'],
      ['Latest home departure under this plan', fmt(value.homeDeparture)],
      ['Flight must land by for the onward chain', fmt(value.flightArrivalBy)],
      ['Tightest scheduled connection', value.tightest ? `${value.tightest.label}: ${value.tightest.spare} min beyond required allowance — ${value.tightest.state}` : 'Not established'],
    ].map(([label, text]) => <div key={label}><dt className="text-ink-500">{label}</dt><dd className="mt-0.5 font-medium">{text}</dd></div>)}</dl>
    {value.turnUpAndGo && <div className="mt-4 rounded-sm border border-ink-200 bg-sand-50 p-3 text-sm">
      <p className="font-semibold">{value.turnUpAndGo.state} — {value.turnUpAndGo.mode} at your ready time</p>
      <dl className="mt-2 space-y-1">
        <div><dt className="inline text-ink-500">Ready at: </dt><dd className="inline">{fmt(value.turnUpAndGo.readyAt)}</dd></div>
        {value.turnUpAndGo.windowClosesAt && <div><dt className="inline text-ink-500">Service closes: </dt><dd className="inline">{fmt(value.turnUpAndGo.windowClosesAt)}</dd></div>}
        {value.turnUpAndGo.nextOpening && <div><dt className="inline text-ink-500">NEXT OPERATING WINDOW: </dt><dd className="inline">{fmt(value.turnUpAndGo.nextOpening)}{value.turnUpAndGo.waitUntilOpeningMinutes !== undefined ? ` · ${duration(value.turnUpAndGo.waitUntilOpeningMinutes)} away` : ''} — a reopening time, not a departure</dd></div>}
        <div><dt className="inline text-ink-500">Wait basis: </dt><dd className="inline">{value.turnUpAndGo.waitLabel}</dd></div>
        <div><dt className="inline text-ink-500">Journey duration basis: </dt><dd className="inline">{value.turnUpAndGo.journeyMinutesBasis}</dd></div>
        {!value.turnUpAndGo.timingConfirmed && value.turnUpAndGo.missing.length > 0 && <div><dt className="inline text-ink-500">CANNOT CONFIRM FULL JOURNEY TIMING — missing: </dt><dd className="inline">{value.turnUpAndGo.missing.join('; ')}</dd></div>}
      </dl>
      {value.turnUpAndGo.notes.map((note, index) => <p key={index} className="mt-2 text-xs text-ink-500">{note}</p>)}
      <p className="mt-2 text-xs text-ink-500">EXACT DEPARTURE NOT PROVIDED. This transport type publishes operating hours rather than individual departures, so no specific boarding time is shown. Operating hours are evidence you entered; anything marked ASSUMPTION is not.</p>
    </div>}
    {/*
      SAFETY/COMPREHENSION FIX (Tester 3, 23 Sep 2026): this paragraph used to
      render whenever ANY onward services were entered (`onwardServices.length
      > 0`), including a failed option with no qualifying service at all —
      directly contradicting "Earliest qualifying onward service: None
      established" a few lines above it. It must only describe a real
      selection (`value.onwardService`); a diagnostic-only alternative gets
      its own, explicitly non-qualifying sentence instead.
    */}
    {value.onwardService && <p className="mt-3 text-xs text-ink-500">The first service you can realistically catch drives the timeline; it meets the entered boarding allowance, extra cushion and final requirement. The latest entered service that still gets you there in time is only a backwards-planning limit and may not be catchable for this flight. Neither is a booking recommendation or safety guarantee. Earliest departure does not always mean fastest arrival.</p>}
    {!value.onwardService && value.diagnosticOnwardService && <p className="mt-3 text-xs text-ink-500">This service is shown only to explain the failure. It does not meet your requirement — no entered onward service that you can realistically catch gets this option to the destination within your requirement.</p>}
    <details className="mt-5 border-t border-ink-100 pt-3"><summary className="cursor-pointer font-semibold">Why — work backwards</summary><ol className="mt-3 space-y-3 text-sm">{value.backwards.map((step, index) => <li key={index}><strong>{step.label}</strong><p>{fmt(step.by)}</p></li>)}</ol></details>
    <details className="mt-4 border-t border-ink-100 pt-3"><summary className="cursor-pointer font-semibold">Timeline and connection checks</summary><div className="mt-3 space-y-3 text-sm">
      <ol className="space-y-3">{value.timeline.map((leg, index) => <li key={index} className="border-l-2 border-brass/40 pl-3"><strong>{leg.label}</strong><p>{fmt(leg.start)} → {fmt(leg.end)}</p><p>{leg.minutes} min{leg.buffer !== undefined ? ` · includes ${leg.buffer} min entered buffer` : ''}</p></li>)}</ol>
      {value.connections.map((connection, index) => <div key={index} className="rounded-sm bg-sand-50 p-3"><strong>{connection.label} — {connection.state}</strong><p>Ready: {fmt(connection.ready)}</p><p>Departs: {fmt(connection.departure)}</p><p>Margin: {connection.margin} min. Required allowance: {connection.minimum} min{connection.extraCushion > 0 ? ` (includes ${connection.extraCushion} min extra cushion)` : ''}. Spare beyond that allowance: {connection.spare} min.</p></div>)}
      {serviceTable('Pre-flight candidate services', value.originServices)}{serviceTable('Onward candidate services', value.onwardServices)}
    </div></details>
  </>;
}
