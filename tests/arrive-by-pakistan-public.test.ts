import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cleanInput } from '@/lib/arrive-by-pakistan/clean-input';

/**
 * Public Pakistan Arrive By beta — structural/source-scan checks, the same
 * readFileSync + regex convention as tests/arrive-by-pakistan-founder-route-
 * access.test.ts, adapted for a route that is meant to be publicly
 * reachable rather than founder-gated.
 */

const publicPagePath = join(process.cwd(), 'app', 'arrive-by', 'pakistan', 'page.tsx');
const publicComponentPath = join(process.cwd(), 'components', 'arrive-by-pakistan-public.tsx');
const publicApiRoutePath = join(process.cwd(), 'app', 'api', 'arrive-by-pakistan', 'google', 'route.ts');
const founderApiRoutePath = join(process.cwd(), 'app', 'api', 'founder', 'arrive-by-pakistan', 'google', 'route.ts');
const founderPagePath = join(process.cwd(), 'app', 'founder', 'arrive-by-pakistan', 'page.tsx');
const sitemapPath = join(process.cwd(), 'app', 'sitemap.ts');
const privacyPolicyPath = join(process.cwd(), 'app', 'privacy-policy', 'page.tsx');

const publicPageSrc = readFileSync(publicPagePath, 'utf8');
const publicComponentSrc = readFileSync(publicComponentPath, 'utf8');
const publicApiRouteSrc = readFileSync(publicApiRoutePath, 'utf8');
const founderApiRouteSrc = readFileSync(founderApiRoutePath, 'utf8');
const founderPageSrc = readFileSync(founderPagePath, 'utf8');
const sitemapSrc = readFileSync(sitemapPath, 'utf8');
const privacyPolicySrc = readFileSync(privacyPolicyPath, 'utf8');

describe('public page is reachable without the founder gate', () => {
  it('the public page never checks FOUNDER_DASHBOARD_ENABLED or calls notFound()', () => {
    expect(publicPageSrc).not.toMatch(/FOUNDER_DASHBOARD_ENABLED/);
    expect(publicPageSrc).not.toMatch(/notFound\(\)/);
  });

  it('the public API route never checks FOUNDER_DASHBOARD_ENABLED or returns a founder-gate 404', () => {
    expect(publicApiRouteSrc).not.toMatch(/FOUNDER_DASHBOARD_ENABLED/);
  });

  it('the founder route/page are unaffected and remain founder-only', () => {
    expect(founderApiRouteSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(founderPageSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
  });
});

describe('public page indexing controls', () => {
  it('the public page sets robots index:false, follow:true — visible to a visitor with the link, not promoted for search discovery yet', () => {
    expect(publicPageSrc).toMatch(/robots:\s*{\s*index:\s*false,\s*follow:\s*true\s*}/);
  });

  it('the public page is absent from app/sitemap.ts', () => {
    expect(sitemapSrc).not.toMatch(/arrive-by\/pakistan/);
  });
});

describe('public API rate limiting', () => {
  it('uses the existing shared best-effort limiter (lib/form-security.ts), not a new implementation', () => {
    expect(publicApiRouteSrc).toMatch(/from ['"]@\/lib\/form-security['"]/);
    expect(publicApiRouteSrc).toContain('checkRateLimit');
    expect(publicApiRouteSrc).toContain('getClientIdentifier');
  });

  it('returns 429 with the specified recovery copy when limited', () => {
    expect(publicApiRouteSrc).toMatch(/status:\s*429/);
    expect(publicApiRouteSrc).toContain("You've checked several journeys in a short time. Please wait a moment and try again.");
  });

  it('is documented as best-effort, not a hard cap or distributed guarantee — matches the founder-approved framing', () => {
    expect(publicApiRouteSrc).toMatch(/best-effort/i);
    expect(publicApiRouteSrc).not.toMatch(/hard (spend )?cap/i);
  });
});

describe('input hardening — confirmedPlaceId/selectedPlaceId length bound', () => {
  const baseInput = {
    airportCode: 'ISB',
    landingAt: '2026-11-17T12:00',
    airportExitBufferMinutes: 60,
    destination: 'Mirpur',
    pickupMode: 'family',
  };

  it('accepts a normal-length confirmedPlaceId', () => {
    expect(() => cleanInput({ ...baseInput, confirmedPlaceId: 'ChIJ4_tdLSsCGTkRl6Zkdabbv4c' })).not.toThrow();
  });

  it('rejects a confirmedPlaceId over 200 characters', () => {
    expect(() => cleanInput({ ...baseInput, confirmedPlaceId: 'x'.repeat(201) })).toThrow();
  });

  it('rejects a selectedPlaceId over 200 characters', () => {
    expect(() => cleanInput({ ...baseInput, selectedPlaceId: 'x'.repeat(201) })).toThrow();
  });

  it('accepts a selectedPlaceId at exactly the 200-character boundary', () => {
    expect(() => cleanInput({ ...baseInput, selectedPlaceId: 'x'.repeat(200) })).not.toThrow();
  });
});

describe('Privacy Policy covers Arrive By', () => {
  it('has one section covering both Manchester and Pakistan, describing the real data flow', () => {
    expect(privacyPolicySrc).toMatch(/Arrive By \(Manchester and Pakistan journey estimates\)/);
    expect(privacyPolicySrc).toMatch(/Geocoding and Routes services/);
    expect(privacyPolicySrc).toMatch(/place identifier may be used transiently/);
    expect(privacyPolicySrc).toMatch(/never send your stated\s+reason for a deadline to Google/i);
    expect(privacyPolicySrc).toMatch(/nearest\s+venue or locality instead of an exact address/i);
  });
});

describe('analytics — coarse public events only', () => {
  it('the public component fires both new event names', () => {
    expect(publicComponentSrc).toContain("'arrive_by_pk_journey_checked'");
    expect(publicComponentSrc).toContain("'arrive_by_pk_recovery_used'");
  });

  it('journey_checked carries only airport and outcome — never destination, venue, place, or a time', () => {
    const match = publicComponentSrc.match(/track\('arrive_by_pk_journey_checked',\s*({[^}]*})\)/);
    expect(match).not.toBeNull();
    const propsSrc = match![1];
    expect(propsSrc).toMatch(/airport/);
    expect(propsSrc).toMatch(/outcome/);
    expect(propsSrc).not.toMatch(/destination|venue|place|time|deadline/i);
  });

  it('recovery_used carries only type and outcome — never destination, venue, or a place_id VALUE (its source may reference confirmedPlaceId only to decide which coarse label to send, never to send the id itself)', () => {
    const match = publicComponentSrc.match(/track\('arrive_by_pk_recovery_used',\s*({[^}]*})\)/);
    expect(match).not.toBeNull();
    const propsSrc = match![1];
    expect(propsSrc).toMatch(/type:/);
    expect(propsSrc).toMatch(/outcome:/);
    // Only two keys are ever sent as properties: "type" and "outcome".
    const keys = [...propsSrc.matchAll(/(\w+):/g)].map((m) => m[1]);
    expect(keys).toEqual(['type', 'outcome']);
  });

  it('never logs or persists what the analytics call itself must not carry either', () => {
    expect(publicComponentSrc).not.toMatch(/console\.(log|error|warn|info)\(/);
  });
});

describe('ROUTE_UNAVAILABLE recovery copy', () => {
  it('tells the user a concrete next step, not just that it failed', async () => {
    const { readFileSync: read } = await import('fs');
    const outcomesSrc = read(join(process.cwd(), 'lib', 'arrive-by-pakistan', 'outcomes.ts'), 'utf8');
    expect(outcomesSrc).toMatch(/Try a nearby town, venue or landmark instead/);
    expect(publicComponentSrc).toMatch(/Try a nearby town, venue or landmark instead/);
  });
});

describe('the public and founder surfaces share the same underlying engine, not a duplicated copy', () => {
  it('both API routes import computePakistanJourney and cleanInput from the same shared modules', () => {
    for (const src of [publicApiRouteSrc, founderApiRouteSrc]) {
      expect(src).toMatch(/from ['"]@\/lib\/arrive-by-pakistan\/journey['"]/);
      expect(src).toMatch(/from ['"]@\/lib\/arrive-by-pakistan\/clean-input['"]/);
    }
  });

  it('the public API route never exposes GOOGLE_ROUTES_API_KEY client-side and only reads it server-side', () => {
    expect(publicApiRouteSrc).toContain('process.env.GOOGLE_ROUTES_API_KEY');
    expect(publicComponentSrc).not.toMatch(/GOOGLE_ROUTES_API_KEY/);
    expect(publicPageSrc).not.toMatch(/GOOGLE_ROUTES_API_KEY/);
  });
});

describe('accessibility carried over from the founder prototype', () => {
  it('the public component keeps aria-live and focus-on-result', () => {
    expect(publicComponentSrc).toMatch(/aria-live="polite"/);
    expect(publicComponentSrc).toMatch(/resultRef\.current\?\.focus\(\)/);
  });

  it('confirmation and selection still use native, keyboard-operable buttons', () => {
    expect(publicComponentSrc).toMatch(/Yes — use this place/);
    expect(publicComponentSrc).toMatch(/No — change destination/);
    expect(publicComponentSrc).toMatch(/type="button"/);
  });
});
