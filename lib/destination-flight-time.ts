import type { Destination } from '@/data/destinations';
import { airports } from '@/data/airports';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

/**
 * Trust fix (7 Sept 2026, independent audit): data/destinations.ts's
 * flightTimeFromUK is a single editorial string naming ONE UK airport as
 * this destination's flight-time reference — it carries no verification of
 * its own. This function used to patch exactly one specific risk (a
 * "direct from Manchester" claim surviving after that Manchester route
 * went service-ended); it did nothing when the named airport had NO
 * canonical Route record at all. That gap let two live public claims
 * assert an unsupported current direct service: Karachi ("8h 30m direct
 * from London Heathrow", /pakistan) and Madinah ("6h 15m direct from
 * London Heathrow", /gulf) — no london-heathrow-karachi or
 * london-heathrow-madinah Route exists anywhere in data/routes.ts, and the
 * UK-Madinah/Karachi routes that DO exist are all connecting.
 *
 * Rewritten to fail closed generally: any "direct from <airport>" clause
 * is checked against that airport's actual Route record and effective
 * presentation (getEffectiveRoutePresentation() — the same function the
 * route pages themselves call), not just Manchester. A route that doesn't
 * exist, or exists but isn't currently 'direct' (connecting, unverified,
 * or service-ended), causes the claim to fail closed rather than repeat
 * an unsupported fact. This closes the class of bug, not just the two
 * instances found — deliberately NOT editing data/destinations.ts itself
 * (reserved for a concurrent, unrelated fix), so the correction lives
 * entirely at this shared rendering/evidence boundary.
 */

const DIRECT_FROM_PATTERN = /\bdirect\s+from\s+([A-Za-z][A-Za-z\s]*?)(?=[;.,]|$)/i;

function findNamedAirport(claimedText: string) {
  return airports.find((a) => a.name === claimedText || a.city === claimedText);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getDestinationFlightTimeFromUK(destination: Destination, nowIso: string): string {
  const base = destination.flightTimeFromUK;
  const match = base.match(DIRECT_FROM_PATTERN);
  if (!match) return base;

  const claimedText = match[1].trim();
  const airport = findNamedAirport(claimedText);
  // No specific single airport identified (e.g. Dubai's "direct from most
  // UK airports") — nothing concrete to verify this claim against, so
  // leave it as the deliberately generic, already-hedged wording it is.
  if (!airport) return base;

  const route = getRouteByAirportAndDestination(airport.slug, destination.slug);
  const unsupported = `Flight time from ${airport.name} not yet confirmed.`;

  if (!route) return unsupported;

  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  if (presentation.status === 'direct') return base;

  if (presentation.status === 'service-ended') {
    // Already annotated by the destination's own editorial copy (e.g.
    // Delhi/Mumbai's "former Manchester direct service ended") — leave it
    // exactly as written rather than mangling an already-correct sentence.
    if (new RegExp(`${escapeRegExp(airport.city)}\\s+direct service ended`, 'i').test(base)) return base;
    // Remove the whole matched "direct from <airport>" clause — not just
    // the airport name — so no bare, object-less "direct" survives.
    const stripped = base.replace(match[0], '').replace(/\s{2,}/g, ' ').trim().replace(/[;,]$/, '');
    return `${stripped}; ${airport.city} direct service ended`;
  }

  // 'connecting' or 'unverified' — a Route record exists, but it does not
  // currently support the "direct" claim this string makes.
  return unsupported;
}
