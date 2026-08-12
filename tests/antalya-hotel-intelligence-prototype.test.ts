import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { antalyaHotelEvidence } from '@/data/hotel-evidence';

const pageSrc = readFileSync(join(process.cwd(), 'app', 'founder', 'antalya-hotel-intelligence', 'page.tsx'), 'utf8');
const componentSrc = readFileSync(join(process.cwd(), 'components', 'founder', 'antalya-hotel-intelligence.tsx'), 'utf8');
const sitemapSrc = readFileSync(join(process.cwd(), 'app', 'sitemap.ts'), 'utf8');
const headerSrc = readFileSync(join(process.cwd(), 'components', 'layout', 'header.tsx'), 'utf8');

describe('Antalya hotel intelligence founder prototype', () => {
  it('uses the existing founder gate and noindex metadata pattern', () => {
    expect(pageSrc).toContain("process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(pageSrc).toContain('notFound()');
    expect(pageSrc).toContain('robots: { index: false, follow: false }');
    expect(pageSrc).toContain("import { antalyaHotelEvidence } from '@/data/hotel-evidence'");
  });

  it('renders exactly the approved internal records without duplicating their data', () => {
    expect(antalyaHotelEvidence).toHaveLength(3);
    expect(componentSrc).toContain('records.map');
    expect(componentSrc).not.toContain('Trendy Lara');
    expect(componentSrc).not.toContain('Regnum Carya');
    expect(componentSrc).not.toContain("Aydinbey King's Palace");
    expect(antalyaHotelEvidence.every((record) => record.publicationStatus === 'internal-only')).toBe(true);
  });

  it('keeps location intelligence distinct from provider labels', () => {
    expect(componentSrc).toContain('Provider area');
    expect(componentSrc).toContain('Sourced address');
    expect(componentSrc).toContain('JetStash area context');
    expect(componentSrc).toContain('Why this matters');
    expect(componentSrc).toContain('providerGeographyConflict');
    expect(componentSrc).toContain('Location confidence:');
    expect(componentSrc).toContain('Provider / location relationship');
    expect(componentSrc).toContain('Different geography level');
    expect(componentSrc).toContain('Aligned at supported level');
    expect(componentSrc).toContain('Unresolved');
  });

  it('uses traveller-facing location explanations and collapsed evidence groups', () => {
    expect(componentSrc).toContain('Booking sites may group the property under');
    expect(componentSrc).toContain('while the sourced address places it more precisely');
    expect(componentSrc).toContain('gives the more precise sub-area');
    expect(componentSrc).toContain('rather than Side historic core');
    expect(componentSrc).toContain('Sources place it ${sideDistance}, but they do not establish a walkable route.');
    expect(componentSrc).not.toContain('not walkable');
    expect(componentSrc).toContain('min-w-0');
    expect(componentSrc).toContain('break-words');
    expect(componentSrc).toContain('sm:flex-row');
    expect(componentSrc).toContain('w-full min-w-0');
    const aydinbey = antalyaHotelEvidence.find((record) => record.hotelName.startsWith('Aydinbey'));
    const sideDistance = aydinbey?.locationJourneyContext.townCityHistoricRelationships.find((item) => item.claim === 'Side Centre relationship');
    const walking = aydinbey?.locationJourneyContext.townCityHistoricRelationships.find((item) => item.claim.includes('Walking access'));
    expect(sideDistance?.state).toBe('evidenced');
    expect(sideDistance?.value).toBe('Approximately 8 km from Side Centre.');
    expect(walking?.state).toBe('not-stated');
    expect(walking?.value).toBe('Not evidenced.');
    expect(componentSrc).toMatch(/<details[\s\S]*<summary/);
    expect(componentSrc).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/i);
  });

  it('preserves the three distinct geography stories in the source data', () => {
    const trendy = antalyaHotelEvidence.find((record) => record.hotelName === 'Trendy Lara');
    const regnum = antalyaHotelEvidence.find((record) => record.hotelName === 'Regnum Carya');
    const aydinbey = antalyaHotelEvidence.find((record) => record.hotelName.startsWith('Aydinbey'));
    expect(trendy?.geography.operationalArea).toBe('Kundu/Aksu');
    expect(trendy?.geography.providerMarketingLocationLabel).toBe('Lara');
    expect(trendy?.geography.providerGeographyConflict).toBe('yes');
    expect(trendy?.locationJourneyContext.airportTimeEvidence.map((item) => item.value)).toEqual([
      'Approximately 15 minutes by car.',
      'Approximately 25 minutes by car.',
    ]);
    expect(regnum?.geography.operationalSubArea).toBe('Kadriye');
    expect(regnum?.geography.operationalArea).toBe('Belek tourism area');
    expect(aydinbey?.geography.operationalSubArea).toBe('Evrenseki');
    expect(aydinbey?.locationJourneyContext.townCityHistoricRelationships.find((item) => item.claim.includes('Walking'))?.value).toBe('Not evidenced.');
  });

  it('does not become a hotel-selling surface', () => {
    const copy = componentSrc.replace('no prices, rankings, booking links or recommendations', '');
    expect(copy).not.toContain('£');
    expect(copy).not.toMatch(/Book now|Compare hotels|affiliate CTA/i);
    expect(copy).not.toMatch(/recommended|best for|top pick|great value|luxury|rating|stars|rank/i);
    expect(componentSrc).toContain('no prices, rankings, booking links or recommendations');
  });

  it('is absent from public navigation and the sitemap', () => {
    expect(sitemapSrc).not.toContain('antalya-hotel-intelligence');
    expect(headerSrc).not.toContain('antalya-hotel-intelligence');
  });
});
