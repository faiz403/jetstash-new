import Link from 'next/link';
import { ArrowUpRight, Plane } from 'lucide-react';
import type { Destination } from '@/data/destinations';
import { formatRouteStatusDate } from '@/lib/route-status-copy';
import { getDestinationFlightGuideEntries, type DestinationFlightGuideEntry } from '@/lib/destination-flight-guides';
import { getTripComDestinationHandoffUrl, PROVIDER_REL } from '@/lib/booking-providers';

function routeStatusLabel(status: DestinationFlightGuideEntry['routeStatus']): string {
  switch (status) {
    case 'direct':
      return 'Direct service verified';
    case 'connecting':
      return 'Connecting route verified';
    case 'service-ended':
      return 'Service ended';
    case 'unverified':
      return 'Route verification pending';
    default:
      return 'Route guide not yet available';
  }
}

function fareStatusLabel(entry: DestinationFlightGuideEntry): string {
  const signal = entry.fareSignal;
  if (!signal?.observation) return 'No current fare observed';

  const fare = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: signal.observation.currency,
    maximumFractionDigits: 0,
  }).format(signal.observation.price);
  const checkedDate = formatRouteStatusDate(signal.observation.observedDate);

  if (signal.state === 'current') return `Fare observed: ${fare} return · checked ${checkedDate}`;
  return `Previous fare observation: ${fare} return · checked ${checkedDate}`;
}

interface DestinationFlightGuidesProps {
  destination: Destination;
  nowIso: string;
}

export function DestinationFlightGuides({ destination, nowIso }: DestinationFlightGuidesProps) {
  const entries = getDestinationFlightGuideEntries(destination, nowIso);
  const guides = entries.filter((entry) => entry.href);
  const unavailable = entries.filter((entry) => !entry.href);
  const handoffs = unavailable
    .map((entry) => ({ entry, href: getTripComDestinationHandoffUrl(entry.airport.slug, destination.slug) }))
    .filter((item): item is { entry: DestinationFlightGuideEntry; href: string } => item.href !== null);
  const blocked = unavailable.filter((entry) => !getTripComDestinationHandoffUrl(entry.airport.slug, destination.slug));

  return (
    <section aria-labelledby="destination-flight-guides-heading" className="mt-10">
      <h3 id="destination-flight-guides-heading" className="font-display text-xl text-ink-900">
        Flights to {destination.city} from the UK
      </h3>

      {guides.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {guides.map((entry) => (
            <article key={entry.airport.slug} className="rounded-sm border border-ink-100 p-4">
              <div className="flex items-start gap-2">
                <Plane className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
                <div>
                  <h4 className="text-sm font-semibold text-ink-800">
                    {entry.airport.city} → {destination.city}
                  </h4>
                  <p className="mt-1 text-xs text-ink-500">{routeStatusLabel(entry.routeStatus)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">{fareStatusLabel(entry)}</p>
                </div>
              </div>
              <Link
                href={entry.href!}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brass-700 transition-colors hover:text-brass-800"
              >
                View flight details
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          JetStash has not published a route guide for flights to {destination.city} yet.
        </p>
      )}

      {handoffs.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label={`Current flight options to ${destination.city}`}>
          {handoffs.map(({ entry, href }) => (
            <article key={entry.airport.slug} className="rounded-sm border border-ink-100 bg-sand-50 p-4">
              <div className="flex items-start gap-2">
                <Plane className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
                <div>
                  <h4 className="text-sm font-semibold text-ink-800">
                    {entry.airport.name} → {destination.city}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">No exact JetStash route guide published yet.</p>
                </div>
              </div>
              <a
                href={href}
                target="_blank"
                rel={PROVIDER_REL}
                className="mt-4 inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-brass-600"
              >
                Check live flights on Trip.com
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </a>
            </article>
          ))}
        </div>
      )}

      {handoffs.length > 0 && (
        <p className="mt-2 text-xs text-ink-500">
          Partner link, opens Trip.com in a new tab. Check the itinerary, dates and booking terms before paying.
        </p>
      )}

      {blocked.length > 0 && (
        <div className="mt-4 rounded-sm border border-ink-100 bg-sand-50 p-4">
          <p className="text-sm font-medium text-ink-700">Route guide coverage is still being expanded</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {handoffs.length > 0
              ? 'We have not yet published destination-specific flight details or an exact partner handoff for:'
              : 'We have not yet published destination-specific flight details for:'}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Airports without a ${destination.city} route guide yet`}>
            {blocked.map((entry) => (
              <li key={entry.airport.slug} className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600">
                {entry.airport.name} ({entry.airport.code})
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-sm text-ink-500">
        Service and fare information is specific to each airport-to-destination route and is shown only where JetStash has evidence.
      </p>
    </section>
  );
}
