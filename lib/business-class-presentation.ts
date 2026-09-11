import type { Deal } from '@/data/deals';
import { hasTrackedFare } from '@/data/deals';
import { getPublishableObservationsByRouteAndCabin } from '@/data/fare-observations';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { isPoorItinerarySuitability } from '@/lib/itinerary-suitability';

/**
 * Presentation guard for Business fare cards. It deliberately reuses the
 * established poor-itinerary suppression rule; it does not change the fare
 * archive, selection policy, or whether the underlying evidence is public.
 */
export function hasPresentableBusinessFare(deal: Deal, nowIso: string): boolean {
  if (deal.cabin !== 'Business' || !hasTrackedFare(deal, nowIso)) return false;

  const route = getRouteByAirportAndDestination(deal.fromAirportSlug, deal.toDestinationSlug);
  if (!route) return false;
  const observations = getPublishableObservationsByRouteAndCabin(
    route.slug,
    'Business',
    nowIso
  );
  const latest = observations.at(-1);
  return latest ? !isPoorItinerarySuitability(latest) : false;
}

export function shouldRenderRouteDealCard(deal: Deal, nowIso: string): boolean {
  return deal.cabin !== 'Business' || hasPresentableBusinessFare(deal, nowIso);
}
