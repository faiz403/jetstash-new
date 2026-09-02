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

// Homepage hero integration (September 2026): JourneyCheckForm now renders
// inside HomepageOpeningHero itself, not directly in journey-desk-home.tsx —
// journey-desk-home.tsx still computes the underlying data and passes it
// down as a prop.
const heroSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/homepage-opening-hero.tsx'), 'utf8');

describe('JourneyCheckForm is wired onto the public homepage — inside the hero itself', () => {
  it('journey-desk-home.tsx computes journeyCheck and passes it to the hero, which imports and renders the real form', () => {
    expect(homeSrc).toContain("import type { JourneyCheckData } from '@/components/homepage-v2/journey-check-form';");
    expect(homeSrc).toContain('<HomepageOpeningHero journeyCheck={journeyCheck} />');
    expect(heroSrc).toContain("import { JourneyCheckForm, type JourneyCheckData } from '@/components/homepage-v2/journey-check-form';");
    expect(heroSrc).toContain('<JourneyCheckForm origins={journeyCheck.origins} destinations={journeyCheck.destinations} routeIndex={journeyCheck.routeIndex} />');
  });

  // Founder final order (August 2026, superseded September 2026): "Check a
  // journey" is the PRIMARY customer task; the SECONDARY Route Atlas
  // exploration experience renders below it. Previously that meant the form
  // rendered in its own section before the Atlas; now the form lives inside
  // the hero, which itself renders before the Atlas — same ordering intent.
  it('the hero (containing the form) renders before the Atlas — the primary task, then the secondary exploration experience below it', () => {
    const atlasIndex = homeSrc.indexOf('<AtlasFeelTest');
    const heroIndex = homeSrc.indexOf('<HomepageOpeningHero');
    expect(atlasIndex).toBeGreaterThan(-1);
    expect(heroIndex).toBeGreaterThan(-1);
    expect(heroIndex).toBeLessThan(atlasIndex);
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
