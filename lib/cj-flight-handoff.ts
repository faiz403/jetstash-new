import { cjFlightLinks, type CjFlightLink } from '@/data/cj-flight-links';
import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

export interface CjFlightHandoff { url: string; providerName: 'Air India'; provider: 'air-india' }

// CJ tracking domains already used by its publisher link tools. No wildcard
// subdomains, arbitrary redirectors or new destinations supplied by the visitor.
const CJ_HOSTS = new Set(['www.anrdoezrs.net', 'www.dpbolvw.net', 'www.jdoqocy.com', 'www.tkqlhce.com']);
const PUBLISHER_ID = '101818709'; // JetStash's existing registered CJ website property.
const DAY_MS = 86400000;

function day(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

/** Local validation only. Never follows a tracking URL or claims a booking. */
export function getCjFlightHandoff(routeSlug: string, nowIso: string, records: readonly CjFlightLink[] = cjFlightLinks): CjFlightHandoff | null {
  const today = day(nowIso.slice(0, 10));
  const route = getRouteBySlug(routeSlug);
  if (today === null || !route) return null;
  const origin = getRouteAirport(route);
  const destination = getRouteDestination(route);
  if (!origin || !destination || destination.country !== 'India') return null;
  const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, nowIso);
  if (presentation.status === 'service-ended' && !presentation.canShowConnectingAlternative) return null;
  // Duplicated records are ambiguous; a reviewer must choose the intended one.
  const matches = records.filter((record) => record.routeSlug === routeSlug);
  if (matches.length !== 1) return null;
  const record = matches[0];
  const verified = day(record.verifiedDate);
  const due = day(record.reviewDueDate);
  if (record.provider !== 'air-india' || record.accountRelationship !== 'active' || !record.ukWebsitePromotionAllowed
      || record.generatedBy !== 'cj-get-code' || record.searchType !== 'dateless-exact-airports'
      || record.originIata !== origin.code || record.destinationIata !== destination.iataCode
      || !record.evidenceNote.trim() || verified === null || due === null
      || verified > today || due < today || due < verified || due - verified > 30 * DAY_MS) return null;
  try {
    const url = new URL(record.url);
    if (url.protocol !== 'https:' || !CJ_HOSTS.has(url.hostname) || url.username || url.password || url.port || url.hash
        || record.url !== record.url.trim() || /[\r\n\t]/.test(record.url)
        || !new RegExp(`^/click-${PUBLISHER_ID}-[1-9]\\d*$`).test(url.pathname)) return null;
    // Return the original string byte for byte, including CJ-generated params.
    return { url: record.url, providerName: 'Air India', provider: 'air-india' };
  } catch { return null; }
}
