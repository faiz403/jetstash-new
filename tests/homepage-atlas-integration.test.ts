import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homepageSource = fs.readFileSync(path.join(root, 'components/homepage-v2/journey-desk-home.tsx'), 'utf8');
const atlasBuilderSource = fs.readFileSync(path.join(root, 'lib/atlas-network-data.ts'), 'utf8');

describe('public homepage Route Atlas integration', () => {
  it('renders the shared Atlas component from the public homepage composition', () => {
    expect(homepageSource).toContain("import { AtlasFeelTest } from '@/components/founder/atlas-feel-test';");
    expect(homepageSource).toContain("import { buildAtlasAirports } from '@/lib/atlas-network-data';");
    expect(homepageSource).toContain('<AtlasFeelTest airports={buildAtlasAirports()} defaultAirportSlug="manchester" />');
    expect(homepageSource).not.toContain('<PullBriefHero');
  });

  it('keeps the homepage network data evidence-backed and multi-airport', () => {
    expect(atlasBuilderSource).toContain("getRouteStatusCopy");
    expect(atlasBuilderSource).toContain("getNetworkEvidence");
    for (const slug of ['manchester', 'birmingham', 'london-heathrow', 'london-gatwick', 'glasgow', 'edinburgh', 'newcastle', 'leeds-bradford']) {
      expect(atlasBuilderSource).toContain(`airportSlug: '${slug}'`);
    }
  });

  it('keeps the geographic Atlas visible on mobile at a legible fixed width, with touch selectors below it', () => {
    const atlasSource = fs.readFileSync(path.join(root, 'components/founder/atlas-feel-test.tsx'), 'utf8');
    expect(atlasSource).not.toContain('className="hidden h-auto w-full sm:block"');
    // Fluid full-width shrinks every label below legibility on a phone —
    // the map keeps a fixed pixel width (matching its desktop per-unit
    // scale) inside a horizontally scrollable strip instead.
    expect(atlasSource).toContain('viewBox="418 230 336 220" className="h-auto w-[800px] max-w-none sm:w-full"');
    expect(atlasSource).toContain('aria-label="Choose a country"');
    expect(atlasSource).toContain('aria-label={`Choose a destination in ${activeCountry.label}`}');
  });

  it('uses the Signature Collection photography on every airport collection card', () => {
    const airportIndexSource = fs.readFileSync(path.join(root, 'app/airports/page.tsx'), 'utf8');
    expect(airportIndexSource).toContain("import Image from 'next/image';");
    expect(airportIndexSource).toContain("import { getAirportImage } from '@/lib/brand-images';");
    expect(airportIndexSource).toContain('const airportImage = getAirportImage(airport.slug);');
    expect(airportIndexSource).toContain('className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"');
    expect(airportIndexSource).not.toContain('text-[6.5rem]');
  });

  it('shows the complete airport photograph before the detail copy on mobile', () => {
    const airportDetailSource = fs.readFileSync(path.join(root, 'app/airports/[slug]/page.tsx'), 'utf8');
    expect(airportDetailSource).toContain('className="relative aspect-[16/9] overflow-hidden sm:absolute sm:inset-0 sm:aspect-auto"');
    expect(airportDetailSource).toContain('<HeroBackdrop image={');
    expect(airportDetailSource).toContain('pb-16 pt-8 sm:px-8 sm:py-20');
  });
});
