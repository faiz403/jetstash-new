'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { GoogleCarRescue, GoogleItinerary, GoogleJourneyLeg, GooglePrototypeResult } from '@/lib/arrive-by/google-routes';

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

function minutes(value?: number): string {
  if (value === undefined) return 'Not established';
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder} min`;
}

export type TopLevelOutcome = 'TRANSIT_WORKS' | 'IMMEDIATE_CAR_MAY_WORK' | 'NO_TRANSIT_CAR_MAY_WORK' | 'NO_CHECKED_OPTION_WORKS' | 'TRANSIT_LATE_CAR_UNAVAILABLE' | 'JOURNEY_NOT_CONFIRMED';

export function topLevelOutcome(result: GooglePrototypeResult): TopLevelOutcome {
  if (result.transitStatus === 'UNAVAILABLE') {
    if (result.immediateCar.status !== 'AVAILABLE') return 'JOURNEY_NOT_CONFIRMED';
    return result.immediateCar.meetsReadyBy ? 'NO_TRANSIT_CAR_MAY_WORK' : 'NO_CHECKED_OPTION_WORKS';
  }
  if (result.judgement.meetsDeadline) return 'TRANSIT_WORKS';
  if (result.immediateCar?.status !== 'AVAILABLE') return 'TRANSIT_LATE_CAR_UNAVAILABLE';
  return result.immediateCar.meetsReadyBy ? 'IMMEDIATE_CAR_MAY_WORK' : 'NO_CHECKED_OPTION_WORKS';
}

export function topLevelVerdict(result: GooglePrototypeResult, deadlineClock: string): string {
  const outcome = topLevelOutcome(result);
  if (outcome === 'IMMEDIATE_CAR_MAY_WORK') return 'Public transport is too late, but a car may still get you there in time.';
  if (outcome === 'NO_TRANSIT_CAR_MAY_WORK') return 'No public-transport journey was found, but a car may still get you there in time.';
  if (outcome === 'NO_CHECKED_OPTION_WORKS') return 'No — none of the checked options get you there in time.';
  if (outcome === 'TRANSIT_LATE_CAR_UNAVAILABLE') return 'Public transport is too late, and a car estimate could not be confirmed.';
  if (outcome === 'JOURNEY_NOT_CONFIRMED') return 'Journey not confirmed.';
  return result.readinessMinutes > 0
    ? `Yes — you can be ready by ${deadlineClock}`
    : `Yes — you can reach ${result.destination} by ${deadlineClock}`;
}

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
    {(leg.headsign || leg.stopCount) && <p className="mt-0.5 text-xs text-ink-500">{leg.headsign ? `Towards ${leg.headsign}` : ''}{leg.headsign && leg.stopCount ? ' · ' : ''}{leg.stopCount ? `${leg.stopCount} ${leg.stopCount === 1 ? 'stop' : 'stops'}` : ''}</p>}
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
      <h3 className="mt-2 font-display text-xl">Estimated drive from Manchester Airport Terminal 2: {minutes(Math.ceil((estimate.durationSeconds ?? 0) / 60))}.</h3>
      <p className="mt-2 text-sm">Estimated departure: <strong>{clock(estimate.departureTime!, result.origin.timeZone)}</strong>. Estimated physical arrival: <strong>{clock(estimate.arrivalTime!, result.origin.timeZone)}</strong>.</p>
      <p className="mt-1 text-sm font-semibold">{estimate.meetsReadyBy
        ? 'A car/taxi/pick-up could get you there in time based on the driving estimate.'
        : (result.readinessMinutes > 0 ? 'The driving estimate still misses the time you need to physically arrive by.' : 'The driving estimate still misses your stated arrival time.')}</p>
      <p className="mt-1 text-sm">{estimate.meetsReadyBy
        ? (result.readinessMinutes > 0 ? `Estimated margin: about ${estimate.minutesFromReadyBy} minutes before the time you need to physically arrive.` : `Estimated margin: about ${estimate.minutesFromReadyBy} minutes before your stated arrival time.`)
        : `Estimated shortfall: about ${estimate.minutesFromReadyBy} minutes.`}</p>
      <p className="mt-3 text-xs text-ink-500">This is a traffic-aware driving estimate only. It assumes you could leave by car {immediate ? 'at your entered ready-to-leave time' : 'as soon as the missed service departs'}. It does not include time to find or wait for a taxi, car or pick-up, and availability is not guaranteed.</p>
    </> : <>
      <h3 className="mt-2 font-display text-xl">Car/taxi driving estimate unavailable.</h3>
      <p className="mt-2 text-sm text-ink-600">Arrive By could not get a usable direct DRIVE route. It has not substituted another route or invented a duration.</p>
    </>}
  </section>;
}

export function ArriveByGoogle() {
  const defaultDate = useMemo(tomorrowInLondon, []);
  const [destination, setDestination] = useState('Sheffield Botanical Gardens, Clarkehouse Road, Sheffield S10 2LN');
  const [availableAt, setAvailableAt] = useState(`${defaultDate}T12:00`);
  const [deadline, setDeadline] = useState(`${defaultDate}T14:30`);
  const [deadlineReason, setDeadlineReason] = useState('');
  const [readinessMinutes, setReadinessMinutes] = useState('');
  const [result, setResult] = useState<GooglePrototypeResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/founder/arrive-by/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originId: 'man-terminal-2', destination, availableAt, deadline, deadlineReason,
          readinessMinutes: readinessMinutes === '' ? undefined : Number(readinessMinutes),
        }),
      });
      const body = await response.json() as GooglePrototypeResult | { error?: string };
      if (!response.ok || 'error' in body) throw new Error('error' in body && body.error ? body.error : 'Arrive By could not check this journey.');
      setResult(body as GooglePrototypeResult);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Arrive By could not check this journey.');
    } finally {
      setLoading(false);
    }
  }

  const deadlineClock = result ? clock(result.deadline, result.origin.timeZone) : '';
  const readyByClock = result ? clock(result.effectiveLatestArrival, result.origin.timeZone) : '';
  const transitResult = result?.transitStatus === 'AVAILABLE' ? result : null;
  const primaryClock = transitResult ? clock(transitResult.judgement.arrivalTime, transitResult.origin.timeZone) : '';
  const fallbackClock = transitResult ? clock(transitResult.fallbackJudgement.arrivalTime, transitResult.origin.timeZone) : '';
  const primaryWasAssessed = transitResult?.engine.assessedService !== 'Google missed-service journey';
  const outcome = result ? topLevelOutcome(result) : null;

  return <div className="mx-auto max-w-5xl bg-white px-4 py-8 text-ink-900 sm:px-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-brass-600">Founder prototype · live Google journey data</p>
    <h1 className="mt-3 font-display text-3xl sm:text-4xl">Will the journey after your flight get you there in time?</h1>
    <p className="mt-3 max-w-3xl text-ink-600">Enter when you will be ready to leave the terminal and the time you need to reach your final destination. Arrive By checks the real public-transport chain and what happens if you miss its first important service.</p>
    <p className="mt-2 max-w-3xl text-sm text-ink-500">This first proof supports Manchester Airport Terminal 2 and UK local time. The terminal uses a precise location so the walk to the station is included.</p>

    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-md border border-ink-200 bg-sand-50 p-4 sm:p-6">
      <label className="text-sm">Arrival terminal
        <select className={field} value="man-terminal-2" disabled><option value="man-terminal-2">Manchester Airport Terminal 2</option></select>
      </label>
      <label className="text-sm">Ready to leave the terminal
        <input className={field} type="datetime-local" required value={availableAt} onChange={(event) => setAvailableAt(event.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">Include landing, immigration, baggage and the time needed before you can start walking towards onward transport.</span>
      </label>
      <label className="text-sm">Final destination
        <input className={field} required maxLength={180} value={destination} onChange={(event) => setDestination(event.target.value)} />
      </label>
      <label className="text-sm">Need to arrive by
        <input className={field} type="datetime-local" required value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </label>
      <label className="text-sm">How many minutes do you need after arriving before you’re ready? <span className="text-ink-500">(optional)</span>
        <input className={field} type="number" min="0" max="720" step="1" inputMode="numeric" value={readinessMinutes} onChange={(event) => setReadinessMinutes(event.target.value)} />
        <span className="mt-1 block text-xs text-ink-500">For parking, walking in, queues, security or getting seated. Leave blank if reaching the location is the requirement.</span>
      </label>
      <label className="text-sm">Why that time matters <span className="text-ink-500">(optional)</span>
        <input className={field} maxLength={140} placeholder="e.g. family event starts" value={deadlineReason} onChange={(event) => setDeadlineReason(event.target.value)} />
      </label>
      <button type="submit" disabled={loading} className="mt-1 rounded-sm bg-ink-900 px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{loading ? 'Checking the live journey…' : 'Can I make it?'}</button>
    </form>

    {error && <div role="alert" className="mt-6 rounded-md border border-terracotta-400 bg-terracotta-50 p-4 text-sm font-medium text-terracotta-700"><strong>Journey not confirmed.</strong><p className="mt-1">{error}</p></div>}

    {result && <div ref={resultRef} tabIndex={-1} aria-live="polite" className="mt-8 scroll-mt-20 outline-none">
      <section className={`rounded-md border p-5 sm:p-7 ${outcome === 'TRANSIT_WORKS' ? 'border-brass bg-brass-50' : outcome === 'IMMEDIATE_CAR_MAY_WORK' || outcome === 'NO_TRANSIT_CAR_MAY_WORK' ? 'border-ink-200 bg-sand-50' : 'border-terracotta-400 bg-terracotta-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">Your answer</p>
        <h2 className="mt-2 font-display text-3xl">{topLevelVerdict(result, deadlineClock)}</h2>
        {transitResult
          ? <p className="mt-3 text-lg">Expected public-transport arrival: <strong>{primaryClock}</strong>.</p>
          : <p className="mt-3 text-lg">No usable public-transport journey was returned for these details.</p>}
        {result.readinessMinutes > 0
          ? <p className="mt-1 text-lg">You entered <strong>{minutes(result.readinessMinutes)}</strong> after arrival to be ready, so you need to physically arrive by <strong>{readyByClock}</strong>.</p>
          : transitResult
            ? <p className="mt-1 text-lg">{transitResult.judgement.meetsDeadline
              ? `You have about ${transitResult.judgement.minutesFromDeadline} minutes spare before your stated arrival time.`
              : `You arrive about ${transitResult.judgement.minutesFromDeadline} minutes after your stated arrival time.`}</p>
            : <p className="mt-1 text-lg">You need to reach the destination by <strong>{deadlineClock}</strong>.</p>}
        {result.readinessMinutes > 0 && transitResult && <p className="mt-1 text-lg">{transitResult.judgement.meetsDeadline
          ? `You have about ${transitResult.judgement.minutesFromDeadline} minutes spare before the time you need to physically arrive.`
          : `Public transport misses the time you need to physically arrive by about ${transitResult.judgement.minutesFromDeadline} minutes.`}</p>}
        {result.deadlineReason && <p className="mt-3 text-sm text-ink-600">You said this matters because: {result.deadlineReason}</p>}
      </section>

      {transitResult?.judgement.meetsDeadline && (primaryWasAssessed ? <section className={`mt-4 rounded-md border p-5 sm:p-6 ${transitResult.fallbackJudgement.meetsDeadline ? 'border-brass/60 bg-white' : 'border-terracotta-400 bg-terracotta-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">If you miss the first important service</p>
        <h3 className="mt-2 font-display text-2xl">Miss the {clock(transitResult.primary.firstImportantService.departureTime, transitResult.origin.timeZone)} {serviceLabel(transitResult.primary.firstImportantService.lineShortName || transitResult.primary.firstImportantService.agency || 'service')}, and the next public-transport journey reaches {transitResult.destination} at about {fallbackClock}.</h3>
        <p className="mt-2 font-semibold">{transitResult.fallbackJudgement.meetsDeadline
          ? (transitResult.readinessMinutes > 0 ? `It still gets you there with about ${transitResult.fallbackJudgement.minutesFromDeadline} minutes spare before your ready-by time.` : `It still reaches the location, with about ${transitResult.fallbackJudgement.minutesFromDeadline} minutes spare.`)
          : (transitResult.readinessMinutes > 0 ? `That misses the time you need to physically arrive by about ${transitResult.fallbackJudgement.minutesFromDeadline} minutes.` : `That is about ${transitResult.fallbackJudgement.minutesFromDeadline} minutes late.`)}</p>
      </section> : <section className="mt-4 rounded-md border border-terracotta-400 bg-terracotta-50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide">The deadline-fitting journey starts too early</p>
        <p className="mt-2 font-semibold">The first Google journey had already started by your ready time, so Arrive By assessed the next returned journey. A further missed-service fallback has not been established.</p>
      </section>)}

      {result.immediateCar && <CarEstimate estimate={result.immediateCar} result={result} scenario="immediate" />}
      {transitResult?.missedServiceCarRescue && <CarEstimate estimate={transitResult.missedServiceCarRescue} result={transitResult} scenario="missed-service" />}

      {transitResult && <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <JourneyChain title="Journey this answer is based on" itinerary={primaryWasAssessed ? transitResult.primary : transitResult.fallback} timeZone={transitResult.origin.timeZone} />
        {transitResult.judgement.meetsDeadline && primaryWasAssessed && <JourneyChain title="Journey after missing the first service" itinerary={transitResult.fallback} timeZone={transitResult.origin.timeZone} />}
      </div>}
      <p className="mt-4 text-xs text-ink-500">Live route and timetable data came from Google Routes. Times can change and delays can exceed this margin. Confirm services before travelling.</p>
    </div>}
  </div>;
}
