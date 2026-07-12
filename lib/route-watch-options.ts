export type RouteWatchIntent = 'best-fare' | 'family-visit' | 'special-occasion' | 'business' | 'document-timing';

export const ROUTE_WATCH_INTENT_OPTIONS: { value: RouteWatchIntent; label: string }[] = [
  { value: 'best-fare', label: 'Just want the best price' },
  { value: 'family-visit', label: 'Visiting family' },
  { value: 'special-occasion', label: 'Eid, wedding or festival travel' },
  { value: 'business', label: 'Business travel' },
  { value: 'document-timing', label: 'Sorting a visa or passport document before I book' },
];

const VALID_ROUTE_WATCH_INTENTS = ROUTE_WATCH_INTENT_OPTIONS.map((o) => o.value);

export function isRouteWatchIntent(value: unknown): value is RouteWatchIntent {
  return typeof value === 'string' && (VALID_ROUTE_WATCH_INTENTS as string[]).includes(value);
}
