import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/arrive-by-manchester/google/route';

/**
 * Public Manchester Arrive By beta — structural/source-scan checks, the
 * same convention as tests/arrive-by-pakistan-public.test.ts, adapted for
 * Manchester's transit-first result shape and its shared registry-driven
 * public-enablement gate.
 *
 * MAN's destination-country policy was resolved as an explicit founder
 * decision in Phase 3.1 (expectedCountryCodes: ['GB'] -- see
 * lib/arrive-by-shared/airport-registry.ts): MAN is now public_beta and
 * publiclyEnabled, so the registry gate below proves the public API is
 * genuinely usable rather than self-gating to 404.
 *
 * app/arrive-by/manchester/page.tsx is now a legacy redirect to the
 * unified /arrive-by shell (Phase 4) rather than the page rendering
 * ArriveByManchesterPublic directly -- see tests/arrive-by-shell.test.ts
 * for the shell's own indexing-control and reachability tests.
 */

const publicPagePath = join(process.cwd(), 'app', 'arrive-by', 'manchester', 'page.tsx');
const publicComponentPath = join(process.cwd(), 'components', 'arrive-by-manchester-public.tsx');
const publicApiRoutePath = join(process.cwd(), 'app', 'api', 'arrive-by-manchester', 'google', 'route.ts');
const founderApiRoutePath = join(process.cwd(), 'app', 'api', 'founder', 'arrive-by', 'google', 'route.ts');
const founderPagePath = join(process.cwd(), 'app', 'founder', 'arrive-by', 'page.tsx');
const sitemapPath = join(process.cwd(), 'app', 'sitemap.ts');
const privacyPolicyPath = join(process.cwd(), 'app', 'privacy-policy', 'page.tsx');

const publicPageSrc = readFileSync(publicPagePath, 'utf8');
const publicComponentSrc = readFileSync(publicComponentPath, 'utf8');
const publicApiRouteSrc = readFileSync(publicApiRoutePath, 'utf8');
const founderApiRouteSrc = readFileSync(founderApiRoutePath, 'utf8');
const founderPageSrc = readFileSync(founderPagePath, 'utf8');
const sitemapSrc = readFileSync(sitemapPath, 'utf8');
const privacyPolicySrc = readFileSync(privacyPolicyPath, 'utf8');

describe('public Manchester page is reachable without the founder gate', () => {
  it('the public page never checks FOUNDER_DASHBOARD_ENABLED or calls notFound()', () => {
    expect(publicPageSrc).not.toMatch(/FOUNDER_DASHBOARD_ENABLED/);
    expect(publicPageSrc).not.toMatch(/notFound\(\)/);
  });

  it('the public API route never checks FOUNDER_DASHBOARD_ENABLED or a founder-gate 404', () => {
    expect(publicApiRouteSrc).not.toMatch(/FOUNDER_DASHBOARD_ENABLED/);
  });

  it('the founder route/page are unaffected and remain founder-only', () => {
    expect(founderApiRouteSrc).toContain('founderEnabled()');
    expect(founderPageSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
  });
});

describe('legacy Manchester page redirects to the unified shell (Phase 4)', () => {
  it('redirects to /arrive-by?airport=MAN', () => {
    expect(publicPageSrc).toMatch(/redirect\(['"]\/arrive-by\?airport=MAN['"]\)/);
  });

  it('the legacy route is absent from app/sitemap.ts', () => {
    expect(sitemapSrc).not.toMatch(/arrive-by\/manchester/);
  });

  it('is not linked from main navigation (no reference outside app/arrive-by/manchester or the component itself)', () => {
    // Same fs-scan convention as tests/arrive-by-integrity.test.ts and
    // tests/arrive-by-pakistan-founder-route-access.test.ts — no shelling
    // out, so it can't fail on environment differences.
    const offenders: string[] = [];
    function scan(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (full === publicPagePath || full === publicComponentPath) continue;
          const content = readFileSync(full, 'utf8');
          if (content.includes('arrive-by/manchester')) offenders.push(full);
        }
      }
    }
    scan(join(process.cwd(), 'app'));
    scan(join(process.cwd(), 'components'));
    expect(offenders).toEqual([]);
  });
});

describe('public Manchester API uses the shared, registry-gated engine', () => {
  it('imports the shared journey engine and clean-input validation, not a duplicate implementation', () => {
    expect(publicApiRouteSrc).toMatch(/from ['"]@\/lib\/arrive-by-shared\/manchester-journey['"]/);
    expect(publicApiRouteSrc).toContain('computeManchesterJourney');
    expect(publicApiRouteSrc).toMatch(/from ['"]@\/lib\/arrive-by-shared\/manchester-clean-input['"]/);
    expect(founderApiRouteSrc).toContain('computeManchesterJourney');
  });

  it('checks the airport registry public-enablement gate before serving a journey', () => {
    expect(publicApiRouteSrc).toContain('getAirportProfile');
    expect(publicApiRouteSrc).toContain('canEnablePublicly');
    expect(publicApiRouteSrc).toContain('publiclyEnabled');
  });

  it('uses the shared Arrive By-wide rate limiter', () => {
    expect(publicApiRouteSrc).toMatch(/from ['"]@\/lib\/arrive-by-shared\/rate-limit['"]/);
    expect(publicApiRouteSrc).toContain('checkArriveByRateLimit');
  });

  it('returns 429 with the specified recovery copy when limited', () => {
    expect(publicApiRouteSrc).toMatch(/status:\s*429/);
    expect(publicApiRouteSrc).toContain("You've checked several journeys in a short time. Please wait a moment and try again.");
  });
});

describe('MAN public-enablement gate — genuinely usable now that the country policy is resolved', () => {
  const previousKey = process.env.GOOGLE_ROUTES_API_KEY;
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
    else process.env.GOOGLE_ROUTES_API_KEY = previousKey;
    vi.restoreAllMocks();
  });

  it('the public API no longer self-gates to 404 for a valid MAN request -- it reaches the real engine', async () => {
    process.env.GOOGLE_ROUTES_API_KEY = 'server-test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ZERO_RESULTS' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await POST(new NextRequest('http://localhost/api/arrive-by-manchester/google', {
      method: 'POST',
      body: JSON.stringify({ originId: 'man-terminal-2', destination: 'Sheffield', availableAt: '2026-09-29T12:00', deadline: '2026-09-29T14:30' }),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.201' },
    }));
    expect(response.status).not.toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the geocode call was genuinely attempted, not skipped
    const body = await response.json();
    expect(body).toMatchObject({ transitStatus: 'DESTINATION_PENDING', destinationConfidence: 'UNRESOLVED' });
  });
});

describe('Privacy Policy covers the Arrive By data flow in a single section', () => {
  it('has exactly one Arrive By section (no per-airport sections), titled for journey estimates', () => {
    expect(privacyPolicySrc).toMatch(/Arrive By \(journey estimates\)/);
    const matches = privacyPolicySrc.match(/Arrive By \(/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe('public Manchester component — analytics stay coarse', () => {
  it('sends only airport and outcome (or type and outcome), never destination/venue/placeId/time', () => {
    expect(publicComponentSrc).toContain("track('arrive_by_journey_checked'");
    expect(publicComponentSrc).toContain("track('arrive_by_recovery_used'");
    const trackedProps = [...publicComponentSrc.matchAll(/track\('arrive_by_[a-z_]+',\s*{([^}]*)}\)/g)].map((match) => match[1]);
    for (const props of trackedProps) {
      const keys = [...props.matchAll(/(\w+):/g)].map((m) => m[1]);
      for (const key of keys) expect(['airport', 'outcome', 'type']).toContain(key);
    }
  });
});

describe('public Manchester component — recovery UX', () => {
  it('offers confirm/select controls for NEEDS_CONFIRMATION and NEEDS_SELECTION, not just an error message', () => {
    expect(publicComponentSrc).toContain('confirmPendingPlace');
    expect(publicComponentSrc).toContain('selectCandidate');
    expect(publicComponentSrc).toMatch(/Yes — use this place/);
    expect(publicComponentSrc).toContain('pendingSelection.candidates.map');
  });

  it('the result and pending regions are keyboard/screen-reader focusable and announced', () => {
    expect(publicComponentSrc).toMatch(/aria-live="polite"/);
    expect(publicComponentSrc).toContain('tabIndex={-1}');
    expect(publicComponentSrc).toContain('resultRef.current?.focus()');
  });

  it('states the result is an estimate, not a guarantee', () => {
    expect(publicComponentSrc).toMatch(/estimate, not a guarantee/i);
  });
});
