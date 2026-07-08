import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plane, FileCheck, ArrowUpRight } from 'lucide-react';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getDealsByDestination } from '@/data/deals';
import { airports } from '@/data/airports';
import { getRoutesByDestination } from '@/data/routes';
import { getTipsForScope } from '@/data/traveller-tips';
import { getVisaLinkForCountry } from '@/lib/visa-links';
import { DealCard } from '@/components/ui/deal-card';
import { NoFareFallback } from '@/components/ui/no-fare-fallback';
import { Badge } from '@/components/ui/badge';
import { FamilyVisitBlock } from '@/components/sections/family-visit-block';
import { TravellerTipList } from '@/components/route/traveller-tip-list';
import { siteConfig } from '@/lib/site-config';
import { DestinationVisual } from '@/components/ui/destination-visual';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { JsonLd, breadcrumbSchema } from '@/components/seo/json-ld';

export async function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const dest = getDestinationBySlug(params.slug);
  if (!dest) return {};
  return {
    title: `Flights to ${dest.city}, ${dest.country} from the UK`,
    description: `${dest.tagline}. Flight times, visa requirements and tracked fares for UK travellers to ${dest.city}.`,
    alternates: { canonical: `${siteConfig.url}/destinations/${dest.slug}` },
  };
}

export default function DestinationPage({ params }: { params: { slug: string } }) {
  const dest = getDestinationBySlug(params.slug);
  if (!dest) {
    notFound();
    return null;
  }

  const dealsHere = getDealsByDestination(dest.slug);
  const servingAirports = airports.filter((a) => dest.ukAirports.includes(a.slug));
  const routesHere = getRoutesByDestination(dest.slug);
  const travellerTips = getTipsForScope({ destinationSlug: dest.slug });
  const visaLink = getVisaLinkForCountry(dest.country);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', href: '/' },
          { name: 'Destinations', href: '/destinations' },
          { name: dest.city, href: `/destinations/${dest.slug}` },
        ])}
      />
      <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-20">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-brass-300">Home</Link>
            <span>/</span>
            <Link href="/destinations" className="hover:text-brass-300">Destinations</Link>
            <span>/</span>
            <span className="text-ink-200">{dest.city}</span>
          </nav>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <div className="stagger-in stagger-1 animate-fade-up">
                <Badge variant="dark">{dest.country}</Badge>
              </div>
              <h1 className="stagger-in stagger-2 mt-4 animate-fade-up font-display text-4xl tracking-tight text-sand-50 sm:text-5xl">{dest.city}</h1>
              <p className="stagger-in stagger-3 mt-3 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-300">{dest.tagline}</p>
              <div className="stagger-in stagger-4 mt-6 flex animate-fade-up flex-wrap gap-2">
                {dest.bestFor.map((tag) => (
                  <Badge key={tag} variant="dark">{tag}</Badge>
                ))}
              </div>
            </div>
            <div className="stagger-in stagger-3 relative aspect-[4/3] animate-fade-up overflow-hidden rounded-md border border-white/10">
              <DestinationVisual
                slug={dest.slug}
                label={dest.city}
                sublabel={dest.country}
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <h2 className="font-display text-2xl text-ink-900">About {dest.city}</h2>
              <p className="mt-4 leading-relaxed text-ink-600">{dest.description}</p>

              <h3 className="mt-10 font-display text-xl text-ink-900">Flying from the UK</h3>
              <div className="mt-4 flex flex-col gap-3">
                {servingAirports.map((airport) => {
                  const matchedRoute = routesHere.find((r) => r.airportSlug === airport.slug);
                  const href = matchedRoute ? `/routes/${matchedRoute.slug}` : `/airports/${airport.slug}`;
                  return (
                    <Link
                      key={airport.slug}
                      href={href}
                      className="flex items-center justify-between rounded-sm border border-ink-100 px-4 py-3 transition-colors hover:border-brass/40 hover:bg-sand-50"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-ink-700">
                        <Plane className="h-4 w-4 text-ink-400" strokeWidth={2} />
                        {airport.name} ({airport.code})
                      </span>
                      <span className="flex items-center gap-1 text-xs text-ink-400">
                        {matchedRoute ? 'View route guide' : 'View airport guide'}
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
                      </span>
                    </Link>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-ink-500">Typical flight time: {dest.flightTimeFromUK}</p>
            </div>

            <div className="rounded-md border border-ink-100 bg-sand-50 p-7">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-terracotta-600" strokeWidth={2} />
                <h3 className="font-display text-lg text-ink-900">Visa & entry</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{dest.visaNote}</p>
              {visaLink && (
                <div className="mt-5">
                  <a
                    href={visaLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${visaLink.buttonLabel} — ${visaLink.sourceName} (opens in a new tab)`}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-4 py-2.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-brass-600"
                  >
                    {visaLink.buttonLabel}
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </a>
                  <p className="mt-2 text-[11px] text-ink-400">{visaLink.sourceName} · opens in a new tab</p>
                </div>
              )}
              <p className="mt-4 text-xs text-ink-400">
                Visa requirements can vary depending on your nationality. Always check the latest official guidance
                before travelling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {dest.familyVisitContent && <FamilyVisitBlock content={dest.familyVisitContent} city={dest.city} />}

      {travellerTips.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Traveller tips for {dest.city}</h2>
            <div className="mt-8">
              <TravellerTipList tips={travellerTips} />
            </div>
          </div>
        </section>
      )}

      <section className="bg-sand-50 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Fares we're tracking to {dest.city}</h2>
          {dealsHere.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dealsHere.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <NoFareFallback cityLabel={dest.city} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
