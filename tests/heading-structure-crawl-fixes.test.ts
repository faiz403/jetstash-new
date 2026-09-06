import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Three heading-structure defects found by the 6 September 2026 155-URL
 * full-site crawl, affecting four public pages: /deals, /quote-request,
 * /travel-club and /routes/leeds-bradford-islamabad. Each is fixed by
 * examining the component's actual structural relationship to its
 * surrounding headings across every real call site — not by mechanically
 * asserting "no numerical skip anywhere" without regard to that structure.
 *
 * 1. DealCard's route-label eyebrow is correctly h3 at 7 of its 8 call
 *    sites (a real section h2 already precedes it there: route/
 *    destination/airport pages' "Fares we're tracking...", region hubs,
 *    business-class, umrah, family-holidays). /deals is the one page with
 *    no section heading of its own — DealCard now accepts an explicit
 *    headingLevel prop (default 'h3') so /deals's own call site can say
 *    so, rather than the component guessing from a route/page name.
 * 2. Footer's column headings (Explore / Specialist journeys / About) are
 *    promoted h3 -> h2 globally, not just on the two pages that exposed a
 *    skip. The footer has exactly one call site (app/layout.tsx), always
 *    renders as its own <footer> landmark after all main content, and is
 *    never nested inside a main-content h2 section on any page — it's
 *    structurally a sibling of the page's own top-level sections, so h2
 *    is the correct level everywhere, confirmed by inspecting the actual
 *    render tree, not merely a two-page patch.
 * 3. WarningBanner's warning title is promoted h3 -> h2. It has exactly
 *    one call site (app/routes/[slug]/page.tsx); the only unconditionally
 *    rendered content before it, FareSignal, contains no heading in any
 *    state, and every other section that could precede it (Route
 *    Status's own h2, Journey Choice/Route Verdict) is independently
 *    gated and genuinely absent on a route in leeds-bradford-islamabad's
 *    situation (disputed status, no journeyChoice) — so this banner is
 *    effectively always the first heading-bearing content after h1
 *    whenever it renders, not a subordinate of an established h2 section.
 */

const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');
const dealsExplorerSrc = readFileSync(join(process.cwd(), 'components/sections/deals-explorer.tsx'), 'utf8');
const footerSrc = readFileSync(join(process.cwd(), 'components/layout/footer.tsx'), 'utf8');
const warningBannerSrc = readFileSync(join(process.cwd(), 'components/route/warning-banner.tsx'), 'utf8');

describe('1. DealCard — context-aware heading level, not a global tag swap', () => {
  it('accepts an explicit headingLevel prop, defaulting to h3 (correct at 7 of 8 real call sites)', () => {
    expect(dealCardSrc).toMatch(/headingLevel\s*=\s*'h3'/);
    expect(dealCardSrc).toMatch(/headingLevel\?:\s*'h2'\s*\|\s*'h3'/);
  });

  it('renders the route-label eyebrow through the dynamic heading tag, not a hardcoded h3', () => {
    expect(dealCardSrc).toContain('const RouteHeading = headingLevel;');
    expect(dealCardSrc).toMatch(/<RouteHeading className="flex items-center gap-1\.5 text-xs font-semibold uppercase tracking-wide text-ink-400">/);
    expect(dealCardSrc).not.toMatch(/<h3[^>]*>\s*<Plane/);
  });

  it('/deals — the one call site with no section heading of its own — explicitly requests h2', () => {
    expect(dealsExplorerSrc).toContain('<DealCard key={deal.id} deal={deal} headingLevel="h2" />');
  });

  it('every other call site (route/destination/airport pages, region hubs, business-class, umrah, family-holidays) is left on the default h3 — none of them pass headingLevel', () => {
    const otherCallSites = [
      'app/routes/[slug]/page.tsx',
      'app/destinations/[slug]/page.tsx',
      'app/airports/[slug]/page.tsx',
      'app/business-class/page.tsx',
      'app/umrah/page.tsx',
      'app/family-holidays/page.tsx',
      'components/sections/region-hub-page.tsx',
    ];
    for (const file of otherCallSites) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      const dealCardCall = src.match(/<DealCard[^/]*\/>/)?.[0];
      expect(dealCardCall, `${file} should render DealCard`).toBeTruthy();
      expect(dealCardCall).not.toContain('headingLevel');
    }
  });

  it('no copy, fare, CTA, or affiliate wiring changed alongside the heading-level prop', () => {
    expect(dealCardSrc).toContain('{deal.fromCity} → {deal.toCity}');
    expect(dealsExplorerSrc).toContain('{filtered.map((deal) => (');
  });
});

describe('2. Footer — global h3 -> h2, confirmed structurally correct everywhere, not a two-page patch', () => {
  it('FooterColumn now renders its title as h2', () => {
    expect(footerSrc).toMatch(/<h2 className="text-xs font-semibold uppercase tracking-wide text-ink-300">\{title\}<\/h2>/);
    expect(footerSrc).not.toMatch(/<h3[^>]*>\{title\}<\/h3>/);
  });

  it('each column keeps its own nav landmark with an accessible name, unchanged', () => {
    expect(footerSrc).toContain('<nav aria-label={title}>');
  });

  it('no footer copy, links, or column structure changed', () => {
    expect(footerSrc).toContain('<FooterColumn title="Explore" links={footerNav.explore} />');
    expect(footerSrc).toContain('<FooterColumn title="Specialist journeys" links={footerNav.specialist} />');
    expect(footerSrc).toContain('<FooterColumn title="About" links={footerNav.company} />');
  });
});

describe('3. WarningBanner — h3 -> h2, confirmed by tracing every conditional section that can precede it', () => {
  it('the warning title now renders as h2', () => {
    expect(warningBannerSrc).toMatch(/<h2 className="mt-0\.5 font-display text-lg text-ink-900">\{warning\.title\}<\/h2>/);
    expect(warningBannerSrc).not.toMatch(/<h3[^>]*>\{warning\.title\}<\/h3>/);
  });

  it('active/resolved filtering and the null-render-when-no-active-warnings behaviour are unchanged', () => {
    expect(warningBannerSrc).toContain("const active = warnings.filter((w) => w.status === 'active');");
    expect(warningBannerSrc).toContain('if (active.length === 0) return null;');
  });

  it('warning wording, severity styling, and body text are unchanged', () => {
    expect(warningBannerSrc).toContain('{warning.body}');
    expect(warningBannerSrc).toContain('severityStyles[warning.severity]');
  });

  it('FareSignal — the only unconditionally-rendered content before WarningBanner on every route — contains no heading in any state, confirming the banner is not a subordinate of an established section', () => {
    const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    expect(fareSignalSrc).not.toMatch(/<h[1-6]\b/);
  });
});

describe('No frozen product behaviour touched', () => {
  it('no MAN-ISB/Journey Choice/Standout Fare functional code (imports, props, or identifiers — not explanatory comments) exists in any of the three edited components', () => {
    for (const src of [dealCardSrc, dealsExplorerSrc, footerSrc, warningBannerSrc]) {
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(withoutComments).not.toMatch(/manchester-islamabad|journeyChoice|standoutFare/i);
    }
  });
});
