import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { routes, getRouteBySlug, getDisplayDirectness } from '@/data/routes';
import { getPublishableObservationsByRoute, isPubliclyPublishable, isObservationPublishable, fareObservations } from '@/data/fare-observations';
import { getActiveWarningsByRoute } from '@/data/route-warnings';
import { isBookByRoute } from '@/lib/booking-intelligence';
import { getTripComRouteUrl } from '@/lib/booking-providers';
import { travellerTips } from '@/data/traveller-tips';
import { computeRouteIntelligenceLevel } from '@/lib/atlas-network-data';

/**
 * Route Completion Batch 1 (August 2026) — Manchester-Dubai and
 * Manchester-Doha. See docs/project-control/ROUTE_COVERAGE_AUDIT.md's
 * "Batch 1 completion record" and its 6 August addendum for the full audit
 * this suite guards.
 *
 * Manchester-Dubai's grade changed from 'useful' to 'strong' on 6 August
 * 2026 — a mechanical consequence of a real, reviewed, approved fare
 * observation clearing the unchanged two-category threshold, never a
 * manual override. Manchester-Doha remains 'useful' throughout — every
 * assertion here is designed to fail loudly if either changes without
 * genuine new evidence, or if Doha is ever closed by gaming the score.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);
const BATCH_1_SLUGS = ['manchester-dubai', 'manchester-doha'] as const;
const NEW_DUBAI_OBS_ID = 'obs-man-dxb-economy-20260806-8w-v1';

describe('Batch 1 route service state is unchanged', () => {
  it('Manchester-Dubai is still a direct, route-level-verified route — unaffected by the fare observation', () => {
    const route = getRouteBySlug('manchester-dubai')!;
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('verified');
    expect(route.airlineSlugs).toEqual(['emirates']);
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('direct');
  });

  it('Manchester-Doha is still a direct, route-level-verified route — unaffected by this batch', () => {
    const route = getRouteBySlug('manchester-doha')!;
    expect(route.isDirect).toBe(true);
    expect(route.verification?.status).toBe('verified');
    expect(route.airlineSlugs).toEqual(['qatar-airways']);
    expect(getDisplayDirectness(route, NOW_ISO)).toBe('direct');
  });
});

describe('The baggage-guidance entry is tied to a real source record, not invented', () => {
  const dubaiBaggageTip = travellerTips.find((t) => t.id === 'manchester-dubai-emirates-baggage-weight');

  it('exists, is scoped only to manchester-dubai (never destinationSlug, which would leak to Glasgow/Edinburgh/Newcastle-Dubai)', () => {
    expect(dubaiBaggageTip).toBeDefined();
    expect(dubaiBaggageTip!.scope.routeSlug).toBe('manchester-dubai');
    expect(dubaiBaggageTip!.scope.destinationSlug).toBeUndefined();
  });

  it('is categorised as baggage and carries a checked date', () => {
    expect(dubaiBaggageTip!.category).toBe('baggage');
    expect(dubaiBaggageTip!.addedDate).toBe('2026-08-06');
  });

  it('states a real, checkable claim, not an unsupported cheapest/fastest/guaranteed/stable-fare claim', () => {
    const forbidden = /\b(cheapest|fastest|safest|guaranteed|stable[- ]fare|best price)\b/i;
    expect(dubaiBaggageTip!.body).not.toMatch(forbidden);
    expect(dubaiBaggageTip!.title).not.toMatch(forbidden);
    expect(dubaiBaggageTip!.body).toContain('32kg');
  });

  it('no equivalent baggage tip was added for Manchester-Doha — the archive is honest that Qatar\'s figure could not be sourced', () => {
    const dohaBaggageTip = travellerTips.find(
      (t) => t.category === 'baggage' && (t.scope.routeSlug === 'manchester-doha' || t.scope.destinationSlug === 'doha')
    );
    expect(dohaBaggageTip).toBeUndefined();
  });

  it('does not claim more precision than the source states: no "checked baggage weight", no "Manage Booking"', () => {
    expect(dubaiBaggageTip!.body).not.toContain('checked baggage weight');
    expect(dubaiBaggageTip!.body).not.toContain('Manage Booking');
  });

  it('discloses that this is Emirates\' general policy, not a fact unique to the Manchester-Dubai city pair', () => {
    expect(dubaiBaggageTip!.body.toLowerCase()).toContain('general baggage rule');
  });
});

describe('No unsupported claim wording was introduced anywhere in this batch\'s new content', () => {
  const forbidden = /\b(cheapest|fastest|safest|guaranteed|stable[- ]fare)\b/i;

  it('every traveller tip in the file is free of the forbidden claim words', () => {
    for (const tip of travellerTips) {
      expect(tip.body, tip.id).not.toMatch(forbidden);
      expect(tip.title, tip.id).not.toMatch(forbidden);
    }
  });

  it('the new fare observation\'s priceNote is free of the forbidden claim words, and never asserts a "<9 left"-style live-availability claim or an assumed timezone', () => {
    const obs = fareObservations.find((o) => o.id === NEW_DUBAI_OBS_ID)!;
    expect(obs.priceNote).not.toMatch(forbidden);
    expect(obs.priceNote).not.toMatch(/left\b/i);
    expect(obs.priceNote.toLowerCase()).not.toContain('13:41');
    expect(obs.priceNote.toLowerCase()).not.toContain('13:54');
  });
});

describe('Trip.com route hand-offs for both Batch 1 routes are unchanged', () => {
  it('Manchester-Dubai keeps its exact, pre-existing Trip.com URL', () => {
    const url = getTripComRouteUrl('manchester-dubai');
    expect(url).toBe(
      'https://www.trip.com/flights/Manchester-to-Dubai/tickets-MAN-DXB?flighttype=S&dcity=MAN&acity=DXB&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082331'
    );
  });

  it('Manchester-Doha keeps its exact, pre-existing Trip.com URL', () => {
    const url = getTripComRouteUrl('manchester-doha');
    expect(url).toBe(
      'https://www.trip.com/flights/Manchester-to-Doha/tickets-MAN-DOH?flighttype=S&dcity=MAN&acity=DOH&Allianceid=9804124&SID=327450313&trip_sub1=&trip_sub3=D19082646'
    );
  });
});

describe('Manchester-Dubai\'s new fare observation matches the approved specification exactly', () => {
  const obs = fareObservations.find((o) => o.id === NEW_DUBAI_OBS_ID);

  it('exists with exactly the approved id, route, cabin and price', () => {
    expect(obs).toBeDefined();
    expect(obs!.routeSlug).toBe('manchester-dubai');
    expect(obs!.cabin).toBe('Economy');
    expect(obs!.price).toBe(480);
    expect(obs!.currency).toBe('GBP');
  });

  it('records the exact approved travel dates and checked date', () => {
    expect(obs!.departureDate).toBe('2026-10-01');
    expect(obs!.returnDate).toBe('2026-10-15');
    expect(obs!.observedDate).toBe('2026-08-06');
  });

  it('records the source airline and provider exactly as approved', () => {
    expect(obs!.source).toBe('Gulf Air');
    expect(obs!.observedVia).toBe('trip.com');
  });

  it('records baggage as "not stated" — never inferred from the ambiguous "Included" badge as a confirmed allowance', () => {
    expect(obs!.baggage).toBe('not stated');
    expect(obs!.baggage?.toLowerCase()).not.toContain('included');
    expect(obs!.baggage?.toLowerCase()).not.toMatch(/\d+\s*kg/);
  });

  it('follows the methodology: a stable profileId and a valid observationReason', () => {
    expect(obs!.profileId).toBe('manchester-dubai-economy-1adult-baseline-v1');
    expect(obs!.observationReason).toBe('routine-weekly');
  });

  it('is the only new observation added — Manchester-Dubai\'s two historic entries are untouched', () => {
    const dubaiObs = fareObservations.filter((o) => o.routeSlug === 'manchester-dubai');
    expect(dubaiObs.length).toBe(3);
    const historic = dubaiObs.filter((o) => o.id !== NEW_DUBAI_OBS_ID);
    expect(historic.length).toBe(2);
    for (const o of historic) {
      expect(o.departureDate, o.id).toBeUndefined();
      expect(o.returnDate, o.id).toBeUndefined();
      expect(isPubliclyPublishable(o), o.id).toBe(false);
    }
  });

  it('passes isPubliclyPublishable() and isObservationPublishable() — the exact gates required before public display', () => {
    expect(isPubliclyPublishable(obs!)).toBe(true);
    const route = getRouteBySlug('manchester-dubai')!;
    expect(isObservationPublishable(obs!, route, NOW_ISO)).toBe(true);
  });

  it('is the sole publishable observation for the route today', () => {
    const publishable = getPublishableObservationsByRoute('manchester-dubai', NOW_ISO);
    expect(publishable.length).toBe(1);
    expect(publishable[0].id).toBe(NEW_DUBAI_OBS_ID);
  });
});

describe('Manchester-Doha\'s original fare observation is untouched by this round', () => {
  it('same id, price, dates as before — no fabricated observation was added to close its gap', () => {
    const obs = fareObservations.find((o) => o.id === 'obs-man-doh-economy-20260805-8w-v1');
    expect(obs).toBeDefined();
    expect(obs!.price).toBe(411);
    expect(obs!.departureDate).toBe('2026-09-30');
    expect(obs!.returnDate).toBe('2026-10-14');
    // A second, genuinely separate observation was added later the same
    // week by Fare Coverage Expansion Batch A (obs-man-doh-economy-20260806-8w-v1,
    // a real nonstop Qatar Airways result) - this test's own scope is only
    // that THIS specific historic record (20260805) was never edited, not
    // that no further observation could ever legitimately be added.
    expect(getPublishableObservationsByRoute('manchester-doha', NOW_ISO).length).toBe(2);
  });

  it('an incomplete fare record (missing dates) can never become publishable, regardless of route status', () => {
    const incomplete = { id: 'test-incomplete', routeSlug: 'manchester-dubai', cabin: 'Economy' as const, observedDate: NOW_ISO, price: 100, priceNote: 'test', source: 'test' };
    expect(isPubliclyPublishable(incomplete)).toBe(false);
  });
});

describe('Atlas grade reflects the real, current evidence for both routes — Dubai\'s promotion is mechanical, not a manual override', () => {
  it('Manchester-Dubai now has exactly two depth categories (baggage + fare) and is genuinely "strong"', () => {
    const route = getRouteBySlug('manchester-dubai')!;
    const hasFare = getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0;
    const hasConnAlt = Boolean(route.connectingAlternative);
    const hasAirlineVerif = Boolean(route.airlineVerifications?.length);
    const hasBookBy = isBookByRoute(route.slug);
    const hasWarning = getActiveWarningsByRoute(route.slug).length > 0;
    const hasBaggage = travellerTips.some((t) => t.category === 'baggage' && (t.scope.routeSlug === route.slug || t.scope.destinationSlug === route.destinationSlug));
    const categoryCount = [hasFare, hasConnAlt, hasAirlineVerif, hasBookBy, hasWarning, hasBaggage].filter(Boolean).length;

    expect(hasBaggage, 'Batch 1 baggage addition should still be picked up').toBe(true);
    expect(hasFare, 'the 6 August 2026 observation should now be publishable').toBe(true);
    expect(hasBookBy, 'Book-By priority must never be added just to move this grade').toBe(false);
    expect(categoryCount).toBe(2);
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('strong');
  });

  it('Manchester-Doha stays at exactly one depth category (fare only) and stays "useful" — never upgraded artificially', () => {
    const route = getRouteBySlug('manchester-doha')!;
    const hasFare = getPublishableObservationsByRoute(route.slug, NOW_ISO).length > 0;
    const hasConnAlt = Boolean(route.connectingAlternative);
    const hasAirlineVerif = Boolean(route.airlineVerifications?.length);
    const hasBookBy = isBookByRoute(route.slug);
    const hasWarning = getActiveWarningsByRoute(route.slug).length > 0;
    const hasBaggage = travellerTips.some((t) => t.category === 'baggage' && (t.scope.routeSlug === route.slug || t.scope.destinationSlug === route.destinationSlug));
    const categoryCount = [hasFare, hasConnAlt, hasAirlineVerif, hasBookBy, hasWarning, hasBaggage].filter(Boolean).length;

    expect(hasFare).toBe(true);
    expect(hasBaggage, 'no genuine Qatar Airways baggage source was found — must not be fabricated').toBe(false);
    expect(hasBookBy, 'Book-By priority must never be added just to close this gap').toBe(false);
    expect(hasWarning, 'no filler warning must ever be added to close this gap').toBe(false);
    expect(categoryCount).toBe(1);
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('useful');
  });
});

describe('Route warnings remain separate and untouched for both Batch 1 routes', () => {
  it('neither route has any active warning — none was added or fabricated to close the depth gap', () => {
    expect(getActiveWarningsByRoute('manchester-dubai').length).toBe(0);
    expect(getActiveWarningsByRoute('manchester-doha').length).toBe(0);
  });
});

describe('No unrelated route was changed by this batch', () => {
  it('data/routes.ts still has exactly 32 routes', () => {
    expect(routes.length).toBe(32);
  });

  it('the traveller-tips file still has exactly the same 11 entries — this round added no new tip', () => {
    expect(travellerTips.length).toBe(11);
  });

  it('grading is unchanged for a sample of routes outside this batch', () => {
    const lahore = getRouteBySlug('manchester-lahore')!;
    const bengaluru = getRouteBySlug('london-heathrow-bengaluru')!;
    expect(computeRouteIntelligenceLevel(lahore, NOW_ISO)).toBe('strong');
    expect(computeRouteIntelligenceLevel(bengaluru, NOW_ISO)).toBe('useful');
  });

  it('every fare observation dated 2026-08-06 belongs to either Route Completion Batch 1 or a documented, separate later initiative', () => {
    // This originally asserted the two Batch 1 routes were the ONLY routes
    // observed on this calendar date - a fragile invariant, since a real
    // date can legitimately be shared by an unrelated later initiative.
    // Fare Coverage Expansion Batch A (FARE_OBSERVATION_ARCHIVE.md, started
    // the same week) added manchester-lahore's own 2026-08-06 observation -
    // expected, not scope creep from this batch. Any route added here must
    // be explicitly accounted for, never silently allowed.
    const knownBatchARoutesSoFar: readonly string[] = [
      'manchester-lahore',
      'manchester-islamabad',
      'manchester-delhi',
      'manchester-mumbai',
      'manchester-ahmedabad',
      'manchester-amritsar',
      'manchester-doha',
      'manchester-madinah',
      'birmingham-amritsar',
    ];
    const allowedSlugs = [...(BATCH_1_SLUGS as readonly string[]), ...knownBatchARoutesSoFar];
    const newlyObserved = fareObservations.filter((o) => o.observedDate === '2026-08-06');
    for (const o of newlyObserved) {
      expect(allowedSlugs.includes(o.routeSlug), o.id).toBe(true);
    }
  });
});

describe('Evidence for the 6 August 2026 fare check is retained and honestly describes its own limitations', () => {
  const evidencePath = join(process.cwd(), 'docs/project-control/fare-evidence/manchester-dubai-2026-08-06.md');

  it('the evidence file exists at the documented path', () => {
    expect(existsSync(evidencePath)).toBe(true);
  });

  it('discloses honestly that the screenshot PNG files were not persisted or committed — never implies image files exist that do not', () => {
    const doc = readFileSync(evidencePath, 'utf8');
    expect(doc.toLowerCase()).toContain('no png, jpg, or any other image evidence file was persisted or committed');
    expect(doc.toLowerCase()).toContain('this is not a substitute claim that image evidence is archived');
  });

  it('states unambiguously that screenshots were viewed live and this file is a contemporaneous transcription, not a later reconstruction', () => {
    const doc = readFileSync(evidencePath, 'utf8');
    expect(doc.toLowerCase()).toContain('two screenshots were viewed during the live browser session');
    expect(doc.toLowerCase()).toContain('this markdown file is a contemporaneous transcription');
  });

  it('cites the exact archive-methodology sections confirming this level of evidence is permitted, without weakening the observation', () => {
    const doc = readFileSync(evidencePath, 'utf8');
    expect(doc).toContain('### Methodology compliance');
    expect(doc.toLowerCase()).toContain('neither section requires a persisted image file of any');
    expect(doc.toLowerCase()).toContain('required record fields');
    expect(doc.toLowerCase()).toContain('review standard');
    // The doc legitimately contains "non-publishable" inside a negation
    // ("not ... non-publishable on evidence grounds") — assert the positive
    // claim never appears instead of a naive substring check.
    expect(doc.toLowerCase()).not.toMatch(/\bis non-publishable\b/);
    expect(doc.toLowerCase()).not.toContain('provisionally reviewed');
    expect(doc.toLowerCase()).toContain('not weakened, provisional, or non-publishable');
  });

  it('records that baggage was confirmed absent by direct DOM inspection, not assumed from the "Included" badge', () => {
    const doc = readFileSync(evidencePath, 'utf8');
    expect(doc.toLowerCase()).toContain('no explicit checked-baggage or cabin-baggage allowance');
  });

  it('does not record "<9 left" as a durable fact, and does not assume a timezone for the page\'s own timestamp', () => {
    const doc = readFileSync(evidencePath, 'utf8');
    expect(doc).toContain('Explicitly not recorded as durable facts');
    expect(doc.toLowerCase()).toContain('no stated timezone');
  });
});

describe('The audit and fare-archive documents accurately reflect the closed observation and its content-depth review', () => {
  const auditDoc = readFileSync(join(process.cwd(), 'docs/project-control/ROUTE_COVERAGE_AUDIT.md'), 'utf8');
  const archiveDoc = readFileSync(join(process.cwd(), 'docs/project-control/FARE_OBSERVATION_ARCHIVE.md'), 'utf8');
  // Markdown in these docs is hand-wrapped, so a phrase spanning a line
  // break contains a literal newline a plain .toContain() won't match —
  // normalize whitespace and bold markers before searching.
  const normalize = (s: string) => s.toLowerCase().replace(/\*\*/g, '').replace(/\s+/g, ' ');
  const auditFlat = normalize(auditDoc);
  const archiveFlat = normalize(archiveDoc);

  it('the audit\'s slug index reflects Manchester-Dubai as Strong, matching the real, current grading function', () => {
    expect(auditDoc).toMatch(/\|\s*`manchester-dubai`\s*\|\s*Strong\s*\|/);
    const route = getRouteBySlug('manchester-dubai')!;
    expect(computeRouteIntelligenceLevel(route, NOW_ISO)).toBe('strong');
  });

  it('the fare archive marks the founder action as closed, with the exact observation id and evidence path', () => {
    expect(archiveDoc).toContain('✅ Manchester–Dubai');
    expect(archiveDoc).toContain(NEW_DUBAI_OBS_ID);
    expect(archiveDoc).toContain('docs/project-control/fare-evidence/manchester-dubai-2026-08-06.md');
  });

  it('never claims the promotion was automatic product approval — only ever negates that framing, never asserts it', () => {
    // The doc legitimately contains the substring "automatic promotion"
    // inside negations ("not an automatic ... promotion") — assert the
    // positive claim never appears instead of a naive substring check.
    expect(auditFlat).not.toMatch(/\bis an automatic (?:content-quality )?promotion\b/);
    expect(auditFlat).not.toMatch(/\bautomatically (?:approved|qualifies|promoted)\b/);
    expect(auditFlat).toContain('not an automatic content-quality promotion');
    expect(archiveFlat).not.toMatch(/reaches strong automatically/);
  });

  it('documents the second content-depth review\'s "DIRECT FLIGHT" badge finding and its subsequent fix, not a stale non-fix claim', () => {
    expect(auditFlat).toContain('direct flight');
    expect(auditFlat).toContain('connecting via bahrain');
    expect(auditFlat).toContain('getdealdirectnesslabel()'.replace('()', '()').toLowerCase());
    // The fix landed the same day (6 August 2026) — the doc must reflect
    // that, never the earlier "not fixed in this PR" framing.
    expect(auditFlat).not.toContain('not fixed in this pr');
    expect(auditFlat).toContain('getdealfaredirectnesslabel()'.toLowerCase());
    expect(auditFlat).toContain('now renders "connecting"'.toLowerCase());
  });

  it('explicitly protects Manchester-Doha from an artificial upgrade, in both the audit and the fare archive', () => {
    expect(auditDoc).toContain('### Protecting the Doha decision from artificial upgrading');
    expect(auditFlat).toContain('never simply to hand the route a second atlas scoring category');
    expect(archiveDoc).toContain('## Manchester–Doha: do not close its gap artificially');
    expect(archiveFlat).toContain('never merely to hand it a second scoring category');
  });

  it('states the real, current fare-tracking route count (13 of 32, after Fare Coverage Expansion Batch A), not a stale hand-typed figure', () => {
    const totalTracked = routes.filter((r) => getPublishableObservationsByRoute(r.slug, NOW_ISO).length > 0).length;
    expect(totalTracked).toBe(13);
    expect(auditDoc).toContain(`${totalTracked} of 32`);
  });
});
