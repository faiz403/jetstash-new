import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';
import {
  getSafeTripComFlightHandoffUrl,
  SERVICE_ENDED_CTA_LABEL,
  TRIPCOM_DEFAULT_CTA_LABEL,
  GENERIC_FLIGHT_SEARCH_CTA_LABEL,
} from '@/lib/booking-providers';
import { DealCard } from '@/components/ui/deal-card';
import { deals } from '@/data/deals';
import RoutePage from '@/app/routes/[slug]/page';

/**
 * Trip.com CTA label consolidation (12 Sept 2026, founder-approved,
 * following the 12 Sept monetised-route funnel audit). The audit found
 * five different labels in production for the same ordinary Trip.com
 * flight-handoff click. This is copy-only: no URL, affiliate id, rel,
 * target, analytics event, or route-resolution logic changes. See
 * TRIPCOM_DEFAULT_CTA_LABEL's doc comment in lib/booking-providers.ts.
 */

const NOW_ISO = '2026-09-12';

function renderRoutePage(slug: string) {
  return RoutePage({ params: Promise.resolve({ slug }) }).then((el) => renderToStaticMarkup(el));
}

describe('1. normal MAN->ISB Trip.com CTAs use the shared label', () => {
  it('renders TRIPCOM_DEFAULT_CTA_LABEL and never the old wordings', async () => {
    const html = await renderRoutePage('manchester-islamabad');
    expect(html).toContain(TRIPCOM_DEFAULT_CTA_LABEL);
    // Source-level check, not just rendered-HTML .toContain(): React
    // re-escapes an apostrophe (whether written as a literal ' or as the
    // JSX entity &apos;) to an HTML numeric/named entity in
    // renderToStaticMarkup's output, so a literal-apostrophe string check
    // against rendered HTML can silently miss a real, live occurrence —
    // exactly what happened here: journey-choice.tsx and route-verdict.tsx
    // both had "Check today&apos;s price" (MAN-ISB's Journey Verdict pilot
    // + Journey Choice detail CTAs) and were missed by the first pass of
    // this consolidation until a live curl/browser QA check caught the
    // apostrophe-entity variant. Checking the source text directly is the
    // reliable guard against this class of miss.
    const journeyChoiceSrc = readFileSync(join(process.cwd(), 'components/route/journey-choice.tsx'), 'utf8');
    const routeVerdictSrc = readFileSync(join(process.cwd(), 'components/route/route-verdict.tsx'), 'utf8');
    for (const src of [journeyChoiceSrc, routeVerdictSrc]) {
      expect(src).toContain('TRIPCOM_DEFAULT_CTA_LABEL');
      expect(src).not.toMatch(/Check today.s price/);
    }
  });
});

describe('2. MAN->DXB uses the shared label', () => {
  it('renders TRIPCOM_DEFAULT_CTA_LABEL', async () => {
    const html = await renderRoutePage('manchester-dubai');
    expect(html).toContain(TRIPCOM_DEFAULT_CTA_LABEL);
    expect(html).not.toContain('Check current price on Trip.com');
  });
});

describe('3. MAN->LHE uses the shared label', () => {
  it('renders TRIPCOM_DEFAULT_CTA_LABEL and never the old Book-By wordings', async () => {
    const html = await renderRoutePage('manchester-lahore');
    expect(html).toContain(TRIPCOM_DEFAULT_CTA_LABEL);
    expect(html).not.toContain('Check live price');
    expect(html).not.toContain("Check today's price");
  });
});

describe('4. BHX->ATQ uses the shared label', () => {
  it('renders TRIPCOM_DEFAULT_CTA_LABEL', async () => {
    const html = await renderRoutePage('birmingham-amritsar');
    expect(html).toContain(TRIPCOM_DEFAULT_CTA_LABEL);
    expect(html).not.toContain('Check live price');
  });
});

describe('5. Book-By normal CTA uses the shared label', () => {
  it('book-by-countdown.tsx source references TRIPCOM_DEFAULT_CTA_LABEL, not a hand-typed state-dependent string', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/book-by-countdown.tsx'), 'utf8');
    expect(src).toContain('TRIPCOM_DEFAULT_CTA_LABEL');
    expect(src).not.toContain("'Check live price now'");
    expect(src).not.toContain("'Check live price'");
    expect(src).not.toContain("'Good time to book — check live price'");
  });
});

describe('6. Fare Signal normal CTA uses the shared label', () => {
  it('fare-signal.tsx source references TRIPCOM_DEFAULT_CTA_LABEL as SignalCta\'s default', () => {
    const src = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    expect(src).toContain('label = TRIPCOM_DEFAULT_CTA_LABEL');
  });
});

describe('7. DealCard normal CTA uses the shared label', () => {
  it('deal-card.tsx source references TRIPCOM_DEFAULT_CTA_LABEL for the non-service-ended branch', () => {
    const src = readFileSync(join(process.cwd(), 'components/ui/deal-card.tsx'), 'utf8');
    expect(src).toContain('TRIPCOM_DEFAULT_CTA_LABEL');
  });

  it('renders the shared label live for a normal monetised deal', () => {
    const deal = deals.find((d) => d.id === 'man-isb-business')!;
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: NOW_ISO }));
    expect(html).toContain(TRIPCOM_DEFAULT_CTA_LABEL);
  });
});

describe('8. MAN->Delhi still uses the service-ended label', () => {
  it('renders SERVICE_ENDED_CTA_LABEL, never TRIPCOM_DEFAULT_CTA_LABEL', async () => {
    const html = await renderRoutePage('manchester-delhi');
    expect(html).toContain(SERVICE_ENDED_CTA_LABEL);
    expect(html).not.toContain(TRIPCOM_DEFAULT_CTA_LABEL);
  });
});

describe('9. MAN->Mumbai still uses the service-ended label', () => {
  it('renders SERVICE_ENDED_CTA_LABEL, never TRIPCOM_DEFAULT_CTA_LABEL', async () => {
    const html = await renderRoutePage('manchester-mumbai');
    expect(html).toContain(SERVICE_ENDED_CTA_LABEL);
    expect(html).not.toContain(TRIPCOM_DEFAULT_CTA_LABEL);
  });
});

describe('10. Google Flights fallback still reads "Search current flights"', () => {
  it('unaffected by this consolidation', async () => {
    const html = await renderRoutePage('london-heathrow-jeddah');
    expect(html).toContain(GENERIC_FLIGHT_SEARCH_CTA_LABEL);
    expect(html).not.toContain(TRIPCOM_DEFAULT_CTA_LABEL);
    expect(html).not.toContain(SERVICE_ENDED_CTA_LABEL);
  });
});

describe('11. no Trip.com URL changes', () => {
  it('manchester-islamabad, manchester-dubai, manchester-lahore, birmingham-amritsar all resolve their existing exact URLs unchanged', () => {
    const expectations: Record<string, string> = {
      'manchester-islamabad': 'tickets-MAN-ISB',
      'manchester-dubai': 'tickets-MAN-DXB',
      'manchester-lahore': 'tickets-MAN-LHE',
      'birmingham-amritsar': 'tickets-BHX-ATQ',
    };
    for (const [slug, marker] of Object.entries(expectations)) {
      const route = getRouteBySlug(slug)!;
      const airport = getRouteAirport(route)!;
      const dest = getRouteDestination(route)!;
      const url = getSafeTripComFlightHandoffUrl(route.slug, airport.slug, dest.slug, NOW_ISO);
      expect(url, slug).toContain(marker);
    }
  });
});

describe('12. no affiliate disclosure changes', () => {
  it('the standard affiliate disclosure text still renders alongside the consolidated CTA', async () => {
    const html = await renderRoutePage('manchester-islamabad');
    expect(html).toContain('Ad · Affiliate link.');
    expect(html).toContain('JetStash earns commission on eligible bookings through this link, at no extra cost to you.');
  });
});

describe('13. no analytics-event changes', () => {
  it('fare-signal.tsx and book-by-countdown.tsx keep their exact existing tripcom_click / bookby_cta_click wiring', () => {
    const fareSignalSrc = readFileSync(join(process.cwd(), 'components/route/fare-signal.tsx'), 'utf8');
    const bookBySrc = readFileSync(join(process.cwd(), 'components/route/book-by-countdown.tsx'), 'utf8');
    expect(fareSignalSrc).toContain('event="tripcom_click"');
    expect(bookBySrc).toContain("track('bookby_cta_click'");
  });
});

describe('intentional old-label exclusion: hotel CTA is out of scope', () => {
  it('holiday-intelligence.tsx (a hotel handoff, tripcom_hotel_click) is untouched — a different action, not a flight CTA', () => {
    const src = readFileSync(join(process.cwd(), 'components/destination/holiday-intelligence.tsx'), 'utf8');
    expect(src).toContain('Check current price on Trip.com');
    expect(src).toContain('tripcom_hotel_click');
  });
});
