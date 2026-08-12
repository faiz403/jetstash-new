import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDestinationBySlug } from '@/data/destinations';
import { getAntalyaFlightHandoffStatuses, getAntalyaFlightHandoffs, getAntalyaPublicHotelExamples } from '@/lib/antalya-holiday-intelligence';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';

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

  it('fails closed when Antalya has no verified exact route and partner handoff', () => {
    const destination = getDestinationBySlug('antalya')!;
    const handoffs = getAntalyaFlightHandoffs(destination, '2026-08-12');
    expect(handoffs.map((handoff) => handoff.airportName)).toEqual([
      'Leeds Bradford Airport',
      'Glasgow Airport',
      'Bristol Airport',
    ]);
    expect(handoffs.every((handoff) => handoff.href.includes('curr=GBP'))).toBe(true);
    expect(handoffs.every((handoff) => handoff.href.includes('Allianceid=9804124') && handoff.href.includes('SID=327450313'))).toBe(true);
    const statuses = getAntalyaFlightHandoffStatuses(destination, '2026-08-12');
    expect(statuses.find((entry) => entry.airportSlug === 'london-gatwick')).toMatchObject({ status: 'blocked', href: null });
    expect(componentSrc).toContain('{handoff.airportName} → Antalya');
    expect(componentSrc).toContain('Check live flights on Trip.com');
    expect(componentSrc).toContain('Partner link, opens Trip.com in a new tab.');
    expect(componentSrc).toContain('No exact dateless Trip.com handoff was generated for:');
    expect(componentSrc).toContain('nofollow sponsored noopener noreferrer');
  });

  it('leaves route-guide pairs to their route journey and keeps unsupported pairs in Holiday Intelligence', () => {
    const destination = getDestinationBySlug('antalya')!;
    const guideEntries = getDestinationFlightGuideEntries(destination, '2026-08-12');
    expect(guideEntries.find((entry) => entry.airport.slug === 'manchester')?.routeSlug).toBe('manchester-antalya');
    expect(guideEntries.find((entry) => entry.airport.slug === 'birmingham')?.routeSlug).toBe('birmingham-antalya');

    const handoffRoutes = getAntalyaFlightHandoffs(destination, '2026-08-12').map((handoff) => handoff.routeSlug);
    expect(handoffRoutes).toEqual(['leeds-bradford-antalya', 'glasgow-antalya', 'bristol-antalya']);
    expect(handoffRoutes).not.toContain('manchester-antalya');
    expect(handoffRoutes).not.toContain('birmingham-antalya');
    expect(handoffRoutes).not.toContain('london-gatwick-antalya');
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
