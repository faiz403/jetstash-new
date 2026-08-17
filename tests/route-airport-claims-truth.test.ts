import { describe, it, expect } from 'vitest';
import { routes } from '@/data/routes';
import { airports } from '@/data/airports';

/**
 * Route + Airport Claims Trust Cleanup (PR #145, August 2026).
 *
 * The Route + Airport Claims Trust Audit confirmed exactly six live
 * sentences that asserted a persistent value/ranking judgement — "usually
 * the most convenient," "one of the more reliably priced," "consistently
 * worthwhile," "the genuine first choice," "beats... on both price and
 * journey time," "consistently beats the calculation" — with no comparative
 * evidence field anywhere in the codebase to support them. This is a
 * narrow, exact-phrase fix: it proves those six phrases are gone and that
 * the genuinely useful factual context around each was preserved, not a
 * global word ban (the audit separately confirmed several other uses of
 * "reliable"/"better"/"worthwhile" elsewhere are legitimately evidenced —
 * see the Leeds Bradford assertions below, which must keep passing
 * unchanged).
 */

const lahore = routes.find((r) => r.slug === 'manchester-lahore')!;
const dubai = routes.find((r) => r.slug === 'manchester-dubai')!;
const heathrowMumbai = routes.find((r) => r.slug === 'london-heathrow-mumbai')!;
const manchesterAirport = airports.find((a) => a.slug === 'manchester')!;
const birminghamAirport = airports.find((a) => a.slug === 'birmingham')!;
const gatwickAirport = airports.find((a) => a.slug === 'london-gatwick')!;
const leedsBradfordAirport = airports.find((a) => a.slug === 'leeds-bradford')!;

describe('The six confirmed unsupported phrases no longer appear anywhere in route/airport copy', () => {
  const banned = [
    'usually the most convenient option',
    'one of the more reliably priced long-haul routes',
    'consistently worthwhile',
    'genuine first choice',
    'beats connecting via London on both price and journey time',
    'consistently beats the calculation',
  ];

  it('none of the six phrases appears in data/routes.ts or data/airports.ts', () => {
    const allRouteText = routes.map((r) => r.intro).join(' \n ');
    const allAirportText = airports.map((a) => a.whyThisAirport).join(' \n ');
    const haystack = `${allRouteText}\n${allAirportText}`;
    for (const phrase of banned) {
      expect(haystack, `"${phrase}" should not appear anywhere`).not.toContain(phrase);
    }
  });
});

describe('Gatwick: the undated absolute Ahmedabad claim is removed, not just softened', () => {
  it('does not claim to be the "only UK airport" with a direct Ahmedabad service', () => {
    expect(gatwickAirport.whyThisAirport).not.toMatch(/only UK airport with a direct/i);
  });

  it('the Ahmedabad service is now framed conditionally ("when it\'s operating"), not as an absolute', () => {
    expect(gatwickAirport.whyThisAirport).toContain('direct, non-stop service to Ahmedabad when it\'s operating');
  });

  it('still contains useful Gujarati/Ahmedabad context without an absolute ranking claim', () => {
    expect(gatwickAirport.whyThisAirport).toMatch(/Gujarati heritage travellers/i);
    expect(gatwickAirport.whyThisAirport).toMatch(/Ahmedabad/);
    expect(gatwickAirport.whyThisAirport).not.toMatch(/first choice|best airport|only UK airport|guaranteed/i);
  });
});

describe('A. Manchester → Lahore still communicates the direct/no-Gulf-connection context', () => {
  it('preserves the structural facts (no Gulf connection, no extra layover, no baggage transfer point)', () => {
    expect(lahore.intro).toMatch(/avoiding a Gulf connection/i);
    expect(lahore.intro).toMatch(/extra layover/i);
    expect(lahore.intro).toMatch(/baggage could go astray/i);
  });

  it('does not claim it is the most convenient, best, or safest option', () => {
    expect(lahore.intro).not.toMatch(/most convenient/i);
    expect(lahore.intro).not.toMatch(/\bbest\b/i);
    expect(lahore.intro).not.toMatch(/\bsafest\b/i);
  });
});

describe('B. Manchester → Dubai still communicates the direct Emirates service and connecting alternatives', () => {
  it('states the direct Emirates service as a fact, without a pricing-reliability judgement', () => {
    expect(dubai.intro).toMatch(/Emirates operates a direct Manchester to Dubai service/i);
    expect(dubai.intro).toMatch(/connecting alternatives/i);
    expect(dubai.intro).not.toMatch(/reliably priced/i);
    expect(dubai.intro).not.toMatch(/\bbest\b|\bcheapest\b/i);
  });
});

describe('C. Heathrow → Mumbai still encourages comparison, without an unsupported certainty claim', () => {
  it('keeps the genuine multi-carrier evidence and the comparison nudge', () => {
    expect(heathrowMumbai.intro).toMatch(/genuine multi-carrier competition/i);
    expect(heathrowMumbai.intro).toMatch(/compare the fare, itinerary and booking details/i);
  });

  it('does not claim comparison is consistently/always worthwhile', () => {
    expect(heathrowMumbai.intro).not.toMatch(/consistently/i);
    expect(heathrowMumbai.intro).not.toMatch(/\balways\b.*worthwhile|worthwhile.*\balways\b/i);
  });
});

describe('E. Manchester airport copy still explains the practical regional benefit', () => {
  it('keeps the "avoids the additional journey to a London airport" framing without a price/time superiority claim', () => {
    expect(manchesterAirport.whyThisAirport).toMatch(/avoids the additional journey to a London airport/i);
    expect(manchesterAirport.whyThisAirport).not.toMatch(/\bbeats\b/i);
    expect(manchesterAirport.whyThisAirport).not.toMatch(/on both price and journey time/i);
  });

  it('still tells the customer to compare for their own dates', () => {
    expect(manchesterAirport.whyThisAirport).toMatch(/compare the available route and fare/i);
  });
});

describe('F. Birmingham airport copy still explains the practical regional benefit', () => {
  it('keeps the "avoids the drive to Heathrow" framing without a persistent-superiority claim', () => {
    expect(birminghamAirport.whyThisAirport).toMatch(/avoids the drive to Heathrow/i);
    expect(birminghamAirport.whyThisAirport).not.toMatch(/\bbeats\b/i);
    expect(birminghamAirport.whyThisAirport).not.toMatch(/consistently/i);
  });

  it('still tells the customer to compare cost/parking/travel time for their own journey', () => {
    expect(birminghamAirport.whyThisAirport).toMatch(/compare route, fare, parking and travel time/i);
  });
});

describe('Evidenced, legitimate uses elsewhere are untouched — this is not a global word ban', () => {
  it('the Leeds Bradford reliability copy (justified by documented service-failure history) is unchanged', () => {
    expect(leedsBradfordAirport.description).toContain('connecting via Manchester or the Gulf is currently the more reliable option');
    expect(leedsBradfordAirport.whyThisAirport).toContain('Manchester, roughly an hour\'s drive away, remains the consistently reliable option.');
  });
});

describe('No route/fare/verification data changed — this PR is editorial wording only', () => {
  it('manchester-lahore: verification, frequency, flightTime, isDirect are unchanged', () => {
    expect(lahore.isDirect).toBe(true);
    expect(lahore.frequency).toBe('Direct — current frequency not confirmed by an official schedule, see note');
    expect(lahore.verification?.status).toBe('verified');
    expect(lahore.verification?.reviewDueDate).toBe('2026-09-14');
  });

  it('manchester-dubai: verification, frequency, flightTime, isDirect are unchanged', () => {
    expect(dubai.isDirect).toBe(true);
    expect(dubai.frequency).toBe('21 flights per week (Emirates; seasonal variation possible)');
    expect(dubai.verification?.status).toBe('verified');
  });

  it('heathrow-mumbai: verification, frequency, isDirect are unchanged', () => {
    expect(heathrowMumbai.isDirect).toBe(true);
    expect(heathrowMumbai.frequency).toContain('Air India and Virgin Atlantic each confirmed 2x daily');
  });

  it('gatwick, manchester, birmingham airports: route lists and hasDirectLongHaul are unchanged', () => {
    expect(gatwickAirport.longHaulRoutes).toEqual(['Dubai', 'Doha', 'Ahmedabad', 'Amritsar']);
    expect(gatwickAirport.hasDirectLongHaul).toBe(true);
    expect(manchesterAirport.longHaulRoutes).toEqual(['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi', 'Karachi', 'Delhi', 'Mumbai']);
    expect(birminghamAirport.longHaulRoutes).toEqual(['Islamabad', 'Dubai', 'Sharjah', 'Doha']);
  });
});
