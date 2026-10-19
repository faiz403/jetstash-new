import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, getPublishableObservationsByRoute } from '@/data/fare-observations';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { deals, getDealAirlineLabel, hasTrackedFare } from '@/data/deals';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getRouteVerificationEvidence } from '@/lib/route-verification-evidence';
import { routeStatusLabel } from '@/components/destination/destination-flight-guides';

/**
 * B1 route re-verification, Batch 1 (19 October 2026). Guards the founder-
 * approved corrections to public route claims on the 15 routes whose route
 * review was overdue while they still displayed fares. Evidence lives
 * outside the repository (b1-batch1-route-report-2026-10-19.md). Route
 * verification only: nothing here verifies a fare.
 */

const NOW = '2026-10-19';

function route(slug: string): Route {
  const found = getRouteBySlug(slug);
  if (!found) throw new Error(`missing route ${slug}`);
  return found;
}

function presentation(slug: string) {
  return getEffectiveRoutePresentation(route(slug), routeStatusEvents, NOW);
}

/** Every customer-facing string the route record can contribute to a page. */
function publicText(r: Route): string {
  const alt = r.connectingAlternative;
  return [
    r.flightTime,
    r.frequency,
    r.intro,
    r.bookingWindowNote,
    alt ? [...alt.hubAirports, ...alt.typicalAirlines, alt.typicalJourneyTime].join(' ') : '',
  ].join(' ');
}

describe('Manchester to Jeddah fails closed while a possible Saudia nonstop is unconfirmed', () => {
  it('is verification-pending, so no schedule claim, booking guidance or connecting alternative renders', () => {
    const p = presentation('manchester-jeddah');
    expect(p.status).toBe('unverified');
    expect(p.flightTime).toBeNull();
    expect(p.frequency).toBeNull();
    expect(p.canShowBookingGuidance).toBe(false);
    expect(p.canShowConnectingAlternative).toBe(false);
  });

  it('no longer carries the unsupported Doha, 10-hour, daily or no-direct claims anywhere in the record', () => {
    const r = route('manchester-jeddah');
    const text = publicText(r);
    expect(text).not.toMatch(/Doha/);
    expect(text).not.toMatch(/10h/);
    expect(text).not.toMatch(/\bDaily\b/i);
    expect(text).not.toMatch(/no current direct/i);
    expect(r.airlineSlugs).toEqual([]);
    expect(r.verification?.status).toBe('unverified');
  });

  it('does not assert that a Saudia nonstop is confirmed', () => {
    const r = route('manchester-jeddah');
    expect(r.airlineSlugs).not.toContain('saudia');
    expect(publicText(r)).not.toMatch(/Saudia/);
    expect(r.verification?.note).toMatch(/not confirmation from Saudia/);
  });

  it('keeps its original 4 October audit dates and history rather than being re-dated', () => {
    const v = route('manchester-jeddah').verification!;
    expect(v.verifiedDate).toBe('2026-10-04');
    expect(v.reviewDueDate).toBe('2026-10-18');
    expect(v.sourceName).toBe('JetStash portfolio evidence audit');
    expect(v.note).toMatch(/^No qualifying route-level source is recorded/);
    expect(v.note).toContain('B1 route re-verification (19 October 2026)');
  });

  it('shows no fare: observations stay in the archive but none is publishable, and the Fare Signal is empty', () => {
    expect(fareObservations.some((o) => o.routeSlug === 'manchester-jeddah')).toBe(true);
    expect(getPublishableObservationsByRoute('manchester-jeddah', NOW)).toHaveLength(0);
    expect(getFareSignalForRoute('manchester-jeddah', NOW).state).toBe('none');
  });

  it('its curated deal card shows no tracked fare and no named airline', () => {
    const deal = deals.find((d) => d.id === 'man-jed-economy')!;
    expect(hasTrackedFare(deal, NOW)).toBe(false);
    expect(getDealAirlineLabel(deal, NOW)).toBe('Verification pending');
  });
});

describe('Manchester to Amritsar no longer lists IndiGo or unsourced timings', () => {
  it('drops IndiGo, British Airways and Air India, keeping only Qatar Airways', () => {
    const r = route('manchester-amritsar');
    expect(r.airlineSlugs).toEqual(['qatar-airways']);
    expect(r.connectingAlternative).toBeUndefined();
    expect(publicText(r)).not.toMatch(/IndiGo/);
  });

  it('hedges journey time, stops and frequency, and no longer calls the Birmingham and Gatwick services "genuine direct"', () => {
    const text = publicText(route('manchester-amritsar'));
    expect(text).not.toMatch(/13h 20m/);
    expect(text).not.toMatch(/usually 1 stop/);
    expect(text).not.toMatch(/Multiple daily/);
    expect(text).not.toMatch(/genuine direct/);
  });

  it('does not name Birmingham or Gatwick as current Amritsar alternatives', () => {
    const text = publicText(route('manchester-amritsar'));
    expect(text).not.toMatch(/Gatwick/);
    expect(text).not.toMatch(/Birmingham/);
  });
});

describe('Manchester to Ahmedabad no longer carries the unsourced booking statistic', () => {
  it('removes the "large majority" claim and the unsourced hubs and timings', () => {
    const r = route('manchester-ahmedabad');
    const text = publicText(r);
    expect(text).not.toMatch(/large majority/i);
    expect(text).not.toMatch(/booked on this route/i);
    expect(text).not.toMatch(/Around 13h/);
    expect(text).not.toMatch(/Multiple daily/);
    expect(text).not.toMatch(/UK's only direct/);
    // The London airport for that service is unresolved in its own record,
    // so no other airport is named in its place.
    expect(text).not.toMatch(/Gatwick|Heathrow|London/);
    expect(r.airlineSlugs).toEqual(['qatar-airways']);
    expect(r.connectingAlternative).toBeUndefined();
  });
});

describe('Madinah routes keep only the airline-sourced operator', () => {
  it('Manchester to Madinah lists only Turkish Airlines and no unsourced timing or Doha-based Jeddah claim', () => {
    const r = route('manchester-madinah');
    const text = publicText(r);
    expect(r.airlineSlugs).toEqual(['turkish-airlines']);
    expect(r.connectingAlternative).toBeUndefined();
    expect(text).not.toMatch(/9h 15m/);
    expect(text).not.toMatch(/EgyptAir|Royal Jordanian/);
    expect(text).not.toMatch(/Doha/);
  });

  it('Birmingham to Madinah lists only Turkish Airlines and no unsourced timing or frequency', () => {
    const r = route('birmingham-madinah');
    const text = publicText(r);
    expect(r.airlineSlugs).toEqual(['turkish-airlines']);
    expect(text).not.toMatch(/8h 50m/);
    expect(text).not.toMatch(/\bDaily\b/);
    expect(text).not.toMatch(/Qatar Airways via Doha|Saudia via Jeddah/);
  });

  it('Birmingham to Madinah booking advice compares itineraries neutrally, without unsourced price or time claims', () => {
    const note = route('birmingham-madinah').bookingWindowNote;
    expect(note).not.toMatch(/price lower|cheaper/i);
    expect(note).not.toMatch(/smaller than expected/i);
    expect(note).toMatch(/Check the exact itineraries, total journey time and current fares/);
    expect(presentation('birmingham-madinah').canShowBookingGuidance).toBe(true);
  });
});

describe('PIA routings stay dated observations, not standing claims', () => {
  for (const slug of ['birmingham-lahore', 'birmingham-islamabad']) {
    it(`${slug} keeps the 21 August Istanbul observation as dated wording only`, () => {
      const r = route(slug);
      expect(r.routeServiceConnections).toBeUndefined();
      expect(r.flightTime).not.toMatch(/^Connecting via Istanbul/);
      expect(r.intro).toContain('When checked on 21 August 2026');
      expect(r.intro).not.toMatch(/^PIA sells/);
    });
  }

  it('manchester-karachi no longer states in the present tense that PIA sells the route', () => {
    expect(route('manchester-karachi').intro).not.toMatch(/^PIA sells/);
  });
});

describe('ended IndiGo direct services stay documented without implying connecting travel ended', () => {
  for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
    it(`${slug} still presents as service-ended with its lapsed record untouched, and still shows a connecting fare`, () => {
      const r = route(slug);
      expect(presentation(slug).status).toBe('service-ended');
      expect(r.verification?.verifiedDate).toBe('2026-07-23');
      expect(r.verification?.reviewDueDate).toBe('2026-08-31');
      expect(presentation(slug).canShowConnectingAlternative).toBe(true);
      expect(r.connectingAlternative).toBeDefined();
      expect(getFareSignalForRoute(slug, NOW).state).toBe('current');
    });
  }

  it('manchester-mumbai no longer claims a 12 to 14 hour connecting journey', () => {
    expect(route('manchester-mumbai').connectingAlternative?.typicalJourneyTime).not.toMatch(/12 to 14h/);
  });
});

describe('Birmingham to Delhi keeps the Air India versus Birmingham Airport conflict visible', () => {
  it('records both sources, keeps the via-Amritsar claim and keeps frequency hedged', () => {
    const r = route('birmingham-delhi');
    expect(r.verification?.note).toContain('No direct flights available');
    expect(r.verification?.note).toContain('Airlines that fly direct: Air India');
    expect(r.verification?.note).toMatch(/conflict/);
    expect(r.flightTime).toMatch(/via Amritsar/);
    expect(r.frequency).toMatch(/not independently re-verified/);
    expect(presentation('birmingham-delhi').status).toBe('connecting');
  });
});

describe('verification records are only re-dated where the reread primary source supports it', () => {
  it('re-dates only Birmingham to Mumbai and Birmingham to Delhi, on their existing 45-day cadence', () => {
    for (const slug of ['birmingham-mumbai', 'birmingham-delhi']) {
      const v = route(slug).verification!;
      expect(v.status, slug).toBe('verified');
      expect(v.verifiedDate, slug).toBe('2026-10-19');
      expect(v.reviewDueDate, slug).toBe('2026-12-03');
    }
  });

  it('leaves every inconclusive or otherwise unconfirmed record on its original, lapsed review date', () => {
    const expected: Record<string, string> = {
      'manchester-jeddah': '2026-10-18',
      'manchester-karachi': '2026-10-05',
      'birmingham-lahore': '2026-10-05',
      'birmingham-islamabad': '2026-10-05',
      'manchester-dhaka': '2026-10-02',
      'manchester-amritsar': '2026-10-18',
      'manchester-ahmedabad': '2026-10-18',
      'manchester-madinah': '2026-10-18',
      'birmingham-madinah': '2026-10-18',
      'leeds-bradford-amritsar': '2026-10-18',
      'leeds-bradford-islamabad': '2026-10-18',
    };
    for (const [slug, due] of Object.entries(expected)) {
      expect(route(slug).verification?.reviewDueDate, slug).toBe(due);
      expect(route(slug).verification?.reviewDueDate! < NOW, slug).toBe(true);
    }
  });

  it('never labels a corrected unverified record as verified', () => {
    for (const slug of ['manchester-jeddah', 'manchester-amritsar', 'manchester-ahmedabad', 'manchester-madinah', 'birmingham-madinah']) {
      expect(route(slug).verification?.status, slug).toBe('unverified');
    }
  });
});

describe('homepage route atlas respects the route presentation and verification-freshness gates', () => {
  const airports = buildAtlasAirports(NOW);
  const points = airports.flatMap((a) => a.countries.flatMap((c) => c.destinations));

  function atlasPoint(slug: string) {
    const found = points.find((p) => p.routeHref === `/routes/${slug}`);
    if (!found) throw new Error(`no atlas point for ${slug}`);
    return found;
  }

  it('pending: Manchester to Jeddah reads as being re-checked, never as a direct service, and exposes no raw note or schedule', () => {
    const p = atlasPoint('manchester-jeddah');
    expect(p.verdict).toMatch(/being re-checked/);
    expect(p.verdict).not.toMatch(/direct (service|flight)|nonstop/i);
    expect(p.detail).toBeNull();
    expect(p.flightTime).toBe('Schedule and journey time being re-checked');
  });

  it('overdue: a lapsed verified connecting record is shown as historical evidence, not as current confirmation', () => {
    for (const slug of ['manchester-karachi', 'birmingham-lahore', 'birmingham-islamabad']) {
      const p = atlasPoint(slug);
      expect(p.verdict, slug).not.toMatch(/verified/i);
      expect(p.verdict, slug).toMatch(/^Modelled as a connecting route/);
      expect(p.detail, slug).toBe('Last confirmed 21 August 2026; due for a fresh check.');
    }
  });

  it('current: a freshly re-dated connecting route is shown as verified with its check date', () => {
    const p = atlasPoint('birmingham-mumbai');
    expect(p.verdict).toBe('Connecting route verified — no direct service currently exists.');
    expect(p.detail).toBe('Checked 19 October 2026.');
  });

  it('current direct: a direct route with a current record still reads "Direct service verified."', () => {
    const r = route('manchester-istanbul');
    expect(r.verification?.reviewDueDate! >= NOW).toBe(true);
    expect(atlasPoint('manchester-istanbul').verdict).toBe('Direct service verified.');
  });

  it('ended: Manchester to Mumbai and Delhi say the direct service ended, without claiming connecting travel ended', () => {
    for (const slug of ['manchester-mumbai', 'manchester-delhi']) {
      const p = atlasPoint(slug);
      expect(p.verdict, slug).toBe('Direct service ended — check current options directly with the airline.');
      expect(p.flightTime, slug).toMatch(/^Direct service ended/);
      expect(`${p.verdict} ${p.detail ?? ''}`, slug).not.toMatch(/connecting (flights|options|travel) (have |has )?ended/i);
    }
  });

  it('portfolio-wide: no atlas point calls a route verified unless its presentation is backed by a current record', () => {
    for (const r of routes) {
      const p = points.find((point) => point.routeHref === `/routes/${r.slug}`);
      if (!p || !/verified\./i.test(p.verdict) && !/route verified/i.test(p.verdict)) continue;
      const current = isCurrent(r);
      expect(current, `${r.slug}: "${p.verdict}"`).toBe(true);
    }
  });

  it('portfolio-wide: every pending route uses the neutral re-check copy and never its raw flightTime or note', () => {
    for (const r of routes) {
      if (getEffectiveRoutePresentation(r, routeStatusEvents, NOW).status !== 'unverified') continue;
      const p = points.find((point) => point.routeHref === `/routes/${r.slug}`);
      if (!p) continue;
      expect(p.verdict, r.slug).toMatch(/being re-checked/);
      expect(p.flightTime, r.slug).not.toBe(r.flightTime);
      expect(p.detail, r.slug).toBeNull();
    }
  });
});

function isCurrent(r: Route): boolean {
  const due = (v: { status: string; reviewDueDate: string } | undefined) => Boolean(v && v.status === 'verified' && v.reviewDueDate >= NOW);
  return due(r.verification) || (r.airlineVerifications ?? []).some((v) => due(v));
}

describe('Leeds Bradford to Islamabad booking advice no longer asserts an unsourced outcome', () => {
  it('drops the "both cheaper and faster" claim and advises comparing the whole journey', () => {
    const note = route('leeds-bradford-islamabad').bookingWindowNote;
    expect(note).not.toMatch(/cheaper|faster|many Bradford-based travellers/i);
    expect(note).toMatch(/total fare, travel to the departure airport, connections, layovers and overall journey time/);
  });
});

describe('destination pages use the same verification-evidence reading as the atlas', () => {
  function label(destinationSlug: string, routeSlug: string): string {
    const entry = getDestinationFlightGuideEntries(getDestinationBySlug(destinationSlug)!, NOW).find((e) => e.routeSlug === routeSlug);
    if (!entry) throw new Error(`no destination entry for ${routeSlug}`);
    return routeStatusLabel(entry);
  }

  it('current: a connecting route with a current record is labelled verified', () => {
    expect(label('mumbai', 'birmingham-mumbai')).toBe('Connecting route verified');
    expect(label('delhi', 'birmingham-delhi')).toBe('Connecting route verified');
  });

  it('overdue: a lapsed verified connecting record says when it was last confirmed, not that it is verified', () => {
    expect(label('karachi', 'manchester-karachi')).toBe('Connecting route · last confirmed 21 August 2026');
    expect(label('lahore', 'birmingham-lahore')).toBe('Connecting route · last confirmed 21 August 2026');
    expect(label('dhaka', 'manchester-dhaka')).toBe('Connecting route · last confirmed 18 August 2026');
  });

  it('never verified: a connecting route with an unverified record is labelled plainly, without implying verification', () => {
    expect(label('amritsar', 'manchester-amritsar')).toBe('Connecting route');
    expect(label('madinah', 'manchester-madinah')).toBe('Connecting route');
  });

  it('pending: Manchester to Jeddah reads as verification pending', () => {
    expect(label('jeddah', 'manchester-jeddah')).toBe('Route verification pending');
  });

  it('ended: Manchester to Mumbai and Delhi name the ended direct service, never an operating one', () => {
    expect(label('mumbai', 'manchester-mumbai')).toBe('Direct service ended');
    expect(label('delhi', 'manchester-delhi')).toBe('Direct service ended');
  });

  it('current direct: a direct route with a current record still reads "Direct service verified"', () => {
    expect(label('istanbul', 'manchester-istanbul')).toBe('Direct service verified');
  });

  it('portfolio-wide: no destination-page label says "verified" without current evidence', () => {
    for (const destination of destinations) {
      for (const entry of getDestinationFlightGuideEntries(destination, NOW)) {
        if (!entry.routeSlug) continue;
        const text = routeStatusLabel(entry);
        if (!/verified/i.test(text)) continue;
        const r = route(entry.routeSlug);
        const backed = entry.routeStatus === 'direct' || getRouteVerificationEvidence(r, NOW).state === 'current';
        expect(backed, `${entry.routeSlug}: "${text}"`).toBe(true);
      }
    }
  });

  it('the atlas and destination pages agree on which connecting routes are verified', () => {
    const points = buildAtlasAirports(NOW).flatMap((a) => a.countries.flatMap((c) => c.destinations));
    for (const destination of destinations) {
      for (const entry of getDestinationFlightGuideEntries(destination, NOW)) {
        if (entry.routeStatus !== 'connecting' || !entry.routeSlug) continue;
        const point = points.find((p) => p.routeHref === `/routes/${entry.routeSlug}`);
        if (!point) continue;
        const atlasVerified = point.verdict.startsWith('Connecting route verified');
        const destinationVerified = routeStatusLabel(entry) === 'Connecting route verified';
        expect(atlasVerified, entry.routeSlug).toBe(destinationVerified);
      }
    }
  });
});

describe('public fare gate stays fail-closed across the whole portfolio', () => {
  it('no verification-pending route has a publishable fare or a Fare Signal', () => {
    for (const r of routes) {
      if (getEffectiveRoutePresentation(r, routeStatusEvents, NOW).status !== 'unverified') continue;
      expect(getPublishableObservationsByRoute(r.slug, NOW), r.slug).toHaveLength(0);
      expect(getFareSignalForRoute(r.slug, NOW).state, r.slug).toBe('none');
    }
  });
});
