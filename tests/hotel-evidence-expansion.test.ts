import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expansionHotelEvidence, getExpansionHotelEvidenceForDestination } from '@/data/hotel-evidence-expansion';
import { getPublicHotelExamples, getStayAreaCopy, hasHolidayIntelligence } from '@/lib/holiday-intelligence';
import { destinationStayAreaCopy } from '@/lib/hotel-stay-areas';
import { getTripComHotelUrl, hasTripComHotelLink } from '@/lib/hotel-booking-links';
import { getDestinationBySlug } from '@/data/destinations';

/**
 * Hotel Intelligence + Monetisation Expansion (August 2026) — the
 * generalized, multi-destination sibling of tests/hotel-evidence.test.ts,
 * tests/antalya-holiday-intelligence-public.test.ts and
 * tests/antalya-hotel-affiliate-mvp.test.ts. Antalya's own pilot suite is
 * untouched; this file guards the same safety properties for every
 * destination added by this expansion instead.
 *
 * Final expansion activation batch (August 2026): all 26 expansion
 * properties across all 9 expansion destinations now have real Trip.com
 * affiliate links — the Dubai/Madinah/Dalaman pilot (9 properties) plus the
 * Istanbul/Marrakech/Bodrum/Agadir/Barcelona/Faro final six (17
 * properties), all generated via the Trip.com Affiliate Platform's
 * Create-links tool and verified distinct in that tool's own link history
 * before being copied into lib/hotel-booking-links.ts. No expansion
 * destination is parked any longer. The `hasHolidayIntelligence()`
 * allowlist-vs-evidence architecture stays in the code regardless — a
 * future destination could still be added to the evidence file without
 * being on the public allowlist — but as of this batch every evidenced
 * expansion destination also happens to be on the allowlist.
 */

const publicRoots = ['app', 'components'];
const approvedInternalSources = new Set<string>([
  // Antalya's own founder-preview pages already exist and consume
  // data/hotel-evidence.ts directly — unrelated to this expansion.
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

const pageSrc = readFileSync(join(process.cwd(), 'app', 'destinations', '[slug]', 'page.tsx'), 'utf8');
const componentSrc = readFileSync(join(process.cwd(), 'components', 'destination', 'holiday-intelligence.tsx'), 'utf8');

const EXPANSION_DESTINATION_SLUGS = ['dubai', 'istanbul', 'marrakech', 'dalaman', 'bodrum', 'agadir', 'barcelona', 'faro', 'madinah'];

describe('expansion hotel evidence contract', () => {
  it('covers exactly the Tier 1 + Madinah destinations approved for this pass', () => {
    const slugs = [...new Set(expansionHotelEvidence.map((r) => r.destinationSlug))].sort();
    expect(slugs).toEqual([...EXPANSION_DESTINATION_SLUGS].sort());
  });

  it('gives every destination at least 2 properties and never more than 4', () => {
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      const records = getExpansionHotelEvidenceForDestination(slug);
      expect(records.length, slug).toBeGreaterThanOrEqual(2);
      expect(records.length, slug).toBeLessThanOrEqual(4);
    }
  });

  it('keeps every record explicitly internal-only', () => {
    expect(expansionHotelEvidence.every((r) => r.publicationStatus === 'internal-only')).toBe(true);
  });

  it('keeps every operational geography resolved (never unresolved)', () => {
    expect(expansionHotelEvidence.every((r) => r.geography.classificationConfidence !== 'unresolved')).toBe(true);
  });

  it('gives every record at least one official (non-Trip.com) source plus a checked date', () => {
    for (const record of expansionHotelEvidence) {
      expect(record.officialPropertySource.url, record.evidenceId).toMatch(/^https?:\/\//);
      expect(record.officialPropertySource.url, record.evidenceId).not.toContain('trip.com');
      expect(record.officialPropertySource.checkedDate, record.evidenceId).toBe('2026-08-15');
      expect(record.propertyFacts.length, record.evidenceId).toBeGreaterThan(0);
      for (const item of record.propertyFacts) {
        expect(item.sources.length, `${record.evidenceId}: ${item.claim}`).toBeGreaterThan(0);
      }
    }
  });

  it('contains no hotel-price or commercial comparison fields', () => {
    const text = JSON.stringify(expansionHotelEvidence).toLowerCase();
    expect(text).not.toMatch(/\bprice\b|\bfare\b|\bdiscount\b|\bvalue.?score\b/);
  });

  it('contains no recommendation, ranking or superlative language', () => {
    const text = JSON.stringify(expansionHotelEvidence).toLowerCase();
    expect(text).not.toMatch(/\b(best|top|perfect|recommended|great value|cheapest|ideal|luxury)\b/);
  });

  it('data/hotel-evidence-expansion.ts never imports lib/hotel-booking-links.ts or contains a real affiliate URL (evidence and commercial handoff stay separate files, matching the Antalya precedent)', () => {
    const src = readFileSync(join(process.cwd(), 'data', 'hotel-evidence-expansion.ts'), 'utf8');
    expect(src).not.toContain('Allianceid');
    expect(src).not.toMatch(/from ['"]@\/lib\/hotel-booking-links['"]/);
    // Plain Trip.com property-page URLs (providerPropertyUrl, corroborating
    // sources) are expected here for identity confirmation, same as Antalya
    // — only the dashboard-generated affiliate query string is forbidden.
    expect(src).not.toMatch(/trip\.com\/[^'"]*Allianceid=/);
  });

  it('is not imported directly by app/ or components/ — only lib/holiday-intelligence.ts may read raw evidence', () => {
    const publicSource = publicRoots
      .flatMap((root) => sourceFilesUnder(root))
      .filter((file) => !approvedInternalSources.has(file.replaceAll('\\', '/')))
      .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(publicSource).not.toContain('data/hotel-evidence-expansion');
  });

  it('every property\'s evidenceId is prefixed with its destinationSlug', () => {
    for (const record of expansionHotelEvidence) {
      expect(record.evidenceId.startsWith(`${record.destinationSlug}-`), record.evidenceId).toBe(true);
    }
  });

  it('Bodrum Beach Resort\'s Yalıçiftlik/Gümbet conflict is documented as resolved, not silently dropped (final expansion batch, August 2026)', () => {
    const record = expansionHotelEvidence.find((r) => r.evidenceId === 'bodrum-bodrum-beach-resort-gumbet-2026-08-15')!;
    // Re-investigated rather than "structured address wins": the official
    // site's own "Located in Yalıçiftlik" sentence also names a different
    // hotel ("Bodrum Park Resort") — a copy-paste template error, not a
    // genuine alternate-location claim — so this is now treated as resolved
    // (not merely disclosed-with-caveat), corroborated by Trip.com's own
    // city-tagged listing URL and independent third-party sources.
    expect(record.geography.providerGeographyConflict).toBe('no');
    expect(record.geography.classificationConfidence).toBe('strong');
    expect(record.geography.classificationNotes.toLowerCase()).toContain('yalıçiftlik'.toLowerCase());
    expect(record.geography.classificationNotes.toLowerCase()).toContain('gümbet'.toLowerCase());
    expect(record.geography.operationalArea).toBe('Gümbet');
  });

  it('Madinah records use hotel-published wording for proximity claims, never an invented figure', () => {
    const records = getExpansionHotelEvidenceForDestination('madinah');
    expect(records).toHaveLength(2);
    for (const record of records) {
      const proximityFact = record.propertyFacts.find((f) => f.claim.toLowerCase().includes('proximity') || f.claim.toLowerCase().includes('walking distance'));
      expect(proximityFact, record.evidenceId).toBeDefined();
      expect(proximityFact!.method, record.evidenceId).toMatch(/hotel-published|official/i);
    }
    // JetStash's own limitations note explicitly disclaims ranking the two
    // properties against each other, even though each property's own quoted
    // claim ("nearest hotel to the Ladies' Prayer Entrance") is allowed to
    // stand as their own marketing language.
    const combinedLimitations = records.flatMap((r) => r.limitations).join(' ').toLowerCase();
    expect(combinedLimitations).toMatch(/no claim about which.*is closer|not a ranked pair/);
  });
});

describe('stay-area copy contract', () => {
  it('every destination with expansion evidence also has stay-area copy, and vice versa (Antalya excluded — its evidence lives in the separate, pinned data/hotel-evidence.ts, but it still gets a copy entry with areas: [] so the shared component can render its unchanged heading/intro)', () => {
    const evidenceSlugs = new Set(expansionHotelEvidence.map((r) => r.destinationSlug));
    const copySlugs = new Set(destinationStayAreaCopy.map((c) => c.destinationSlug).filter((slug) => slug !== 'antalya'));
    expect([...evidenceSlugs].sort()).toEqual([...copySlugs].sort());

    const antalyaCopy = destinationStayAreaCopy.find((c) => c.destinationSlug === 'antalya');
    expect(antalyaCopy).toBeDefined();
    expect(antalyaCopy!.areas).toEqual([]);
    expect(antalyaCopy!.heading).toBe('Where to stay in Antalya');
  });

  it('never uses ranking language ("best area") in area descriptions', () => {
    const text = JSON.stringify(destinationStayAreaCopy).toLowerCase();
    expect(text).not.toMatch(/\bbest area\b|\btop area\b|\bbest choice\b/);
  });

  it('Madinah copy explicitly disclaims quality/ranking judgement', () => {
    const madinah = getStayAreaCopy('madinah');
    expect(madinah).not.toBeNull();
    expect(madinah!.gatewayNote?.toLowerCase()).toContain('does not rank properties');
  });

  it('Dalaman and Faro carry a gateway note (never presented as one resort)', () => {
    expect(getStayAreaCopy('dalaman')?.gatewayNote).toBeTruthy();
    expect(getStayAreaCopy('faro')?.gatewayNote).toBeTruthy();
  });
});

describe('public projection safety (lib/holiday-intelligence.ts)', () => {
  it('every destination surfaces a public hotel example with a non-empty location note', () => {
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      const examples = getPublicHotelExamples(slug);
      expect(examples.length, slug).toBeGreaterThan(0);
      for (const example of examples) {
        expect(example.locationNote.length, `${slug}: ${example.hotelName}`).toBeGreaterThan(0);
        expect(example.factualSignals.length, `${slug}: ${example.hotelName}`).toBeGreaterThan(0);
      }
    }
  });

  it('the public projection carries no internal evidence detail, price, rating or ranking language', () => {
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      const publicCopy = JSON.stringify(getPublicHotelExamples(slug)).toLowerCase();
      expect(publicCopy, slug).not.toContain('internal-only');
      expect(publicCopy, slug).not.toContain('providerpropertyurl');
      expect(publicCopy, slug).not.toContain('"sources"');
      expect(publicCopy, slug).not.toMatch(/£|\bprice\b|availability|\bpackage\b|\brating\b|\breview\b|\bdiscount\b/);
      expect(publicCopy, slug).not.toMatch(/\bbest\b|\brecommended\b|\btop pick\b|\brank\b|\bcheapest\b/);
    }
  });

  it('all 26 expansion properties across all 9 expansion destinations have real, non-null bookingUrls', () => {
    let liveExampleCount = 0;
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      const examples = getPublicHotelExamples(slug);
      for (const example of examples) {
        expect(example.bookingUrl, `${slug}: ${example.hotelName}`).not.toBeNull();
        expect(example.bookingUrl, `${slug}: ${example.hotelName}`).toMatch(/^https:\/\/(www|us|in)\.trip\.com\/hotels\/[^?]*hotel-detail-\d+\//);
        liveExampleCount += 1;
      }
    }
    expect(liveExampleCount).toBe(26); // 4 Dubai + 2 Madinah + 3 Dalaman + 3 Istanbul + 3 Marrakech + 3 Bodrum + 2 Agadir + 3 Barcelona + 3 Faro

    // Corroborated at the lookup-table level too — every expansion evidence
    // record resolves to a real link, none fail closed any longer.
    for (const record of expansionHotelEvidence) {
      expect(hasTripComHotelLink(record.evidenceId), record.evidenceId).toBe(true);
      expect(getTripComHotelUrl(record.evidenceId), record.evidenceId).not.toBeNull();
    }
  });

  it('every one of the 26 real URLs is dateless, carries the correct Allianceid/SID, and points to the exact-property detail page (never a search/listing page)', () => {
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      for (const record of getExpansionHotelEvidenceForDestination(slug)) {
        const url = getTripComHotelUrl(record.evidenceId)!;
        expect(url, record.evidenceId).not.toBeNull();
        expect(url, record.evidenceId).toContain('Allianceid=9804124');
        expect(url, record.evidenceId).toContain('SID=327450313');
        expect(url, record.evidenceId).toMatch(/trip_sub3=D\d+/);
        expect(url, record.evidenceId).not.toMatch(/checkIn=|checkOut=/);
        expect(url, record.evidenceId).toMatch(/\/hotels\/[^?]*hotel-detail-\d+\//);
      }
    }
  });

  it('all 26 real trip_sub3 tracking values are unique — no property accidentally shares another\'s generated link', () => {
    const tripSub3Values: string[] = [];
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      for (const record of getExpansionHotelEvidenceForDestination(slug)) {
        const url = getTripComHotelUrl(record.evidenceId)!;
        const match = url.match(/trip_sub3=(D\d+)/);
        expect(match, record.evidenceId).not.toBeNull();
        tripSub3Values.push(match![1]);
      }
    }
    expect(tripSub3Values).toHaveLength(26);
    expect(new Set(tripSub3Values).size).toBe(26);
  });

  it('hasHolidayIntelligence() is true for the complete, frozen 10-destination public set (Antalya + all 9 expansion destinations)', () => {
    const PUBLIC_SLUGS = ['antalya', ...EXPANSION_DESTINATION_SLUGS];
    expect(PUBLIC_SLUGS.sort()).toEqual(
      ['antalya', 'dubai', 'madinah', 'dalaman', 'istanbul', 'marrakech', 'bodrum', 'agadir', 'barcelona', 'faro'].sort(),
    );

    for (const slug of PUBLIC_SLUGS) {
      expect(hasHolidayIntelligence(slug), slug).toBe(true);
    }
    expect(hasHolidayIntelligence('mumbai')).toBe(false);
    expect(hasHolidayIntelligence('not-a-real-destination')).toBe(false);
  });
});

describe('component fail-closed CTA rendering', () => {
  it('only renders the CTA inside an `example.bookingUrl &&` guard — never unconditionally', () => {
    expect(componentSrc).toContain('example.bookingUrl && (');
    expect(componentSrc).toContain('href={example.bookingUrl}');
  });

  it('returns null entirely when a destination has no stay-area copy or no evidence, never a half-empty section', () => {
    expect(componentSrc).toContain('if (!stayAreaCopy || examples.length === 0) return null;');
  });

  it('never hardcodes a price, rating or discount figure', () => {
    expect(componentSrc).not.toMatch(/£\d/);
    expect(componentSrc).not.toMatch(/\brating\b/i);
    expect(componentSrc).not.toMatch(/\bdiscount\b/i);
  });

  it('keeps the "not a ranking or recommendation" disclosure verbatim', () => {
    expect(componentSrc).toContain('Factual examples only, not a ranking or recommendation.');
  });

  it('uses the hotel-specific CTA disclosure sentence and label, matching the Antalya pattern', () => {
    expect(componentSrc).toContain('Check current price on Trip.com');
    expect(componentSrc).toContain('Check the property, dates and booking terms before paying.');
    expect(componentSrc).toContain('<AffiliateLinkDisclosure providerName="Trip.com"');
  });

  it('fires tripcom_hotel_click for the hotel CTA and tripcom_click for the flight handoff, each exactly once in source', () => {
    expect(componentSrc.match(/event="tripcom_hotel_click"/g)).toHaveLength(1);
    expect(componentSrc.match(/event="tripcom_click"/g)).toHaveLength(1);
  });

  it('sends only route + source on both tracked links, never a raw URL or personal data (source is analyticsSource — a per-destination string, still exactly 2 keys)', () => {
    expect(componentSrc).toMatch(/properties=\{\{ route: `\$\{handoff\.airportSlug\}-\$\{destination\.slug\}`, source: analyticsSource \}\}/);
    expect(componentSrc).toMatch(/properties=\{\{ route: destination\.slug, source: analyticsSource \}\}/);
    // analyticsSource itself only ever resolves to one of two known, non-PII strings.
    expect(componentSrc).toContain("const analyticsSource = destination.slug === 'antalya' ? 'antalya-holiday-intelligence' : 'holiday-intelligence';");
  });

  it('every hotel CTA opens in a new tab with the safe rel attribute', () => {
    expect(componentSrc).toContain('rel={HOTEL_PROVIDER_REL}');
  });
});

describe('destination page wiring', () => {
  it('wires HolidayIntelligence for every destination through one shared gate — hasHolidayIntelligence decides which render, not the page', () => {
    expect(pageSrc).toContain('hasHolidayIntelligence(dest.slug)');
    expect(pageSrc).toContain('<HolidayIntelligence');
    expect(pageSrc).not.toContain('AntalyaHolidayIntelligence');
  });

  it('never imports the raw expansion evidence module directly in the page', () => {
    expect(pageSrc).not.toContain('hotel-evidence-expansion');
  });

  it('every expansion destination slug actually exists as a published Destination', () => {
    for (const slug of EXPANSION_DESTINATION_SLUGS) {
      expect(getDestinationBySlug(slug), slug).toBeDefined();
    }
  });
});
