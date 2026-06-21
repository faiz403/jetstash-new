import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { airports } from '@/data/airports';

export const metadata: Metadata = {
  title: 'UK Departure Airports',
  description: 'Every UK airport covered by JetStash, with long-haul and short-haul routes from each.',
};

export default function AirportsIndexPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">UK departure airports</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">Find the routes available from your nearest airport.</p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {airports.map((airport) => (
              <Link
                key={airport.slug}
                href={`/airports/${airport.slug}`}
                className="group flex flex-col rounded-md border border-ink-100 p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">{airport.code}</span>
                <h3 className="mt-1.5 font-display text-2xl text-ink-900">{airport.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{airport.region}</p>
                {airport.hasDirectLongHaul && (
                  <span className="mt-2 inline-flex w-fit items-center rounded-full bg-terracotta-50 px-2.5 py-0.5 text-xs font-semibold text-terracotta-700">
                    Direct long-haul
                  </span>
                )}
                <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                  View routes <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
