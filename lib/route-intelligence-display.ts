import { computeRouteIntelligenceLevel } from '@/lib/atlas-network-data';
import type { Route } from '@/data/routes';
import type { RouteIntelligenceLevel } from '@/components/founder/atlas-feel-test';

/**
 * Site-wide Route Intelligence Completion (August 2026, phase 2).
 *
 * Phase 1 (same month) fixed the Atlas so every one of the 80 real routes
 * gets a genuine, non-blank computeRouteIntelligenceLevel() grade — but
 * that grade was only ever visible on the homepage Atlas. A route's own
 * detail page, its card on /routes, and its entry on a destination page's
 * flight-guide list never showed it at all — a visitor following any of
 * those three journeys had no way to see whether JetStash actually knows a
 * route well.
 *
 * This is the single, shared source of the label/colour every one of those
 * three surfaces uses — deliberately NOT a second scoring system: it calls
 * the exact same computeRouteIntelligenceLevel() the Atlas calls, and reuses
 * the exact same label wording ROUTE_INTELLIGENCE_COLOUR already established
 * in components/founder/atlas-feel-test.tsx (destination-dot labels), so a
 * visitor sees identical words whether they're on the Atlas or a route card.
 * The dot colour uses this site's real Tailwind brand tokens (brass/ink)
 * rather than the Atlas's own raw hex values — that file draws directly into
 * inline SVG style props (a genuine, pre-existing, narrowly-scoped exception
 * to "never hardcode hex", unaffected by this file) where a Tailwind class
 * can't apply; every surface this file serves is a normal DOM node, so it
 * uses the site's normal Tailwind classes instead, per the design-system
 * rule in CLAUDE.md.
 *
 * 'expanding' is included for type completeness and future-proofing, but is
 * structurally unreachable on every surface this file currently serves:
 * computeRouteIntelligenceLevel() only ever returns 'strong' or 'useful' for
 * a real Route (see that function's own contract) — 'expanding' is exclusive
 * to the Atlas's buildUntrackedDestinationPoint() path, for destinations
 * with no data/routes.ts entry at all. A route reaching /routes, a
 * destination's flight-guide list, or its own /routes/[slug] page always has
 * a real Route by definition, so this case never actually renders — kept
 * only so the mapping stays exhaustive if that ever changes.
 */

export interface RouteIntelligenceDisplay {
  level: RouteIntelligenceLevel;
  /** Exact wording ROUTE_INTELLIGENCE_COLOUR already uses in atlas-feel-test.tsx — never reworded per-surface. */
  label: string;
  /** Tailwind background-colour utility for a small compact dot — this site's real brand tokens, not a new hex value. */
  dotClassName: string;
}

const LABEL: Record<RouteIntelligenceLevel, string> = {
  strong: 'JetStash knows this route well',
  useful: 'Useful route guidance available',
  expanding: 'Intelligence still being expanded',
};

const DOT_CLASS: Record<RouteIntelligenceLevel, string> = {
  strong: 'bg-brass-500',
  useful: 'bg-ink-400',
  expanding: 'bg-ink-300',
};

/** Pure mapping — no route/date lookup, safe to call with any already-computed level (e.g. a test fixture). */
export function getRouteIntelligenceDisplay(level: RouteIntelligenceLevel): RouteIntelligenceDisplay {
  return { level, label: LABEL[level], dotClassName: DOT_CLASS[level] };
}

/** Convenience wrapper — the one call every route-card surface actually makes: real Route + nowIso in, display data out. */
export function getRouteIntelligenceDisplayForRoute(route: Route, nowIso: string): RouteIntelligenceDisplay {
  return getRouteIntelligenceDisplay(computeRouteIntelligenceLevel(route, nowIso));
}
