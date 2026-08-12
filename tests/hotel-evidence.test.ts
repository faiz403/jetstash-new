import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { antalyaHotelEvidence } from '@/data/hotel-evidence';

const publicRoots = ['app', 'components'];
const approvedInternalSources = new Set([
  'app/founder/antalya-hotel-intelligence/page.tsx',
  'components/founder/antalya-hotel-intelligence.tsx',
]);

function sourceFilesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(path);
    return statSync(path).isFile() ? [path] : [];
  });
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, nested]) => [key, ...objectKeys(nested)]);
}

describe('internal Antalya hotel evidence contract', () => {
  it('contains exactly the three approved initial records', () => {
    expect(antalyaHotelEvidence).toHaveLength(3);
    expect(antalyaHotelEvidence.map((record) => record.hotelName)).toEqual([
      'Trendy Lara',
      'Regnum Carya',
      "Aydinbey King's Palace & Spa",
    ]);
  });

  it('keeps every record explicitly internal-only', () => {
    expect(antalyaHotelEvidence.every((record) => record.publicationStatus === 'internal-only')).toBe(true);
  });

  it('keeps every operational geography resolved', () => {
    expect(antalyaHotelEvidence.every((record) => record.geography.classificationConfidence !== 'unresolved')).toBe(true);
    expect(antalyaHotelEvidence.map((record) => record.geography.operationalSubArea)).toEqual([
      'Kundu / Kemerağzı coastal resort corridor',
      'Kadriye',
      'Evrenseki',
    ]);
  });

  it('preserves Trendy Lara as Kundu/Aksu and retains the provider conflict', () => {
    const record = antalyaHotelEvidence[0];
    expect(record.geography.operationalArea).toBe('Kundu/Aksu');
    expect(record.geography.providerMarketingLocationLabel).toBe('Lara');
    expect(record.geography.providerGeographyConflict).toBe('yes');
    expect(record.geography.operationalArea).not.toBe('Lara Beach');
  });

  it('preserves both conflicting Trendy Lara airport-time claims', () => {
    const values = antalyaHotelEvidence[0].locationJourneyContext.airportTimeEvidence.map((item) => item.value);
    expect(values).toEqual(['Approximately 15 minutes by car.', 'Approximately 25 minutes by car.']);
    expect(antalyaHotelEvidence[0].locationJourneyContext.airportTimeEvidence.every((item) => item.state === 'conflicted')).toBe(true);
  });

  it('keeps Regnum Carya in Kadriye within the Belek tourism area', () => {
    const record = antalyaHotelEvidence[1];
    expect(record.geography.operationalArea).toBe('Belek tourism area');
    expect(record.geography.operationalSubArea).toBe('Kadriye');
    expect(record.geography.classificationConfidence).toBe('strong');
    expect(record.geography.providerGeographyConflict).toBe('no');
  });

  it('keeps Aydinbey in Evrenseki, not Side historic core', () => {
    const record = antalyaHotelEvidence[2];
    expect(record.geography.operationalSubArea).toBe('Evrenseki');
    expect(record.geography.operationalArea).toBe('Side/Manavgat corridor');
    expect(record.geography.classificationNotes).toMatch(/not classified as Side historic core/i);
    const walking = record.locationJourneyContext.townCityHistoricRelationships.find((item) => item.claim.includes('Walking access'));
    expect(walking?.value).toBe('Not evidenced.');
    expect(walking?.state).toBe('not-stated');
  });

  it('contains no hotel-price or commercial comparison fields', () => {
    const keys = objectKeys(antalyaHotelEvidence).map((key) => key.toLowerCase());
    expect(keys.some((key) => /price|fare|discount|package|value.?score|comparison|ranking/.test(key))).toBe(false);
  });

  it('retains source and checked-date metadata for every material evidence item', () => {
    for (const record of antalyaHotelEvidence) {
      expect(record.officialPropertySource.url).toMatch(/^https?:\/\//);
      expect(record.officialPropertySource.checkedDate).toBe('2026-08-11');
      const items = [
        ...record.propertyFacts,
        ...record.locationJourneyContext.airportTimeEvidence,
        ...(record.locationJourneyContext.airportDistance ? [record.locationJourneyContext.airportDistance] : []),
        ...record.locationJourneyContext.townCityHistoricRelationships,
      ];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.sources.length).toBeGreaterThan(0);
        expect(item.sources.every((source) => source.url.startsWith('https://') && source.checkedDate === '2026-08-11')).toBe(true);
      }
    }
  });

  it('keeps unknown and conflicted information explicit', () => {
    const trendyTimes = antalyaHotelEvidence[0].locationJourneyContext.airportTimeEvidence;
    expect(trendyTimes.some((item) => item.state === 'conflicted')).toBe(true);
    expect(antalyaHotelEvidence[2].locationJourneyContext.airportTimeEvidence).toHaveLength(0);
    expect(antalyaHotelEvidence[2].locationJourneyContext.townCityHistoricRelationships.some((item) => item.state === 'not-stated')).toBe(true);
  });

  it('contains no recommendation, ranking or value language', () => {
    const text = JSON.stringify(antalyaHotelEvidence).toLowerCase();
    expect(text).not.toMatch(/\b(best|top|recommended|recommendation|bargain|great value|luxury|premium)\b/);
  });

  it('is not currently imported by public rendering sources', () => {
    const publicSource = publicRoots
      .flatMap((root) => sourceFilesUnder(root))
      // Only the approved founder prototype may consume this internal module;
      // every other app/components source remains a public-consumer guard.
      .filter((file) => !approvedInternalSources.has(file.replaceAll('\\', '/')))
      .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(publicSource).not.toContain('data/hotel-evidence');
    expect(publicSource).not.toContain('@/data/hotel-evidence');
  });
});
