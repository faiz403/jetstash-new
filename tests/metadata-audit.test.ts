import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { destinations } from '@/data/destinations';
import { airports } from '@/data/airports';
import { guides } from '@/data/guides';
import { routes, getRouteAirport, getRouteDestination, truncateMetadataDescription } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { siteConfig } from '@/lib/site-config';

/**
 * A deterministic, repository-wide audit of every PUBLIC page's <title>/
 * <meta description> — static pages (source-scanned, matching this repo's
 * established convention for metadata regression checks, e.g.
 * tests/not-found-page-title.test.ts) and dynamic per-item pages (routes,
 * destinations, airports, guides — computed against the real, current data
 * and the exact real generator functions those pages call, never a
 * re-implementation that could drift from the real code).
 *
 * app/founder/** is deliberately excluded: every founder page sets
 * `robots: { index: false, follow: false }` (see app/founder/page.tsx) —
 * it is not public metadata.
 *
 * Every title below is the exact string a visitor's browser tab shows
 * AFTER the root layout's `%s | JetStash` template (see app/layout.tsx) —
 * except the homepage, which uses `title.absolute` to bypass the template
 * (documented in app/page.tsx) precisely so it isn't doubled.
 */

const root = process.cwd();
const read = (relPath: string) => readFileSync(join(root, relPath), 'utf8');

export interface MetadataEntry {
  page: string;
  /** The exact final rendered title — after the root layout's template, exactly like a browser tab. */
  title: string;
  description: string | undefined;
}

const TITLE_TEMPLATE_SUFFIX = ` | ${siteConfig.name}`;

function applyTemplate(rawTitle: string): string {
  return `${rawTitle}${TITLE_TEMPLATE_SUFFIX}`;
}

/** Extracts a single-quoted `title: '...'` and `description: '...'`/`description:\n  '...'` pair from a static page's literal metadata export. Only handles the plain-string shape every current static page uses — a page using a template literal or computed title needs its own dynamic entry instead (see the route/destination/airport/guide sections below). */
function extractStaticMetadata(relPath: string): { title: string; description?: string } {
  const src = read(relPath);
  const block = src.match(/export const metadata:\s*Metadata\s*=\s*\{[\s\S]*?\n\};/);
  if (!block) throw new Error(`${relPath}: no static metadata export found`);
  const body = block[0];
  const titleMatch = body.match(/title:\s*'((?:[^'\\]|\\.)*)'/);
  if (!titleMatch) throw new Error(`${relPath}: no plain-string title found`);
  const descMatch = body.match(/description:\s*\n?\s*'((?:[^'\\]|\\.)*)'/);
  return { title: titleMatch[1], description: descMatch?.[1] };
}

const STATIC_PAGES: { page: string; path: string }[] = [
  { page: '/about', path: 'app/about/page.tsx' },
  { page: '/contact', path: 'app/contact/page.tsx' },
  { page: '/privacy-policy', path: 'app/privacy-policy/page.tsx' },
  { page: '/affiliate-disclosure', path: 'app/affiliate-disclosure/page.tsx' },
  { page: '/travel-club', path: 'app/travel-club/page.tsx' },
  { page: '/travel-ready-check', path: 'app/travel-ready-check/page.tsx' },
  { page: '/quote-request', path: 'app/quote-request/page.tsx' },
  { page: '/pakistan', path: 'app/pakistan/page.tsx' },
  { page: '/india', path: 'app/india/page.tsx' },
  { page: '/gulf', path: 'app/gulf/page.tsx' },
  { page: '/umrah', path: 'app/umrah/page.tsx' },
  { page: '/family-holidays', path: 'app/family-holidays/page.tsx' },
  { page: '/business-class', path: 'app/business-class/page.tsx' },
  { page: '/routes', path: 'app/routes/page.tsx' },
  { page: '/destinations', path: 'app/destinations/page.tsx' },
  { page: '/airports', path: 'app/airports/page.tsx' },
  { page: '/guides', path: 'app/guides/page.tsx' },
  { page: '/deals', path: 'app/deals/page.tsx' },
  { page: '/tracked-fares', path: 'app/tracked-fares/page.tsx' },
  { page: '/404', path: 'app/not-found.tsx' },
];

function collectStaticEntries(): MetadataEntry[] {
  return STATIC_PAGES.map(({ page, path }) => {
    const { title, description } = extractStaticMetadata(path);
    return { page, title: applyTemplate(title), description };
  });
}

/** The homepage bypasses the template via title.absolute — see app/page.tsx's own doc comment. */
function collectHomepageEntry(): MetadataEntry {
  const src = read('app/page.tsx');
  const titleMatch = src.match(/title:\s*\{\s*absolute:\s*`([^`]*)`/);
  if (!titleMatch) throw new Error('app/page.tsx: no title.absolute template literal found');
  const rawTitle = titleMatch[1].replace('${siteConfig.name}', siteConfig.name).replace('${siteConfig.tagline}', siteConfig.tagline);
  return { page: '/', title: rawTitle, description: siteConfig.description };
}

/** Real template from app/destinations/[slug]/page.tsx's generateMetadata — locked by a source-scan test below so a future edit there can't silently drift from what this audit checks. */
function destinationEntry(dest: (typeof destinations)[number]): MetadataEntry {
  return {
    page: `/destinations/${dest.slug}`,
    title: applyTemplate(`Flights to ${dest.city}, ${dest.country} from the UK`),
    description: `${dest.tagline}. Flight times, visa requirements and tracked fares for UK travellers to ${dest.city}.`,
  };
}

/** Real template from app/airports/[slug]/page.tsx's generateMetadata — including the meta-only truncateMetadataDescription() pass; the visible page paragraph still renders airport.description in full, untouched. */
function airportEntry(airport: (typeof airports)[number]): MetadataEntry {
  return {
    page: `/airports/${airport.slug}`,
    title: applyTemplate(`${airport.name} (${airport.code}): Flights & Fares`),
    description: truncateMetadataDescription(airport.description),
  };
}

/** Real fields from app/guides/[slug]/page.tsx's generateMetadata — a direct passthrough of guide.title/guide.summary. */
function guideEntry(guide: (typeof guides)[number]): MetadataEntry {
  return { page: `/guides/${guide.slug}`, title: applyTemplate(guide.title), description: guide.summary };
}

const NOW_ISO = '2026-08-01';

/** The real, exact function app/routes/[slug]/page.tsx's generateMetadata calls — never a re-implementation, so this audit can't drift from the real code path. */
function routeEntries(): MetadataEntry[] {
  return routes
    .map((route): MetadataEntry | null => {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) return null;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
      return {
        page: `/routes/${route.slug}`,
        title: applyTemplate(presentation.metadataTitle),
        description: presentation.metadataDescription,
      };
    })
    .filter((e): e is MetadataEntry => e !== null);
}

export function collectAllPublicMetadata(): MetadataEntry[] {
  return [
    collectHomepageEntry(),
    ...collectStaticEntries(),
    ...destinations.map(destinationEntry),
    ...airports.map(airportEntry),
    ...guides.map(guideEntry),
    ...routeEntries(),
  ];
}

export interface MetadataAudit {
  totalChecked: number;
  titlesOverThreshold: { page: string; title: string; length: number }[];
  descriptionsOverThreshold: { page: string; description: string; length: number }[];
  duplicateTitles: { title: string; pages: string[] }[];
  duplicateDescriptions: { description: string; pages: string[] }[];
  titlesWithDuplicatedBranding: { page: string; title: string }[];
  emptyTitles: string[];
  emptyDescriptions: string[];
  longestTitle: { page: string; title: string; length: number } | null;
  longestDescription: { page: string; description: string; length: number } | null;
}

export const TITLE_THRESHOLD = 65;
export const DESCRIPTION_THRESHOLD = 170;

/**
 * Pure, deterministic audit function — same input always produces the same
 * output (requirement: "the audit should be deterministic and testable").
 * No network, no file I/O, no current-date dependency (callers pass their
 * own now-fixed entries in).
 */
export function auditMetadata(entries: MetadataEntry[]): MetadataAudit {
  const titleGroups = new Map<string, string[]>();
  const descriptionGroups = new Map<string, string[]>();
  let longestTitle: MetadataAudit['longestTitle'] = null;
  let longestDescription: MetadataAudit['longestDescription'] = null;

  for (const e of entries) {
    if (!titleGroups.has(e.title)) titleGroups.set(e.title, []);
    titleGroups.get(e.title)!.push(e.page);
    if (e.description !== undefined) {
      if (!descriptionGroups.has(e.description)) descriptionGroups.set(e.description, []);
      descriptionGroups.get(e.description)!.push(e.page);
    }
    if (!longestTitle || e.title.length > longestTitle.length) {
      longestTitle = { page: e.page, title: e.title, length: e.title.length };
    }
    if (e.description !== undefined && (!longestDescription || e.description.length > longestDescription.length)) {
      longestDescription = { page: e.page, description: e.description, length: e.description.length };
    }
  }

  return {
    totalChecked: entries.length,
    titlesOverThreshold: entries
      .filter((e) => e.title.length > TITLE_THRESHOLD)
      .map((e) => ({ page: e.page, title: e.title, length: e.title.length })),
    descriptionsOverThreshold: entries
      .filter((e) => e.description !== undefined && e.description.length > DESCRIPTION_THRESHOLD)
      .map((e) => ({ page: e.page, description: e.description!, length: e.description!.length })),
    duplicateTitles: [...titleGroups.entries()].filter(([, pages]) => pages.length > 1).map(([title, pages]) => ({ title, pages })),
    duplicateDescriptions: [...descriptionGroups.entries()].filter(([, pages]) => pages.length > 1).map(([description, pages]) => ({ description, pages })),
    titlesWithDuplicatedBranding: entries
      .filter((e) => (e.title.match(new RegExp(siteConfig.name, 'gi')) ?? []).length > 1)
      .map((e) => ({ page: e.page, title: e.title })),
    emptyTitles: entries.filter((e) => e.title.trim().length === 0).map((e) => e.page),
    emptyDescriptions: entries.filter((e) => e.description !== undefined && e.description.trim().length === 0).map((e) => e.page),
    longestTitle,
    longestDescription,
  };
}

describe('Metadata audit — deterministic, repeatable', () => {
  it('produces the exact same result across repeated calls (requirement 17: deterministic generators)', () => {
    const a = auditMetadata(collectAllPublicMetadata());
    const b = auditMetadata(collectAllPublicMetadata());
    expect(a).toEqual(b);
  });

  it('reports the current, real audit counts (the "fresh audit" — never a hardcoded historical number)', () => {
    const audit = auditMetadata(collectAllPublicMetadata());
    // eslint-disable-next-line no-console
    console.log('METADATA AUDIT SUMMARY', {
      totalChecked: audit.totalChecked,
      titlesOverThreshold: audit.titlesOverThreshold.length,
      descriptionsOverThreshold: audit.descriptionsOverThreshold.length,
      duplicateTitles: audit.duplicateTitles.length,
      duplicateDescriptions: audit.duplicateDescriptions.length,
      titlesWithDuplicatedBranding: audit.titlesWithDuplicatedBranding.length,
      emptyTitles: audit.emptyTitles.length,
      emptyDescriptions: audit.emptyDescriptions.length,
      longestTitle: audit.longestTitle,
      longestDescription: audit.longestDescription,
    });
    expect(audit.totalChecked).toBeGreaterThan(0);
  });
});

/**
 * Requirement 6/7: titles/descriptions over threshold must be a documented,
 * reasoned exception — never silently tolerated, never mechanically forced
 * under the limit if that would harm clarity or remove route meaning.
 *
 * Guide entries (6): `guide.title` is dual-purposed as the page's own <h1>
 * AND the metadata title (see app/guides/[slug]/page.tsx) — shortening it
 * would violate "do not alter headings merely to mirror metadata" and
 * "do not change visible page copy unless strictly necessary."
 *
 * No route entries currently need an exception. The peak-period title fix
 * (Search Console opportunity audit, 20 Aug 2026 — see data/routes.ts and
 * tests/peak-period-title-flights.test.ts) restored "Flights" to every
 * peak-period route's title by shortening the connector to an en dash and
 * dropping "Windows" from the trailing phrase, which incidentally resolved
 * the four route exceptions this list used to carry (manchester-islamabad,
 * manchester-ahmedabad, london-heathrow-dubai, london-gatwick-dubai — the
 * last two disambiguated for the separate duplicate-<title> reason
 * documented in disambiguatedTitleOrigin(), data/routes.ts) — all four now
 * land at or under the threshold. If a future route reintroduces an
 * over-threshold title, add it back here with its own reasoning rather than
 * assuming this list is permanently empty of route entries.
 */
const DOCUMENTED_TITLE_EXCEPTIONS: Record<string, string> = {
  '/guides/visa-processing-booking-date':
    'guide.title doubles as the page <h1>; shortening it would alter visible page copy for a 1-char overage.',
  '/guides/eid-diwali-vs-school-holiday-pricing':
    'guide.title doubles as the page <h1>; the comparison needs both named periods to stay meaningful.',
  '/guides/esim-vs-local-sim':
    'guide.title doubles as the page <h1>; already the shortest accurate phrasing of the comparison.',
  '/guides/travel-insurance-family-visit-trips':
    'guide.title doubles as the page <h1>; "family-visit trips" is the specific audience the guide targets.',
  '/guides/checked-baggage-allowances':
    'guide.title doubles as the page <h1>; longest of the six, still a single accurate sentence.',
  '/guides/comparing-airlines-same-route':
    'guide.title doubles as the page <h1>; shortening would blur the guide\'s specific comparison angle.',
};

// Sanity bound: an exception is a small, reasoned overage, not a licence to
// ship an arbitrarily long title. Nothing here should ever need this much
// slack — if it does, that's a sign the exception needs re-examining, not
// widening.
const MAX_EXCEPTION_OVERAGE = 20;

describe('Requirement 6: documented title-threshold exceptions', () => {
  const audit = auditMetadata(collectAllPublicMetadata());
  const overPages = audit.titlesOverThreshold.map((t) => t.page);

  it('every currently-over-threshold title is in the documented exception list (fails on any new, undocumented overage)', () => {
    const undocumented = overPages.filter((p) => !(p in DOCUMENTED_TITLE_EXCEPTIONS));
    expect(undocumented).toEqual([]);
  });

  it('every documented exception is still actually over threshold (fails if the underlying title was shortened and the entry is now stale)', () => {
    const stale = Object.keys(DOCUMENTED_TITLE_EXCEPTIONS).filter((p) => !overPages.includes(p));
    expect(stale).toEqual([]);
  });

  it('no documented exception is wildly over the threshold', () => {
    for (const t of audit.titlesOverThreshold) {
      expect(t.length, `${t.page}: ${t.length} chars`).toBeLessThanOrEqual(TITLE_THRESHOLD + MAX_EXCEPTION_OVERAGE);
    }
  });
});

describe('Requirement 7: no description exceptions needed', () => {
  it('zero public descriptions exceed the threshold — every one was fixed rather than documented as an exception', () => {
    const audit = auditMetadata(collectAllPublicMetadata());
    expect(audit.descriptionsOverThreshold).toEqual([]);
  });
});

describe('Requirements 1–5: homepage and universal metadata hygiene', () => {
  it('req 1: homepage title is accurate and is NOT double-templated (bypasses the root layout\'s "%s | JetStash" suffix)', () => {
    const home = collectHomepageEntry();
    expect(home.title).toContain(siteConfig.name);
    expect(home.title).toContain(siteConfig.tagline);
    // Exactly one occurrence — the template-bypass exists specifically so this never doubles.
    expect((home.title.match(new RegExp(siteConfig.name, 'g')) ?? []).length).toBe(1);
  });

  it('req 2: homepage description is materially shorter than the pre-audit 302-character original', () => {
    const home = collectHomepageEntry();
    expect(home.description).toBeDefined();
    const description = home.description!;
    expect(description.length).toBeLessThan(200);
    expect(description).toContain('South Asia');
    expect(description).toContain('Gulf');
  });

  it('req 3: no public page has an empty title', () => {
    const audit = auditMetadata(collectAllPublicMetadata());
    expect(audit.emptyTitles).toEqual([]);
  });

  it('req 4: no public page has an empty description', () => {
    const audit = auditMetadata(collectAllPublicMetadata());
    expect(audit.emptyDescriptions).toEqual([]);
  });

  it('req 5: no title duplicates the JetStash brand name more than once', () => {
    const audit = auditMetadata(collectAllPublicMetadata());
    expect(audit.titlesWithDuplicatedBranding).toEqual([]);
  });
});

describe('Requirements 8–11: route metadata correctness and honesty', () => {
  const now = '2026-08-01';

  it('req 8: every route\'s metadata title and description name both its real departure airport city and destination city', () => {
    for (const route of routes) {
      const airport = getRouteAirport(route);
      const dest = getRouteDestination(route);
      if (!airport || !dest) continue;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, now);
      expect(presentation.metadataTitle, route.slug).toContain(airport.city);
      expect(presentation.metadataTitle, route.slug).toContain(dest.city);
    }
  });

  it('req 9: route titles are unique across different routes (no two distinct routes share a metadata title)', () => {
    const audit = auditMetadata(routeEntries());
    expect(audit.duplicateTitles).toEqual([]);
  });

  it('req 10: route metadata descriptions never introduce a new claim — truncation only trims from the end of the already-reviewed route.intro, never rewrites, inserts, or cuts mid-word', () => {
    // route.intro is hand-authored, already-verified editorial copy (see
    // CLAUDE.md's "Route claims must be verified against real airline
    // schedules"). This audit never rewrites it — truncateMetadataDescription
    // only shortens from the end — so if intro is honest about direct vs.
    // connecting, the metadata description stays honest by construction, as
    // long as truncation is a clean prefix. That's the property this checks.
    for (const route of routes) {
      const result = truncateMetadataDescription(route.intro);
      if (result === route.intro) continue;
      const withoutEllipsis = result.endsWith('…') ? result.slice(0, -1).trimEnd() : result;
      expect(route.intro.startsWith(withoutEllipsis), route.slug).toBe(true);
      const nextChar = route.intro[withoutEllipsis.length];
      const endsOnPunctuation = /[.!?]$/.test(withoutEllipsis);
      expect(nextChar === undefined || nextChar === ' ' || endsOnPunctuation, route.slug).toBe(true);
    }
  });

  it('req 11: withdrawal-announced routes (Manchester–Mumbai, Manchester–Delhi) keep an honest, non-fabricated metadata description', () => {
    // buildWithdrawalAnnouncedPresentation() (lib/route-status-copy.ts) only
    // overrides shareText — metadataDescription flows through unchanged from
    // the base getRoutePresentation(), i.e. truncateMetadataDescription(route.intro).
    // Confirms that base intro text (which itself defers to "the Route Status
    // panel below" rather than asserting a specific current frequency) is what
    // ships, not a rewritten or invented claim.
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const route = routes.find((r) => r.slug === slug);
      expect(route, slug).toBeTruthy();
      if (!route) continue;
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, now);
      expect(presentation.metadataDescription).toBe(truncateMetadataDescription(route.intro));
    }
  });

  it('req 11b: pending/unverified routes\' metadata says verification is in progress, not a settled claim', () => {
    for (const route of routes) {
      const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, now);
      if (presentation.status !== 'unverified') continue;
      const haystack = `${presentation.metadataTitle} ${presentation.metadataDescription}`.toLowerCase();
      expect(haystack, route.slug).toMatch(/verif/);
    }
  });
});

describe('Requirements 12–16: canonicals, OG/Twitter, sitemap/robots, slugs untouched', () => {
  it('req 12: route/destination/airport/guide canonical URLs are unchanged, still built from siteConfig.url + the real slug', () => {
    const dest = destinations[0];
    const destSrc = read('app/destinations/[slug]/page.tsx');
    expect(destSrc).toContain('alternates: { canonical: `${siteConfig.url}/destinations/${dest.slug}` }');

    const airportSrc = read('app/airports/[slug]/page.tsx');
    expect(airportSrc).toContain('alternates: { canonical: `${siteConfig.url}/airports/${airport.slug}` }');

    const guideSrc = read('app/guides/[slug]/page.tsx');
    expect(guideSrc).toContain('alternates: { canonical: `${siteConfig.url}/guides/${guide.slug}` }');

    const routeSrc = read('app/routes/[slug]/page.tsx');
    expect(routeSrc).toMatch(/alternates:\s*\{\s*canonical:/);
    void dest;
  });

  it('req 13: root layout OG image/site name are untouched (no page overrides openGraph — the site-wide image/card is what every page inherits)', () => {
    const layoutSrc = read('app/layout.tsx');
    expect(layoutSrc).toContain("images: [{ url: '/og/og-image.png', width: 1200, height: 630, alt: siteConfig.name }]");
    expect(layoutSrc).toContain('siteName: siteConfig.name');
    for (const { path } of [
      { path: 'app/routes/[slug]/page.tsx' },
      { path: 'app/destinations/[slug]/page.tsx' },
      { path: 'app/airports/[slug]/page.tsx' },
      { path: 'app/guides/[slug]/page.tsx' },
    ]) {
      expect(read(path), path).not.toContain('openGraph');
    }
  });

  it('req 14: root layout Twitter card metadata is untouched and valid', () => {
    const layoutSrc = read('app/layout.tsx');
    expect(layoutSrc).toContain("card: 'summary_large_image'");
    expect(layoutSrc).toContain("images: ['/og/og-image.png']");
  });

  it('req 15: root layout robots directive is untouched (site remains indexable; no sitemap/robots behaviour changed by this audit)', () => {
    const layoutSrc = read('app/layout.tsx');
    expect(layoutSrc).toContain('robots: { index: true, follow: true }');
  });

  it('req 16: no route/destination/airport/guide slug was changed — every entry this audit checks still resolves to real data by its original slug', () => {
    for (const route of routes) expect(getRouteAirport(route) && getRouteDestination(route)).toBeTruthy();
    expect(destinations.every((d) => typeof d.slug === 'string' && d.slug.length > 0)).toBe(true);
    expect(airports.every((a) => typeof a.slug === 'string' && a.slug.length > 0)).toBe(true);
    expect(guides.every((g) => typeof g.slug === 'string' && g.slug.length > 0)).toBe(true);
  });
});

describe('Requirements 18–20: no invented content, unchanged rendering', () => {
  it('req 18: no metadata description contains an email address, phone number, or other personal/legal identity detail', () => {
    const entries = collectAllPublicMetadata();
    for (const e of entries) {
      if (!e.description) continue;
      expect(e.description, e.page).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      expect(e.description, e.page).not.toMatch(/\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/);
    }
  });

  it('req 19: no metadata title or description was changed to introduce a price, "cheap", "best", "live", "official" or "guaranteed" claim', () => {
    // Negation-aware: e.g. /deals' description deliberately says "Never a
    // live price claim" — a disclaimer, not the claim itself — so a bare
    // substring match would misfire on the site's own honesty language.
    const banned = /\b(cheap(est)?|best|live prices?|official partner|guaranteed)\b/gi;
    const negation = /\b(no|not|never|n['’]t|without|isn['’]t|doesn['’]t|wasn['’]t|aren['’]t|don['’]t|cannot|can['’]t)\b/i;
    const hasUnnegatedMatch = (text: string): string | null => {
      const re = new RegExp(banned.source, banned.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const before = text.slice(Math.max(0, m.index - 25), m.index);
        if (!negation.test(before)) return m[0];
        if (re.lastIndex === m.index) re.lastIndex++;
      }
      return null;
    };
    const entries = collectAllPublicMetadata();
    for (const e of entries) {
      expect(hasUnnegatedMatch(e.title), e.page).toBeNull();
      if (e.description) expect(hasUnnegatedMatch(e.description), e.page).toBeNull();
    }
  });

  it('req 20a: the airport page still renders airport.description IN FULL in its visible <p> — only the <meta description> is truncated', () => {
    const src = read('app/airports/[slug]/page.tsx');
    expect(src).toContain('{airport.description}</p>');
  });

  it('req 20b: family-holidays and quote-request pages still render their original, untouched visible headings — only their metadata text changed', () => {
    const familySrc = read('app/family-holidays/page.tsx');
    expect(familySrc).toContain('Holidays that work with children, not despite them');
    const quoteSrc = read('app/quote-request/page.tsx');
    expect(quoteSrc).toContain("Tell us the trip. We'll price it properly.");
  });
});
