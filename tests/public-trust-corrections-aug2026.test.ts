import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { isValidElement } from 'react';
import { CommercialPaths } from '@/components/homepage-v2/homepage-sections';
import { routes } from '@/data/routes';

/**
 * Plain recursive .tsx walker (no `glob` dependency — this repo doesn't have
 * one, and this PR doesn't add one). Mirrors the directory-walk pattern
 * every other source-scan test in this repo already uses via readFileSync,
 * just extended to enumerate files instead of reading one known path.
 */
function listTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listTsxFiles(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Public trust corrections (August 2026): three genuine trust cracks fixed
 * in one focused PR, following a full audit rather than a guess.
 *
 * 1. The homepage's Economy card (CommercialPaths, inside
 *    homepage-sections.tsx) linked to /founder/journey-brief/manchester-mumbai
 *    — a founder-only surface (see journey-brief-manchester-mumbai.tsx's own
 *    doc comment) that a public visitor could never actually reach. Fixed to
 *    link to the real public route guide for the same featured journey,
 *    /routes/manchester-mumbai — the homepage's own flagship thread (see
 *    journey-desk-home.tsx).
 * 2. Three customer-facing Trip.com hand-offs (DealCard, NoFareFallback,
 *    Travel Ready Check) had no visible partner/affiliate disclosure next to
 *    the CTA, unlike the route-hero and Book-By Countdown CTAs which already
 *    said "Partner link, opens Trip.com in a new tab." All three now match.
 * 3. "A member of our team" (implying paid staff JetStash doesn't have —
 *    it's founder-led) appeared in app/deals/page.tsx, app/about/page.tsx and
 *    fare-history-panel.tsx; "JetStash hands you a live-fare check" (implying
 *    JetStash itself supplies live fares, not Trip.com) appeared in the same
 *    homepage Economy card as fix 1. All four corrected.
 *
 * Deliberately unchanged, and asserted here so a future edit can't
 * accidentally break it: every route-specific Trip.com URL, the
 * PROVIDER_REL rel attribute, every analytics event name/property, the
 * fail-closed behaviour on unsupported routes, and the footer's Affiliate
 * Disclosure link.
 */

const homepageSectionsSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/homepage-sections.tsx'), 'utf8');
const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');
const noFareFallbackSrc = readFileSync(join(process.cwd(), 'components/ui/no-fare-fallback.tsx'), 'utf8');
const travelReadyCheckSrc = readFileSync(join(process.cwd(), 'components/travel-ready/travel-ready-check.tsx'), 'utf8');
const routeHeroSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
const bookByCountdownSrc = readFileSync(join(process.cwd(), 'components/route/book-by-countdown.tsx'), 'utf8');
const dealsPageSrc = readFileSync(join(process.cwd(), 'app/deals/page.tsx'), 'utf8');
const aboutPageSrc = readFileSync(join(process.cwd(), 'app/about/page.tsx'), 'utf8');
const fareHistoryPanelSrc = readFileSync(join(process.cwd(), 'components/route/fare-history-panel.tsx'), 'utf8');
const footerSrc = readFileSync(join(process.cwd(), 'components/layout/footer.tsx'), 'utf8');

function collectHrefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectHrefs(child, out);
    return out;
  }
  if (isValidElement(node)) {
    const props = node.props as { href?: unknown; children?: unknown } | null;
    if (typeof props?.href === 'string') out.push(props.href);
    if (props?.children !== undefined) collectHrefs(props.children, out);
  }
  return out;
}

describe('Fix 1 — the broken /founder homepage CTA is replaced with a real public route', () => {
  // CommercialPaths (exported directly from homepage-sections.tsx) is called
  // here rather than the full JourneyDeskHome tree — JourneyDeskHome also
  // composes 'use client' components with their own hooks (AtlasFeelTest,
  // JourneyCheckForm), which cannot be safely invoked outside React's own
  // render cycle in a plain function call. CommercialPaths itself has no
  // hooks and is the actual component that contained the bug, so calling it
  // directly and walking its real returned element tree is both safe and
  // precise — this proves the actual rendered output, not just source text.
  it('the actual rendered Economy card contains no /founder link', () => {
    const hrefs = collectHrefs(CommercialPaths());
    expect(hrefs.some((h) => h.startsWith('/founder'))).toBe(false);
  });

  it('the Economy card now links to the public Manchester–Mumbai route guide', () => {
    const hrefs = collectHrefs(CommercialPaths());
    expect(hrefs).toContain('/routes/manchester-mumbai');
  });

  it('manchester-mumbai is a real, statically-generated public route (would return 200)', () => {
    // generateStaticParams in app/routes/[slug]/page.tsx maps routes.map(r => ({ slug: r.slug }))
    // directly — being present in this array IS what makes a route slug a real, pre-rendered
    // public page rather than a 404. Confirming this from the actual data module the route
    // page's own generateStaticParams reads from, not a separate assumption.
    expect(routes.some((r) => r.slug === 'manchester-mumbai')).toBe(true);
  });

  it('the CTA label no longer references the private "Journey Brief" product name', () => {
    expect(homepageSectionsSrc).not.toMatch(/Start with the Journey Brief/);
    expect(homepageSectionsSrc).toContain('See the Manchester–Mumbai route guide');
  });

  it('a meaningful internal-link scan: no public source file links to /founder', () => {
    // Walks every real .tsx source file under app/ and components/, excluding
    // app/founder and components/founder — the two directories that are the
    // actual founder-only surface — for a literal href="/founder" (or '/founder
    // or `/founder). journey-brief-hero.tsx is a known, pre-existing dead
    // component (zero importers anywhere in app/ or components/, confirmed by
    // grep before this PR) — like pull-brief-hero.tsx before it, it is
    // retired-but-not-deleted code, not a reachable public page, and is the
    // one deliberate exclusion here.
    const root = process.cwd();
    const files = [...listTsxFiles(join(root, 'app')), ...listTsxFiles(join(root, 'components'))];
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(root, file).replace(/\\/g, '/');
      if (rel.startsWith('app/founder/') || rel.startsWith('components/founder/') || rel.endsWith('journey-brief-hero.tsx')) continue;
      const src = readFileSync(file, 'utf8');
      if (/href=["'`]\/founder/.test(src)) offenders.push(rel);
    }
    expect(offenders, `files with a public /founder link: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('Fix 2 — every customer-facing Trip.com CTA now shows visible partner wording', () => {
  it('DealCard shows "Partner link"', () => {
    expect(dealCardSrc).toMatch(/Partner link, opens Trip\.com in a new tab/);
  });

  it('NoFareFallback shows "Partner link"', () => {
    expect(noFareFallbackSrc).toMatch(/Partner link, opens Trip\.com in a new tab/);
  });

  it('Travel Ready Check\'s booking CTA shows "Partner link"', () => {
    expect(travelReadyCheckSrc).toMatch(/Partner link, opens Trip\.com in a new tab/);
  });

  it('the route-hero CTA and Book-By Countdown CTA already had it, and still do (regression guard)', () => {
    expect(routeHeroSrc).toMatch(/Partner link, opens Trip\.com in a new tab/);
    expect(bookByCountdownSrc).toMatch(/Partner link, opens Trip\.com in a new tab/);
  });
});

describe('Unrelated behaviour is unchanged — URLs, rel, analytics, fail-closed behaviour', () => {
  it('every fixed Trip.com CTA uses rel={PROVIDER_REL} — the shared constant, never a hardcoded or weakened string', () => {
    // Asserting the literal `rel={PROVIDER_REL}` JSX binding, not just that the
    // string "PROVIDER_REL" appears somewhere in the file (which would pass
    // even if the actual anchor used a hardcoded rel="..." elsewhere). Not
    // asserting "no hardcoded rel anywhere in the file" — travel-ready-check.tsx
    // legitimately has an unrelated official-source citation link with its own
    // rel="noopener noreferrer" that has nothing to do with the Trip.com CTA.
    for (const [name, src] of Object.entries({ dealCard: dealCardSrc, noFareFallback: noFareFallbackSrc, travelReadyCheck: travelReadyCheckSrc })) {
      expect(src, `${name} does not bind rel={PROVIDER_REL}`).toContain('rel={PROVIDER_REL}');
    }
  });

  it('the shared PROVIDER_REL constant itself still carries every safe token', () => {
    const bookingProvidersSrc = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    const match = bookingProvidersSrc.match(/PROVIDER_REL\s*=\s*'([^']+)'/);
    expect(match).not.toBeNull();
    const tokens = (match![1] ?? '').split(/\s+/);
    for (const required of ['nofollow', 'sponsored', 'noopener', 'noreferrer']) {
      expect(tokens, `PROVIDER_REL is missing "${required}"`).toContain(required);
    }
  });

  it('tripcom_click event name and properties are unchanged on DealCard and NoFareFallback', () => {
    expect(dealCardSrc).toContain('event="tripcom_click"');
    expect(dealCardSrc).toContain("properties={{ route: matchedRoute!.slug, source: 'deal-card' }}");
    expect(noFareFallbackSrc).toContain('event="tripcom_click"');
    expect(noFareFallbackSrc).toContain("properties={{ route: routeSlug!, source: 'no-fare-fallback' }}");
  });

  it('Travel Ready Check\'s own distinct analytics event name is unchanged', () => {
    expect(travelReadyCheckSrc).toContain("track('ready_check_book_cta_click', { destination: destinationSlug })");
  });

  it('fail-closed behaviour on unsupported routes is unchanged in every fixed component', () => {
    expect(dealCardSrc).toMatch(/Direct flight comparison is not available for this airport yet\./);
    expect(noFareFallbackSrc).toMatch(/Direct flight comparison is not available for this airport yet\./);
    expect(travelReadyCheckSrc).toMatch(/Direct flight comparison is not available for this airport yet\./);
  });

  it('the footer Affiliate Disclosure link is untouched', () => {
    expect(footerSrc).toMatch(/href=["'`]\/affiliate-disclosure["'`]/);
  });

  it('no route-specific Trip.com URL construction was touched (getTripComRouteUrl call sites unchanged)', () => {
    for (const src of [dealCardSrc, noFareFallbackSrc, travelReadyCheckSrc, routeHeroSrc]) {
      expect(src).toContain('getTripComRouteUrl');
    }
  });
});

describe('Fix 3 — credibility wording corrected: no invented team, no JetStash-supplies-live-fares claim', () => {
  it('"a member of our team" / "our team" is gone from every affected customer-facing surface', () => {
    for (const [name, src] of Object.entries({
      'app/deals/page.tsx': dealsPageSrc,
      'app/about/page.tsx': aboutPageSrc,
      'components/route/fare-history-panel.tsx': fareHistoryPanelSrc,
      'components/homepage-v2/homepage-sections.tsx': homepageSectionsSrc,
    })) {
      expect(src, `${name} still mentions "our team"`).not.toMatch(/\bour team\b/i);
      expect(src, `${name} still mentions "a member of"`).not.toMatch(/a member of/i);
    }
  });

  it('the homepage no longer claims JetStash itself "hands you a live-fare check"', () => {
    expect(homepageSectionsSrc).not.toMatch(/JetStash hands you a live-fare check/);
    expect(homepageSectionsSrc).toMatch(/current Trip\.com partner search/);
  });

  it('the underlying facts these sentences convey are still present, just without the invented team/live-fare claim', () => {
    // Deals page: still explains fares are hand-checked and dated.
    expect(dealsPageSrc).toMatch(/a real check logged by hand, dated/);
    // About page: the section title already said "checked by a person" —
    // confirming that framing is still there and the body no longer contradicts it.
    expect(aboutPageSrc).toMatch(/checked by a person/);
    expect(aboutPageSrc).toMatch(/a real fare check logged by hand/);
    // Fare history panel: still explains figures are checked/recorded, not live.
    expect(fareHistoryPanelSrc).toMatch(/a fare checked and recorded on the date shown, not a live price feed/);
  });
});
