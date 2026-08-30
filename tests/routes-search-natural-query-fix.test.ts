import { describe, it, expect } from 'vitest';
import { buildRouteCountryGroups } from '@/lib/route-country-groups';
import { matchesRouteQuery, filterCountryGroups, tokenizeSearchQuery } from '@/components/routes/routes-catalogue';

/**
 * Real-user validation, Stage A (30 Aug 2026) — Fix 2: natural route search,
 * plus the search-precision follow-up (same day).
 *
 * A genuine tester typed "Manchester Mumbai" on /routes and got "No routes
 * match" — even though "Mumbai" alone and "Manchester" alone both worked.
 * Root cause (confirmed by direct diagnostic against production): the old
 * matchesRouteQuery() required the WHOLE query to appear as one contiguous
 * substring of a fixed-order index string, so only the literal "X to Y"
 * template (or a lucky reversed-order accident) ever matched a natural
 * two-city query.
 *
 * The fix tokenises the query, strips harmless connector words ("flight",
 * "flights", "from", "to"), and requires every remaining token to appear
 * somewhere in the route's own (now IATA-code-inclusive) search index.
 *
 * Follow-up: plain substring-per-token let "MAN LHE" also list
 * Manchester-Sylhet, because "lhe" (Lahore's real code) is a literal
 * substring of "Sylhet". A token that is itself a genuine IATA code drawn
 * from the live route list is now matched EXACTLY against a route's own
 * two codes instead — see matchesRouteQuery's and buildKnownIataCodes's own
 * doc comments in components/routes/routes-catalogue.tsx for the full
 * reasoning, including why this is a real-code lookup, never a bare
 * "exactly 3 letters" heuristic (which would misfire on "Dha" for Dhaka,
 * whose actual code is DAC).
 */

const countryGroups = buildRouteCountryGroups();
const allRoutes = countryGroups.flatMap((g) => g.routes);

/**
 * Mirrors exactly what the real search box does (filterCountryGroups):
 * builds the known-code set from the WHOLE catalogue, not one route in
 * isolation — required for the cross-route precision this file tests (a
 * code recognised via one route must rule out an unrelated route that only
 * contains those letters as plain text).
 */
function slugsFor(query: string): string[] {
  return filterCountryGroups(countryGroups, query)
    .flatMap((g) => g.routes)
    .map((r) => r.slug);
}

describe('tokenizeSearchQuery — normalisation', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(tokenizeSearchQuery('  Manchester,  Mumbai!  ')).toEqual(['manchester', 'mumbai']);
  });

  it('drops filler words (flight, flights, from, to) but keeps meaningful terms', () => {
    expect(tokenizeSearchQuery('flights from Manchester to Mumbai')).toEqual(['manchester', 'mumbai']);
    expect(tokenizeSearchQuery('flight to Mumbai')).toEqual(['mumbai']);
  });

  it('an empty or filler-only query produces zero tokens', () => {
    expect(tokenizeSearchQuery('')).toEqual([]);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
    expect(tokenizeSearchQuery('to from')).toEqual([]);
  });
});

describe('Fix 2 — required natural queries now resolve to the real route', () => {
  const requiredQueries = [
    'Manchester Mumbai',
    'Manchester to Mumbai',
    'flights from Manchester to Mumbai',
    'MAN BOM',
    'MAN to BOM',
    'Mumbai Manchester',
  ];

  it.each(requiredQueries)('%s matches manchester-mumbai and nothing else', (query) => {
    expect(slugsFor(query), query).toEqual(['manchester-mumbai']);
  });
});

describe('Fix 2 — controls: natural two-city queries generalise beyond the one reported route', () => {
  it('Manchester Lahore matches manchester-lahore', () => {
    expect(slugsFor('Manchester Lahore')).toContain('manchester-lahore');
  });

  it('London Delhi matches a London Heathrow-Delhi route', () => {
    expect(slugsFor('London Delhi')).toContain('london-heathrow-delhi');
  });

  it('single-city queries still match every route for that city, exactly as before — a normal partial/whole text query still works', () => {
    expect(slugsFor('Mumbai').length).toBeGreaterThanOrEqual(3);
    expect(slugsFor('Manchester').length).toBeGreaterThanOrEqual(20);
  });

  it('a genuine incremental (partial-word) text query still narrows results while typing — this fix never switched to exact-word matching', () => {
    // "lon" is neither a real IATA code nor a full word — it must still hit
    // via plain substring, exactly like before this batch: every
    // London-origin route (a genuine partial match on "London") stays
    // reachable mid-type, without needing to type the whole city name.
    const partial = slugsFor('lon');
    expect(partial.length).toBeGreaterThan(0);
    expect(partial).toContain('london-heathrow-delhi');
    expect(partial).toContain('london-gatwick-dubai');
  });
});

describe('Search-precision follow-up — exact-code queries are precise, never a coincidental text substring', () => {
  it('MAN LHE resolves to exactly Manchester-Lahore, never Manchester-Sylhet', () => {
    expect(slugsFor('MAN LHE')).toEqual(['manchester-lahore']);
  });

  it('LHE MAN (reversed) resolves identically — order never matters', () => {
    expect(slugsFor('LHE MAN')).toEqual(['manchester-lahore']);
  });

  it('MAN ZYL resolves to exactly Manchester-Sylhet using Sylhet\'s real code (ZYL, not SYL — see the note on "MAN SYL" below)', () => {
    expect(slugsFor('MAN ZYL')).toEqual(['manchester-sylhet']);
  });

  it('MAN SYL also resolves to exactly Manchester-Sylhet — not because "SYL" was added as a fake code (Sylhet\'s real code is ZYL, confirmed in data/destinations.ts), but because "syl" is a genuine substring of the real word "Sylhet" and is not itself a recognised code for any route, so it correctly falls through to ordinary substring matching', () => {
    expect(slugsFor('MAN SYL')).toEqual(['manchester-sylhet']);
  });

  it('MAN BOM resolves to exactly Manchester-Mumbai', () => {
    expect(slugsFor('MAN BOM')).toEqual(['manchester-mumbai']);
  });

  it('LHR DEL resolves to exactly London Heathrow-Delhi', () => {
    expect(slugsFor('LHR DEL')).toEqual(['london-heathrow-delhi']);
  });

  it('a recognised code never matches via substring even when it coincidentally sits inside another route\'s own text — "lhe" is never satisfied by manchester-sylhet\'s "Sylhet" text', () => {
    const sylhetRoute = allRoutes.find((r) => r.slug === 'manchester-sylhet')!;
    expect(sylhetRoute.searchIndex).toContain('lhe'); // the coincidence is real...
    expect(slugsFor('MAN LHE')).not.toContain('manchester-sylhet'); // ...but no longer matches.
  });
});

describe('Fix 2 — negative match: unrelated but individually-real terms must not match', () => {
  it('Glasgow Dhaka matches nothing — both are real, but no such route exists', () => {
    // Confirms AND-token semantics: matching "glasgow" and "dhaka"
    // independently on DIFFERENT routes must never combine into a false
    // positive for a route that has neither term together.
    expect(slugsFor('Glasgow Dhaka')).toEqual([]);
  });

  it('filterCountryGroups drops every country group for that same query — never an empty header shown', () => {
    expect(filterCountryGroups(countryGroups, 'Glasgow Dhaka')).toEqual([]);
  });

  it('an exact-code query for two real codes that never share a route matches nothing (GLA + DAC: Glasgow has no Dhaka route)', () => {
    expect(slugsFor('GLA DAC')).toEqual([]);
  });
});

describe('Fix 2 — Bombay alias investigated, not implemented (per explicit scope boundary)', () => {
  it('confirms no existing alias/alternate-name mechanism exists on Destination — "Manchester Bombay" is not expected to match', () => {
    // data/destinations.ts's Destination interface carries no alias/
    // alternate-name field (city, country, iataCode only) — adding one
    // for a single historical city name would mean building a small
    // synonym framework, explicitly out of scope for this batch (see the
    // Stage A implementation prompt). Left unaddressed and reported.
    expect(slugsFor('Manchester Bombay')).toEqual([]);
  });
});

describe('Fix 2 — full end-to-end query-result matrix (documents exact counts for the final report)', () => {
  it('matches the counts verified live on production after the precision fix', () => {
    const matrix: Record<string, number> = {
      'Manchester Mumbai': slugsFor('Manchester Mumbai').length,
      'Manchester to Mumbai': slugsFor('Manchester to Mumbai').length,
      'flights from Manchester to Mumbai': slugsFor('flights from Manchester to Mumbai').length,
      'MAN BOM': slugsFor('MAN BOM').length,
      'MAN to BOM': slugsFor('MAN to BOM').length,
      'Mumbai Manchester': slugsFor('Mumbai Manchester').length,
      'Manchester Lahore': slugsFor('Manchester Lahore').length,
      'MAN LHE': slugsFor('MAN LHE').length,
      'LHE MAN': slugsFor('LHE MAN').length,
      'MAN SYL': slugsFor('MAN SYL').length,
      'London Delhi': slugsFor('London Delhi').length,
      'LHR DEL': slugsFor('LHR DEL').length,
    };
    for (const [query, count] of Object.entries(matrix)) {
      expect(count, query).toBe(1);
    }
  });
});
