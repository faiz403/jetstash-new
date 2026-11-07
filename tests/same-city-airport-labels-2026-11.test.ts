import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RoutePage, { generateMetadata } from '@/app/routes/[slug]/page';
import { routes, getRoutesByDestination } from '@/data/routes';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { getAlternativeAirportOriginLabel, isAlternativeAirportCityAmbiguous } from '@/lib/alternative-airport-label';

/**
 * Route-page cleanup (November 2026, CEO-approved): in "Other UK airports", two airports in the same city must not
 * read identically. London Heathrow and London Gatwick both appeared as "London → Doha". The airport name replaces the
 * city only where the city alone is ambiguous. The page H1, SEO title, canonical, route data and links are untouched.
 */
const TODAY = '2026-11-06';
const render = async (slug: string) => renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug }) }));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const strip = (s: string) => plain(s.replace(/<[^>]+>/g, '')).trim();

function alternativesSection(html: string, destCity: string): string {
  const start = html.indexOf(`Other UK airports for ${destCity}`);
  return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
}
function altHeadings(section: string): string[] {
  return [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => strip(m[1]));
}

/** Pages that had an ambiguous heading before this change (found by the 6 Nov 2026 audit of Production), with the headings they must now show. */
const EXPECTED_CHANGED: Record<string, string[]> = {
  'manchester-dubai': ['London Heathrow → Dubai', 'London Gatwick → Dubai'],
  'manchester-doha': ['London Heathrow → Doha', 'London Gatwick → Doha'],
  'glasgow-dubai': ['London Heathrow → Dubai', 'London Gatwick → Dubai'],
  'edinburgh-dubai': ['London Heathrow → Dubai', 'London Gatwick → Dubai'],
  'newcastle-dubai': ['London Heathrow → Dubai', 'London Gatwick → Dubai'],
  'birmingham-dubai': ['London Heathrow → Dubai', 'London Gatwick → Dubai'],
  'birmingham-doha': ['London Heathrow → Doha', 'London Gatwick → Doha'],
  'london-heathrow-doha': ['London Gatwick → Doha'],
  'london-gatwick-doha': ['London Heathrow → Doha'],
  'london-heathrow-dubai': ['London Gatwick → Dubai'],
  'london-gatwick-dubai': ['London Heathrow → Dubai'],
};

describe('same-city airport labels in Other UK airports', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('the label rule', () => {
    const lhr = { slug: 'london-heathrow', name: 'London Heathrow', city: 'London' };
    const lgw = { slug: 'london-gatwick', name: 'London Gatwick', city: 'London' };
    const man = { slug: 'manchester', name: 'Manchester Airport', city: 'Manchester' };
    const bhx = { slug: 'birmingham', name: 'Birmingham Airport', city: 'Birmingham' };

    it('uses the airport name when two alternatives share a city', () => {
      expect(getAlternativeAirportOriginLabel(lhr, man, [lhr, lgw])).toBe('London Heathrow');
      expect(getAlternativeAirportOriginLabel(lgw, man, [lhr, lgw])).toBe('London Gatwick');
    });

    it("uses the airport name when the alternative's city is this page's own departure city", () => {
      expect(getAlternativeAirportOriginLabel(lgw, lhr, [lgw])).toBe('London Gatwick');
      expect(getAlternativeAirportOriginLabel(lhr, lgw, [lhr])).toBe('London Heathrow');
    });

    it('keeps the plain city where the city already identifies the airport', () => {
      expect(getAlternativeAirportOriginLabel(man, bhx, [man])).toBe('Manchester');
      expect(getAlternativeAirportOriginLabel(lhr, man, [lhr, bhx])).toBe('London');
      expect(isAlternativeAirportCityAmbiguous(lhr, man, [lhr])).toBe(false);
    });

    it('does not treat an airport as a duplicate of itself', () => {
      expect(isAlternativeAirportCityAmbiguous(man, bhx, [man, man])).toBe(false);
    });
  });

  describe('every route page', () => {
    it('shows no two identical row headings, and no row identical to the page it is on', async () => {
      let pagesWithSection = 0;
      for (const route of routes) {
        const airport = getAirportBySlug(route.airportSlug)!;
        const dest = getDestinationBySlug(route.destinationSlug)!;
        const headings = altHeadings(alternativesSection(await render(route.slug), dest.city));
        if (headings.length === 0) continue;
        pagesWithSection++;
        expect(new Set(headings).size, `${route.slug} duplicate headings: ${headings.join(' | ')}`).toBe(headings.length);
        // The page's own title form is "{airport name or city} to {dest}"; a row must never read as the page it sits on.
        expect(headings, route.slug).not.toContain(`${airport.city} → ${dest.city}`);
        expect(headings, route.slug).not.toContain(`${airport.name} → ${dest.city}`);
      }
      expect(pagesWithSection).toBeGreaterThan(0);
    });

    it('changes exactly the 11 audited pages and shows exactly the headings listed, one row per alternative', async () => {
      const changed: string[] = [];
      let withSection = 0;
      let withoutSection = 0;
      for (const route of routes) {
        const airport = getAirportBySlug(route.airportSlug)!;
        const dest = getDestinationBySlug(route.destinationSlug)!;
        const alternatives = getRoutesByDestination(dest.slug).filter((r) => r.slug !== route.slug && getAirportBySlug(r.airportSlug));
        const headings = altHeadings(alternativesSection(await render(route.slug), dest.city));
        expect(headings.length, route.slug).toBe(alternatives.length);
        if (alternatives.length > 0) withSection++;
        else withoutSection++;

        // Independent derivation of what the old (city-only) headings were: a page changed iff using cities would have been ambiguous.
        const oldHeadings = alternatives.map((a) => `${getAirportBySlug(a.airportSlug)!.city} → ${dest.city}`);
        const wasAmbiguous = new Set(oldHeadings).size !== oldHeadings.length || oldHeadings.includes(`${airport.city} → ${dest.city}`);
        if (wasAmbiguous) {
          changed.push(route.slug);
          // Only the London rows change; every other row keeps its exact city-only heading, in the same order.
          const isLondon = (h: string) => h.startsWith('London');
          expect(headings.filter(isLondon).sort(), route.slug).toEqual([...EXPECTED_CHANGED[route.slug]].sort());
          expect(headings.filter((h) => !isLondon(h)), route.slug).toEqual(oldHeadings.filter((h) => !isLondon(h)));
        } else {
          // Everything else keeps the exact city-only headings, in the same order.
          expect(headings, route.slug).toEqual(oldHeadings);
        }
      }
      expect(changed.sort()).toEqual(Object.keys(EXPECTED_CHANGED).sort());
      // 85 of the 89 pages carry the section: 11 change, 74 keep their headings, 4 have no alternative airport.
      expect({ withSection, withoutSection, total: routes.length }).toEqual({ withSection: 85, withoutSection: 4, total: 89 });
    });

    it('keeps each row linking to the same route page as before', async () => {
      const html = await render('manchester-doha');
      const section = alternativesSection(html, 'Doha');
      expect(section).toContain('href="/routes/london-heathrow-doha"');
      expect(section).toContain('href="/routes/london-gatwick-doha"');
    });
  });

  describe('what must not change', () => {
    it('the H1 stays "London to Doha" on both London pages (an SEO decision, not part of this fix)', async () => {
      for (const slug of ['london-heathrow-doha', 'london-gatwick-doha', 'london-heathrow-dubai', 'london-gatwick-dubai']) {
        const html = await render(slug);
        const h1 = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? '');
        const dest = slug.endsWith('doha') ? 'Doha' : 'Dubai';
        expect(h1, slug).toBe(`London to ${dest}`);
      }
    });

    it('title, description and canonical for the affected pages come from generateMetadata, which this change does not touch', async () => {
      const before = await generateMetadata({ params: Promise.resolve({ slug: 'london-heathrow-doha' }) });
      expect(before.alternates?.canonical).toContain('/routes/london-heathrow-doha');
      expect(JSON.stringify(before)).not.toContain('London Gatwick →');
    });
  });
});
