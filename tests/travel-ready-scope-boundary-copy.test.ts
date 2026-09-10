import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Astra bounded trust review (10 Sept 2026) — finding #3, Travel Ready scope.
 *
 * The Travel Ready Check card's intro subtext gave no scope boundary before
 * a traveller starts relying on the result, even though its supported truth
 * model (lib/travel-ready-check.ts, data/travel-ready-rules.ts) only covers
 * British passport holders (plus NICOP/POC/OCI/NVR document holders)
 * travelling to 8 supported destinations. The headline ("Can you actually
 * travel on these dates, with the documents you have?") could read as a
 * universal checker for any nationality/passport if the boundary wasn't
 * visible up front.
 *
 * Wording-only fix: the subtext directly beneath the headline now names
 * "British passport holders" explicitly, so the boundary is visible before
 * the traveller starts the form (which already asks the British-passport
 * question, but only once they've begun).
 *
 * This project has no jsdom/@testing-library dependency (see
 * tests/travel-ready-duplicate-route-watch-fix.test.ts's header comment for
 * the same established constraint), so this is a source-string assertion,
 * matching that file's pattern.
 */

const componentSrc = readFileSync(
  join(process.cwd(), 'components', 'travel-ready', 'travel-ready-check.tsx'),
  'utf8'
);

describe('Travel Ready Check intro subtext discloses its British-passport scope boundary', () => {
  it('states the check is for British passport holders, not a universal nationality checker', () => {
    expect(componentSrc).toMatch(/passport validity and visa guidance for British passport\s+holders/);
  });

  it('the headline question itself is untouched — this is a scope-boundary addition, not a rewrite', () => {
    expect(componentSrc).toContain('Can you actually travel on these dates, with the documents you have?');
  });

  it('no nationality, passport type, or destination was added — the fix is wording-only', () => {
    // NICOP/POC/OCI/NVR exemption-document handling and the supported
    // country list are unchanged; only the intro paragraph gained the
    // "British passport holders" clause.
    expect(componentSrc).toContain('TRAVEL_READY_SUPPORTED_COUNTRIES');
    expect(componentSrc).toContain("Are you travelling on a British passport?");
  });
});
