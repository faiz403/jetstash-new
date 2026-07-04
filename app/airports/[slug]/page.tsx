import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plane, ArrowUpRight, Info, MapPin } from 'lucide-react';
import { airports, getAirportBySlug } from '@/data/airports';
import { getDealsByAirport } from '@/data/deals';
import { getRoutesByAirport, getRouteDestination } from '@/data/routes';
import { getNotesByAirport } from '@/data/airport-notes';
import { getTipsForScope } from '@/data/traveller-tips';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { Badge } from '@/components/ui/badge';
import { TravellerTipList } from '@/components/route/traveller-tip-list';
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld';
import { siteConfig } from '@/lib/site-config';

export async function generateStaticParams() {
  return airports.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const airport = getAirportBySlug(params.slug);
  if (!airport) return {};
  return {
    title: `Flights from ${airport.name} (${airport.code}) — Pakistan, India & Gulf Routes`,
    description: airport.description,
    alternates: { canonical: `${siteConfig.url}/airports/${airport.slug}` },
  };
}

export default function AirportPage({ params }: { params: { slug: string } }) {
  const airport = getAirportBySlug(params.slug);
  if (!airport) {
    notFound();
    return null;
  }

  const dealsHere = getDealsByAirport(airport.slug);
  const routesHere = getRoutesByAirport(airport.slug);
  const compareAirports = (airport.compareAirportSlugs ?? [])
    .map((slug) => getAirportBySlug(slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const practicalNotes = getNotesByAirport(airport.slug);
  const travellerTips = getTipsForScope({ airportSlug: airport.slug });

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', href: '/' },
          { name: 'Airports', href: '/airports' },
          { name: airport.name, href: `/airports/${airport.slug}` },
        ])}
      />
      <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,147,46,0.12),transparent_60%)]" />
        <span
          className="pointer-events-none absolute -right-6 -top-10 hidden select-none font-display text-[12rem] leading-none text-sand-50/[0.04] lg:block"
          aria-hidden="true"
        >
          {airport.code}
        </span>
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-brass-300">Home</Link>
            <span>/</span>
            <Link href="/airports" className="hover:text-brass-300">Airports</Link>
            <span>/</span>
            <span className="text-ink-200">{airport.name}</span>
          </nav>
          <div className="stagger-in stagger-1 animate-fade-up">
            <Badge variant="dark">{airport.code} · {airport.region}</Badge>
          </div>
          <h1 className="stagger-in stagger-2 mt-4 animate-fade-up font-display text-4xl tracking-tight text-sand-50 sm:text-5xl">{airport.name}</h1>
          <p className="stagger-in stagger-3 mt-3 max-w-2xl animate-fade-up text-lg leading-relaxed text-ink-300">{airport.description}</p>
        </div>
      </section>

      {/* Why this airport — community-specific framing */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Why {airport.city} is the right airport for this route</h2>
              <p className="mt-4 leading-relaxed text-ink-600">{airport.whyThisAirport}</p>
            </div>
            <div className="rounded-md border border-ink-100 bg-sand-50 p-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Serves communities in</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {airport.servesCommunities.map((c) => (
                  <span key={c} className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Route hub links — either this airport's own routes, or a genuine comparison link */}
      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          {routesHere.length > 0 ? (
            <>
              <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Direct routes from {airport.name}</h2>
              <p className="mt-2 max-w-xl text-sm text-ink-500">
                Each route below has its own guide — booking windows, peak periods and airline coverage specific to that exact pairing.
              </p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {routesHere.map((route) => {
                  const dest = getRouteDestination(route);
                  if (!dest) return null;
                  return (
                    <Link
                      key={route.slug}
                      href={`/routes/${route.slug}`}
                      className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                        <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                        {dest.country}
                      </span>
                      <h3 className="mt-2 font-display text-xl text-ink-900">{airport.city} → {dest.city}</h3>
                      <p className="mt-1.5 text-sm text-ink-500">{route.flightTime} · {route.isDirect ? 'Direct' : 'Connecting'}</p>
                      <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                        View route guide
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : compareAirports.length > 0 ? (
            <>
              <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">No curated route from {airport.name} yet</h2>
              <p className="mt-2 max-w-xl text-sm text-ink-500">{airport.whyThisAirport}</p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {compareAirports.map((cmp) => (
                  <Link
                    key={cmp.slug}
                    href={`/airports/${cmp.slug}`}
                    className="group flex flex-col rounded-md border border-ink-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      <Plane className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {cmp.code}
                    </span>
                    <h3 className="mt-2 font-display text-xl text-ink-900">Compare with {cmp.name}</h3>
                    <p className="mt-1.5 text-sm text-ink-500">{cmp.region}</p>
                    <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      View {cmp.city} routes
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.25} />
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <NoFareFallback cityLabel={airport.name} />
          )}
        </div>
      </section>

      {/* Practical notes — real hub depth, not generic airport copy */}
      {(practicalNotes.length > 0 || travellerTips.length > 0) && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Before you fly from {airport.city}</h2>
            {practicalNotes.length > 0 && (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {practicalNotes.map((note) => (
                  <div key={note.id} className="rounded-md border border-ink-100 bg-sand-50 p-6">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">
                      <Info className="h-4.5 w-4.5" strokeWidth={2} />
                    </div>
                    <h3 className="mt-4 font-display text-lg text-ink-900">{note.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-500">{note.body}</p>
                  </div>
                ))}
              </div>
            )}
            {travellerTips.length > 0 && (
              <div className="mt-10">
                <TravellerTipList tips={travellerTips} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Long-haul + short-haul lists retained, but as supporting detail not the page's main content */}
      <section className="bg-sand-50 py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-xl text-ink-900">All long-haul routes</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {airport.longHaulRoutes.map((route) => (
                  <li key={route} className="flex items-center gap-2 text-sm text-ink-600">
                    <Plane className="h-4 w-4 text-terracotta-600" strokeWidth={2} />
                    {route}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-xl text-ink-900">Popular short-haul</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {airport.shortHaulHighlights.map((route) => (
                  <li key={route} className="flex items-center gap-2 text-sm text-ink-600">
                    <Plane className="h-4 w-4 text-ink-400" strokeWidth={2} />
                    {route}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Example fares from {airport.name}</h2>
          {dealsHere.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dealsHere.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NoFareFallback cityLabel={airport.name} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
