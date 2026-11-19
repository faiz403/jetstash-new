import { ArrowUpRight } from 'lucide-react';
import type { CjFlightHandoff } from '@/lib/cj-flight-handoff';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';
import { AffiliateLinkDisclosure } from '@/components/ui/affiliate-link-disclosure';
import { PROVIDER_REL } from '@/lib/booking-providers';

/** One verified alternative to the paused provider, at the existing booking slot. */
export function CjFlightCta({ handoff, routeSlug, serviceEnded = false }: { handoff: CjFlightHandoff; routeSlug: string; serviceEnded?: boolean }) {
  return <div className="mt-3 sm:mt-5">
    <TrackedOutboundLink href={handoff.url} target="_blank" rel={PROVIDER_REL} event="cj_flight_click"
      properties={{ route: routeSlug, source: handoff.provider }}
      className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-5 py-3 text-base font-semibold text-sand-50 transition-all hover:bg-brass-700 active:scale-[0.985] sm:w-auto">
      {serviceEnded ? 'Search connecting flights on Air India' : 'Search flights on Air India'}
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </TrackedOutboundLink>
    <AffiliateLinkDisclosure providerName={handoff.providerName} className="mt-2">
      Check the itinerary, baggage allowance and booking terms before paying.
    </AffiliateLinkDisclosure>
    <p className="mt-2 text-xs leading-snug text-ink-500">Opens a new search. Choose your travel dates and check both airports. Any fare shown on JetStash is not carried across. This does not confirm a nonstop service or availability.</p>
  </div>;
}
