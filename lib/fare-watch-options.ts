export type FareWatchIntent = 'best-fare' | 'family-visit' | 'special-occasion' | 'business';

export const FARE_WATCH_INTENT_OPTIONS: { value: FareWatchIntent; label: string }[] = [
  { value: 'best-fare', label: 'Just want the best price' },
  { value: 'family-visit', label: 'Visiting family' },
  { value: 'special-occasion', label: 'Eid, wedding or festival travel' },
  { value: 'business', label: 'Business travel' },
];

const VALID_FARE_WATCH_INTENTS = FARE_WATCH_INTENT_OPTIONS.map((o) => o.value);

export function isFareWatchIntent(value: unknown): value is FareWatchIntent {
  return typeof value === 'string' && (VALID_FARE_WATCH_INTENTS as string[]).includes(value);
}
