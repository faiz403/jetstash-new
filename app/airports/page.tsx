import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Plane } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { airports } from '@/data/airports';
import { getRoutesByAirport } from '@/data/routes';
import { getAirportImage } from '@/lib/brand-images';

export const metadata: Metadata = {
  alternates: { canonical: '/airports' },
  title: 'UK Departure Airports',
  description: 'Every UK airport covered by JetStash, with long-haul and short-haul routes from each.',
};

export default function AirportsIndexPage() {
  const directLongHaulCount = airports.filter((a) => a.hasDirectLongHaul).length;

  return (
    <>
      <PageHero
        heroKey="airports"
        eyebrow="UK airports"
        title="Start from the airport nearest you"
        description="Every fare on JetStash is tied to a real UK departure airport, because the right route from Manchester is rarely the right route from Heathrow."
        stats={[
          { value: String(airports.length), label: 'UK airports' },
          { value: String(directLongHaulCount), label: 'With direct long-haul' },
        ]}
      />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {airports.map((airport) => {
              const routeCount = getRoutesByAirport(airport.slug).length;
              const airportImage = getAirportImage(airport.slug);
              return (
                <Link
                  key={airport.slug}
                  href={`/airports/${airport.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-md border border-ink-100 shadow-card transition-all hover:-translate-y-1 hover:border-brass-200 hover:shadow-card-hover"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-ink-950">
                    {airportImage ? (
                      <Image
                        src={airportImage.src}
                        alt={airportImage.alt}
                        fill
                        sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-display text-6xl text-sand-50/20" aria-hidden="true">
                        {airport.code}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/10 to-transparent" aria-hidden="true" />
                    <span className="absolute bottom-4 left-5 text-xs font-semibold uppercase tracking-[0.16em] text-sand-50">
                      {airport.code} · {airport.region}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-2xl text-ink-900">{airport.name}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {airport.hasDirectLongHaul && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brass-50 px-2.5 py-0.5 text-xs font-semibold text-brass-700">
                          <Plane className="h-3 w-3" strokeWidth={2.5} />
                          Direct long-haul
                        </span>
                      )}
                      {routeCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold text-ink-500">
                          {routeCount} route guide{routeCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors group-hover:text-terracotta-600">
                      View routes
                      <ArrowUpRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        strokeWidth={2.25}
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
