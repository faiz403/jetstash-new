import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { routes } from '@/data/routes';
import { getTripComRouteUrl, getTripComFlightHandoffUrl, hasTripComRoute, PROVIDER_NAME, PROVIDER_REL } from '@/lib/booking-providers';

/**
 * Trip.com sole-provider migration — TravelUp removed entirely. Covers the
 * full requirement list from the removal task: exact per-route URLs, the
 * fail-closed London-origin routes, no TravelUp residue anywhere active,
 * analytics correctness, and CTA wording. Follows this repo's established
 * convention for booking-provider checks (tests/heathrow-bengaluru-route.test.ts,
 * tests/bangladesh-workstream.test.ts): source-text regression assertions
 * over the real files, since the surfaces involved are server components.
 */

const SUPPORTED_ROUTES = [
  'manchester-lahore',
  'manchester-islamabad',
  'manchester-istanbul',
  'manchester-dalaman',
  'manchester-bodrum',
  'manchester-dubai',
  'manchester-karachi',
  'manchester-dhaka',
  'manchester-sylhet',
  'manchester-doha',
  'manchester-jeddah',
  'manchester-delhi',
  'manchester-mumbai',
  'manchester-amritsar',
  'manchester-ahmedabad',
  'manchester-madinah',
  'birmingham-amritsar',
  'birmingham-lahore',
  'birmingham-islamabad',
  'birmingham-madinah',
  'birmingham-mumbai',
  'leeds-bradford-amritsar',
  'leeds-bradford-islamabad',
  'glasgow-dubai',
  'edinburgh-dubai',
  'newcastle-dubai',
];

const UNSUPPORTED_LONDON_ROUTES = [
  'london-heathrow-delhi',
  'london-heathrow-doha',
  'london-heathrow-jeddah',
  'london-heathrow-mumbai',
  'london-heathrow-bengaluru',
  'london-heathrow-dhaka',
  'london-heathrow-sylhet',
  'london-gatwick-ahmedabad',
  'london-gatwick-amritsar',
];

describe('every current route slug is classified exactly once', () => {
  it('SUPPORTED_ROUTES + UNSUPPORTED_LONDON_ROUTES together equal every route in data/routes.ts, with no overlap', () => {
    const allSlugs = routes.map((r) => r.slug).sort();
    const classified = [...SUPPORTED_ROUTES, ...UNSUPPORTED_LONDON_ROUTES].sort();
    expect(classified).toEqual(allSlugs);
    expect(new Set(SUPPORTED_ROUTES).size).toBe(SUPPORTED_ROUTES.length);
    const overlap = SUPPORTED_ROUTES.filter((s) => UNSUPPORTED_LONDON_ROUTES.includes(s));
    expect(overlap).toEqual([]);
  });

  it('is exactly 26 supported and 9 unsupported', () => {
    expect(SUPPORTED_ROUTES).toHaveLength(26);
    expect(UNSUPPORTED_LONDON_ROUTES).toHaveLength(9);
  });
});

describe('all 26 supported routes receive their exact, real Trip.com URL', () => {
  it.each(SUPPORTED_ROUTES)('%s resolves to a genuine trip.com/flights URL', (slug) => {
    const url = getTripComRouteUrl(slug);
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\/www\.trip\.com\/flights\//);
    expect(hasTripComRoute(slug)).toBe(true);
  });

  it('every URL carries JetStash\'s genuine, constant affiliate identifiers — never a guessed or per-route-varying value', () => {
    for (const slug of SUPPORTED_ROUTES) {
      const url = getTripComRouteUrl(slug)!;
      expect(url).toContain('Allianceid=9804124');
      expect(url).toContain('SID=327450313');
    }
  });

  it('every URL\'s dcity/acity query params match the route\'s real origin/destination airport codes', () => {
    const CODES: Record<string, [string, string]> = {
      'manchester-lahore': ['MAN', 'LHE'],
      'manchester-islamabad': ['MAN', 'ISB'],
      'manchester-istanbul': ['MAN', 'IST'],
      'manchester-dalaman': ['MAN', 'DLM'],
      'manchester-bodrum': ['MAN', 'BJV'],
      'manchester-dubai': ['MAN', 'DXB'],
      'manchester-karachi': ['MAN', 'KHI'],
      'manchester-dhaka': ['MAN', 'DAC'],
      'manchester-sylhet': ['MAN', 'ZYL'],
      'manchester-doha': ['MAN', 'DOH'],
      'manchester-jeddah': ['MAN', 'JED'],
      'manchester-delhi': ['MAN', 'DEL'],
      'manchester-mumbai': ['MAN', 'BOM'],
      'manchester-amritsar': ['MAN', 'ATQ'],
      'manchester-ahmedabad': ['MAN', 'AMD'],
      'manchester-madinah': ['MAN', 'MED'],
      'birmingham-amritsar': ['BHX', 'ATQ'],
      'birmingham-lahore': ['BHX', 'LHE'],
      'birmingham-islamabad': ['BHX', 'ISB'],
      'birmingham-madinah': ['BHX', 'MED'],
      'birmingham-mumbai': ['BHX', 'BOM'],
      'leeds-bradford-amritsar': ['LBA', 'ATQ'],
      'leeds-bradford-islamabad': ['LBA', 'ISB'],
      'glasgow-dubai': ['GLA', 'DXB'],
      'edinburgh-dubai': ['EDI', 'DXB'],
      'newcastle-dubai': ['NCL', 'DXB'],
    };
    for (const [slug, [origin, dest]] of Object.entries(CODES)) {
      const url = getTripComRouteUrl(slug)!;
      expect(url, slug).toContain(`dcity=${origin}&acity=${dest}`);
    }
  });
});

describe('all 9 London-origin routes receive no Trip.com URL — fail closed, never a generic fallback', () => {
  it.each(UNSUPPORTED_LONDON_ROUTES)('%s resolves to null, not a generic London/LON link', (slug) => {
    expect(getTripComRouteUrl(slug)).toBeNull();
    expect(hasTripComRoute(slug)).toBe(false);
  });

  it('no unsupported route\'s slug appears as a key anywhere in the URL map source', () => {
    const src = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    for (const slug of UNSUPPORTED_LONDON_ROUTES) {
      expect(src).not.toContain(`'${slug}':`);
    }
  });
});

describe('no manually guessed or generic Trip.com URL exists anywhere in the map', () => {
  const bookingProvidersSrc = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');

  it('never uses the generic "LON" city code', () => {
    expect(bookingProvidersSrc).not.toMatch(/dcity=LON\b/);
  });

  it('never uses a bare Trip.com homepage/search URL with no origin/destination', () => {
    expect(bookingProvidersSrc).not.toMatch(/'https:\/\/www\.trip\.com\/?'/);
    expect(bookingProvidersSrc).not.toMatch(/'https:\/\/www\.trip\.com\/flights\/?'(?!\w)/);
  });
});

describe('no Trip.com URL contains a fixed departure or return date', () => {
  it('every URL is the Flights-page shape (flighttype=S, no date params) not a dated search-results URL', () => {
    for (const slug of SUPPORTED_ROUTES) {
      const url = getTripComRouteUrl(slug)!;
      expect(url).toContain('flighttype=S');
      expect(url).not.toContain('showfarefirst');
      expect(url).not.toMatch(/[?&]ddate=/);
      expect(url).not.toMatch(/[?&]rdate=/);
    }
  });
});

describe('public flight handoffs request the UK GBP presentation without changing attribution', () => {
  it.each(SUPPORTED_ROUTES)('%s adds the supported locale/currency fields to the shared handoff URL', (slug) => {
    const source = getTripComRouteUrl(slug)!;
    const handoff = getTripComFlightHandoffUrl(slug)!;
    expect(handoff).toContain('locale=en-XX&curr=GBP');
    expect(handoff).toContain('Allianceid=9804124');
    expect(handoff).toContain('SID=327450313');
    expect(handoff.replace('&locale=en-XX&curr=GBP', '')).toBe(source);
  });

  it.each(UNSUPPORTED_LONDON_ROUTES)('%s remains fail-closed with no handoff URL', (slug) => {
    expect(getTripComFlightHandoffUrl(slug)).toBeNull();
  });

  it('does not introduce currency conversion or request USD', () => {
    const src = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    expect(src).not.toMatch(/curr=USD|convert|exchange rate/i);
  });
});

describe('TravelUp is completely removed from active code — no residue', () => {
  const ACTIVE_DIRS = ['app', 'components', 'lib', 'data'];

  function collectFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collectFiles(full, out);
      else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) out.push(full);
    }
    return out;
  }

  it('no active app/components/lib/data file references TravelUp\'s tracking domain or CJ identifiers — these have no legitimate reason to appear anywhere, historical or otherwise', () => {
    const offenders: string[] = [];
    for (const dir of ACTIVE_DIRS) {
      for (const file of collectFiles(join(process.cwd(), dir))) {
        const content = readFileSync(file, 'utf8');
        if (/kqzyfj|101818709|15363607/i.test(content)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every remaining "TravelUp" mention in active code is an explicit historical/rationale note stating it is no longer active, never a live claim', () => {
    const offenders: string[] = [];
    const WINDOW = 3; // "removed" may land a line or two away in a wrapped comment, not necessarily the same line
    for (const dir of ACTIVE_DIRS) {
      for (const file of collectFiles(join(process.cwd(), dir))) {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (!/travelup/i.test(lines[i])) continue;
          const contextStart = Math.max(0, i - WINDOW);
          const contextEnd = Math.min(lines.length, i + WINDOW + 1);
          const context = lines.slice(contextStart, contextEnd).join(' ');
          if (!/removed/i.test(context)) offenders.push(`${file}: ${lines[i].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lib/booking-providers.ts exports no TravelUp-era symbols', () => {
    const src = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    expect(src).not.toMatch(/getRouteBookingUrl|getDealBookingUrl|getGeneralBookingUrl|hasVerifiedDeepLink|BOOKING_PROVIDERS|PRIMARY_PROVIDER_ID|BookingProviderId/);
  });

  it('lib/analytics.ts no longer types travelup_click', () => {
    const src = readFileSync(join(process.cwd(), 'lib/analytics.ts'), 'utf8');
    expect(src).not.toContain('travelup_click');
    expect(src).toContain("'tripcom_click'");
  });
});

describe('Trip.com CTA is primary, singular, and correctly wired on the route hero', () => {
  const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');

  it('renders exactly one booking CTA branch, gated on the shared GBP flight handoff helper', () => {
    expect(routePageSrc).toContain('getTripComFlightHandoffUrl(route.slug)');
    expect(routePageSrc).toContain('tripComUrl ?');
  });

  it('uses the required CTA wording', () => {
    expect(routePageSrc).toContain('Compare flights on Trip.com');
  });

  it('uses the required supporting wording', () => {
    expect(routePageSrc).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
  });

  it('fires tripcom_click with exactly the two properties standard Vercel Pro can store — route and source, never origin/destination (both derivable from the route slug)', () => {
    expect(routePageSrc).toContain("event=\"tripcom_click\"");
    expect(routePageSrc).toMatch(/properties=\{\{ route: route\.slug, source: 'route-hero' \}\}/);
    expect(routePageSrc).not.toMatch(/properties=\{\{[^}]*origin:/);
    expect(routePageSrc).not.toMatch(/properties=\{\{[^}]*destination:/);
  });

  it('renders the required clean unavailable state when no Trip.com URL exists', () => {
    expect(routePageSrc).toContain('Direct flight comparison is not available for this airport yet.');
  });

  it('never suggests broadening Heathrow/Gatwick to generic London, and never links a generic Trip.com page', () => {
    expect(routePageSrc).not.toMatch(/all London airports/i);
    expect(routePageSrc).not.toMatch(/href=\{['"`]https:\/\/www\.trip\.com\/?['"`]\}/);
  });

  it('preserves the correct external-link security attributes', () => {
    expect(routePageSrc).toContain('PROVIDER_REL');
    const bookingProvidersSrc = readFileSync(join(process.cwd(), 'lib/booking-providers.ts'), 'utf8');
    expect(bookingProvidersSrc).toContain("PROVIDER_REL = 'nofollow sponsored noopener noreferrer'");
  });
});

describe('no banned pricing language exists anywhere in active booking surfaces', () => {
  const FILES = [
    'app/routes/[slug]/page.tsx',
    'components/ui/deal-card.tsx',
    'components/ui/no-fare-fallback.tsx',
    'components/route/book-by-countdown.tsx',
    'components/travel-ready/travel-ready-check.tsx',
    'lib/booking-providers.ts',
  ];
  const BANNED = [/\bcheapest\b/i, /\bbest price\b/i, /\bguaranteed\b/i, /\blowest fare\b/i, /\bbook now\b/i];

  it.each(FILES)('%s contains none of: cheapest, best price, guaranteed, lowest fare, book now', (relPath) => {
    const src = readFileSync(join(process.cwd(), relPath), 'utf8');
    for (const pattern of BANNED) {
      expect(src, `${relPath} matched ${pattern}`).not.toMatch(pattern);
    }
  });
});

describe('affiliate disclosure remains present and unrelated to this migration', () => {
  it('app/affiliate-disclosure/page.tsx still exists and is generic (never named TravelUp, needs no Trip.com-specific rewrite)', () => {
    const src = readFileSync(join(process.cwd(), 'app/affiliate-disclosure/page.tsx'), 'utf8');
    expect(src.length).toBeGreaterThan(0);
    expect(src).not.toMatch(/travelup/i);
  });
});

describe('PROVIDER_NAME and PROVIDER_REL are the single source every surface reads from', () => {
  it('PROVIDER_NAME is Trip.com', () => {
    expect(PROVIDER_NAME).toBe('Trip.com');
  });

  it('PROVIDER_REL matches Google\'s guidance for paid/affiliate links', () => {
    expect(PROVIDER_REL).toBe('nofollow sponsored noopener noreferrer');
  });
});
