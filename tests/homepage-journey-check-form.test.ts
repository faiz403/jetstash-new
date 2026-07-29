import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { routes } from '@/data/routes';
import { airports } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';

/**
 * JourneyCheckForm — the fast-path "I already know my route" companion
 * restored alongside the Route Atlas (the Atlas is a browse/discovery
 * surface; this is the direct handover the old PullBriefHero used to
 * provide before it was replaced). journey-check-form.tsx is 'use client'
 * (refs to useState/useRouter), so — same reasoning as
 * homepage-manchester-mumbai-visual.test.ts and
 * homepage-route-check-copy.test.ts — these are source-text regression
 * assertions on the real component, not a rendered/mocked one.
 */

const homeSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/journey-desk-home.tsx'), 'utf8');
const formSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/journey-check-form.tsx'), 'utf8');

describe('JourneyCheckForm is wired onto the public homepage', () => {
  it('journey-desk-home.tsx imports and renders it', () => {
    expect(homeSrc).toContain("import { JourneyCheckForm, type JourneyCheckData } from '@/components/homepage-v2/journey-check-form';");
    expect(homeSrc).toContain('<JourneyCheckForm origins={journeyCheck.origins} destinations={journeyCheck.destinations} routeIndex={journeyCheck.routeIndex} />');
  });

  it('the Atlas is still the first thing rendered — the form is a companion below it, not a replacement', () => {
    const atlasIndex = homeSrc.indexOf('<AtlasFeelTest');
    const formIndex = homeSrc.indexOf('<JourneyCheckForm');
    expect(atlasIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeGreaterThan(atlasIndex);
  });

  it('origins/destinations/routeIndex are computed from the real tracked-route data, not fabricated', () => {
    expect(homeSrc).toContain('routes.map((r) => r.airportSlug)');
    expect(homeSrc).toContain('routes.map((r) => r.destinationSlug)');
    expect(homeSrc).toContain('getDestinationBySlug(slug)');
    expect(homeSrc).toContain('routeIndex[`${r.airportSlug}|${r.destinationSlug}`] = r.slug');
  });
});

describe('JourneyCheckForm never resolves to a dead end', () => {
  it('a tracked pairing opens its real route guide', () => {
    expect(formSrc).toContain('router.push(routeSlug ? `/routes/${routeSlug}` : `/destinations/${toSlug}`)');
  });

  it('has no coupling to the retired pull-brief/flagship-status machinery', () => {
    expect(formSrc).not.toMatch(/from ['"].*pull-brief/);
    expect(formSrc).not.toContain('flagship-status-copy');
    expect(formSrc).not.toContain('FlagshipStatusPresentation');
  });
});

describe('the underlying tracked-route data this form depends on is internally consistent', () => {
  it('every route resolves to a real origin airport and a real destination', () => {
    for (const r of routes) {
      expect(airports.some((a) => a.slug === r.airportSlug), `missing airport for route ${r.slug}`).toBe(true);
      expect(getDestinationBySlug(r.destinationSlug), `missing destination for route ${r.slug}`).toBeDefined();
    }
  });

  it('at least one tracked route exists, so the form never renders with empty selects', () => {
    expect(routes.length).toBeGreaterThan(0);
  });
});
