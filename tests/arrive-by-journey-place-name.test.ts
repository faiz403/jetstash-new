import { describe, expect, it, vi } from 'vitest';
import { cleanPlaceName, type EnrichableDetail, enrichPendingNames, fetchPlaceDisplayName } from '../lib/arrive-by-journey/place-name';
import { GoogleCallLedger } from '../lib/arrive-by-journey/call-budget';

const ledger = (remaining: number) => ({ remaining, exhausted: false });

describe('cleanPlaceName', () => {
  it('accepts a normal name and rejects plus codes, empties, control characters and long text', () => {
    expect(cleanPlaceName('Atlantis The Royal')).toBe('Atlantis The Royal');
    expect(cleanPlaceName('VQ8F+2X9')).toBeUndefined();
    expect(cleanPlaceName('')).toBeUndefined();
    expect(cleanPlaceName(42)).toBeUndefined();
    expect(cleanPlaceName('x'.repeat(101))).toBeUndefined();
    expect(cleanPlaceName('Line\u0000one\ntwo')).toBe('Line one two');
  });
});

describe('fetchPlaceDisplayName', () => {
  it('asks Places (New) for displayName only, and reads the name', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ displayName: { text: 'Atlantis The Royal', languageCode: 'en' } }), { status: 200 }));
    expect(await fetchPlaceDisplayName('k', 'abc/def', fetchImpl as unknown as typeof fetch)).toBe('Atlantis The Royal');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places/abc%2Fdef');
    expect((init.headers as Record<string, string>)['X-Goog-FieldMask']).toBe('displayName');
  });
  it('falls back (undefined) on an error status, a network failure or a malformed body', async () => {
    expect(await fetchPlaceDisplayName('k', 'p', (async () => new Response('{}', { status: 403 })) as typeof fetch)).toBeUndefined();
    expect(await fetchPlaceDisplayName('k', 'p', (async () => { throw new Error('down'); }) as typeof fetch)).toBeUndefined();
    expect(await fetchPlaceDisplayName('k', 'p', (async () => new Response('not json', { status: 200 })) as typeof fetch)).toBeUndefined();
  });
});

describe('enrichPendingNames', () => {
  const lookup = vi.fn(async (id: string) => `Name of ${id}`);
  it('looks up only unnamed items and never a place Google already named', async () => {
    lookup.mockClear();
    const out = await enrichPendingNames({ pendingConfirmation: { placeId: 'a', unnamed: true } } as EnrichableDetail, lookup, ledger(5));
    expect(out?.pendingConfirmation?.name).toBe('Name of a');
    lookup.mockClear();
    const named = await enrichPendingNames({ pendingConfirmation: { placeId: 'b' } } as EnrichableDetail, lookup, ledger(5));
    expect(lookup).not.toHaveBeenCalled();
    expect(named?.pendingConfirmation?.name).toBeUndefined();
  });
  it('enriches exactly the candidates shown, one call each, and stops when the budget runs out', async () => {
    lookup.mockClear();
    const l = new GoogleCallLedger(10, (async () => new Response('{}')) as typeof fetch);
    const budgeted = async (id: string) => { await l.fetch('https://places.googleapis.com/v1/places/' + id); return `N-${id}`; };
    for (let i = 0; i < 9; i += 1) l.charge('other'); // 1 call left
    const out = await enrichPendingNames({ pendingSelection: { candidates: [{ placeId: 'x', unnamed: true }, { placeId: 'y', unnamed: true }, { placeId: 'z' }] } } as EnrichableDetail, budgeted, l);
    expect(out?.pendingSelection?.candidates.map((c) => c.name)).toEqual(['N-x', undefined, undefined]);
    expect(l.used).toBe(10);
    expect(l.exhausted).toBe(false); // the ceiling was respected without tripping the exhaustion flag
  });
  it('keeps the safe label when the lookup finds nothing', async () => {
    const out = await enrichPendingNames({ pendingConfirmation: { placeId: 'a', unnamed: true } } as EnrichableDetail, async () => undefined, ledger(5));
    expect(out?.pendingConfirmation?.name).toBeUndefined();
  });
});
