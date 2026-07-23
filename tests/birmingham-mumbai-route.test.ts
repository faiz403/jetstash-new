import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
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
import RoutePage from '@/app/routes/[slug]/page';
import DestinationPage from '@/app/destinations/[slug]/page';
import { getFareSectionCopy } from '@/lib/fare-section-copy';
import { FamilyVisitBlock } from '@/components/sections/family-visit-block';

const FIXED_TODAY = '2026-07-23';

/**
 * Recursively walks a tree of React elements (as returned by calling a
 * server-component function directly, without a renderer) and collects
 * every distinct `type` encountered. Only descends into `props.children`,
 * which is enough to find elements authored directly in a component's own
 * JSX — it deliberately does not (and cannot, without a renderer) invoke
 * child components to inspect what they themselves would render, so this
 * only proves "this component's own JSX does/doesn't reference X", which is
 * exactly the leak this fix targets (a route page directly authoring a
 * FamilyVisitBlock element), not a claim about deeper indirect rendering.
 */
function collectElementTypes(node: unknown, found: Set<unknown> = new Set()): Set<unknown> {
  if (Array.isArray(node)) {
    for (const child of node) collectElementTypes(child, found);
    return found;
  }
  if (isValidElement(node)) {
    found.add(node.type);
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectElementTypes(children, found);
  }
  return found;
}

/**
 * Same traversal as collectElementTypes, but collects every string leaf
 * found in props.children instead of every element type — used to check
 * visible text content (e.g. a heading) without JSON.stringify, which
 * throws on this tree (React elements built by calling a server-component
 * function directly can carry circular references, e.g. through a module's
 * own `default` export, that JSON.stringify can't walk).
 */
function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, out);
    return out;
  }
  if (isValidElement(node)) {
    const children = (node.props as { children?: unknown } | null)?.children;
    if (children !== undefined) collectStrings(children, out);
  }
  return out;
}

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

describe('Cross-surface leakage fix — destination-level family content no longer renders on route pages', () => {
  it('Mumbai actually carries familyVisitContent, so the following "absent" assertions are meaningful, not vacuous', () => {
    expect(getDestinationBySlug('mumbai')!.familyVisitContent).toBeDefined();
  });

  it('the birmingham-mumbai route page never includes a FamilyVisitBlock element in its own JSX', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'birmingham-mumbai' }) });
    const types = collectElementTypes(element);
    expect(types.has(FamilyVisitBlock)).toBe(false);
  });

  it('manchester-mumbai — a different airport, same destination — also never includes FamilyVisitBlock: this is a systemic fix on the shared route-page template, not a patch scoped to Birmingham–Mumbai', async () => {
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-mumbai' }) });
    const types = collectElementTypes(element);
    expect(types.has(FamilyVisitBlock)).toBe(false);
  });

  it('a route whose destination has no familyVisitContent at all (manchester-dubai — Dubai) predictably also has no FamilyVisitBlock — same code path, different reason', async () => {
    expect(getDestinationBySlug('dubai')!.familyVisitContent).toBeUndefined();
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-dubai' }) });
    const types = collectElementTypes(element);
    expect(types.has(FamilyVisitBlock)).toBe(false);
  });

  it('the Mumbai destination page itself still renders FamilyVisitBlock — the fix removes the route-page leak, it does not remove the block from the context where it belongs', async () => {
    const element = await DestinationPage({ params: Promise.resolve({ slug: 'mumbai' }) });
    const types = collectElementTypes(element);
    expect(types.has(FamilyVisitBlock)).toBe(true);
  });
});

describe('Cross-surface leakage fix — FamilyVisitBlock no longer asserts a fixed demand/booking-window claim', () => {
  it('rendering the block for a destination with real peak-period content no longer claims a specific booking window or "demand peaks" — that language is gone regardless of which destination is passed in', () => {
    const mumbai = getDestinationBySlug('mumbai')!;
    expect(mumbai.familyVisitContent).toBeDefined();
    expect(mumbai.familyVisitContent!.peakPeriodIds.length).toBeGreaterThan(0);
    const element = FamilyVisitBlock({ content: mumbai.familyVisitContent!, city: mumbai.city });
    const text = collectStrings(element).join(' ');
    expect(text).not.toMatch(/When demand peaks/i);
    expect(text).not.toMatch(/book\s+\d[–-]\d\s+months?\s+ahead/i);
    expect(text).toMatch(/Key travel periods/);
  });

  it('the period labels themselves (real calendar/planning data from data/peak-periods.ts) still render — only the surrounding claim was neutralised, not the underlying content', () => {
    const mumbai = getDestinationBySlug('mumbai')!;
    const element = FamilyVisitBlock({ content: mumbai.familyVisitContent!, city: mumbai.city });
    const text = collectStrings(element).join(' ');
    expect(text).toMatch(/Diwali/i);
  });

  it('data/destinations.ts source content is unchanged by this fix — only the shared component copy changed, not any destination\'s own facts (the Manchester-specific Mumbai packingNote and the other flagged entries are a separate, reported concern, not touched here)', () => {
    const mumbai = getDestinationBySlug('mumbai')!;
    expect(mumbai.familyVisitContent!.packingNote).toMatch(/Manchester direct service/);
  });
});

describe('Cross-surface leakage fix — WhatsApp/share text is concise, honest, and free of doubled punctuation', () => {
  it('birmingham-mumbai shareText has no doubled terminal punctuation and does not splice in the full frequency or bookingWindowNote text verbatim', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.shareText).not.toMatch(/[.,]{2,}/);
    expect(p.shareText).not.toContain(route.frequency);
    expect(p.shareText).not.toContain(route.bookingWindowNote);
    expect(p.shareText.length).toBeLessThan(220);
  });

  it('the decoded WhatsApp message, built exactly as WhatsAppShareButton builds it, stays honest and free of doubled punctuation end-to-end', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    const url = 'https://jetstash.co.uk/routes/birmingham-mumbai';
    const message = `${p.shareText}\n\nFull route guide: ${url}`;
    const href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const decoded = decodeURIComponent(href.split('?text=')[1]);
    expect(decoded).toBe(message);
    expect(decoded).not.toMatch(/[.,]{2,}/);
    expect(decoded.length).toBeLessThan(320);
  });

  it('birmingham-mumbai shareText states its connecting status honestly and invents no duration/frequency', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.shareText.toLowerCase()).toMatch(/connecting route/);
    expect(p.shareText).not.toMatch(/\d+h(\s?\d+m)?/);
    expect(p.shareText).not.toMatch(/\bdaily\b/i);
  });

  it('a direct route with a short flightTime (manchester-lahore) names that real duration in shareText, but still never leaks frequency or bookingWindowNote', () => {
    const route = getRouteBySlug('manchester-lahore')!;
    const p = getRoutePresentation(route, FIXED_TODAY);
    expect(p.shareText).toContain(route.flightTime);
    expect(p.shareText).not.toContain(route.frequency);
    expect(p.shareText).not.toContain(route.bookingWindowNote);
  });

  it('pending-route share protection is unchanged by this fix — still the short, claim-free pending message, untouched by buildShareText', () => {
    const route = getRouteBySlug('birmingham-mumbai')!;
    const hypotheticalPending = { ...route, isDirect: true, verification: undefined };
    const p = getRoutePresentation(hypotheticalPending, FIXED_TODAY);
    expect(p.shareText).toMatch(/verification in progress/i);
    expect(p.shareText.length).toBeLessThan(120);
  });
});

describe('Cross-surface leakage fix — fare section heading is content-aware, not a fixed "history" claim', () => {
  // getFareSectionCopy covers all three states directly, including "has
  // observations" — which, as of this fix, has no example in real data:
  // every entry in data/fare-observations.ts is missing the
  // departureDate/returnDate pair isPubliclyPublishable requires, so
  // getPublishableObservationsByRoute is currently [] for every route. See
  // that function's doc comment in app/routes/[slug]/page.tsx.
  it('with fare history: keeps the "Fare history & current example" heading and its "checked on the date shown" caption', () => {
    const copy = getFareSectionCopy(true, true);
    expect(copy.heading).toBe('Fare history & current example');
    expect(copy.caption).toMatch(/checked on the date shown/);
  });

  it('with deals but no publishable fare history: a truthful "what we know" heading, no "history" or "example" claim', () => {
    const copy = getFareSectionCopy(false, true);
    expect(copy.heading).toBe('What we know about this route');
    expect(copy.heading).not.toMatch(/history|example/i);
    expect(copy.caption).toMatch(/haven't logged fare history/);
  });

  it('with neither deals nor fare history: "No tracked fare yet", matching what NoFareFallback actually shows below it', () => {
    const copy = getFareSectionCopy(false, false);
    expect(copy.heading).toBe('No tracked fare yet');
    expect(copy.caption).not.toMatch(/history|example/i);
  });

  it('birmingham-mumbai (no observations, no deals) renders the "No tracked fare yet" heading end-to-end on the real page', async () => {
    expect(fareObservations.filter((o) => o.routeSlug === 'birmingham-mumbai')).toHaveLength(0);
    expect(deals.filter((d) => d.fromAirportSlug === 'birmingham' && d.toDestinationSlug === 'mumbai')).toHaveLength(0);
    const element = await RoutePage({ params: Promise.resolve({ slug: 'birmingham-mumbai' }) });
    const text = collectStrings(element).join(' ');
    expect(text).toMatch(/No tracked fare yet/);
    expect(text).not.toMatch(/Fare history & current example/);
  });

  it('manchester-lahore (deals exist, but its logged observations lack the dates isPubliclyPublishable requires) renders the "What we know about this route" heading end-to-end, not the history heading', async () => {
    expect(deals.some((d) => d.fromAirportSlug === 'manchester' && d.toDestinationSlug === 'lahore')).toBe(true);
    const element = await RoutePage({ params: Promise.resolve({ slug: 'manchester-lahore' }) });
    const text = collectStrings(element).join(' ');
    expect(text).toMatch(/What we know about this route/);
    expect(text).not.toMatch(/Fare history & current example/);
  });
});
