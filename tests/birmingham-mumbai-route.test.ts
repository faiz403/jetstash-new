import { describe, it, expect } from 'vitest';
import {
  getRouteBySlug,
  getRouteByAirportAndDestination,
  getRoutesByAirport,
  getRoutesByDestination,
  getDisplayDirectness,
  getRoutePresentation,
  getAirlineDisplayStatus,
} from '@/data/routes';
import { getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { getAirlinesBySlugs } from '@/data/airlines';
import { deals } from '@/data/deals';
import { fareObservations } from '@/data/fare-observations';
import { generateMetadata } from '@/app/routes/[slug]/page';

const FIXED_TODAY = '2026-07-23';

describe('TR-017 — Birmingham–Mumbai route existence and slug relationships', () => {
  it('a route record exists at the expected slug', () => {
    expect(getRouteBySlug('birmingham-mumbai')).toBeDefined();
  });

  it('airportSlug and destinationSlug point to real, existing records', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(getAirportBySlug(route.airportSlug)).toBeDefined();
    expect(getDestinationBySlug(route.destinationSlug)).toBeDefined();
    expect(route.airportSlug).toBe('birmingham');
    expect(route.destinationSlug).toBe('mumbai');
  });

  it('is resolvable via getRouteByAirportAndDestination, matching getRouteBySlug', () => {
    const bySlug = getRouteBySlug('birmingham-mumbai')!;
    const byPair = getRouteByAirportAndDestination('birmingham', 'mumbai');
    expect(byPair?.slug).toBe(bySlug.slug);
  });
});

describe('TR-017 — must display as connecting, never direct', () => {
  it('isDirect is false and getDisplayDirectness returns connecting', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.isDirect).toBe(false);
    expect(getDisplayDirectness(route, FIXED_TODAY)).toBe('connecting');
  });

  it('getRoutePresentation also reports status "connecting"', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(getRoutePresentation(route, FIXED_TODAY).status).toBe('connecting');
  });

  it('the route copy never claims a direct or non-stop service', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const proseFields = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency];
    for (const field of proseFields) {
      expect(field.toLowerCase()).not.toMatch(/\bdirect flight\b/);
      expect(field.toLowerCase()).not.toMatch(/\bnon-?stop\b/);
    }
    expect(route.intro.toLowerCase()).toMatch(/no direct/);
  });

  it('has no connectingAlternative block — never added merely to repeat the route itself, and Birmingham never had a direct Mumbai service to compare against', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.connectingAlternative).toBeUndefined();
  });
});

describe('TR-017 — official verification supports only the no-direct claim, nothing else', () => {
  it('a route-level verification record exists, sourced to Birmingham Airport\'s own route-specific page', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.verification).toBeDefined();
    expect(route.verification!.status).toBe('verified');
  });

  it('the source URL is Birmingham Airport\'s own official domain, and is specific to the Mumbai route, not a generic connections guide', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const url = route.verification!.sourceUrl!;
    expect(url).toMatch(/^https:\/\/airport\.birminghamairport\.co\.uk\//);
    expect(url).toMatch(/\/where-we-fly\/mumbai\/?$/);
  });

  it('the verification note explicitly disclaims duration, frequency, demand periods, fare behaviour, self-transfer risk and airline-hub mapping — it must not be read as supporting any of those', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const note = route.verification!.note ?? '';
    expect(note.toLowerCase()).toMatch(/no direct/);
    expect(note.toLowerCase()).toMatch(/does not.*(map|establish)/i);
    for (const mustMention of ['duration', 'frequency', 'demand', 'fare', 'self-transfer', 'hub']) {
      expect(note.toLowerCase(), `note should address "${mustMention}"`).toMatch(new RegExp(mustMention));
    }
  });

  it('the verification record does not, by itself, change the public "Connecting" display — that already follows from isDirect: false alone, independent of this record', () => {
    // Same assertion style as the pending-leakage suite's connecting-route
    // regression: a route-level verification record existing must never be
    // read as "the whole facts bundle is verified".
    const route = getRouteBySlug('birmingham-mumbai')!;
    const withVerification = getRoutePresentation(route, FIXED_TODAY);
    const withoutVerification = getRoutePresentation({ ...route, verification: undefined }, FIXED_TODAY);
    expect(withVerification.status).toBe('connecting');
    expect(withoutVerification.status).toBe('connecting');
    expect(withVerification.statusLabel).toBe(withoutVerification.statusLabel);
  });
});

describe('TR-017 — getRoutePresentation does not claim verification of the entire facts bundle', () => {
  it('no field on the presentation object equals the literal string \'verified\' — matches the general connecting-route honesty regression in verification-pending-leakage.test.ts', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    for (const [key, value] of Object.entries(p)) {
      expect(value, `presentation.${key}`).not.toBe('verified');
    }
  });

  it('canShow* flags are true only because the route is not pending, not because its facts were independently verified', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.status).not.toBe('unverified');
    expect(p.canShowBookingGuidance).toBe(true);
    expect(p.canShowPeakPeriods).toBe(true);
    expect(p.canShowConnectingAlternative).toBe(true);
  });
});

describe('TR-017 — destination and airport cross-linking', () => {
  it('Mumbai\'s ukAirports includes birmingham', () => {
    expect(getDestinationBySlug('mumbai')!.ukAirports).toContain('birmingham');
  });

  it('getRoutesByAirport("birmingham") and getRoutesByDestination("mumbai") both include the route', () => {
    expect(getRoutesByAirport('birmingham').some((r) => r.slug === 'birmingham-mumbai')).toBe(true);
    expect(getRoutesByDestination('mumbai').some((r) => r.slug === 'birmingham-mumbai')).toBe(true);
  });

  it('existing Manchester/London Heathrow Mumbai routes are unaffected — both must exist and resolve to their exact expected pair, not merely "if present"', () => {
    // Deliberately NOT `if (r) expect(...)` — a conditional assertion here
    // would silently pass even if one of these routes were accidentally
    // deleted by this change, which is exactly the regression this test
    // exists to catch.
    const manchester = getRouteByAirportAndDestination('manchester', 'mumbai');
    const heathrow = getRouteByAirportAndDestination('london-heathrow', 'mumbai');
    expect(manchester, 'manchester-mumbai must still exist').toBeDefined();
    expect(heathrow, 'london-heathrow-mumbai must still exist').toBeDefined();
    expect(manchester!.slug).toBe('manchester-mumbai');
    expect(manchester!.airportSlug).toBe('manchester');
    expect(manchester!.destinationSlug).toBe('mumbai');
    expect(heathrow!.slug).toBe('london-heathrow-mumbai');
    expect(heathrow!.airportSlug).toBe('london-heathrow');
    expect(heathrow!.destinationSlug).toBe('mumbai');
  });
});

describe('TR-017 — airline attribution: only source-supported, registry-present airlines; no hub mapping', () => {
  it('every listed airline slug resolves to a real entry in data/airlines.ts', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const resolved = getAirlinesBySlugs(route.airlineSlugs);
    expect(resolved.length).toBe(route.airlineSlugs.length);
  });

  it('the airline list matches exactly the intersection of what Birmingham Airport\'s page names and what exists in the registry: Air India, Emirates, Qatar Airways, Saudia, Turkish Airlines — never Air France/KLM/Lufthansa/Swiss (no registry entry) and never an airline the source doesn\'t name', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.airlineSlugs.slice().sort()).toEqual(['air-india', 'emirates', 'qatar-airways', 'saudia', 'turkish-airlines'].sort());
  });

  it('no airline on this route has an individual airlineVerifications record — attribution rests on the route-level source naming them collectively, not an individual per-airline claim', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.airlineVerifications).toBeUndefined();
    for (const airlineSlug of route.airlineSlugs) {
      expect(getAirlineDisplayStatus(route, airlineSlug, FIXED_TODAY), airlineSlug).toBe('unverified');
    }
  });

  it('no airline-to-hub mapping appears anywhere in the route\'s public copy — the source lists hubs and airlines separately and never pairs them, so this route must not invent a pairing either', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency].join(' ');
    // None of "<airline> via <hub>" or "<airline> (via <hub>)" patterns.
    expect(allCopy).not.toMatch(/\b(Emirates|Qatar Airways|Air India|Saudia|Turkish Airlines)\b[^.]*\bvia\b/i);
  });

  it('Doha never appears in this route\'s public copy — the live source does not name Doha as a hub for this route, only Amsterdam, Delhi, Dubai, Istanbul and Paris', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const allCopy = [route.intro, route.bookingWindowNote, route.flightTime, route.frequency, route.verification?.note ?? ''].join(' ');
    expect(allCopy).not.toMatch(/\bDoha\b/);
  });

  it('the hub cities named (where mentioned at all) are limited to what the source actually lists: Amsterdam, Delhi, Dubai, Istanbul, Paris', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const hubMentions = (route.intro.match(/\b(Amsterdam|Delhi|Dubai|Istanbul|Paris|Doha|Abu Dhabi|Riyadh|Jeddah)\b/g) ?? []);
    const allowed = new Set(['Amsterdam', 'Delhi', 'Dubai', 'Istanbul', 'Paris']);
    for (const hub of hubMentions) {
      expect(allowed.has(hub), `unexpected hub "${hub}" in intro`).toBe(true);
    }
  });
});

describe('TR-017 — no unsupported duration, frequency, urgency, demand, or fare claim', () => {
  it('flightTime states duration varies and is not independently established — no invented number', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.flightTime).not.toMatch(/\d+h(\s?\d+m)?/);
    expect(route.flightTime.toLowerCase()).toMatch(/varies|not.*established|not.*verified/);
  });

  it('frequency states that connecting options exist and must be checked — no quantified claim ("daily", "multiple daily", "Nx weekly")', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.frequency).not.toMatch(/\bdaily\b/i);
    expect(route.frequency).not.toMatch(/\bmultiple daily\b/i);
    expect(route.frequency).not.toMatch(/\d+x\s*weekly/i);
  });

  it('bookingWindowNote gives durable itinerary-comparison advice only — no cheapest period, demand surge, booking window, or urgency claim', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const note = route.bookingWindowNote.toLowerCase();
    expect(note).not.toMatch(/book (ahead|now|early|\d+ (weeks|months))/);
    expect(note).not.toMatch(/rise sharply|surge|cheapest|best time to book|demand (spike|period)/);
  });

  it('peakPeriodIds is empty — no route-specific demand pattern is asserted, and none is inferred from Mumbai\'s general festival calendar', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.peakPeriodIds).toEqual([]);
  });

  it('no deal card and no fare observation exist for this route — no fare is invented', () => {
    expect(deals.filter((d) => d.fromAirportSlug === 'birmingham' && d.toDestinationSlug === 'mumbai')).toHaveLength(0);
    expect(fareObservations.filter((o) => o.routeSlug === 'birmingham-mumbai')).toHaveLength(0);
  });
});

describe('TR-017 — existing verification-pending protections remain intact for this route', () => {
  it('if this route were hypothetically pending, getRoutePresentation would still suppress facts exactly like any other pending route (sanity check that the shared gate still applies)', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const hypotheticalPending = { ...route, isDirect: true, verification: undefined };
    const p = getRoutePresentation(hypotheticalPending, FIXED_TODAY);
    expect(p.status).toBe('unverified');
    expect(p.flightTime).toBeNull();
    expect(p.frequency).toBeNull();
    expect(p.airlineSlugs).toEqual([]);
    expect(p.canShowBookingGuidance).toBe(false);
    expect(p.canShowPeakPeriods).toBe(false);
    expect(p.canShowConnectingAlternative).toBe(false);
  });
});

describe('TR-017 — presentation integrity: metadata and social copy must reflect actual content, not a fixed template', () => {
  it('peakPeriodIds is empty for this route, which is the trigger condition for the content-aware title', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    expect(route.peakPeriodIds).toEqual([]);
  });

  it('metadataTitle does not mention "Peak Periods" or "Fare History" — neither section genuinely exists for this route', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.metadataTitle).not.toMatch(/Peak Periods/i);
    expect(p.metadataTitle).not.toMatch(/Fare History/i);
  });

  it('metadataTitle identifies this as a connecting/connection guide, not a generic "Booking Windows & Peak Periods" template', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.metadataTitle).toMatch(/Connection Guide/i);
  });

  it('generateMetadata() produces the same content-aware title end-to-end, not just at the getRoutePresentation layer', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'birmingham-mumbai' }) });
    expect(String(meta.title)).not.toMatch(/Peak Periods/i);
    expect(String(meta.title)).not.toMatch(/Fare History/i);
    expect(String(meta.title)).toMatch(/Connection Guide/i);
  });

  it('a route WITH real peak-period content (e.g. manchester-lahore) keeps the full "Booking Windows & Peak Periods" title — the fix is content-aware, not a blanket removal', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    expect(route.peakPeriodIds.length).toBeGreaterThan(0);
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.metadataTitle).toMatch(/Booking Windows & Peak Periods/);
  });

  it('socialDetail contains no numeric journey duration and no quantified frequency — the flightTime field here is a full disclaimer sentence, not a duration, so it must fall back to a restrained label rather than being shown verbatim', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.socialDetail).not.toMatch(/\d+h(\s?\d+m)?/);
    expect(p.socialDetail).not.toMatch(/\bdaily\b/i);
    expect(p.socialDetail).not.toMatch(/\d+x\s*weekly/i);
    expect(p.socialDetail.toLowerCase()).toMatch(/connecting/);
  });

  it('socialFooter does not advertise "Peak periods" or "Fare history" for this route', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.socialFooter).not.toMatch(/Peak periods/i);
    expect(p.socialFooter).not.toMatch(/Fare history/i);
    expect(p.socialFooter.toLowerCase()).toMatch(/jetstash\.co\.uk/);
  });

  it('socialDetail and socialFooter are both short enough for a 1200×630 social image with no text wrapping — a generous but real ceiling, not just "shorter than before"', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.socialDetail.length).toBeLessThanOrEqual(50);
    expect(p.socialFooter.length).toBeLessThanOrEqual(50);
  });

  it('a route with genuinely short, useful flightTime data (e.g. manchester-lahore) still shows it on the social image — the fallback is for disclaimer-length strings specifically, not connecting/direct status in general', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.socialDetail).toBe(route.flightTime);
  });
});
