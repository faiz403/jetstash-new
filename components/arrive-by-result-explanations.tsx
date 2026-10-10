import { clockOf, dateLabelOf, describeDay } from '@/lib/arrive-by-journey/local-time';
import type { JourneyPlan } from '@/lib/arrive-by-journey/types';

type TransitResult = NonNullable<NonNullable<JourneyPlan['arrivalDetail']>['transit']>;

/** Makes the deadline arithmetic visible without changing the solver's verdict or timings. */
export function ArriveByReadyBySummary({ plan }: { plan: JourneyPlan }) {
  if (!plan.deadline || !plan.finalArrival) return null;

  const zone = plan.finalArrival.zone;
  const readinessLeg = plan.timeline.find((leg) => leg.kind === 'DESTINATION_READINESS');
  const deadlineMs = Date.parse(plan.deadline.iso);
  const latestArrivalMs = Date.parse(plan.deadline.latestAcceptableIso);
  const margin = plan.deadline.marginMinutes;

  return <section aria-labelledby="arrive-by-ready-by-title" className="mt-4 rounded-sm border border-ink-200 bg-white p-4 text-sm text-ink-700" data-testid="ready-by-summary">
    <h3 id="arrive-by-ready-by-title" className="font-semibold text-ink-900">Your ready-by check</h3>
    <p className="mt-2">Expected physical arrival: around {clockOf(Date.parse(plan.finalArrival.iso), zone)} on {describeDay(plan.finalArrival.dateLabel, plan.finalArrival.dayOffset)}.</p>
    {readinessLeg && <p className="mt-1">With your {readinessLeg.minutes}-minute readiness buffer, expected ready time is around {clockOf(Date.parse(readinessLeg.endIso), zone)} on {dateLabelOf(Date.parse(readinessLeg.endIso), zone)}.</p>}
    <p className="mt-1">You need to be ready by {clockOf(deadlineMs, zone)} on {dateLabelOf(deadlineMs, zone)}.</p>
    <p className="mt-1">To keep that buffer, latest acceptable physical arrival is around {clockOf(latestArrivalMs, zone)} on {dateLabelOf(latestArrivalMs, zone)}.</p>
    <p className="mt-1">{margin >= 0 ? `About ${margin} minutes to spare against that arrival time.` : `About ${Math.abs(margin)} minutes past that arrival time.`}</p>
  </section>;
}

/** The route estimate describes road time, not a booked or available vehicle. */
export function ArriveByRoadEstimateDisclosure({ pickupLabel, pickupWaitMinutes }: { pickupLabel: string; pickupWaitMinutes?: number }) {
  return <p className="mt-3 rounded-sm border border-ink-200 bg-white p-3 text-sm text-ink-700" data-testid="road-estimate-disclosure">
    For your {pickupLabel.toLowerCase()} plan, the onward time below is based on Google&apos;s traffic-aware driving estimate. This is a road-time estimate only; it does not confirm a driver or vehicle is available, or give a price.
    {pickupWaitMinutes !== undefined && pickupWaitMinutes > 0 && <> Your entered {pickupWaitMinutes}-minute pickup wait is included separately before driving.</>}
  </p>;
}

/** An explicit, expandable missed-service explanation; it opens automatically when the fallback misses the deadline. */
export function ArriveByMissedServiceDetails({ transit, timeZone, deadline, onOpen }: { transit: TransitResult; timeZone: string; deadline?: JourneyPlan['deadline']; onOpen?: () => void }) {
  const rescueArrivalMs = Date.parse(transit.rescue?.arrivalIso ?? '');
  const latestMs = Date.parse(deadline?.latestAcceptableIso ?? '');
  const validRescueArrival = transit.rescue?.available && Number.isFinite(rescueArrivalMs);
  const rescueMargin = validRescueArrival && Number.isFinite(latestMs)
    ? rescueArrivalMs > latestMs ? -Math.max(1, Math.round((rescueArrivalMs - latestMs) / 60000)) : Math.round((latestMs - rescueArrivalMs) / 60000)
    : undefined;
  return <details open={transit.missedServiceMeetsReadyBy === false} className="mt-3 rounded-sm border border-ink-200 bg-white p-3 text-sm text-ink-700" data-testid="missed-service-details">
    <summary onClick={(event) => { const details = event.currentTarget.parentElement; if (details instanceof HTMLDetailsElement && !details.open) onOpen?.(); }} className="cursor-pointer font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass">What if I miss the first service?</summary>
    <p className="mt-2">Your expected onward journey uses {transit.firstService}.</p>
    {transit.missedServiceArrivalIso ? <p className="mt-1">The next checked public-transport option arrives around {clockOf(Date.parse(transit.missedServiceArrivalIso), timeZone)}{transit.missedServiceMeetsReadyBy === true ? ' and still meets your ready-by time.' : transit.missedServiceMeetsReadyBy === false ? ' and misses your ready-by time.' : '.'}</p> : <p className="mt-1">A later public-transport option could not be confirmed.</p>}
    {transit.rescue?.attempted && <div className="mt-2 border-t border-ink-100 pt-2" data-testid="road-rescue-estimate">
      <p className="font-semibold">Car / taxi rescue estimate</p>
      {validRescueArrival ? <>
        <p className="mt-1">Estimated car / taxi arrival around {clockOf(rescueArrivalMs, timeZone)} on {dateLabelOf(rescueArrivalMs, timeZone)}.</p>
        {rescueMargin !== undefined ? <>
          <p className="mt-1">Latest acceptable physical arrival: {clockOf(latestMs, timeZone)} on {dateLabelOf(latestMs, timeZone)}.</p>
          <p className="mt-1">{rescueMargin >= 0 ? `About ${rescueMargin} minutes before your latest acceptable arrival.` : `About ${Math.abs(rescueMargin)} minutes after your latest acceptable arrival.`}</p>
          <p className="mt-1">{rescueMargin >= 0 ? 'The road journey may still meet your ready-by time if a car is ready to leave.' : 'The road journey does not meet your ready-by time.'}</p>
        </> : <p className="mt-1">No reliable deadline margin is available for this road estimate.</p>}
      </> : <p className="mt-1">A reliable driving arrival time could not be confirmed.</p>}
      <p className="mt-1 text-xs text-ink-500">This estimates road travel only; it does not confirm a taxi, driver or pickup is available, or give a price. No allowance for finding or waiting for a taxi is included.</p>
    </div>}
  </details>;
}

export function ArriveByScheduledFlightDisclosure({ assumption }: { assumption: NonNullable<JourneyPlan['scheduledFlightAssumption']> }) {
  const arrivalMs = Date.parse(assumption.arrivesIso);
  return <p className="mt-3 rounded-sm border border-brass bg-white p-3 text-sm text-ink-700" data-testid="scheduled-flight-assumption">
    We have not checked whether you will make your flight connection. This result assumes you arrive at {assumption.arrivalAirportName} at {clockOf(arrivalMs, assumption.timeZone)} on {dateLabelOf(arrivalMs, assumption.timeZone)}, as entered. The onward estimate depends on that arrival. Flight delays and connection feasibility are not checked; airport-exit and pickup times are your own estimates.
  </p>;
}
