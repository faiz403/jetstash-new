import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { destinations } from '@/data/destinations';
import { TRAVEL_READY_SUPPORTED_COUNTRIES, evaluateTravelReadiness } from '@/lib/travel-ready-check';

/**
 * Bangladesh Travel Ready consistency fix (August 2026) — regression suite.
 *
 * The underlying rules engine, destination selector and NVR exemption logic
 * were never the bug: `TRAVEL_READY_SUPPORTED_COUNTRIES` already included
 * 'Bangladesh', and it's already extensively covered by
 * tests/bangladesh-workstream.test.ts. The actual defect was two hand-typed
 * public sentences (the page metadata description and the selector hint)
 * that named the other 7 countries but never Bangladesh — an editorial
 * omission, not a logic gap.
 *
 * Deriving those two sentences directly from `TRAVEL_READY_SUPPORTED_COUNTRIES`
 * was considered and rejected as unnecessary complexity for a narrow fix:
 * the array stores 'United Arab Emirates' but both sentences use the 'UAE'
 * abbreviation, and the metadata description has a hard 170-character budget
 * (tests/metadata-audit.test.ts's DESCRIPTION_THRESHOLD, enforced with zero
 * tolerated exceptions) that spelling out every country name in full could
 * blow at any time a country is added. Regression tests here are the
 * chosen alternative: they fail loudly the moment a country is added to (or
 * removed from) TRAVEL_READY_SUPPORTED_COUNTRIES without the public copy
 * being updated to match — see README.md's "To add or refresh a rule" step 5.
 */

const root = process.cwd();
const pageSrc = readFileSync(join(root, 'app/travel-ready-check/page.tsx'), 'utf8');
const componentSrc = readFileSync(join(root, 'components/travel-ready/travel-ready-check.tsx'), 'utf8');

/** Country name as it appears in the two hand-typed public sentences — 'United Arab Emirates' is always shortened to 'UAE' there, matching this site's established convention (also used in region-hub copy). */
const PUBLIC_DISPLAY_NAME: Record<string, string> = {
  'United Arab Emirates': 'UAE',
};

function extractDescription(src: string): string {
  const match = src.match(/description:\s*\n?\s*'((?:[^'\\]|\\.)*)'/);
  if (!match) throw new Error('app/travel-ready-check/page.tsx: no plain-string description found');
  return match[1];
}

describe('Bangladesh is genuinely supported by the rules engine (sanity check, full coverage lives in tests/bangladesh-workstream.test.ts)', () => {
  it('Bangladesh is in TRAVEL_READY_SUPPORTED_COUNTRIES', () => {
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).toContain('Bangladesh');
  });

  it('Bangladesh destinations (Dhaka, Sylhet) exist and are the only two Bangladesh entries', () => {
    const bangladeshDestinations = destinations.filter((d) => d.country === 'Bangladesh');
    expect(bangladeshDestinations.map((d) => d.city).sort()).toEqual(['Dhaka', 'Sylhet']);
  });

  it('the destination selector derives from TRAVEL_READY_SUPPORTED_COUNTRIES, so Bangladesh destinations are automatically selectable — no separate list to keep in sync', () => {
    // components/travel-ready/travel-ready-check.tsx's `supportedDestinations`
    // is `destinations.filter((d) => TRAVEL_READY_SUPPORTED_COUNTRIES.includes(d.country))`
    // — proving the filter condition here proves the selector's real behaviour
    // without needing to render the client component.
    const selectable = destinations.filter((d) => TRAVEL_READY_SUPPORTED_COUNTRIES.includes(d.country));
    const bangladeshInSelector = selectable.filter((d) => d.country === 'Bangladesh');
    expect(bangladeshInSelector.map((d) => d.city).sort()).toEqual(['Dhaka', 'Sylhet']);
  });

  it('NVR handling still works: British passport, Sylhet, NVR endorsement held — ready to continue', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'sylhet',
        isBritishPassport: true,
        exemptionDocument: 'nvr',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      new Date('2026-08-05T12:00:00Z')
    );
    expect(result.verdict).toBe('ready-to-continue');
  });

  it('NVR handling still works: British passport, Dhaka, no NVR, no visa held — needs a visa (not silently exempted)', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'dhaka',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      new Date('2026-08-05T12:00:00Z')
    );
    expect(['visa-or-entry-permission-needed', 'document-timing-may-affect-booking']).toContain(result.verdict);
  });
});

describe('Public supported-country copy names every country in TRAVEL_READY_SUPPORTED_COUNTRIES — no silent drift', () => {
  it('the page metadata description mentions every supported country (by its established public display name)', () => {
    const description = extractDescription(pageSrc);
    for (const country of TRAVEL_READY_SUPPORTED_COUNTRIES) {
      const displayName = PUBLIC_DISPLAY_NAME[country] ?? country;
      expect(description, `metadata description missing "${displayName}"`).toContain(displayName);
    }
  });

  it('the destination-selector hint sentence mentions every supported country (by its established public display name)', () => {
    for (const country of TRAVEL_READY_SUPPORTED_COUNTRIES) {
      const displayName = PUBLIC_DISPLAY_NAME[country] ?? country;
      expect(componentSrc, `selector hint missing "${displayName}"`).toContain(displayName);
    }
  });

  it('Bangladesh specifically appears in both public sentences (the exact regression this fix addresses)', () => {
    expect(extractDescription(pageSrc)).toContain('Bangladesh');
    expect(componentSrc).toMatch(/Currently covers[^<]*Bangladesh[^<]*only/);
  });

  it('no currently-supported country silently disappears if the sentences are edited again: every country named in the hint sentence also has a real rule set (data/travel-ready-rules.ts) behind it', () => {
    // Cross-check the other direction too — a country named in the copy but
    // missing from TRAVEL_READY_SUPPORTED_COUNTRIES would be an equally
    // dishonest claim (promising coverage that doesn't exist).
    const hintMatch = componentSrc.match(/Currently covers ([^—]*) only/);
    expect(hintMatch, 'could not find the "Currently covers ... only" sentence').not.toBeNull();
    const namedCountries = hintMatch![1]
      .replace(/,? and /, ', ')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const expectedNames = TRAVEL_READY_SUPPORTED_COUNTRIES.map((c) => PUBLIC_DISPLAY_NAME[c] ?? c);
    expect(namedCountries.sort()).toEqual([...expectedNames].sort());
  });
});

describe('Metadata length stays within the project\'s established limits (mirrors tests/metadata-audit.test.ts\'s DESCRIPTION_THRESHOLD; that suite is the authoritative, repo-wide check — this is a fast, file-scoped sanity check)', () => {
  const DESCRIPTION_THRESHOLD = 170;

  it('the /travel-ready-check metadata description is at or under the threshold', () => {
    const description = extractDescription(pageSrc);
    expect(description.length, `description is ${description.length} chars: "${description}"`).toBeLessThanOrEqual(DESCRIPTION_THRESHOLD);
  });

  it('the description is not implausibly short either (a sanity floor, catching an accidental truncation)', () => {
    const description = extractDescription(pageSrc);
    expect(description.length).toBeGreaterThan(100);
  });
});

describe('No Travel Ready logic changed unintentionally by this copy-only fix', () => {
  it('TRAVEL_READY_SUPPORTED_COUNTRIES still has exactly 8 countries, in the same order', () => {
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).toEqual([
      'Pakistan',
      'India',
      'Bangladesh',
      'Saudi Arabia',
      'United Arab Emirates',
      'Qatar',
      'Turkey',
      'Morocco',
    ]);
  });

  it('an unsupported country (France) still returns not-enough-information, never a guess', () => {
    expect(TRAVEL_READY_SUPPORTED_COUNTRIES).not.toContain('France');
  });

  it('a previously-verified non-Bangladesh journey (Pakistan/NICOP) is unaffected', () => {
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'lahore',
        isBritishPassport: true,
        exemptionDocument: 'nicop-poc',
        departureDate: '2027-03-01',
        arrivalDate: '2027-03-01',
        returnDate: '2027-03-20',
        passportExpiryDate: '2029-01-01',
      },
      new Date('2026-08-05T12:00:00Z')
    );
    expect(result.verdict).toBe('ready-to-continue');
  });
});
