'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { compareArrivalDeadline, type DeadlineComparison, type DeadlineState } from '@/lib/arrive-by/deadline-comparison';
import { AlertTriangle, CheckCircle2, Compass, Eye, HelpCircle, Plane } from 'lucide-react';
import {
  CONFIDENCE_COPY,
  DEPARTURE_TIMING_COPY,
  FOUNDER_PREVIEW_ROUTE_OPTIONS,
  JOURNEY_TYPE_COPY,
  describeUkCalendarShift,
  findFounderPreviewRoute,
  formatTimeZoneLabel,
  formatZonedDate,
  formatZonedDateTime,
  isConnectingRouteSlug,
  runFounderPreview,
  type FounderPreviewOutcome,
} from '@/lib/arrive-by/founder-preview';
import type { BaggageType, ConnectionRiskPreference, DeadlineStrictness } from '@/lib/arrive-by/types';
import { cn } from '@/lib/utils';

/**
 * Arrive By — Stage 2 founder preview.
 *
 * Private, internal, product-evaluation surface — not the final public
 * implementation (see docs/product/ARRIVE_BY_MVP.md §16). Access is gated
 * entirely at the route level (app/founder/arrive-by/page.tsx); nothing on
 * this page decides who can see it.
 *
 * Fully client-side and stateless beyond React state: every plan comes from
 * `runFounderPreview` (lib/arrive-by/founder-preview.ts), which only ever
 * calls Stage 1's own `planArriveBy` — no fetch, no analytics, no
 * localStorage, no persistence of any kind. Nothing entered here leaves the
 * browser tab.
 */

const DEFAULT_ROUTE_SLUG = 'manchester-lahore';
// The same illustrative example already used throughout Stage 1's own tests
// and docs/product/ARRIVE_BY_MVP.md — a static, non-time-computed default so
// the form starts pre-filled with a working example without ever reading
// `Date.now()` during render (which would risk a server/client hydration
// mismatch). The founder can change any field before calculating.
const DEFAULT_DATE = '2026-09-14';
const DEFAULT_TIME = '14:00';

function LegacyPlanningWindow() {
  const [routeSlug, setRouteSlug] = useState(DEFAULT_ROUTE_SLUG);
  const [dateLocal, setDateLocal] = useState(DEFAULT_DATE);
  const [timeLocal, setTimeLocal] = useState(DEFAULT_TIME);
  const [deadlineStrictness, setDeadlineStrictness] = useState<DeadlineStrictness>('flexible');
  const [baggage, setBaggage] = useState<BaggageType>('hand-luggage-only');
  const [connectionRiskPreference, setConnectionRiskPreference] = useState<ConnectionRiskPreference>('standard');
  const [outcome, setOutcome] = useState<FounderPreviewOutcome | null>(null);

  const selectedRoute = findFounderPreviewRoute(routeSlug);
  const showConnectionPreference = isConnectingRouteSlug(routeSlug);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setOutcome(
      runFounderPreview(
        { routeSlug, requiredArrivalDateLocal: dateLocal, requiredArrivalTimeLocal: timeLocal, deadlineStrictness, baggage, connectionRiskPreference },
        new Date().toISOString()
      )
    );
  }

  return (
    <div className="mx-auto max-w-content px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brass-600">
        <Eye className="h-4 w-4" strokeWidth={2} />
        Private · founder preview · not linked anywhere public
      </div>
      <h1 className="mt-2 font-display text-2xl text-ink-900 sm:text-3xl">Arrive By — planning window</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
        Enter when you need to arrive, and this returns an indicative UK departure window — never a live schedule
        search, never a booked itinerary. Stage 2 product evaluation only; see{' '}
        <code className="rounded-sm bg-ink-50 px-1 py-0.5 text-xs">docs/product/ARRIVE_BY_MVP.md</code>.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <form
          onSubmit={handleSubmit}
          aria-label="Arrive By planning form"
          className="flex flex-col gap-4 rounded-md border border-ink-100 bg-white p-5 shadow-card sm:p-6"
        >
          <div>
            <label htmlFor="ab-route" className="text-xs text-ink-400">
              Route
            </label>
            <select
              id="ab-route"
              required
              value={routeSlug}
              onChange={(e) => setRouteSlug(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
            >
              {FOUNDER_PREVIEW_ROUTE_OPTIONS.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-400">The only six routes Stage 1 currently supports — every one ex-Manchester.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ab-date" className="text-xs text-ink-400">
                Required arrival date
              </label>
              <input
                id="ab-date"
                type="date"
                required
                value={dateLocal}
                onChange={(e) => setDateLocal(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 px-3 text-sm text-ink-900 focus-visible:border-brass"
              />
            </div>
            <div>
              <label htmlFor="ab-time" className="text-xs text-ink-400">
                Required arrival time
              </label>
              <input
                id="ab-time"
                type="time"
                required
                value={timeLocal}
                onChange={(e) => setTimeLocal(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 px-3 text-sm text-ink-900 focus-visible:border-brass"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-ink-400">
            Both are local time at the destination{selectedRoute ? ` — ${selectedRoute.destinationLabel}` : ''}, never UK time.
          </p>

          <fieldset>
            <legend className="text-xs text-ink-400">Planning preference</legend>
            <div className="mt-1.5 flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm text-ink-700">
                <input
                  type="radio"
                  name="ab-strictness"
                  className="mt-0.5"
                  checked={deadlineStrictness === 'flexible'}
                  onChange={() => setDeadlineStrictness('flexible')}
                />
                <span>
                  <span className="font-semibold text-ink-900">Flexible deadline</span> — minimum practical buffer (20 min schedule-risk allowance)
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-700">
                <input
                  type="radio"
                  name="ab-strictness"
                  className="mt-0.5"
                  checked={deadlineStrictness === 'strict'}
                  onChange={() => setDeadlineStrictness('strict')}
                />
                <span>
                  <span className="font-semibold text-ink-900">Strict deadline</span> — safer buffer (60 min schedule-risk allowance)
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs text-ink-400">Baggage</legend>
            <div className="mt-1.5 flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-ink-700">
                <input type="radio" name="ab-baggage" checked={baggage === 'hand-luggage-only'} onChange={() => setBaggage('hand-luggage-only')} />
                Hand luggage only
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink-700">
                <input type="radio" name="ab-baggage" checked={baggage === 'checked-baggage'} onChange={() => setBaggage('checked-baggage')} />
                Checked baggage
              </label>
            </div>
          </fieldset>

          {showConnectionPreference && (
            <fieldset>
              <legend className="text-xs text-ink-400">Connection risk (this route connects via one stop)</legend>
              <div className="mt-1.5 flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="radio"
                    name="ab-connection"
                    checked={connectionRiskPreference === 'standard'}
                    onChange={() => setConnectionRiskPreference('standard')}
                  />
                  Standard connection buffer
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="radio"
                    name="ab-connection"
                    checked={connectionRiskPreference === 'cautious'}
                    onChange={() => setConnectionRiskPreference('cautious')}
                  />
                  Cautious — I&apos;d rather not risk a tight connection
                </label>
              </div>
            </fieldset>
          )}

          <button
            type="submit"
            className="mt-1 inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
          >
            <Compass className="h-4 w-4" strokeWidth={2.25} />
            Calculate planning window
          </button>
          <p className="text-xs text-ink-400">Calculated in your browser only — nothing you enter here is sent anywhere or saved.</p>
        </form>

        <div>{outcome ? <ArriveByOutcomeCard outcome={outcome} /> : <IncompleteState />}</div>
      </div>
    </div>
  );
}

const ARRIVAL_ZONES = [
  ['Asia/Karachi', 'Pakistan'], ['Asia/Kolkata', 'India'], ['Asia/Dubai', 'UAE'],
  ['Asia/Qatar', 'Qatar'], ['Asia/Riyadh', 'Saudi Arabia'], ['Asia/Dhaka', 'Bangladesh'],
  ['Europe/London', 'United Kingdom'],
] as const;
const DEADLINE_COPY: Record<DeadlineState, string> = {
  before_with_buffer: 'Entered range leaves your chosen buffer',
  before_without_buffer: 'Before the deadline, but below your chosen buffer',
  overlaps_deadline: 'Entered arrival range crosses the deadline',
  after_deadline: 'Entered arrival range is after the deadline',
  incomplete: 'More information needed',
};
const INPUT_STYLE = 'mt-1 w-full min-w-0 rounded-sm border border-ink-200 bg-white px-3 py-2 text-base text-ink-900';
type OptionFields = { label: string; date: string; time: string; zone: string; exitMin: string; exitMax: string; groundMin: string; groundMax: string };
const blankOption = (label: string): OptionFields => ({ label, date: '', time: '', zone: 'Asia/Karachi', exitMin: '', exitMax: '', groundMin: '', groundMax: '' });
const minutes = (text: string) => text.trim() === '' ? NaN : Number(text);

export function ArriveByFounderPreview() {
  const [place, setPlace] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [zone, setZone] = useState('Asia/Karachi');
  const [buffer, setBuffer] = useState('');
  const [options, setOptions] = useState<OptionFields[]>([blankOption('Option A')]);
  const [result, setResult] = useState<DeadlineComparison | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);
  function updateOption(index: number, field: keyof OptionFields, value: string) {
    setResult(null);
    setOptions((current) => current.map((option, i) => i === index ? { ...option, [field]: value } : option));
  }
  function compare(event: FormEvent) {
    event.preventDefault();
    setResult(compareArrivalDeadline({
      deadline: { date, time, timeZone: zone }, bufferMinutes: minutes(buffer),
      options: options.map((option) => ({
        label: option.label, landing: { date: option.date, time: option.time, timeZone: option.zone },
        airportExit: { min: minutes(option.exitMin), max: minutes(option.exitMax) },
        onwardTravel: { min: minutes(option.groundMin), max: minutes(option.groundMax) },
      })),
    }, new Date().toISOString()));
  }
  return (
    <div className="mx-auto max-w-5xl bg-white px-5 py-10 text-ink-900 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Private founder preview</p>
      <h1 className="mt-3 font-display text-4xl text-ink-900">Where do you need to be, and by when?</h1>
      <p className="mt-3 max-w-2xl text-ink-600">Compare flight options against your arrival deadline — including getting out of the airport and reaching your final destination.</p>
      <p className="mt-3 max-w-2xl text-sm text-ink-500">Use flight details you have checked. This compares your entries; it does not search flights, verify connections or predict delays. Nothing entered is saved.</p>
      <form onSubmit={compare} onChange={() => setResult(null)} className="mt-8 space-y-6">
        <fieldset className="rounded-md border border-ink-200 bg-sand-50 p-5">
          <legend className="px-2 font-semibold text-ink-900">1. Your destination deadline</legend>
          <label className="block text-sm" htmlFor="deadline-place">Final destination, such as a town or venue</label>
          <input id="deadline-place" required maxLength={120} className={INPUT_STYLE} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Family home in Lahore" />
          <p className="mt-1 text-xs text-ink-500">A label for your plan, not a map lookup. You enter the onward-travel estimate below.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm">Arrive by date<input aria-label="Arrive by date" required type="date" className={INPUT_STYLE} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="text-sm">Arrive by time<input aria-label="Arrive by time" required type="time" className={INPUT_STYLE} value={time} onChange={(e) => setTime(e.target.value)} /></label>
            <label className="text-sm">Destination time zone<select aria-label="Destination time zone" className={INPUT_STYLE} value={zone} onChange={(e) => setZone(e.target.value)}>{ARRIVAL_ZONES.map(([value, label]) => <option key={value} value={value}>{label} — {value}</option>)}</select></label>
          </div>
          <label className="mt-4 block max-w-sm text-sm">How many minutes early do you want to arrive?<input aria-label="Chosen arrival buffer in minutes" required type="number" min="0" max="10080" step="1" className={INPUT_STYLE} value={buffer} onChange={(e) => setBuffer(e.target.value)} placeholder="Your chosen buffer" /></label>
          <p className="mt-1 text-xs text-ink-500">Your preference, not a delay forecast or a recommended safety margin. Enter 0 explicitly if you want no additional buffer.</p>
        </fieldset>
        <div className="grid gap-5 lg:grid-cols-2">
          {options.map((option, index) => (
            <fieldset key={index} className="min-w-0 rounded-md border border-ink-200 p-5">
              <legend className="px-2 font-semibold">{index === 0 ? '2. Flight option A' : 'Flight option B'}</legend>
              <label className="text-sm">Option name<input aria-label={`Option ${index + 1} name`} maxLength={100} className={INPUT_STYLE} value={option.label} onChange={(e) => updateOption(index, 'label', e.target.value)} placeholder="Airline / arrival airport" /></label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-sm">Landing date<input aria-label={`Option ${index + 1} landing date`} type="date" className={INPUT_STYLE} value={option.date} onChange={(e) => updateOption(index, 'date', e.target.value)} /></label>
                <label className="text-sm">Landing time<input aria-label={`Option ${index + 1} landing time`} type="time" className={INPUT_STYLE} value={option.time} onChange={(e) => updateOption(index, 'time', e.target.value)} /></label>
              </div>
              <label className="mt-4 block text-sm">Arrival airport time zone<select aria-label={`Option ${index + 1} airport time zone`} className={INPUT_STYLE} value={option.zone} onChange={(e) => updateOption(index, 'zone', e.target.value)}>{ARRIVAL_ZONES.map(([value, label]) => <option key={value} value={value}>{label} — {value}</option>)}</select></label>
              <p className="mt-2 text-xs text-ink-500">Use the scheduled landing date, including any next-day arrival. Confirm the full itinerary and connections separately.</p>
              {([
                ['Airport exit', 'Include disembarkation, immigration and baggage collection.', 'exitMin', 'exitMax'],
                ['Onward travel', 'Include waiting for transport and travel to your final destination. Use a current transport estimate; leave unknown values blank.', 'groundMin', 'groundMax'],
              ] as const).map(([title, hint, minKey, maxKey]) => (
                <fieldset key={title} className="mt-5">
                  <legend className="text-sm font-semibold">{title} — your estimated range</legend>
                  <p className="mt-1 text-xs text-ink-500">{hint}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="text-sm">From (minutes)<input aria-label={`Option ${index + 1} ${title} minimum minutes`} type="number" min="0" max="10080" step="1" className={INPUT_STYLE} value={option[minKey]} onChange={(e) => updateOption(index, minKey, e.target.value)} /></label>
                    <label className="text-sm">To (minutes)<input aria-label={`Option ${index + 1} ${title} maximum minutes`} type="number" min="0" max="10080" step="1" className={INPUT_STYLE} value={option[maxKey]} onChange={(e) => updateOption(index, maxKey, e.target.value)} /></label>
                  </div>
                </fieldset>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white">Check against my deadline</button>
          <button type="button" className="rounded-sm border border-ink-200 px-5 py-3 text-sm" onClick={() => { setResult(null); setOptions((current) => current.length === 1 ? [...current, blankOption('Option B')] : current.slice(0, 1)); }}>{options.length === 1 ? 'Compare a second option' : 'Remove second option'}</button>
        </div>
      </form>
      {result && (
        <div ref={resultRef} tabIndex={-1} role="status" aria-live="polite" className="mt-8 rounded-md border border-ink-200 bg-sand-50 p-5 focus:outline focus:outline-2 focus:outline-brass">
          <h2 className="font-display text-2xl">Your arrival at {place.trim() || 'your destination'}</h2>
          {result.state === 'invalid' ? <ul className="mt-3 list-inside list-disc">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <>
            <p className="mt-2 text-sm">Deadline: {formatZonedDateTime(result.deadline)} · {result.deadline.timeZone}. Chosen buffer: {result.bufferMinutes} minutes.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">{result.options.map((option, index) => <article key={index} className="min-w-0 rounded-md border border-ink-200 bg-white p-5">
              <h3 className="break-words font-semibold">{option.label}</h3>
              <p className="mt-2 font-semibold text-ink-800">{DEADLINE_COPY[option.state]}</p>
              {option.state === 'incomplete' ? <ul className="mt-3 list-inside list-disc text-sm">{option.missing.map((item) => <li key={item}>{item}</li>)}</ul> : <>
                <ol className="mt-4 space-y-2 text-sm">
                  <li>Scheduled landing entered: {formatZonedDateTime(option.landing!)}</li>
                  <li>Airport exit: +{option.airportExit!.min}–{option.airportExit!.max} min</li>
                  <li>Onward travel: +{option.onwardTravel!.min}–{option.onwardTravel!.max} min</li>
                  <li className="font-semibold">Arrival range: {formatZonedDateTime(option.arrival!.earliest)} – {formatZonedDateTime(option.arrival!.latest)}</li>
                </ol>
                <p className="mt-3 text-sm">All displayed times use {result.deadline.timeZone}.</p>
                <p className="mt-3 text-sm">At the later end of your range: {option.marginMinutes!.min >= 0 ? `${option.marginMinutes!.min} minutes before` : `${Math.abs(option.marginMinutes!.min)} minutes after`} the deadline.</p>
                <p className="mt-2 text-sm">{option.bufferRemainingMinutes! >= 0 ? `${option.bufferRemainingMinutes} minutes remain beyond your chosen buffer.` : `${Math.abs(option.bufferRemainingMinutes!)} minutes short of your chosen buffer.`}</p>
              </>}
            </article>)}</div>
          </>}
          <p className="mt-5 text-sm font-medium">Before booking: confirm the flights and connections with the airline, check entry requirements, and recheck airport-exit and onward-travel estimates. Delays can exceed every allowance entered here. This is not a guarantee of arrival.</p>
        </div>
      )}
      <details className="mt-10 border-t border-ink-200 pt-5"><summary className="cursor-pointer text-sm text-ink-500">Earlier prototype: broad departure-window planner</summary><LegacyPlanningWindow /></details>
    </div>
  );
}

function IncompleteState() {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-md border border-dashed border-ink-200 bg-sand-50 p-8 text-center">
      <Plane className="h-6 w-6 text-ink-300" strokeWidth={2} />
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
        Select a route and enter your required arrival date and time, then calculate to see a recommended UK departure window.
      </p>
    </div>
  );
}

function ArriveByOutcomeCard({ outcome }: { outcome: FounderPreviewOutcome }) {
  if (outcome.kind === 'incomplete') return <IncompleteState />;

  const { result, route } = outcome;

  switch (result.state) {
    case 'unsupported_route':
    case 'invalid_deadline':
    case 'insufficient_timezone_data':
      return (
        <div role="status" aria-live="polite" className="rounded-md border border-terracotta-200 bg-terracotta-50 p-6">
          <div className="flex items-center gap-2 text-terracotta-700">
            <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide">Can&apos;t calculate a planning window</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-800">{result.reason}</p>
          <p className="mt-4 text-xs leading-relaxed text-ink-500">{result.disclaimer}</p>
        </div>
      );
  }

  if (result.state === 'route_verification_required') {
    return (
      <div role="status" aria-live="polite" className="rounded-md border border-terracotta-200 bg-terracotta-50 p-6">
        <div className="flex items-center gap-2 text-terracotta-700">
          <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />
          <span className="text-xs font-semibold uppercase tracking-wide">{JOURNEY_TYPE_COPY[result.journeyType]}</span>
        </div>
        <h2 className="mt-3 font-display text-xl leading-snug text-ink-900">
          JetStash can&apos;t build a planning window for {route.label} on this date yet.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{result.routeWarning}</p>
        <dl className="mt-4 grid gap-1 text-sm text-ink-600">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-400">Required arrival</dt>
            <dd className="text-right font-medium text-ink-900">{formatZonedDateTime(result.requiredArrivalLocal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-400">Destination timezone</dt>
            <dd className="text-right font-medium text-ink-900">{formatTimeZoneLabel(result.requiredArrivalLocal.timeZone)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">{result.disclaimer}</p>
      </div>
    );
  }

  // ready_for_planning | limited_confidence
  const plan = result;
  const isLimited = plan.confidence === 'limited';
  const ukShiftNote = describeUkCalendarShift(plan.requiredArrivalLocal);
  // indicativeUkDepartureWindow.earliest/.latest are consumed directly —
  // the engine itself now guarantees earliest <= latest for every result
  // (fixed at the source in lib/arrive-by/engine.ts; see
  // docs/product/ARRIVE_BY_MVP.md §16), so no display-side re-sorting is
  // needed or present anywhere in this file.
  const { earliest, latest } = plan.indicativeUkDepartureWindow;
  const sameUkDate = earliest.dateIso === latest.dateIso;

  return (
    <div role="status" aria-live="polite" className="rounded-md border border-ink-100 bg-white shadow-card">
      <div className="border-b border-ink-100 px-6 py-5 sm:px-8 sm:py-6">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
            isLimited ? 'border-brass/40 bg-brass-50 text-brass-700' : 'border-brass-200 bg-brass-50 text-brass-700'
          )}
        >
          {isLimited ? <HelpCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {CONFIDENCE_COPY[plan.confidence]}
        </span>

        <h2 className="mt-3 font-display text-2xl leading-snug text-ink-900">
          {sameUkDate ? (
            <>
              Aim to leave the UK between {earliest.timeHHmm} and {latest.timeHHmm} on {formatZonedDate(earliest)}.
            </>
          ) : (
            <>
              Aim to leave the UK between {formatZonedDateTime(earliest)} and {formatZonedDateTime(latest)}.
            </>
          )}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {formatZonedDateTime(earliest)} – {formatZonedDateTime(latest)} (UK local time)
        </p>

        <p className="mt-4 text-sm leading-relaxed text-ink-700">
          This planning window allows for the journey and arrival buffer, to arrive in <strong>{route.destinationLabel}</strong> by{' '}
          <strong>{formatZonedDateTime(plan.requiredArrivalLocal)}</strong> ({formatTimeZoneLabel(plan.requiredArrivalLocal.timeZone)}).
        </p>

        <p className="mt-2 text-sm font-medium text-ink-800">{DEPARTURE_TIMING_COPY[plan.departureTiming]}</p>
        {ukShiftNote && <p className="mt-1 text-xs text-ink-500">{ukShiftNote}</p>}
      </div>

      {(plan.routeWarning || plan.planningWarnings.length > 0) && (
        <div className="border-b border-ink-100 bg-terracotta-50 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2 text-terracotta-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide">Before you rely on this</span>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-ink-800">
            {plan.routeWarning && <li>{plan.routeWarning}</li>}
            {plan.planningWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-6 py-4 sm:px-8">
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-ink-900 underline decoration-ink-300 underline-offset-4 hover:text-brass-600">
            Calculation details
          </summary>
          <div className="mt-4 flex flex-col gap-4 text-sm text-ink-700">
            <dl className="grid gap-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Route</dt>
                <dd className="text-right font-medium text-ink-900">{route.label} — {JOURNEY_TYPE_COPY[plan.journeyType]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Recommended latest landing</dt>
                <dd className="text-right font-medium text-ink-900">{formatZonedDateTime(plan.recommendedLatestLandingLocal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Be at the UK departure airport by</dt>
                <dd className="text-right font-medium text-ink-900">{formatZonedDateTime(plan.recommendedOriginAirportArrivalLocal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Real route flight time (context only)</dt>
                <dd className="text-right font-medium text-ink-900">{route.flightTimeText}</dd>
              </div>
            </dl>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Planning assumptions used</p>
              <ul className="mt-2 flex flex-col gap-2">
                {plan.assumptionsUsed.map((a) => (
                  <li key={a.name} className="rounded-sm border border-ink-100 bg-sand-50 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-ink-900">{a.name}</span>
                      <span className="shrink-0 tabular-nums text-ink-600">{a.value}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{a.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>

            {plan.sourceProvenance.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Sources</p>
                <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-ink-500">
                  {plan.sourceProvenance.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </div>

      <p className="border-t border-ink-100 bg-sand-50 px-6 py-3 text-xs leading-relaxed text-ink-500 sm:px-8">{plan.disclaimer}</p>
    </div>
  );
}
