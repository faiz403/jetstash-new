import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPublicHotelExamples } from '@/lib/holiday-intelligence';
import { getTripComHotelUrl, hasTripComHotelLink, HOTEL_PROVIDER_REL } from '@/lib/hotel-booking-links';
import { antalyaHotelEvidence } from '@/data/hotel-evidence';

/**
 * Antalya hotel affiliate MVP (August 2026), repointed at the shared
 * lib/holiday-intelligence.ts + components/destination/holiday-intelligence.tsx
 * (Hotel Intelligence architecture consolidation, August 2026) — every
 * assertion below is unchanged; only the import paths were updated.
 *
 * The smallest legitimate monetised journey for the existing Antalya
 * Holiday Intelligence pilot: factual hotel context (already public) plus
 * a "Check current price on Trip.com" handoff, for the three properties
 * that have a real, dashboard-generated Trip.com hotel affiliate link on
 * file in lib/hotel-booking-links.ts. Evidence (data/hotel-evidence.ts) and
 * commercial handoff (lib/hotel-booking-links.ts) are deliberately kept in
 * separate files — this suite guards that separation as much as the CTA
 * itself.
 */

const componentSrc = readFileSync(join(process.cwd(), 'components', 'destination', 'holiday-intelligence.tsx'), 'utf8');
const hotelLinksSrc = readFileSync(join(process.cwd(), 'lib', 'hotel-booking-links.ts'), 'utf8');

describe('Only exact verified hotel links can render', () => {
  it('all three Antalya evidenceIds resolve to a real Trip.com URL', () => {
    for (const record of antalyaHotelEvidence) {
      expect(hasTripComHotelLink(record.evidenceId), record.evidenceId).toBe(true);
      expect(getTripComHotelUrl(record.evidenceId), record.evidenceId).not.toBeNull();
    }
  });

  it("getPublicHotelExamples('antalya') surfaces a non-null bookingUrl for all three current examples", () => {
    const examples = getPublicHotelExamples('antalya');
    expect(examples).toHaveLength(3);
    for (const example of examples) {
      expect(example.bookingUrl, example.hotelName).not.toBeNull();
    }
  });
});

describe('Missing hotel link fails closed — no CTA', () => {
  it('an evidenceId with no entry in TRIPCOM_HOTEL_URLS returns null, never a guessed URL', () => {
    expect(getTripComHotelUrl('antalya-some-future-property-not-yet-linked')).toBeNull();
    expect(hasTripComHotelLink('antalya-some-future-property-not-yet-linked')).toBe(false);
  });

  it('the component only renders the CTA inside an `example.bookingUrl &&` guard — never unconditionally', () => {
    expect(componentSrc).toContain('example.bookingUrl && (');
    expect(componentSrc).toContain('href={example.bookingUrl}');
  });
});

describe('URLs preserve Trip.com\'s own generated affiliate parameters, unmodified', () => {
  it('every hotel URL carries the same live Allianceid/SID identifiers already used for flights', () => {
    for (const record of antalyaHotelEvidence) {
      const url = getTripComHotelUrl(record.evidenceId)!;
      expect(url, record.evidenceId).toContain('Allianceid=9804124');
      expect(url, record.evidenceId).toContain('SID=327450313');
      expect(url, record.evidenceId).toMatch(/trip_sub3=D\d+/);
    }
  });

  it('every hotel URL points to the exact property page, not a search/listing page', () => {
    for (const record of antalyaHotelEvidence) {
      const url = getTripComHotelUrl(record.evidenceId)!;
      expect(url, record.evidenceId).toMatch(/\/hotels\/[^?]*hotel-detail-\d+\//);
      expect(url, record.evidenceId).not.toMatch(/checkIn=|checkOut=/);
    }
  });

  it('no URL is constructed from a template string — every entry in the map is a literal, dashboard-generated value', () => {
    expect(hotelLinksSrc).not.toMatch(/\$\{.*hotelId/);
    expect(hotelLinksSrc).not.toContain('.replace(');
  });
});

describe('No prices, ratings or availability are exposed by JetStash', () => {
  it('the public data projection never carries a price, rating, review score, discount or availability claim', () => {
    const publicCopy = JSON.stringify(getPublicHotelExamples('antalya')).toLowerCase();
    // bookingUrl legitimately contains "curr=gbp" (a currency-market
    // parameter Trip.com's own generator appended, not a JetStash price) —
    // excluded from this check by removing the URL fields before matching.
    const withoutUrls = JSON.stringify(getPublicHotelExamples('antalya').map(({ bookingUrl, ...rest }) => rest)).toLowerCase();
    expect(withoutUrls).not.toMatch(/£|\bprice\b|availability|package|rating|review|discount/);
    expect(publicCopy).not.toMatch(/strikethrough|strike-through/);
  });

  it('the component source never hardcodes a price, rating, review score or discount figure', () => {
    expect(componentSrc).not.toMatch(/£\d/);
    expect(componentSrc).not.toMatch(/\brating\b/i);
    expect(componentSrc).not.toMatch(/\breview[s]?\b/i);
    expect(componentSrc).not.toMatch(/\bdiscount\b/i);
    expect(componentSrc).not.toMatch(/strike-?through/i);
    // "availability" appears exactly once, in the disclosure sentence
    // itself ("Prices, availability and package inclusions are not
    // shown") — that's the disclaimer this MVP requires, not a claim.
    expect(componentSrc.match(/availability/gi)).toEqual(['availability']);
  });

  it('the top-level disclosure that prices/availability/package inclusions are not shown is unchanged', () => {
    expect(componentSrc).toContain('Prices, availability and package inclusions are not shown.');
  });
});

describe('Existing factual/non-recommendation language remains', () => {
  it('keeps the "not a ranking or recommendation" disclosure verbatim', () => {
    expect(componentSrc).toContain('Factual examples only, not a ranking or recommendation.');
  });

  it('keeps the existing factual hotel context fields untouched', () => {
    const examples = getPublicHotelExamples('antalya');
    expect(examples.map((example) => example.hotelName)).toEqual([
      'Trendy Lara',
      'Regnum Carya',
      "Aydinbey King's Palace & Spa",
    ]);
    expect(examples.every((example) => example.factualSignals.length > 0)).toBe(true);
    expect(examples.every((example) => example.locationNote.length > 0)).toBe(true);
  });

  it('never adds a "recommended"/"top pick"/ranking-style claim anywhere in the component', () => {
    expect(componentSrc.toLowerCase()).not.toMatch(/best|recommended|top pick|\brank\b|cheapest|good value/);
  });
});

describe('CTA disclosure and link safety, matching the existing flight-handoff pattern', () => {
  it('uses the hotel-specific disclosure sentence ("property", not "itinerary" — that wording is reserved for the flight CTA)', () => {
    expect(componentSrc).toContain('Partner link, opens Trip.com in a new tab. Check the property, dates and booking terms before paying.');
  });

  it('never reuses the flight CTA\'s exact disclosure sentence for the hotel CTA', () => {
    const flightDisclosure = 'Partner link, opens Trip.com in a new tab. Check the itinerary, dates and booking terms before paying.';
    expect(componentSrc).toContain(flightDisclosure); // still present once, for the flight CTA
    expect((componentSrc.match(new RegExp(flightDisclosure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length).toBe(1);
  });

  it('every hotel CTA opens in a new tab with the safe rel attribute', () => {
    expect(componentSrc).toContain('target="_blank"');
    expect(componentSrc).toContain('rel={HOTEL_PROVIDER_REL}');
    expect(HOTEL_PROVIDER_REL).toBe('nofollow sponsored noopener noreferrer');
  });

  it('the CTA label is exactly "Check current price on Trip.com"', () => {
    expect(componentSrc).toContain('Check current price on Trip.com');
  });
});

describe('Evidence and commercial handoff stay in separate files', () => {
  it('data/hotel-evidence.ts never imports from or references lib/hotel-booking-links.ts', () => {
    const evidenceSrc = readFileSync(join(process.cwd(), 'data', 'hotel-evidence.ts'), 'utf8');
    expect(evidenceSrc).not.toContain('hotel-booking-links');
    expect(evidenceSrc).not.toContain('Allianceid');
    expect(evidenceSrc).not.toContain('trip.com/hotels/detail');
  });

  it('lib/hotel-booking-links.ts is keyed by evidenceId, never by hotel name', () => {
    for (const record of antalyaHotelEvidence) {
      expect(hotelLinksSrc).toContain(record.evidenceId);
    }
  });
});
