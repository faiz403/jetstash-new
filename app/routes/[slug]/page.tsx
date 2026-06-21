import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plane, Calendar, Clock, ArrowUpRight, AlertCircle } from 'lucide-react';
import { routes, getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { getDealsByDestination } from '@/data/deals';
import { DealCard } from '@/components/ui/deal-card';
import { Badge } from '@/components/ui/badge';
import { FamilyVisitBlock } from '@/components/sections/family-visit-block';
import { siteConfig } from '@/lib/site-config';

export async function generateStaticParams() {
  return routes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const route = getRouteBySlug(params.slug);
  if (!route) return {};
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  if (!airport || !dest) return {};
  return {
    title: `${airport.city} to ${dest.city} Flights — Booking Windows & Peak Periods`,
    description: `${route.intro.slice(0, 150)}...`,
    alternates: { canonical: `${siteConfig.url}/routes/${route.slug}` },
  };
}

export default function RoutePage({ params }: { params: { slug: string } }) {
  const route = getRouteBySlug(params.slug);
  if (!route) {
    notFound();
    return null;
  }

  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  if (!airport || !dest) {
    notFound();
    return null;
  }

  const dealsHere = getDealsByDestination(dest.slug).filter((d) => d.fromAirportSlug === airport.slug);

  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-brass-300">Home</Link>
            <span>/</span>
            <Link href={`/airports/${airport.slug}`} className="hover:text-brass-300">{airport.name}</Link>
            <span>/</span>
            <span className="text-ink-200">{dest.city}</span>
          </nav>
          <Badge variant="dark">{route.isDirect ? 'Direct route' : 'Connecting route'}</Badge>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] text-sand-50 sm:text-5xl">
            {airport.city} to {dest.city}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-300">{route.intro}</p>

          <div className="mt-7 flex flex-wrap gap-6">
            <RouteStat icon={<Clock className="h-4 w-4" strokeWidth={2} />} label="Flight time" value={route.flightTime} />
            <RouteStat icon={<Plane className="h-4 w-4" strokeWidth={2} />} label="Frequency" value={route.frequency} />
            <RouteStat icon={<Calendar className="h-4 w-4" strokeWidth={2} />} label="Airlines" value={route.airlines.join(', ')} />
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="font-display text-2xl text-ink-900">When to book this route</h2>
              <p className="mt-4 leading-relaxed text-ink-600">{route.bookingWindowNote}</p>
            </div>
            <div className="rounded-md border border-ink-100 bg-sand-50 p-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
                <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Peak demand periods</span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {route.peakPeriods.map((period) => (
                  <div key={period} className="flex items-center gap-2 text-sm text-ink-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-terracotta-500" />
                    {period}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink-400">
                Fares on this route rise sharply within 3–4 weeks of these periods. Book ahead if your dates are fixed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {dest.familyVisitContent && <FamilyVisitBlock content={dest.familyVisitContent} city={dest.city} />}

      {dealsHere.length > 0 && (
        <section className="bg-sand-50 py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Current fares on this route</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dealsHere.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="flex flex-col gap-4 rounded-md border border-ink-100 bg-sand-50 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl text-ink-900">More about {dest.city}</h2>
              <p className="mt-1 text-sm text-ink-500">Full destination guide, visa notes and all current fares — not just this one route.</p>
            </div>
            <Link
              href={`/destinations/${dest.slug}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-5 py-3 text-sm font-semibold text-sand-50 transition-colors hover:bg-ink-700"
            >
              View {dest.city} guide
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function RouteStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-brass-300">{icon}</div>
      <div>
        <p className="text-xs text-ink-400">{label}</p>
        <p className="text-sm font-semibold text-sand-100">{value}</p>
      </div>
    </div>
  );
}
