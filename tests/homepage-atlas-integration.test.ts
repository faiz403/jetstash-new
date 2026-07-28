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
});
