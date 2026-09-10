import { describe, it, expect } from 'vitest';
import { guides, getGuideBySlug } from '@/data/guides';
import { getRouteBySlug, getRouteAirlineDisplayStatus } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';

/**
 * Trust/evidence-integrity fix (6 Sept 2026, independent audit): the
 * "comparing-airlines-same-route" guide (data/guides.ts) named
 * Heathrow-Delhi as an example "where British Airways, Virgin Atlantic
 * and Air India all operate directly" — a specific, current three-airline
 * operating claim made independently of JetStash's own canonical
 * evidence. london-heathrow-delhi's airlineVerifications (data/routes.ts)
 * only currently verifies British Airways individually; Virgin Atlantic
 * and Air India appear in the route's airlineSlugs but have no current
 * per-airline verification record. This does NOT mean those airlines
 * don't actually operate the route — only that this guide was asserting
 * a current fact outside JetStash's own evidence boundary, the same class
 * of defect already found and fixed elsewhere in the codebase today
 * (Birmingham-Amritsar traveller tip, Travel Club copy, Manchester/
 * Gatwick airport records).
 *
 * Amendment (same day, founder review): the first fix still named
 * Heathrow-Delhi as "a well-known example" of a route "served by more
 * than one carrier" — a smaller, less explicit version of the same
 * problem, since JetStash currently only verifies one carrier (British
 * Airways) on this exact pairing and explicitly withholds the other two
 * pending separate evidence. The guide must not independently assert
 * that ANY specific route currently has multiple operators — that is
 * itself a current route/operator fact, and canonical route evidence
 * alone owns it. The guide may explain HOW to compare options when they
 * exist; it must not determine that they exist for a given pairing.
 *
 * These tests deliberately compare the guide's copy against the route's
 * actual effective presentation (getEffectiveRoutePresentation()) and
 * per-airline verification status (getRouteAirlineDisplayStatus()) — the
 * same functions the route page itself calls — rather than only banning
 * one exact sentence, so they keep failing correctly if the route's
 * verification state ever changes again.
 */

const NOW_ISO = '2026-09-06';
const heathrowDelhi = getRouteBySlug('london-heathrow-delhi')!;
const presentation = getEffectiveRoutePresentation(heathrowDelhi, routeStatusEvents, NOW_ISO);
const guide = getGuideBySlug('comparing-airlines-same-route')!;
const carrierParagraph = guide.paragraphs[0];

describe('1. Heathrow-Delhi canonical evidence is unchanged', () => {
  it('remains effectively "Direct", with only British Airways currently verified as an individual operator', () => {
    expect(presentation.status).toBe('direct');
    expect(presentation.airlineSlugs).toEqual(['british-airways']);
    expect(getRouteAirlineDisplayStatus(heathrowDelhi, 'british-airways', NOW_ISO)).toBe('verified');
    expect(getRouteAirlineDisplayStatus(heathrowDelhi, 'virgin-atlantic', NOW_ISO)).toBe('unverified');
    expect(getRouteAirlineDisplayStatus(heathrowDelhi, 'air-india', NOW_ISO)).toBe('unverified');
  });
});

describe('2. The guide no longer independently asserts current airlines outside the verified evidence boundary', () => {
  it('does not claim a specific set of airlines "all operate directly" on Heathrow-Delhi', () => {
    expect(carrierParagraph).not.toMatch(/all operate directly/i);
    expect(carrierParagraph).not.toMatch(/virgin atlantic/i);
    expect(carrierParagraph).not.toMatch(/air india/i);
  });

  it('does not identify Heathrow-Delhi (or any other named route) as a current example of a multi-carrier route', () => {
    // The core of this amendment: even an unnamed-airline claim that a
    // *specific pairing* currently has more than one operator is itself
    // an independent current-route fact outside the evidence boundary.
    expect(carrierParagraph).not.toMatch(/heathrow to delhi/i);
    expect(carrierParagraph).not.toMatch(/heathrow.{0,10}delhi/i);
    expect(carrierParagraph).not.toMatch(/well-known example/i);
    // No other specific route/city-pair example was added in its place.
    expect(carrierParagraph).not.toMatch(/for example|e\.g\.|such as/i);
  });

  it('makes no unqualified named-airline route-operation claim anywhere in the guide, matching the actual verified-airline set for the one route it names', () => {
    // Structural check, not a fixed string: if any route is ever named
    // alongside a specific airline claim again, that claim must be a subset
    // of that route's own currently-verified operators.
    const namedAirlines = ['british airways', 'virgin atlantic', 'air india']
      .filter((name) => guide.paragraphs.some((p) => p.toLowerCase().includes(name)));
    for (const name of namedAirlines) {
      const slug = name.replace(/\s+/g, '-').toLowerCase();
      expect(getRouteAirlineDisplayStatus(heathrowDelhi, slug, NOW_ISO), `${name} should be verified if named`).toBe('verified');
    }
  });

  it('does not guarantee that at least two verified carriers exist for the reader\'s route — the comparison is conditional ("when several... appear"), not asserted as universally true', () => {
    expect(carrierParagraph).toMatch(/when several airline options appear/i);
    expect(carrierParagraph).not.toMatch(/compare at least two/i);
  });
});

describe('3. The guide remains useful comparison guidance, even with only one carrier currently verified', () => {
  it('still explains what to compare and defers current-carrier verification to the route guide / canonical evidence', () => {
    expect(carrierParagraph).toMatch(/service standards, baggage allowances and typical pricing/i);
    expect(carrierParagraph).toMatch(/check the route guide/i);
    expect(carrierParagraph).toMatch(/currently has verified/i);
  });

  it('the advice is phrased so it stays true and useful on a route where JetStash currently verifies only one carrier (like Heathrow-Delhi itself)', () => {
    // Applying this exact guide's own advice to Heathrow-Delhi's real
    // current evidence state (1 verified carrier, not 2+) must not produce
    // a contradiction — proving the wording no longer presupposes plurality.
    const verifiedCount = heathrowDelhi.airlineSlugs.filter(
      (s) => getRouteAirlineDisplayStatus(heathrowDelhi, s, NOW_ISO) === 'verified'
    ).length;
    expect(verifiedCount).toBe(1);
    expect(carrierParagraph).not.toMatch(/at least two|two or more carriers/i);
  });

  it('the other two paragraphs and the summary are unchanged', () => {
    expect(guide.summary).toBe(
      'On routes served by multiple carriers, service, baggage and pricing differ meaningfully, so it pays not to default to whichever appears first.'
    );
    expect(guide.paragraphs[1]).toContain('Baggage allowance can vary by an entire suitcase between carriers');
    expect(guide.paragraphs[2]).toContain('The route guides on this site list which airlines fly each pairing');
  });
});

describe('4. No route/fare/verification data changed — this is a guide-copy-only fix', () => {
  it('london-heathrow-delhi route record (airlineSlugs, airlineVerifications, isDirect, flightTime) is unchanged', () => {
    expect(heathrowDelhi.airlineSlugs).toEqual(['virgin-atlantic', 'british-airways', 'air-india']);
    expect(heathrowDelhi.isDirect).toBe(true);
    expect(heathrowDelhi.flightTime).toBe('8h 45m direct');
    expect(heathrowDelhi.airlineVerifications).toHaveLength(1);
    expect(heathrowDelhi.airlineVerifications?.[0].airlineSlug).toBe('british-airways');
    expect(heathrowDelhi.airlineVerifications?.[0].status).toBe('verified');
  });
});

describe('5. No unrelated guide content changed', () => {
  it('every other guide is untouched', () => {
    expect(guides).toHaveLength(9);
    const visaGuide = getGuideBySlug('visa-processing-booking-date')!;
    const baggageGuide = getGuideBySlug('checked-baggage-allowances')!;
    expect(visaGuide.summary).toContain('Pakistan and India e-Visas often take 4 to 7 days');
    expect(baggageGuide.paragraphs[0]).toContain('PIA, Air India and Saudia all have different standard checked baggage allowances');
  });

  it('the comparing-airlines guide title and slug are unchanged', () => {
    expect(guide.title).toBe('Comparing airlines on the same route is worth the extra five minutes');
    expect(guide.slug).toBe('comparing-airlines-same-route');
  });
});
