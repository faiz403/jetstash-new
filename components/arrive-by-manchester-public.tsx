'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import {
  topLevelOutcome, topLevelVerdict,
  type TopLevelOutcome, type GoogleCarRescue, type GoogleDestinationPendingResult, type GoogleItinerary, type GoogleJourneyLeg,
  type GoogleNoTransitPrototypeResult, type GoogleTransitPrototypeResult,
} from '@/lib/arrive-by-shared/manchester-journey';

/**
 * Public Manchester Arrive By beta component. Deliberately a separate file
 * from the founder-only component (components/founder/arrive-by-google.tsx),
 * matching the same founder/public split already established for Pakistan's
 * own public component (components/arrive-by-pakistan-public.tsx) versus
 * its founder-only counterpart: the founder component's exact source is
 * scanned by existing structural/access tests, and this file adds
 * public-only concerns (its own API route, analytics, public copy) rather
 * than threading them through that file. Reuses topLevelOutcome/
 * topLevelVerdict from the shared lib/arrive-by-shared/manchester-journey.ts
 * module (not from the founder component, and not from lib/arrive-by
 * directly — that directory is founder-only-importable, see
 * tests/arrive-by-integrity.test.ts) since those are pure result
 * classifiers with no founder-only content — everything else here is its
 * own rendering, since Manchester's transit-first result shape is
 * genuinely different from Pakistan's road-only one, not a copy of it.
 */
type GooglePrototypeResult = GoogleTransitPrototypeResult | GoogleNoTransitPrototypeResult;

const field = 'mt-1 w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-base text-ink-900';

function tomorrowInLondon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function clock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

function vehicleLabel(value?: string): string {
  const labels: Record<string, string> = {
    HEAVY_RAIL: 'Train', HIGH_SPEED_TRAIN: 'Train', COMMUTER_TRAIN: 'Train',
    LIGHT_RAIL: 'Tram', SUBWAY: 'Metro', BUS: 'Bus', INTERCITY_BUS: 'Coach', FERRY: 'Ferry',
  };
  return value ? labels[value] ?? 'Public transport' : 'Public transport';
}

function serviceLabel(value: string): string {
  return value === value.toLowerCase() ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function minutesLabel(value?: number): string {
  if (value === undefined) return 'Not established';
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder} min`;
}

function destinationPendingHeadline(pending: GoogleDestinationPendingResult): string {
  if (pending.destinationConfidence === 'NEEDS_CONFIRMATION') return "We found a place that might match your destination. Please confirm it's the right one before we calculate the journey.";
  if (pending.destinationConfidence === 'NEEDS_SELECTION') return 'We found a few possible places for your destination. Please choose the one you mean.';
  if (pending.destinationConfidence === 'UNRESOLVED') return "Arrive By couldn't resolve this destination at all. Try a more specific destination.";
  if (pending.clarificationReason === 'WRONG_COUNTRY') return "This doesn't look like a UK location. Please check the destination.";
  if (pending.clarificationReason === 'MULTIPLE_CANDIDATES') return 'Google returned more than one possible match for this destination. Please make it more specific.';
  return "Arrive By couldn't confidently match this destination to a single specific place. Try adding more detail.";
}

const KNOWN_LIMITATIONS = [
  'Currently supports Manchester Airport Terminal 2 only.',
  'UK domestic destinations only.',
  'Public-transport and traffic-aware driving estimates only — not live delay/disruption alerts.',
  'No taxi/ride-hailing availability or price.',
  'No flight tracking.',
  'No immigration or baggage-hall time prediction.',
  'Road and rail conditions can change after the estimate is given.',
];

function Walk({ leg }: { leg: Extract<GoogleJourneyLeg, { kind: 'walk' }> }) {
  const minutes = Math.max(1, Math.ceil(leg.durationSeconds / 60));
  const distance = leg.distanceMeters >= 1000 ? `${(leg.distanceMeters / 1000).toFixed(1)} km` : `${leg.distanceMeters} m`;
  return <li className="border-l-2 border-ink-200 py-1 pl-4 text-sm"><strong>Walk</strong><span className="text-ink-500"> · {minutes} min · {distance}</span></li>;
}

function Transit({ leg, timeZone }: { leg: Extract<GoogleJourneyLeg, { kind: 'transit' }>; timeZone: string }) {
  const service = serviceLabel(leg.lineShortName || leg.agency || leg.lineName);
  return <li className="border-l-2 border-brass py-2 pl-4 text-sm">
    <p className="font-semibold">{vehicleLabel(leg.vehicleType)} {service}</p>
    <p>{clock(leg.departureTime, timeZone)} {leg.departureStop} → {clock(leg.arrivalTime, timeZone)} {leg.arrivalStop}</p>
  </li>;
}

function JourneyChain({ title, itinerary, timeZone }: { title: string; itinerary: GoogleItinerary; timeZone: string }) {
  return <details className="rounded-md border border-ink-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">{title}</summary>
    <ol className="mt-4 space-y-1">
      {itinerary.legs.map((leg, index) => leg.kind === 'walk'
        ? <Walk key={index} leg={leg} />
        : <Transit key={index} leg={leg} timeZone={timeZone} />)}
    </ol>
  </details>;
}

function CarEstimate({ estimate, result, scenario }: { estimate: GoogleCarRescue; result: GooglePrototypeResult; scenario: 'immediate' | 'missed-service' }) {
  const immediate = scenario === 'immediate';
  return <section className="mt-4 rounded-md border border-ink-200 bg-sand-50 p-4 sm:p-5">
    <p className="text-xs font-semibold uppercase tracking-wide">{immediate ? 'Car / taxi / pick-up from your ready time' : 'Car / taxi / pick-up after the missed service'}</p>
    {estimate.status === 'AVAILABLE' ? <>
      <h3 className="mt-2 font-display text-xl">Estimated drive from Manchester Airport Terminal 2: {minutesLabel(Math.ceil((estimate.durationSeconds ?? 0) / 60))}.</h3>
      <p className="mt-2 text-sm">Estimated departure: <strong>{clock(estimate.departureTime!, result.origin.timeZone)}</strong>. Estimated physical arrival: <strong>{clock(estimate.arrivalTime!, result.origin.timeZone)}</strong>.</p>
      <p className="mt-1 text-sm font-semibold">{estimate.meetsReadyBy ? 'A car/taxi/pick-up could get you there in time based on the driving estimate.' : 'The driving estimate still misses the time you need to arrive by.'}</p>
      <p className="mt-3 text-xs text-ink-500">This is a traffic-aware driving estimate only. It does not include time to find or wait for a taxi, car or pick-up, and availability is not guaranteed.</p>
    </> : <>
      <h3 className="mt-2 font-display text-xl">Car/taxi driving estimate unavailable.</h3>
      <p className="mt-2 text-sm text-ink-600">Arrive By could not get a usable direct DRIVE route.</p>
    </>}
  </section>;
}

export function ArriveByManchesterPublic() {
  const defaultDate = useMemo(tomorrowInLondon, []);
  const [destination, setDestination] = useState('');
  const [availableAt, setAvailableAt] = useState(`${defaultDate}T12:00`);
  const [deadline, setDeadline] = useState(`${defaultDate}T14:30`);
  const [deadlineReason, setDeadlineReason] = useState('');
  const [readinessMinutes, setReadinessMinutes] = useState('');
  const [result, setResult] = useState<GooglePrototypeResult | null>(null);
  const [pending, setPending] = useState<GoogleDestinationPendingResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function runJourney(overrides?: { confirmedPlaceId?: string; selectedPlaceId?: string }) {
    setLoading(true); setError(''); setResult(null); setPending(null);
    try {
      const response = await fetch('/api/arrive-by-manchester/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originId: 'man-terminal-2', destination, availableAt, deadline, deadlineReason,
          readinessMinutes: readinessMinutes === '' ? undefined : Number(readinessMinutes),
          confirmedPlaceId: overrides?.confirmedPlaceId,
          selectedPlaceId: overrides?.selectedPlaceId,
        }),
      });
      const body = await response.json() as GooglePrototypeResult | GoogleDestinationPendingResult | { error?: string };
      if (!response.ok || 'error' in body) throw new Error('error' in body && body.error ? body.error : 'Arrive By could not check this journey.');
      if ('transitStatus' in body && body.transitStatus === 'DESTINATION_PENDING') {
        setPending(body);
        if (overrides?.confirmedPlaceId || overrides?.selectedPlaceId) {
          track('arrive_by_recovery_used', { type: overrides.confirmedPlaceId ? 'confirmation' : 'selection', outcome: 'PENDING' });
        }
      } else {
        const journeyResult = body as GooglePrototypeResult;
        setResult(journeyResult);
        const outcome: TopLevelOutcome = topLevelOutcome(journeyResult);
        // Coarse-only: airport and the outcome class, nothing that
        // identifies the destination, venue, place, or any time entered.
        track('arrive_by_journey_checked', { airport: 'MAN', outcome });
        if (overrides?.confirmedPlaceId || overrides?.selectedPlaceId) {
          track('arrive_by_recovery_used', { type: overrides.confirmedPlaceId ? 'confirmation' : 'selection', outcome });
        }
      }
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Arrive By could not check this journey.');
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runJourney();
  }

  function confirmPendingPlace() {
    if (pending?.pendingConfirmation) void runJourney({ confirmedPlaceId: pending.pendingConfirmation.placeId });
  }

  function selectCandidate(placeId: string) {
    void runJourney({ selectedPlaceId: placeId });
  }

  function rejectPendingPlace() {
    setPending(null);
  }

  const deadlineClock = result ? clock(result.deadline, result.origin.timeZone) : '';
  const readyByClock = result ? clock(result.effectiveLatestArrival, result.origin.timeZone) : '';
  const transitResult = result?.transitStatus === 'AVAILABLE' ? result : null;
  const primaryClock = transitResult ? clock(transitResult.judgement.arrivalTime, transitResult.origin.timeZone) : '';
  const fallbackClock = transitResult ? clock(transitResult.fallbackJudgement.arrivalTime, transitResult.origin.timeZone) : '';
  const primaryWasAssessed = transitResult?.engine.assessedService !== 'Google missed-service journey';
  const outcome = result ? topLevelOutcome(result) : null;

  return <div className="mx-auto max-w-5xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Manchester Arrive By — Beta</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">After you land at Manchester Airport, when will you actually reach where you're going?</h1>
    <p className="mt-3 max-w-3xl text-ink-600">Enter when you'll be ready to leave the terminal, your final destination and the time you need to arrive by. Arrive By checks the real public-transport chain, what happens if you miss its first important service, and whether a car could still get you there in time.</p>
    <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-500">
      <li>Currently supports Manchester Airport Terminal 2 and UK domestic destinations.</li>
      <li>Real, live public-transport and traffic-aware driving data — nothing invented.</li>
      <li>The journey result is an estimate, not a guarantee.</li>
    </ul>

    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-md border border-ink-200 bg-sand-50 p-4 sm:p-6">
      <label className="text-sm">Ready to leave the terminal
        <input className={field} type="datetime-local" required value={availableAt} onChange={(event) => setAvailableAt(event.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">Include landing, immigration, baggage and the time needed before you can start walking towards onward transport.</span>
      </label>
      <label className="text-sm">Final destination
        <input className={field} required maxLength={180} placeholder="e.g. Sheffield city centre" value={destination} onChange={(event) => { setDestination(event.target.value); setPending(null); }} />
      </label>
      <label className="text-sm">Need to arrive by
        <input className={field} type="datetime-local" required value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </label>
      <label className="text-sm">How many minutes do you need after arriving before you're ready? <span className="text-ink-500">(optional)</span>
        <input className={field} type="number" min="0" max="720" step="1" inputMode="numeric" value={readinessMinutes} onChange={(event) => setReadinessMinutes(event.target.value)} />
      </label>
      <label className="text-sm">Why that time matters <span className="text-ink-500">(optional)</span>
        <input className={field} maxLength={140} placeholder="e.g. family event starts" value={deadlineReason} onChange={(event) => setDeadlineReason(event.target.value)} />
      </label>
      <button type="submit" disabled={loading} className="mt-1 rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? 'Checking the live journey…' : 'Can I make it?'}</button>
    </form>

    {error && <div role="alert" className="mt-6 rounded-md border border-terracotta-400 bg-terracotta-50 p-4 text-sm font-medium text-terracotta-700"><strong>Journey not confirmed.</strong><p className="mt-1">{error}</p></div>}

    {pending && <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 scroll-mt-20 rounded-md border border-brass bg-brass-50 p-5 sm:p-7 outline-none">
      <p className="text-xs font-semibold uppercase tracking-wide">Confirm your destination</p>
      <h2 className="mt-2 font-display text-2xl sm:text-3xl">{destinationPendingHeadline(pending)}</h2>
      {pending.destinationConfidence === 'NEEDS_CONFIRMATION' && pending.pendingConfirmation && <div className="mt-4 rounded-md border border-brass bg-white p-4">
        <p className="text-sm text-ink-700">You entered: <strong>{destination}</strong></p>
        <p className="mt-1 text-sm text-ink-700">Google found: <strong>{pending.pendingConfirmation.formattedAddress}</strong></p>
        <p className="mt-2 text-sm font-semibold text-ink-900">Is this the place you mean?</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={confirmPendingPlace} disabled={loading} className="rounded-sm bg-ink-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">Yes — use this place</button>
          <button type="button" onClick={rejectPendingPlace} className="rounded-sm border border-ink-300 px-5 py-2 text-sm font-semibold text-ink-900">No — change destination</button>
        </div>
      </div>}
      {pending.destinationConfidence === 'NEEDS_SELECTION' && pending.pendingSelection && <div className="mt-4 rounded-md border border-brass bg-white p-4">
        <p className="text-sm font-semibold text-ink-900">We found a few possible places. Choose the one you mean:</p>
        <div className="mt-3 grid gap-2">
          {pending.pendingSelection.candidates.map((candidate) => (
            <button
              key={candidate.placeId}
              type="button"
              onClick={() => selectCandidate(candidate.placeId)}
              disabled={loading}
              className="rounded-sm border border-ink-300 bg-sand-50 px-4 py-2 text-left text-sm text-ink-900 hover:bg-sand-100 disabled:cursor-wait disabled:opacity-60"
            >
              {candidate.formattedAddress}
            </button>
          ))}
        </div>
      </div>}
      {(pending.destinationConfidence === 'NEEDS_CLARIFICATION' || pending.destinationConfidence === 'UNRESOLVED') && (
        <p className="mt-3 text-sm text-ink-700">Please make the destination more specific and try again.</p>
      )}
    </div>}

    {result && <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 scroll-mt-20 outline-none">
      <section className={`rounded-md border p-5 sm:p-7 ${outcome === 'TRANSIT_WORKS' ? 'border-brass bg-brass-50' : outcome === 'IMMEDIATE_CAR_MAY_WORK' || outcome === 'NO_TRANSIT_CAR_MAY_WORK' ? 'border-ink-200 bg-sand-50' : 'border-terracotta-400 bg-terracotta-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">Your answer</p>
        <h2 className="mt-2 font-display text-2xl sm:text-3xl">{outcome && topLevelVerdict(result, deadlineClock)}</h2>
        {transitResult
          ? <p className="mt-3 text-lg">Expected public-transport arrival: <strong>{primaryClock}</strong>.</p>
          : <p className="mt-3 text-lg">No usable public-transport journey was returned for these details.</p>}
        {result.readinessMinutes > 0 && <p className="mt-1 text-lg">You entered <strong>{minutesLabel(result.readinessMinutes)}</strong> after arrival to be ready, so you need to physically arrive by <strong>{readyByClock}</strong>.</p>}
        {result.deadlineReason && <p className="mt-3 text-sm text-ink-600">You said this matters because: {result.deadlineReason}</p>}
        <p className="mt-3 text-xs text-ink-500">This is an estimate, not a guarantee. Delays, disruption and traffic can change your actual arrival.</p>
      </section>

      {transitResult?.judgement.meetsDeadline && primaryWasAssessed && <section className={`mt-4 rounded-md border p-5 sm:p-6 ${transitResult.fallbackJudgement.meetsDeadline ? 'border-brass/60 bg-white' : 'border-terracotta-400 bg-terracotta-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">If you miss the first important service</p>
        <h3 className="mt-2 font-display text-xl">Miss the {clock(transitResult.primary.firstImportantService.departureTime, transitResult.origin.timeZone)} {serviceLabel(transitResult.primary.firstImportantService.lineShortName || transitResult.primary.firstImportantService.agency || 'service')}, and the next journey reaches {transitResult.destination} at about {fallbackClock}.</h3>
        <p className="mt-2 font-semibold">{transitResult.fallbackJudgement.meetsDeadline
          ? `It still gets you there, with about ${transitResult.fallbackJudgement.minutesFromDeadline} minutes spare.`
          : `That is about ${transitResult.fallbackJudgement.minutesFromDeadline} minutes late.`}</p>
      </section>}

      {result.immediateCar && <CarEstimate estimate={result.immediateCar} result={result} scenario="immediate" />}
      {transitResult?.missedServiceCarRescue && <CarEstimate estimate={transitResult.missedServiceCarRescue} result={transitResult} scenario="missed-service" />}

      {transitResult && <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <JourneyChain title="Journey this answer is based on" itinerary={primaryWasAssessed ? transitResult.primary : transitResult.fallback} timeZone={transitResult.origin.timeZone} />
        {transitResult.judgement.meetsDeadline && primaryWasAssessed && <JourneyChain title="Journey after missing the first service" itinerary={transitResult.fallback} timeZone={transitResult.origin.timeZone} />}
      </div>}
    </div>}

    <details className="mt-8 max-w-3xl rounded-md border border-ink-200 bg-sand-50 p-4 text-sm text-ink-600">
      <summary className="cursor-pointer font-semibold text-ink-900">Known limitations (beta)</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {KNOWN_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </details>
  </div>;
}
