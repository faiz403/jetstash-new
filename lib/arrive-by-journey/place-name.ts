import type { GoogleCallLedger } from './call-budget';

/**
 * Presentation-only venue names for recovery prompts.
 *
 * Geocoding stays the resolver and the source of truth. When a place is already
 * waiting for the traveller to confirm or choose it AND Google's geocode gave it
 * no venue name (street-only, "Hotel at …", area-only), one Places API (New)
 * Place Details call fetches its `displayName` so the traveller can recognise it
 * ("Atlantis The Royal" rather than "Palm Jumeirah"). The name never decides
 * whether a place is safe or correct: every safety check ran before this and
 * the confirm/select re-verification still runs on the next request.
 *
 * Every call goes through the journey's own ledger (and so the monthly guard).
 * Nothing is called unless a whole call is still affordable; any failure just
 * leaves the safe geocode label in place. A name is never invented.
 */

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places/';
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

export type PlaceNameLookup = (placeId: string) => Promise<string | undefined>;

/** Accepts only a short, printable, non-plus-code string. */
export function cleanPlaceName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 100 || PLUS_CODE.test(text)) return undefined;
  return text;
}

export async function fetchPlaceDisplayName(apiKey: string, placeId: string, fetchImpl: typeof fetch): Promise<string | undefined> {
  try {
    const response = await fetchImpl(`${PLACES_ENDPOINT}${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'displayName' },
      cache: 'no-store',
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { displayName?: { text?: unknown } };
    return cleanPlaceName(body?.displayName?.text);
  } catch {
    return undefined;
  }
}

type Named = { placeId: string; unnamed?: boolean; name?: string };

export interface EnrichableDetail {
  pendingConfirmation?: Named;
  pendingSelection?: { candidates: Named[] };
}

/**
 * Adds `name` to the pending items that will actually be SHOWN and have no venue name. Only when the ledger can afford
 * each call (checked before calling, so a refusal never trips the journey's exhaustion flag). Returns a copy.
 */
export async function enrichPendingNames<T extends EnrichableDetail>(detail: T | undefined, lookup: PlaceNameLookup, ledger: Pick<GoogleCallLedger, 'remaining' | 'exhausted'>): Promise<T | undefined> {
  if (!detail || ledger.exhausted) return detail;
  const enrich = async <N extends Named>(item: N): Promise<N> => {
    if (!item.unnamed || ledger.remaining < 1 || ledger.exhausted) return item;
    const name = await lookup(item.placeId);
    return name ? { ...item, name } : item;
  };
  const copy: T = { ...detail };
  if (detail.pendingConfirmation) copy.pendingConfirmation = await enrich(detail.pendingConfirmation);
  if (detail.pendingSelection) {
    const candidates: Named[] = [];
    for (const candidate of detail.pendingSelection.candidates) candidates.push(await enrich(candidate));
    copy.pendingSelection = { ...detail.pendingSelection, candidates };
  }
  return copy;
}
