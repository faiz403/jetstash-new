import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mainNav, footerNav } from '@/lib/site-config';

/**
 * A9 (August 2026): repositioning "Deals" as tracked fare evidence. The
 * word "Deals" implies JetStash has proven a price is unusually good
 * against historical data, which it has not — every fare shown is a dated,
 * hand-checked observation, not a claim of being the cheapest available
 * (see data/deals.ts and data/fare-observations.ts). The /deals page's own
 * content (title, hero, cards) already used honest "tracked fare" language
 * before this change; the navigation label and the page's own "All deals"
 * filter pill were the two places still saying otherwise.
 *
 * Deliberately unchanged, and asserted here so a future edit can't
 * accidentally break it: the /deals URL itself, the underlying Deal data
 * type and its route/href, and every analytics event name (tripcom_click
 * etc.) — see the source diff this test accompanies for the exact scope.
 */

const siteConfigSrc = readFileSync(join(process.cwd(), 'lib/site-config.ts'), 'utf8');
const dealsExplorerSrc = readFileSync(join(process.cwd(), 'components/sections/deals-explorer.tsx'), 'utf8');
const dealCardSrc = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');
const dealsPageSrc = readFileSync(join(process.cwd(), 'app/deals/page.tsx'), 'utf8');

describe('Main and footer navigation no longer say "Deals"', () => {
  it('mainNav labels "Tracked Fares", not "Deals"', () => {
    const labels = mainNav.map((item) => item.label);
    expect(labels).toContain('Tracked Fares');
    expect(labels).not.toContain('Deals');
  });

  it('the Tracked Fares nav entry still points at /deals — the URL is unchanged', () => {
    const entry = mainNav.find((item) => item.label === 'Tracked Fares');
    expect(entry?.href).toBe('/deals');
  });

  it('footerNav.specialist labels "Tracked Fares", not "All Deals"', () => {
    const labels = footerNav.specialist.map((item) => item.label);
    expect(labels).toContain('Tracked Fares');
    expect(labels).not.toContain('All Deals');
  });

  it('the footer Tracked Fares entry also points at /deals', () => {
    const entry = footerNav.specialist.find((item) => item.label === 'Tracked Fares');
    expect(entry?.href).toBe('/deals');
  });

  it('no other nav or footer entry was touched by this change', () => {
    expect(mainNav.map((item) => item.label)).toEqual(['Routes', 'Destinations', 'UK Airports', 'Travel Ready', 'Guides', 'Tracked Fares']);
    expect(footerNav.explore.map((item) => item.label)).toEqual(['All Routes', 'All Destinations', 'UK Airports', 'Travel Ready Check', 'Travel Guides']);
  });
});

describe('/deals page filter pill no longer says "All deals"', () => {
  it('the DealsExplorer filter label is "All fares", not "All deals"', () => {
    expect(dealsExplorerSrc).toContain("{ label: 'All fares', value: 'all' }");
    expect(dealsExplorerSrc).not.toMatch(/label:\s*'All deals'/);
  });

  it('the other category filter labels are unchanged', () => {
    expect(dealsExplorerSrc).toContain("{ label: 'Flights', value: 'flight' }");
    expect(dealsExplorerSrc).toContain("{ label: 'Packages', value: 'package' }");
    expect(dealsExplorerSrc).toContain("{ label: 'Business class', value: 'business' }");
    expect(dealsExplorerSrc).toContain("{ label: 'Umrah', value: 'umrah' }");
  });
});

describe('The /deals route keeps its URL while clarifying curated card scope', () => {
  it('the /deals route keeps its URL and distinguishes route coverage from curated cards', () => {
    expect(dealsPageSrc).toContain("title: 'Tracked Fares from UK Airports'");
    expect(dealsPageSrc).toContain('alternates: { canonical: `${siteConfig.url}/deals` }');
    expect(dealsPageSrc).toContain('curated selection of routes and categories');
    expect(dealsPageSrc).toContain('not listed as a Deal card here');
  });

  it('DealCard never rendered the word "Deal" in customer-facing text, and still does not', () => {
    // Every occurrence of "Deal" in this file is a TypeScript type name or a
    // prop/variable (Deal, DealCabin, deal.id, DealCard) — never literal
    // JSX text content. Checked directly against every static string this
    // component actually renders, rather than a regex over the whole file
    // (which also matches type annotations like Record<DealCabin, string>
    // and isn't a reliable way to distinguish JSX text from code).
    const renderedStrings = [...dealCardSrc.matchAll(/>\s*([A-Za-z][^{}<>\n]*?)\s*</g)].map((m) => m[1]);
    for (const s of renderedStrings) {
      expect(s, `rendered string "${s}"`).not.toMatch(/\bDeals?\b/);
    }
  });

  it('the tripcom_click analytics event name is unchanged', () => {
    expect(dealCardSrc).toContain("event=\"tripcom_click\"");
    expect(dealCardSrc).toContain("properties={{ route: matchedRoute!.slug, source: 'deal-card' }}");
  });

  it('the Data/deals.ts import path and Deal type name are unchanged (internal identifiers, not customer-facing, deliberately not renamed)', () => {
    expect(dealCardSrc).toContain("import { Deal, DealCabin,");
    expect(siteConfigSrc).not.toMatch(/import.*Deal/); // site-config.ts has no reason to import the Deal type
  });
});
