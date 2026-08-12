import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildAtlasAirports } from '@/lib/atlas-network-data';

const atlasSrc = readFileSync(join(process.cwd(), 'components/founder/atlas-feel-test.tsx'), 'utf8');

describe('Route Atlas destination interaction', () => {
  const destinations = buildAtlasAirports().flatMap((airport) =>
    airport.countries.flatMap((country) => country.destinations.map((destination) => ({ airport, country, destination })))
  );

  it('keeps Antalya and Dalaman as real, selectable Manchester destinations', () => {
    const manchester = buildAtlasAirports().find((airport) => airport.airportSlug === 'manchester')!;
    const turkey = manchester.countries.find((country) => country.slug === 'turkey')!;
    expect(turkey.destinations.map((destination) => destination.slug)).toEqual(
      expect.arrayContaining(['antalya', 'dalaman'])
    );
    for (const slug of ['antalya', 'dalaman']) {
      const destination = turkey.destinations.find((item) => item.slug === slug)!;
      expect(destination.href).toBe(`/destinations/${slug}`);
      expect(destination.intelligenceLevel).toBe('expanding');
    }
  });

  it('every visible destination has a valid destination record and a non-empty intelligence panel contract', () => {
    expect(destinations.length).toBeGreaterThan(0);
    for (const { destination } of destinations) {
      expect(destination.slug, destination.label).toMatch(/^[a-z0-9-]+$/);
      expect(destination.label, destination.slug).toBeTruthy();
      expect(destination.href, destination.slug).toBe(`/destinations/${destination.slug}`);
      expect(destination.verdict, destination.slug).toBeTruthy();
      expect(destination.flightTime, destination.slug).toBeTruthy();
    }
  });

  it('uses a painted-independent destination hit layer and keeps labels from intercepting it', () => {
    const destinationBlock = atlasSrc.slice(atlasSrc.indexOf('{/* destinations within the active country'), atlasSrc.indexOf('</svg>'));
    const destinationCircle = destinationBlock.match(/<circle\s+cx=\{d\.x\}\s+cy=\{d\.y\}\s+r=\{destHitRadius[\s\S]*?\/>/)?.[0] ?? '';
    const destinationLabel = destinationBlock.match(/<text x=\{d\.x \+ 2\.7\}[\s\S]*?aria-hidden="true"[^>]*>/)?.[0] ?? '';
    expect(destinationCircle).toContain('pointerEvents="all"');
    expect(destinationCircle).toContain('onClick={() => selectDestination(d.slug)}');
    expect(destinationLabel).toContain('pointerEvents="none"');
  });

  it('keeps close destination hit targets disjoint so neighbouring cities cannot steal a tap', () => {
    expect(atlasSrc).toContain('const effectiveMargin = Math.min(margin, nearestDist * 0.05);');
    expect(atlasSrc).toContain('const lowerBound = Math.min(min, Math.max(0, safe));');
    expect(atlasSrc).toContain('return Math.min(base, Math.max(lowerBound, safe));');
  });

  it('uses one clear legend with the two genuinely different visual layers explained together', () => {
    expect(atlasSrc).toContain('What the colours mean');
    expect(atlasSrc).toContain('Country glow = coverage across that country. Destination dot = research for that specific route.');
    expect(atlasSrc).not.toContain('Country coverage (this destination\'s whole country)');
    expect(atlasSrc).not.toContain('Route intelligence (this specific destination)');
  });

  it('makes horizontal exploration explicit only in the mobile cue', () => {
    expect(atlasSrc).toContain('Swipe across the map to explore more destinations');
    expect(atlasSrc).toMatch(/Swipe across the map to explore more destinations[\s\S]*sm:hidden/);
    expect(atlasSrc).toContain('if (!hasScrolledMap && e.currentTarget.scrollLeft > 12) setHasScrolledMap(true);');
  });
});
