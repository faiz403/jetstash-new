import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDestinationBySlug } from '@/data/destinations';
import { getAntalyaFlightHandoffStatuses, getAntalyaFlightHandoffs, getAntalyaPublicHotelExamples } from '@/lib/antalya-holiday-intelligence';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { getTripComFlightHandoffUrl } from '@/lib/booking-providers';

const pageSrc = readFileSync(join(process.cwd(), 'app', 'destinations', '[slug]', 'page.tsx'), 'utf8');
const componentSrc = readFileSync(join(process.cwd(), 'components', 'destination', 'antalya-holiday-intelligence.tsx'), 'utf8');

describe('public Antalya holiday intelligence', () => {
  it('derives exactly the three approved factual examples', () => {
    const examples = getAntalyaPublicHotelExamples();
    expect(examples.map((example) => example.hotelName)).toEqual([
      'Trendy Lara',
      'Regnum Carya',
      "Aydinbey King's Palace & Spa",
    ]);
    expect(examples.map((example) => example.operationalSubArea)).toEqual([
      'Kundu / Kemerağzı coastal resort corridor',
      'Kadriye',
      'Evrenseki',
    ]);
    expect(examples.every((example) => example.factualSignals.length > 0)).toBe(true);
  });

  it('keeps the public projection free of internal evidence detail and commercial claims', () => {
    const publicCopy = JSON.stringify(getAntalyaPublicHotelExamples()).toLowerCase();
    expect(publicCopy).not.toContain('internal-only');
    expect(publicCopy).not.toContain('providerpropertyurl');
    expect(publicCopy).not.toContain('"sources"');
    expect(publicCopy).not.toMatch(/£|price|availability|package/);
    expect(publicCopy).not.toMatch(/best|recommended|top pick|rank|cheapest|value/);
    expect(publicCopy).toContain('not establish a walkable route');
  });

  it('has no competing Holiday Intelligence handoffs once every Antalya origin has a route guide', () => {
    const destination = getDestinationBySlug('antalya')!;
    const handoffs = getAntalyaFlightHandoffs(destination, '2026-08-12');
    expect(handoffs).toEqual([]);
    const statuses = getAntalyaFlightHandoffStatuses(destination, '2026-08-12');
    expect(statuses).toEqual([]);
    expect(getTripComFlightHandoffUrl('london-gatwick-antalya')).toBeNull();
    expect(componentSrc).toContain('{handoff.airportName} → Antalya');
    expect(componentSrc).toContain('Check live flights on Trip.com');
    expect(componentSrc).toContain('Partner link, opens Trip.com in a new tab.');
    expect(componentSrc).toContain('Flight actions are shown on the individual Antalya route guides above.');
    expect(componentSrc).not.toContain('No airport-specific partner handoff is available for Antalya yet.');
    expect(componentSrc).toContain('No exact dateless Trip.com handoff was generated for:');
    expect(componentSrc).toContain('nofollow sponsored noopener noreferrer');
  });

  it('leaves every Antalya origin on one route-guide journey and keeps Gatwick fail-closed', () => {
    const destination = getDestinationBySlug('antalya')!;
    const guideEntries = getDestinationFlightGuideEntries(destination, '2026-08-12');
    expect(guideEntries.find((entry) => entry.airport.slug === 'manchester')?.routeSlug).toBe('manchester-antalya');
    expect(guideEntries.find((entry) => entry.airport.slug === 'birmingham')?.routeSlug).toBe('birmingham-antalya');

    const routeSlugs = guideEntries.filter((entry) => entry.airport.slug !== 'london-heathrow').map((entry) => entry.routeSlug);
    expect(routeSlugs).toEqual([
      'manchester-antalya',
      'birmingham-antalya',
      'leeds-bradford-antalya',
      'glasgow-antalya',
      'bristol-antalya',
      'london-gatwick-antalya',
    ]);
    expect(getAntalyaFlightHandoffs(destination, '2026-08-12')).toEqual([]);
    expect(getTripComFlightHandoffUrl('london-gatwick-antalya')).toBeNull();
  });

  it('wires the public section only for Antalya and keeps founder-only detail out of the public page', () => {
    expect(pageSrc).toContain("dest.slug === 'antalya'");
    expect(pageSrc).toContain('AntalyaHolidayIntelligence');
    expect(pageSrc).not.toContain("@/data/hotel-evidence");
    expect(pageSrc).not.toContain('antalyaHotelEvidence');
  });

  it('preserves the three location distinctions in customer-facing copy', () => {
    const examples = getAntalyaPublicHotelExamples();
    expect(examples[0].locationNote).toContain('Kundu/Aksu');
    expect(examples[0].locationNote).toContain('rather than Lara Beach proper');
    expect(examples[1].locationNote).toContain('Kadriye');
    expect(examples[1].locationNote).toContain('Belek tourism area');
    expect(examples[2].locationNote).toContain('Evrenseki');
    expect(examples[2].locationNote).toContain('approximately 8 km from Side Centre');
  });
});
