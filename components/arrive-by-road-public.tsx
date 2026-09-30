'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ESTIMATE_DISCLAIMER, PICKUP_MODE_CAVEATS } from '@/lib/arrive-by-shared/road-outcomes';
import { formatMinutesHuman, formatSecondsHuman, roundClockToNearestFive, trafficContextSentence } from '@/lib/arrive-by-shared/format';
import { isoToClock } from '@/lib/arrive-by-shared/timezone';
import { track } from '@/lib/analytics';
import type { RoadJourneyResult, RoadPickupMode } from '@/lib/arrive-by-shared/road-types';
import type { RoadAirportInfo } from '@/lib/arrive-by-shared/shell-dispatch';

/**
 * Generic worldwide road-first Arrive By journey UI. Everything airport-
 * specific arrives as `airport` (server-resolved -- see
 * getRoadAirportInfo), never derived from a country or code check here. It
 * posts only the airport CODE to the shared road API; coordinates, timezone
 * and destination policy are resolved server-side.
 *
 * Deliberately asks only what the traveller can truthfully supply: landing
 * time, their own airport-exit estimate, their own pickup wait, the
 * destination and an optional deadline. It invents no immigration, baggage,
 * taxi or fare timing.
 *
 * The Pakistan beta keeps its own component (its tests pin its exact copy);
 * this one is reached only for a capability-verified `road_supported`
 * airport, of which there are none until the gate records evidence.
 */

const field = 'mt-1 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-base text-ink-900';

function tomorrowIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

const PICKUP_LABELS: Record<RoadPickupMode, string> = {
  family: 'Family/friend collecting me',
  'pre-booked': 'Pre-booked driver/taxi',
  'arrange-after-landing': "I'll arrange a car after landing",
  other: 'Other',
};

const outcomeStyle: Record<string, string> = {
  ETA_ONLY: 'border-ink-200 bg-sand-50',
  BEFORE_DEADLINE: 'border-brass bg-brass-50',
  TIGHT_MARGIN: 'border-ink-200 bg-sand-50',
  AFTER_DEADLINE: 'border-terracotta-400 bg-terracotta-50',
  DESTINATION_NEEDS_CONFIRMATION: 'border-brass bg-brass-50',
  DESTINATION_NEEDS_SELECTION: 'border-brass bg-brass-50',
  DESTINATION_NEEDS_CLARIFICATION: 'border-terracotta-400 bg-terracotta-50',
  ROUTE_UNAVAILABLE: 'border-terracotta-400 bg-terracotta-50',
};

const KNOWN_LIMITATIONS = [
  'Place resolution depends on Google — it is not always right.',
  'This is an airport-level estimate: the route starts from the airport as a whole, not from a specific terminal or pickup point.',
  'Airport-exit time is your own estimate, not something Arrive By checks.',
  'Pickup availability is not checked — only the road journey is.',
  'No taxi/ride-hailing availability or price.',
  'No flight tracking, and no immigration or baggage-hall time prediction.',
  'Road conditions can change after the estimate is given.',
];

function headline(result: RoadJourneyResult, arrivalClock: string, deadlineClock: string, airportName: string): string {
  if (result.outcome === 'DESTINATION_NEEDS_CLARIFICATION' && result.clarificationReason === 'WRONG_COUNTRY') {
    return `${result.destination} looks outside the area Arrive By supports from ${airportName}, so we haven't calculated a journey.`;
  }
  switch (result.outcome) {
    case 'ETA_ONLY':
      return `Based on the traffic-aware driving estimate, you should reach ${result.destination} at around ${arrivalClock}.`;
    case 'BEFORE_DEADLINE':
      return `Based on the current estimate, you should reach ${result.destination} before ${deadlineClock}, with about ${formatMinutesHuman(result.marginMinutes ?? 0)} spare.`;
    case 'TIGHT_MARGIN':
      return `You may reach ${result.destination} in time, but there is only about ${formatMinutesHuman(result.marginMinutes ?? 0)} spare.`;
    case 'AFTER_DEADLINE':
      return `The current estimate gets you to ${result.destination} after the time you need to be there.`;
    case 'DESTINATION_NEEDS_CONFIRMATION':
      return `We found a place that might match ${result.destination}. Please confirm it's the right one before we calculate the journey.`;
    case 'DESTINATION_NEEDS_SELECTION':
      return `We found a few possible places for ${result.destination}. Please choose the one you mean.`;
    case 'DESTINATION_NEEDS_CLARIFICATION':
      return `We couldn't confidently match ${result.destination} to a single specific place. Try adding the nearest larger town or city name.`;
    case 'ROUTE_UNAVAILABLE':
      return "Journey not confirmed. We couldn't get a reliable driving route for this destination. Try a nearby town, venue or landmark instead.";
    default:
      return 'Arrive By could not check this journey right now. Please try again shortly.';
  }
}

export function ArriveByRoadPublic({ airport }: { airport: RoadAirportInfo }) {
  const defaultDate = useMemo(() => tomorrowIn(airport.timeZone), [airport.timeZone]);
  const [landingAt, setLandingAt] = useState(`${defaultDate}T12:00`);
  const [airportExitBufferMinutes, setAirportExitBufferMinutes] = useState('60');
  const [destination, setDestination] = useState('');
  const [pickupMode, setPickupMode] = useState<RoadPickupMode>('family');
  const [pickupWaitMinutes, setPickupWaitMinutes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deadlineReason, setDeadlineReason] = useState('');
  const [destinationReadinessBufferMinutes, setDestinationReadinessBufferMinutes] = useState('');
  const [result, setResult] = useState<RoadJourneyResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function runJourney(overrides?: { confirmedPlaceId?: string; selectedPlaceId?: string }) {
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/arrive-by/road', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airportCode: airport.code,
          landingAt,
          airportExitBufferMinutes: Number(airportExitBufferMinutes),
          destination,
          pickupMode,
          pickupWaitMinutes: pickupWaitMinutes === '' ? undefined : Number(pickupWaitMinutes),
          deadline: deadline || undefined,
          deadlineReason: deadlineReason || undefined,
          destinationReadinessBufferMinutes: destinationReadinessBufferMinutes === '' ? undefined : Number(destinationReadinessBufferMinutes),
          confirmedPlaceId: overrides?.confirmedPlaceId,
          selectedPlaceId: overrides?.selectedPlaceId,
        }),
      });
      const body = (await response.json()) as RoadJourneyResult | { error?: string };
      if (!response.ok || 'error' in body) throw new Error('error' in body && body.error ? body.error : 'Arrive By could not check this journey.');
      const journeyResult = body as RoadJourneyResult;
      setResult(journeyResult);
      // Coarse-only: airport code and outcome class. Never the destination, place, or any time entered.
      track('arrive_by_journey_checked', { airport: airport.code, outcome: journeyResult.outcome });
      if (overrides?.confirmedPlaceId || overrides?.selectedPlaceId) {
        track('arrive_by_recovery_used', { type: overrides.confirmedPlaceId ? 'confirmation' : 'selection', outcome: journeyResult.outcome });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Arrive By could not check this journey.');
    } finally {
      setLoading(false);
    }
  }

  // Move focus to the answer once it has actually rendered (an effect runs after commit; a rAF fired
  // from the async handler can beat React's commit and focus a node that is about to be replaced).
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runJourney();
  }

  // expectedArrival is Google's variable traffic-aware estimate, so it is
  // rounded to 5 minutes; deadline/latestAcceptable are exact arithmetic on
  // times the traveller typed, so they stay exact.
  const arrivalClock = result?.expectedArrival ? roundClockToNearestFive(result.expectedArrival, result.airport.timeZone) : '';
  const deadlineClock = result?.deadline ? isoToClock(result.deadline, result.airport.timeZone) : '';
  const latestAcceptableClock = result?.latestAcceptableArrival ? isoToClock(result.latestAcceptableArrival, result.airport.timeZone) : '';
  const hasRoute = result?.driveDurationSeconds !== undefined;
  const trafficSentence = result?.driveDurationSeconds !== undefined ? trafficContextSentence(result.driveDurationSeconds, result.staticDurationSeconds) : undefined;

  return <div className="mx-auto max-w-5xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Arrive By — Beta</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">After you land at {airport.displayName}, when will you actually reach where you're going?</h1>
    <p className="mt-3 max-w-3xl text-ink-600">Enter your landing time, how long you'll need to leave the airport, and your destination. Arrive By checks a real, traffic-aware road journey — with a deadline judgement if you have one.</p>
    {airport.estimateLabel && <p className="mt-3 inline-block rounded-sm border border-brass bg-brass-50 px-3 py-1 text-sm font-semibold text-ink-900">{airport.estimateLabel}</p>}
    <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-500">
      <li>Road journeys only, in {airport.city} local time.</li>
      <li>You supply the airport-exit and pickup assumptions; Arrive By does not guess them.</li>
      <li>The journey result is an estimate, not a guarantee.</li>
    </ul>

    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-md border border-ink-200 bg-sand-50 p-4 sm:p-6">
      <label className="text-sm">When does your flight land? <span className="text-ink-500">(local time at {airport.city})</span>
        <input className={field} type="datetime-local" required value={landingAt} onChange={(event) => setLandingAt(event.target.value)} />
      </label>
      <label className="text-sm">How many minutes after landing before you're outside the airport?
        <input className={field} type="number" min="0" max="480" step="5" required value={airportExitBufferMinutes} onChange={(event) => setAirportExitBufferMinutes(event.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">Your own estimate for immigration, baggage and walking out — Arrive By does not assume this for you.</span>
      </label>
      <label className="text-sm">Where are you going?
        <input className={field} required maxLength={180} placeholder="A town, venue or address" value={destination} onChange={(event) => { setDestination(event.target.value); setResult(null); }} />
        <span className="mt-1 block text-xs text-ink-500">A town, locality or venue is enough — you don't need to enter an exact home address.</span>
      </label>
      <label className="text-sm">How are you leaving the airport?
        <select className={field} value={pickupMode} onChange={(event) => setPickupMode(event.target.value as RoadPickupMode)}>
          {(Object.keys(PICKUP_LABELS) as RoadPickupMode[]).map((mode) => (
            <option key={mode} value={mode}>{PICKUP_LABELS[mode]}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">How long after leaving the terminal until your car, taxi or pickup is ready (minutes)? <span className="text-ink-500">(optional)</span>
        <input className={field} type="number" min="0" max="480" step="5" value={pickupWaitMinutes} onChange={(event) => setPickupWaitMinutes(event.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">Leave blank if your pickup will already be ready to leave.</span>
      </label>
      <label className="text-sm">Need to arrive by <span className="text-ink-500">(optional)</span>
        <input className={field} type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">Leave blank if you just want an arrival estimate — a deadline adds a pass/fail judgement.</span>
      </label>
      {deadline && <>
        <label className="text-sm">Why that time matters <span className="text-ink-500">(optional)</span>
          <input className={field} maxLength={140} placeholder="e.g. meeting starts" value={deadlineReason} onChange={(event) => setDeadlineReason(event.target.value)} />
        </label>
        <label className="text-sm">How many minutes after arriving before you need to be ready? <span className="text-ink-500">(optional)</span>
          <input className={field} type="number" min="0" max="480" step="5" value={destinationReadinessBufferMinutes} onChange={(event) => setDestinationReadinessBufferMinutes(event.target.value)} />
        </label>
      </>}
      <button type="submit" disabled={loading} className="mt-1 rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? 'Checking the live journey…' : 'When will I get there?'}</button>
    </form>

    {error && <div role="alert" className="mt-6 rounded-md border border-terracotta-400 bg-terracotta-50 p-4 text-sm font-medium text-terracotta-700"><strong>Journey not confirmed.</strong><p className="mt-1">{error}</p></div>}

    {result && <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 scroll-mt-20 outline-none">
      <section className={`rounded-md border p-5 sm:p-7 ${outcomeStyle[result.outcome] ?? 'border-terracotta-400 bg-terracotta-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">Your answer</p>
        {hasRoute ? (
          <>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl">Expected arrival: around {arrivalClock}</h2>
            <p className="mt-2 text-sm text-ink-700">Traffic-aware drive: about {formatSecondsHuman(result.driveDurationSeconds ?? 0)}</p>
            {trafficSentence && <p className="mt-1 text-sm text-ink-600">{trafficSentence}</p>}
            {result.outcome === 'AFTER_DEADLINE' && <p className="mt-2 text-sm font-medium text-terracotta-700">This estimate arrives after the time you need to be there.</p>}
            {result.deadline && result.latestAcceptableArrival && (
              <div className="mt-2 text-sm text-ink-700">
                <p>Latest useful arrival: {latestAcceptableClock}</p>
                <p>{(result.marginMinutes ?? 0) < 0
                  ? `Estimated shortfall: about ${formatMinutesHuman(result.marginMinutes ?? 0)}`
                  : `Estimated margin: about ${formatMinutesHuman(result.marginMinutes ?? 0)}`}</p>
              </div>
            )}
          </>
        ) : (
          <h2 className="mt-2 font-display text-2xl sm:text-3xl">{headline(result, arrivalClock, deadlineClock, airport.displayName)}</h2>
        )}
        {airport.estimateLabel && <p className="mt-2 text-sm font-semibold text-ink-700">{airport.estimateLabel}</p>}
        {result.resolvedDestination && (
          <div className="mt-3 text-sm text-ink-600">
            <p>Entered destination: <strong>{result.destination}</strong></p>
            <p>Google understood this as: <strong>{result.resolvedDestination}</strong></p>
          </div>
        )}
        {result.outcome === 'DESTINATION_NEEDS_CONFIRMATION' && result.pendingConfirmation && (
          <div className="mt-4 rounded-md border border-brass bg-white p-4">
            <p className="text-sm text-ink-700">You entered: <strong>{result.destination}</strong></p>
            <p className="mt-1 text-sm text-ink-700">Google found: <strong>{result.pendingConfirmation.formattedAddress}</strong></p>
            <p className="mt-2 text-sm font-semibold text-ink-900">Is this the place you mean?</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => void runJourney({ confirmedPlaceId: result.pendingConfirmation?.placeId })} disabled={loading} className="rounded-sm bg-ink-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">Yes — use this place</button>
              <button type="button" onClick={() => setResult(null)} className="rounded-sm border border-ink-300 px-5 py-2 text-sm font-semibold text-ink-900">No — change destination</button>
            </div>
          </div>
        )}
        {result.outcome === 'DESTINATION_NEEDS_SELECTION' && result.pendingSelection && (
          <div className="mt-4 rounded-md border border-brass bg-white p-4">
            <p className="text-sm font-semibold text-ink-900">We found a few possible places. Choose the one you mean:</p>
            <div className="mt-3 grid gap-2">
              {result.pendingSelection.candidates.map((candidate) => (
                <button key={candidate.placeId} type="button" onClick={() => void runJourney({ selectedPlaceId: candidate.placeId })} disabled={loading} className="rounded-sm border border-ink-300 bg-sand-50 px-4 py-2 text-left text-sm text-ink-900 hover:bg-sand-100 disabled:cursor-wait disabled:opacity-60">
                  {candidate.formattedAddress}
                </button>
              ))}
            </div>
          </div>
        )}
        {result.outcome === 'DESTINATION_NEEDS_CLARIFICATION' && result.clarificationReason === 'WRONG_COUNTRY' && (
          <p className="mt-3 text-sm text-ink-600">Please check the destination, or choose one within the area this airport supports.</p>
        )}
        {result.outcome === 'DESTINATION_NEEDS_CLARIFICATION' && result.clarificationReason !== 'WRONG_COUNTRY' && (
          <p className="mt-3 text-sm text-ink-600">Please make the destination more specific before we calculate the journey.</p>
        )}
        {result.deadlineReason && <p className="mt-3 text-sm text-ink-600">You said this matters because: {result.deadlineReason}</p>}
        {hasRoute && <p className="mt-3 text-sm text-ink-600">{PICKUP_MODE_CAVEATS[pickupMode]}</p>}
        <p className="mt-3 text-xs text-ink-500">{ESTIMATE_DISCLAIMER}</p>
      </section>
    </div>}

    <details className="mt-8 max-w-3xl rounded-md border border-ink-200 bg-sand-50 p-4 text-sm text-ink-600">
      <summary className="cursor-pointer font-semibold text-ink-900">Known limitations (beta)</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {KNOWN_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </details>
  </div>;
}
