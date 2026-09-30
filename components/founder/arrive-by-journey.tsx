'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { calendarDayOffset, clockOf, dateLabelOf, describeDay } from '@/lib/arrive-by-journey/local-time';
import type { AirportOption } from '@/lib/arrive-by-journey/airport-options';
import type { JourneyPlan, TimelineLeg } from '@/lib/arrive-by-journey/types';
import {
  EMPTY_RECOVERY, chooseConfirmed, chooseSelected, invalidateForArrivalAirportChange, invalidateSide, pendingSides, reconcileWithPlan, toRequestFields,
  type RecoveryState,
} from '@/lib/arrive-by-journey/place-recovery';

/**
 * INTERNAL full-journey preview. One question order, start to finish:
 *
 *   Where are you starting from? -> Which airport are you flying from? -> When does the flight leave?
 *   -> Where are you landing? -> When does it land? -> Where are you going after that?
 *
 * Start and destination recovery are INDEPENDENT pieces of state (lib/arrive-by-journey/place-recovery.ts): every
 * submission resends the choice already made for BOTH sides, so resolving one never resets the other. The server
 * re-verifies every ID on every request; the state held here is convenience, never trust.
 *
 * and one answer order: WHEN SHOULD I LEAVE first, then the departure-airport result, then the final arrival.
 * It posts only what the traveller typed to the internal API; airports, coordinates, time zones and country rules
 * are all resolved server-side. Deliberately no analytics, no storage: the internal access token lives in component
 * state only and is gone on reload.
 */

const field = 'mt-1 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-base text-ink-900';

const tomorrowInLondon = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

const PICKUP_LABELS = {
  family: 'Family/friend collecting me',
  'pre-booked': 'Pre-booked driver/taxi',
  'arrange-after-landing': "I'll arrange a car after landing",
  other: 'Other',
} as const;
type PickupMode = keyof typeof PICKUP_LABELS;

const stateStyle: Record<string, string> = {
  POSSIBLE_WITH_MARGIN: 'border-brass bg-brass-50',
  POSSIBLE_BUT_TIGHT: 'border-ink-200 bg-sand-50',
  ESTIMATE_ONLY: 'border-ink-200 bg-sand-50',
  NOT_FEASIBLE: 'border-terracotta-400 bg-terracotta-50',
  CANNOT_CONFIRM: 'border-terracotta-400 bg-terracotta-50',
};

/** Clock range for a leg; a date is added to any end that falls on a different local day than the journey's first leg. */
function legTime(leg: TimelineLeg, first: TimelineLeg | undefined): string {
  const at = (iso: string, zone: string) => {
    const ms = Date.parse(iso);
    const offset = first ? calendarDayOffset(Date.parse(first.startIso), first.startZone, ms, zone) : 0;
    return offset === 0 ? clockOf(ms, zone) : `${clockOf(ms, zone)} ${describeDay(dateLabelOf(ms, zone), offset)}`;
  };
  return `${at(leg.startIso, leg.startZone)} → ${at(leg.endIso, leg.endZone)}`;
}

/** Human label first; the raw address is kept as secondary so the traveller can still cross-check it. */
const placeText = (p: { display?: string; formattedAddress?: string; address?: string } | undefined) => p?.display ?? p?.formattedAddress ?? p?.address ?? '';
const addressNote = (p: { display?: string; formattedAddress?: string; address?: string } | undefined) => {
  const address = p?.formattedAddress ?? p?.address;
  return address && p?.display && address !== p.display ? address : undefined;
};

const label = (option: AirportOption) => `${option.code} · ${option.name} (${option.city}, ${option.country})`;

type Pending = 'start' | 'destination';

export function ArriveByJourney({ departureAirports, arrivalAirports }: { departureAirports: AirportOption[]; arrivalAirports: AirportOption[] }) {
  const day = useMemo(tomorrowInLondon, []);
  const [start, setStart] = useState('');
  const [departureAirport, setDepartureAirport] = useState(departureAirports.find((a) => a.code === 'MAN')?.code ?? departureAirports[0]?.code ?? '');
  const [departsLocal, setDepartsLocal] = useState(`${day}T11:00`);
  const [arrivalAirport, setArrivalAirport] = useState(arrivalAirports.find((a) => a.code === 'ISB')?.code ?? arrivalAirports[0]?.code ?? '');
  const [arrivesLocal, setArrivesLocal] = useState(`${day}T18:00`);
  const [destination, setDestination] = useState('');
  const [hasConnection, setHasConnection] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState('120');
  const [exitMinutes, setExitMinutes] = useState('60');
  const [pickupWait, setPickupWait] = useState('');
  const [pickupMode, setPickupMode] = useState<PickupMode>('family');
  const [deadline, setDeadline] = useState('');
  const [readiness, setReadiness] = useState('');
  const [token, setToken] = useState('');
  const [recovery, setRecovery] = useState<RecoveryState>(EMPTY_RECOVERY);
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  /** `next` is passed explicitly because React state updates are asynchronous: the request must carry the choices just made. */
  async function run(next: RecoveryState = recovery) {
    setLoading(true); setError(''); setPlan(null);
    try {
      const response = await fetch('/api/founder/arrive-by-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-arrive-by-internal-token': token } : {}) },
        body: JSON.stringify({
          start, departureAirport, arrivalAirport, destination,
          flight: { departsLocal, arrivesLocal, declaredConnections: hasConnection ? 1 : 0 },
          preferences: {
            departureAirportBufferMinutes: Number(bufferMinutes),
            arrivalExitMinutes: Number(exitMinutes),
            pickupWaitMinutes: pickupWait === '' ? undefined : Number(pickupWait),
            pickupMode,
            finalDeadlineLocal: deadline || undefined,
            destinationReadinessMinutes: readiness === '' ? undefined : Number(readiness),
          },
          ...toRequestFields(next),
        }),
      });
      const body = (await response.json()) as JourneyPlan | { error?: string };
      if (!response.ok || 'error' in body) throw new Error('error' in body && body.error ? body.error : 'Arrive By could not check this journey.');
      setPlan(body as JourneyPlan);
      // A side sent back for recovery even though we supplied a choice for it means that ID was stale/forged: forget it (that side only).
      setRecovery(reconcileWithPlan(next, body as JourneyPlan));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Arrive By could not check this journey.');
    } finally {
      setLoading(false);
    }
  }

  // Focus the answer once it has actually rendered (an effect runs after commit).
  useEffect(() => {
    if (plan) resultRef.current?.focus();
  }, [plan]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run();
  }

  const pendingFor = (which: Pending) => (which === 'start' ? plan?.startDetail : plan?.arrivalDetail);

  function PendingChoice({ which }: { which: Pending }) {
    const detail = pendingFor(which);
    if (!detail) return null;
    const heading = which === 'start' ? 'Your start location' : 'Your final destination';
    const side = which;
    const typed = which === 'start' ? start : destination;
    return <div className="mt-4 rounded-md border border-brass bg-white p-4">
      <p className="text-sm font-semibold text-ink-900">{heading} needs a check</p>
      {detail.pendingConfirmation && <>
        <p className="mt-1 text-sm text-ink-700">You typed <strong>{typed}</strong>. Google found <strong>{placeText(detail.pendingConfirmation)}</strong>. Is this the place you mean?</p>
        {addressNote(detail.pendingConfirmation) && <p className="mt-1 text-xs text-ink-500">Full address: {addressNote(detail.pendingConfirmation)}</p>}
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={loading} onClick={() => { const next = chooseConfirmed(recovery, side, detail.pendingConfirmation?.placeId ?? ''); setRecovery(next); void run(next); }} className="rounded-sm bg-ink-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Yes — use this place</button>
          <button type="button" onClick={() => setPlan(null)} className="rounded-sm border border-ink-300 px-5 py-2 text-sm font-semibold text-ink-900">No — change it</button>
        </div>
      </>}
      {detail.pendingSelection && <>
        <p className="mt-1 text-sm text-ink-700">We found a few possible places. Choose the one you mean:</p>
        <div className="mt-3 grid gap-2">
          {detail.pendingSelection.candidates.map((candidate) => (
            <button key={candidate.placeId} type="button" disabled={loading} onClick={() => { const next = chooseSelected(recovery, side, candidate.placeId); setRecovery(next); void run(next); }} className="rounded-sm border border-ink-300 bg-sand-50 px-4 py-2 text-left text-sm text-ink-900 hover:bg-sand-100 disabled:opacity-60">{placeText(candidate)}{addressNote(candidate) && <span className="block text-xs text-ink-500">{addressNote(candidate)}</span>}</button>
          ))}
        </div>
      </>}
      {!detail.pendingConfirmation && !detail.pendingSelection && (
        <p className="mt-1 text-sm text-ink-600">
          {'clarificationReason' in detail && detail.clarificationReason === 'WRONG_COUNTRY'
            ? which === 'start' ? 'Arrive By only supports UK starts at the moment.' : 'That looks outside the area Arrive By supports from your arrival airport.'
            : 'Please make it more specific (a town, postcode or place name).'}
        </p>
      )}
    </div>;
  }

  return <div className="mx-auto max-w-5xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Arrive By — full journey (internal preview)</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">When should I leave?</h1>
    <p className="mt-3 max-w-3xl text-ink-600">Start → departure airport → flight → arrival airport → final destination. Enter your own flight times and buffers; Arrive By checks the two road journeys live and works out when to leave.</p>
    <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-500">
      <li>UK starts and UK departure airports only. Flight times are entered by you — no flight lookup.</li>
      <li>Estimates are airport-level, not terminal-level. Nothing here is stored.</li>
    </ul>

    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-md border border-ink-200 bg-sand-50 p-4 sm:p-6">
      <label className="text-sm">Where are you starting from? <span className="text-ink-500">(UK town, postcode or place)</span>
        <span className="mt-1 block text-xs text-ink-500">Leave time assumes you drive there, using live traffic.</span>
        <input className={field} required maxLength={180} value={start} placeholder="e.g. Preston" onChange={(e) => { setStart(e.target.value); setRecovery((r) => invalidateSide(r, 'start')); setPlan(null); }} />
      </label>
      <label className="text-sm">Which airport are you flying from?
        <select className={field} value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)}>
          {departureAirports.map((option) => <option key={option.code} value={option.code}>{label(option)}</option>)}
        </select>
      </label>
      <label className="text-sm">When does the flight leave? <span className="text-ink-500">(local time at the departure airport)</span>
        <input className={field} type="datetime-local" required value={departsLocal} onChange={(e) => setDepartsLocal(e.target.value)} />
      </label>
      <label className="text-sm">Where are you landing?
        <select className={field} value={arrivalAirport} onChange={(e) => {
          const country = (code: string) => arrivalAirports.find((a) => a.code === code)?.country;
          setRecovery((r) => invalidateForArrivalAirportChange(r, country(arrivalAirport), country(e.target.value)));
          setArrivalAirport(e.target.value);
        }}>
          {arrivalAirports.map((option) => <option key={option.code} value={option.code}>{label(option)}</option>)}
        </select>
      </label>
      <label className="text-sm">When does it land? <span className="text-ink-500">(local time at the arrival airport)</span>
        <input className={field} type="datetime-local" required value={arrivesLocal} onChange={(e) => setArrivesLocal(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasConnection} onChange={(e) => setHasConnection(e.target.checked)} /> This flight has a connection or stop (Arrive By can't check those yet)</label>
      <label className="text-sm">Where are you going after that?
        <input className={field} required maxLength={180} value={destination} placeholder="e.g. Mirpur, Azad Kashmir" onChange={(e) => { setDestination(e.target.value); setRecovery((r) => invalidateSide(r, 'destination')); setPlan(null); }} />
      </label>

      <label className="text-sm">How many minutes before the flight do you want to be at the departure airport?
        <input className={field} type="number" min="0" max="480" step="5" required value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} />
      </label>
      <label className="text-sm">How many minutes after landing before you're outside the arrival airport?
        <input className={field} type="number" min="0" max="480" step="5" required value={exitMinutes} onChange={(e) => setExitMinutes(e.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">Your own estimate for immigration, baggage and walking out — Arrive By does not assume this for you.</span>
      </label>
      <label className="text-sm">How are you leaving the arrival airport?
        <select className={field} value={pickupMode} onChange={(e) => setPickupMode(e.target.value as PickupMode)}>
          {(Object.keys(PICKUP_LABELS) as PickupMode[]).map((mode) => <option key={mode} value={mode}>{PICKUP_LABELS[mode]}</option>)}
        </select>
      </label>
      <label className="text-sm">Wait for the car/pickup after leaving the terminal (minutes) <span className="text-ink-500">(optional)</span>
        <input className={field} type="number" min="0" max="480" step="5" value={pickupWait} onChange={(e) => setPickupWait(e.target.value)} />
      </label>
      <label className="text-sm">Need to arrive by <span className="text-ink-500">(optional; local time at the arrival airport)</span>
        <input className={field} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      {deadline && <label className="text-sm">Minutes you need at the destination before that time <span className="text-ink-500">(optional)</span>
        <input className={field} type="number" min="0" max="480" step="5" value={readiness} onChange={(e) => setReadiness(e.target.value)} />
      </label>}
      <label className="text-sm">Internal access token <span className="text-ink-500">(required on a deployed preview; kept in memory only)</span>
        <input className={field} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <button type="submit" disabled={loading || !departureAirport || !arrivalAirport} className="mt-1 rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? 'Checking the live journey…' : 'When should I leave?'}</button>
    </form>

    {error && <div role="alert" className="mt-6 rounded-md border border-terracotta-400 bg-terracotta-50 p-4 text-sm font-medium text-terracotta-700"><strong>Journey not confirmed.</strong><p className="mt-1">{error}</p></div>}

    {plan && <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 scroll-mt-20 outline-none">
      <section className={`rounded-md border p-5 sm:p-7 ${stateStyle[plan.state] ?? 'border-terracotta-400 bg-terracotta-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">{plan.stateLabel}</p>
        {plan.state === 'CANNOT_CONFIRM' ? <>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl">We couldn't confirm this journey</h2>
          <p className="mt-2 text-sm text-ink-700">No leave time is shown because part of the journey could not be checked. Anything below is partial and is not a plan to follow.</p>
        </> : plan.headline ? <>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl">{plan.headline.leave}{plan.leaveBy && <span className="block mt-1 text-base font-normal text-ink-600">{plan.leaveBy.dateLabel}</span>}</h2>
          <p className="mt-2 text-sm text-ink-700">{plan.headline.airport}{plan.airportArriveBy && plan.airportArriveBy.dayOffset !== 0 ? ` (${describeDay(plan.airportArriveBy.dateLabel, plan.airportArriveBy.dayOffset)})` : ''}</p>
          <p className="mt-1 text-sm text-ink-700">{plan.headline.arrival}{plan.finalArrival ? ` on ${describeDay(plan.finalArrival.dateLabel, plan.finalArrival.dayOffset)}` : ''}</p>
        </> : <>
          {plan.leaveBy && <h2 className="mt-2 font-display text-2xl sm:text-3xl">Leave by around {plan.leaveBy.clock}<span className="block mt-1 text-base font-normal text-ink-600">{plan.leaveBy.dateLabel}</span></h2>}
          {plan.finalArrival && <p className="mt-2 text-sm text-ink-700">Expected final arrival around {plan.finalArrival.clock} on {describeDay(plan.finalArrival.dateLabel, plan.finalArrival.dayOffset)}</p>}
          {!plan.leaveBy && !plan.finalArrival && <h2 className="mt-2 font-display text-2xl sm:text-3xl">We couldn't confirm this journey.</h2>}
        </>}
        {plan.places && (plan.places.start || plan.places.destination) && <div className="mt-3 grid gap-1 text-sm text-ink-700" data-testid="resolved-places">
          {plan.places.start && <p>Start: <strong>{placeText(plan.places.start)}</strong>{addressNote(plan.places.start) ? <span className="text-ink-500"> · {addressNote(plan.places.start)}</span> : null}</p>}
          {plan.places.destination && <p>Destination: <strong>{placeText(plan.places.destination)}</strong>{addressNote(plan.places.destination) ? <span className="text-ink-500"> · {addressNote(plan.places.destination)}</span> : null}</p>}
        </div>}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-700">
          {plan.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        {plan.deadline && <p className="mt-2 text-sm text-ink-700">Margin against your deadline: about {plan.deadline.marginMinutes} minutes.</p>}
        {(plan.startDetail || plan.arrivalDetail) && <p className="mt-3 text-xs text-ink-500" data-testid="place-status">
          Start: {pendingSides(plan).start === 'NONE' ? 'confirmed' : 'needs a check'} · Destination: {pendingSides(plan).destination === 'NONE' ? 'confirmed' : 'needs a check'}
        </p>}
        <PendingChoice which="start" />
        <PendingChoice which="destination" />

        {plan.state === 'CANNOT_CONFIRM' && plan.timeline.length > 0 && <div className="mt-5 border-t border-ink-200 pt-4 text-sm text-ink-600" data-testid="partial-evidence">
          <p className="font-semibold text-ink-700">What we could work out (partial, not a confirmed plan)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.timeline.map((leg, index) => <li key={`${leg.kind}-${index}`}>{leg.label} · {leg.minutes} min</li>)}
          </ul>
        </div>}
        {plan.state !== 'CANNOT_CONFIRM' && plan.timeline.length > 0 && <ol className="mt-5 grid gap-2 border-t border-ink-200 pt-4 text-sm text-ink-700">
          {plan.timeline.map((leg, index) => <li key={`${leg.kind}-${index}`} className="grid gap-x-4 sm:grid-cols-[9rem,1fr]">
            <span className="font-semibold">{legTime(leg, plan.timeline[0])}</span>
            <span>{leg.label} · {leg.minutes} min<span className="block text-xs text-ink-500">{leg.evidence.source}{leg.evidence.checkedAt ? ` · checked ${clockOf(Date.parse(leg.evidence.checkedAt), 'Europe/London')} UK` : ''}</span></span>
          </li>)}
        </ol>}

        {plan.calls && <p className="mt-4 text-xs text-ink-500">
          Internal: {plan.calls.used} of {plan.calls.ceiling} Google calls (geocode {plan.calls.breakdown.geocode ?? 0}, routes {plan.calls.breakdown.routes ?? 0}).
          {plan.originSearch ? ` Departure search: ${plan.originSearch.queries} route ${plan.originSearch.queries === 1 ? 'query' : 'queries'}, ${plan.originSearch.converged ? 'converged' : 'not fully converged'}.` : ''}
        </p>}
        {plan.state !== 'CANNOT_CONFIRM' && <p className="mt-3 text-xs text-ink-500" data-testid="driving-assumption">Leave time assumes you drive to the airport (live traffic). It doesn't include parking, drop-off, shuttle or rental-car return time.</p>}
        <p className="mt-3 text-xs text-ink-500">This is an estimate, not a guarantee. Traffic, airport processing and pickup time can change your actual times. Airport-level estimates only.</p>
      </section>
    </div>}
  </div>;
}
