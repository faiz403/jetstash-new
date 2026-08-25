import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AFFILIATE_DISCLOSURE_TEXT,
  AffiliateLinkDisclosure,
} from '@/components/ui/affiliate-link-disclosure';
import { DealCard } from '@/components/ui/deal-card';
import type { Deal } from '@/data/deals';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function occurrenceCount(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

const disclosureCallsites = [
  ['Fare Signal', 'components/route/fare-signal.tsx', 1],
  ['Journey Choice', 'components/route/journey-choice.tsx', 1],
  ['Book-By', 'components/route/book-by-countdown.tsx', 1],
  ['Deal cards', 'components/ui/deal-card.tsx', 1],
  ['no-fare fallback', 'components/ui/no-fare-fallback.tsx', 1],
  ['destination flight handoffs', 'components/destination/destination-flight-guides.tsx', 1],
  ['holiday flight and hotel handoffs', 'components/destination/holiday-intelligence.tsx', 2],
  ['Travel Ready flight and baggage links', 'components/travel-ready/travel-ready-check.tsx', 2],
  ['Tracked Fares', 'components/sections/tracked-fares-explorer.tsx', 1],
  ['Manchester–Mumbai Journey Brief', 'components/journey-brief/journey-brief-manchester-mumbai.tsx', 1],
] as const;

describe('shared compensated-link disclosure', () => {
  it('renders the founder-approved wording exactly and makes the ad/affiliate label visually prominent', () => {
    const html = renderToStaticMarkup(AffiliateLinkDisclosure({ providerName: 'Trip.com' }));
    const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    expect(AFFILIATE_DISCLOSURE_TEXT).toBe(
      'Ad · Affiliate link. JetStash earns commission on eligible bookings through this link, at no extra cost to you.'
    );
    expect(text).toBe(`${AFFILIATE_DISCLOSURE_TEXT} Opens Trip.com in a new tab.`);
    expect(html).toContain('<span class="font-semibold text-ink-700">Ad · Affiliate link.</span>');
  });

  it.each(disclosureCallsites)('%s uses the shared disclosure at every commercial CTA position', (_name, path, expectedCount) => {
    const value = source(path);
    expect(value).toContain('AffiliateLinkDisclosure');
    expect(occurrenceCount(value, /<AffiliateLinkDisclosure\b/g)).toBe(expectedCount);
  });

  it('Business Class inherits the covered DealCard CTA rather than creating a second commercial pattern', () => {
    const business = source('app/business-class/page.tsx');
    expect(business).toContain('<DealCard');
    expect(source('components/ui/deal-card.tsx')).toContain('<AffiliateLinkDisclosure');
  });

  it('removes the old ambiguous label from public source while retaining provider/open-tab detail in the shared component', () => {
    for (const [, path] of disclosureCallsites) {
      expect(source(path)).not.toContain('Partner link, opens');
    }
    expect(source('components/ui/affiliate-link-disclosure.tsx')).toContain('Opens {providerName} in a new tab.');
  });

  it('keeps price, itinerary, baggage and booking warnings alongside the commercial disclosure', () => {
    for (const path of [
      'components/route/fare-signal.tsx',
      'components/route/journey-choice.tsx',
      'components/route/book-by-countdown.tsx',
      'components/ui/deal-card.tsx',
      'components/ui/no-fare-fallback.tsx',
      'components/journey-brief/journey-brief-manchester-mumbai.tsx',
    ]) {
      const value = source(path);
      expect(value, path).toContain('Check the itinerary, baggage allowance and booking terms before paying.');
    }

    expect(source('components/sections/tracked-fares-explorer.tsx')).toContain('TRIPCOM_FRESH_SEARCH_NOTE');
    expect(source('components/route/fare-signal.tsx')).toContain('TRIPCOM_FRESH_SEARCH_NOTE');
    expect(source('components/route/journey-choice.tsx')).toContain('TRIPCOM_FRESH_SEARCH_NOTE');
    expect(source('components/destination/destination-flight-guides.tsx')).toContain(
      'Check the itinerary, dates and booking terms before paying.'
    );
    const holiday = source('components/destination/holiday-intelligence.tsx');
    expect(holiday).toContain('Check the itinerary, dates and booking terms before paying.');
    expect(holiday).toContain('Check the property, dates and booking terms before paying.');
  });
});

describe('safe-facts trust corrections', () => {
  it('links both public forms to the existing Privacy Policy without changing submission endpoints', () => {
    const contact = source('components/sections/contact-form.tsx');
    const quote = source('components/sections/quote-request-form.tsx');

    for (const value of [contact, quote]) {
      expect(value).toContain('href="/privacy-policy"');
      expect(value).toContain('Privacy Policy');
      expect(value).not.toMatch(/retention|retain for|shared with/i);
    }
    expect(contact).toContain("fetch('/api/contact'");
    expect(quote).toContain("fetch('/api/quote-request'");
  });

  it('corrects the stale hotel-scope statement without claiming broad hotel coverage', () => {
    const about = source('app/about/page.tsx');
    expect(about).toContain('checked hotel and location intelligence for a limited set of destinations');
    expect(about).toContain('Car hire, airport lounges and parking are not covered.');
    expect(about).not.toContain('hotels, car hire, airport lounges, parking, aren\'t on the site yet');
  });

  it('removes generic Business benefit assumptions and replaces them with fare-specific checks', () => {
    const business = source('app/business-class/page.tsx');
    expect(business).not.toMatch(/Most South Asia and Gulf business cabins|Lounge access both ends|2 to 3 times the economy limit/);
    expect(business).not.toMatch(/Booking window matters less than economy|Worth it most on 7\+ hour direct sectors/);
    expect(business).toContain('A Business label does not establish a flat bed.');
    expect(business).toContain('Access varies by fare, operating airline and airport.');
    expect(business).toContain('Allowance is fare- and airline-specific.');
  });

  it('states that family and Umrah cards are route context, not tracked package prices', () => {
    const family = source('app/family-holidays/page.tsx');
    const umrah = source('app/umrah/page.tsx');
    const dealCard = source('components/ui/deal-card.tsx');

    expect(family).toContain('Family holiday route cards');
    expect(family).toContain('has not tracked a package price for these cards');
    expect(family).not.toContain('Example family package fares');
    expect(umrah).toContain('Umrah route cards, not package prices');
    expect(umrah).toContain('has not tracked package prices for these cards');
    expect(umrah).not.toContain('Example package fares');
    expect(dealCard).toContain('No package price tracked yet.');
  });

  it('labels pending airline verification separately from verified route directness', () => {
    const fixture: Deal = {
      id: 'verification-label-fixture',
      category: 'flight',
      cabin: 'Premium Economy',
      fromAirportSlug: 'birmingham',
      toDestinationSlug: 'lahore',
      fromCity: 'Birmingham',
      toCity: 'Lahore',
      toCountry: 'Pakistan',
      airline: 'Unregistered fixture airline',
    };
    const html = renderToStaticMarkup(DealCard({ deal: fixture })).replace(/\s+/g, ' ');

    expect(html).toContain('Airline: verification pending · Route: Connecting');
    expect(html).not.toContain('Verification pending · Connecting');
  });
});
