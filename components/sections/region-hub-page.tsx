import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, MapPin, Plane, Users } from 'lucide-react';
import { DealCard } from '@/components/ui/deal-card';
import { Badge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Destination } from '@/data/destinations';
import { getDealsByRegionGroup } from '@/data/deals';
import { getRoutesByDestination, getRouteAirport } from '@/data/routes';
import { placeholderUrl } from '@/lib/images';

interface RegionHubProps {
  eyebrow: string;
  title: string;
  intro: string;
  destinationsInRegion: Destination[];
  visaNote: string;
  practicalNotes: { title: string; body: string }[];
  airportsServed: string[];
  /** When true, surfaces a "visiting family" callout — only relevant for Pakistan/India-style hubs. */
  showFamilyVisitCallout?: boolean;
}

export function RegionHubPage({
  eyebrow,
  title,
  intro,
  destinationsInRegion,
  visaNote,
  practicalNotes,
  airportsServed,
  showFamilyVisitCallout = false,
}: RegionHubProps) {
  const slugs = destinationsInRegion.map((d) => d.slug);
  const regionDeals = getDealsByRegionGroup(slugs);
  const regionRoutes = slugs.flatMap((slug) => getRoutesByDestination(slug));

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">{eyebrow}</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-sand-50 sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-300">{intro}</p>
          <p className="mt-5 flex items-center gap-2 text-sm text-ink-400">
            <Plane className="h-4 w-4" strokeWidth={2} />
            Flying from: {airportsServed.join(', ')}
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Destinations in this hub</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {destinationsInRegion.map((dest) => (
              <Link
                key={dest.slug}
                href={`/destinations/${dest.slug}`}
                className="group flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="relative h-36 w-full overflow-hidden">
                  <Image
                    src={placeholderUrl(`${dest.city}, ${dest.country}`)}
                    alt={`${dest.city}, ${dest.country}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {dest.country}
                  </span>
                  <h3 className="mt-2 font-display text-2xl text-ink-900">{dest.city}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{dest.tagline}</p>
                  <p className="mt-4 text-xs font-medium text-ink-400">{dest.flightTimeFromUK}</p>
                  <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    View destination guide
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {showFamilyVisitCallout && (
        <section className="bg-ink-900 py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-brass-300" strokeWidth={2} />
              <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Most trips here are family visits</span>
            </div>
            <h2 className="mt-3 max-w-xl font-display text-2xl leading-tight text-sand-50 sm:text-3xl">
              Every destination guide below includes document, baggage and peak-period detail specific to visiting family
            </h2>
            <p className="mt-3 max-w-xl text-sm text-ink-300">
              Open any destination guide in this hub and scroll to the "Visiting family" section for NICOP/OCI
              guidance and real Eid/Diwali booking-window advice.
            </p>
          </div>
        </section>
      )}

      {regionRoutes.length > 0 && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Routes in this hub</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-500">Specific airport-to-destination guides with booking windows and peak periods.</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {regionRoutes.map((route) => {
                const airport = getRouteAirport(route);
                const dest = destinationsInRegion.find((d) => d.slug === route.destinationSlug);
                if (!airport || !dest) return null;
                return (
                  <Link
                    key={route.slug}
                    href={`/routes/${route.slug}`}
                    className="group flex flex-col rounded-md border border-ink-100 bg-sand-50 p-5 transition-all hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{route.isDirect ? 'Direct' : 'Connecting'}</span>
                    <h3 className="mt-1.5 font-display text-lg text-ink-900">{airport.city} → {dest.city}</h3>
                    <p className="mt-1 text-xs text-ink-500">{route.flightTime}</p>
                    <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-ink-900">
                      View route <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {regionDeals.length > 0 && (
        <section className="bg-sand-50 py-16 sm:py-20">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Current fares in this hub</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {regionDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Travel notes</h2>
              <div className="mt-6 flex flex-col gap-6">
                {practicalNotes.map((note) => (
                  <div key={note.title} className="border-l-2 border-brass pl-4">
                    <h3 className="font-semibold text-ink-900">{note.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-ink-100 bg-sand-50 p-7">
              <h3 className="font-display text-xl text-ink-900">Visa & entry requirements</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{visaNote}</p>
              <p className="mt-4 text-xs text-ink-400">
                Requirements change — always confirm directly with the relevant embassy, high commission, or an
                authorised visa service before booking.
              </p>
              <LinkButton href="/contact" variant="ghost" size="sm" className="mt-5">
                Ask us a question
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
