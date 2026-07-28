import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { footerNav, mainNav, siteConfig } from '@/lib/site-config';

const homepageSource = readFileSync(join(process.cwd(), 'components/homepage-v2/pull-brief-hero.tsx'), 'utf8');
const destinationsSource = readFileSync(join(process.cwd(), 'app/destinations/page.tsx'), 'utf8');
const routesSource = readFileSync(join(process.cwd(), 'app/routes/page.tsx'), 'utf8');

describe('International brand positioning', () => {
  it('leads the global brand with UK travel intelligence for international journeys', () => {
    expect(siteConfig.tagline).toBe("UK travel intelligence for international journeys");
    expect(siteConfig.description).toContain('international booking decisions');
    expect(siteConfig.description).toContain('deepest verified coverage is currently South Asia and the Gulf');
  });

  it('keeps primary navigation product-led while specialist hubs remain discoverable elsewhere', () => {
    expect(mainNav.map((item) => item.label)).toEqual([
      'Routes',
      'Destinations',
      'UK Airports',
      'Travel Ready',
      'Guides',
      'Deals',
    ]);
    expect(footerNav.specialist.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Pakistan Hub', 'India Hub', 'Gulf Hub', 'Umrah & Saudi', 'Business Class'])
    );
  });

  it('keeps core product discovery ahead of specialist hubs in the footer', () => {
    expect(footerNav.explore.map((item) => item.label)).toEqual(
      expect.arrayContaining(['All Routes', 'All Destinations', 'UK Airports', 'Travel Ready Check', 'Travel Guides'])
    );
  });

  it('frames the homepage as international while naming current depth honestly, without an em dash or a vague worldwide/global claim', () => {
    const paragraphMatch = homepageSource.match(/We check the route[\s\S]*?actually matters\./);
    expect(paragraphMatch).not.toBeNull();
    const paragraph = paragraphMatch![0].replace(/\s+/g, ' ');
    expect(paragraph).toContain('international journeys from UK airports');
    expect(paragraph).toContain('Our verified coverage runs deepest across South Asia and the Gulf');
    expect(paragraph).toContain('selected journeys across Turkey, Morocco and the Mediterranean');
    expect(paragraph).not.toContain('UK journeys to Pakistan, India, the Gulf and Umrah');
    expect(paragraph).not.toMatch(/—/);
    expect(paragraph).not.toMatch(/\b(worldwide|global)\b/i);
  });

  it('shows all four real coverage areas before country-level destination sections, each linking to an anchor that actually covers what the card names', () => {
    for (const area of ['South Asia', 'Gulf & Saudi', 'Mediterranean & Southern Europe', 'North Africa']) {
      expect(destinationsSource).toContain(`title: '${area}'`);
    }
    // South Asia (Pakistan + India) and Gulf & Saudi (Gulf + Umrah) get their
    // own combined-region anchors — see tests/destination-region-anchors.test.ts
    // for the full detail of why #india/#umrah alone were wrong.
    for (const anchor of ['#south-asia', '#gulf-saudi', '#mediterranean', '#northAfrica']) {
      expect(destinationsSource).toContain(`href: '${anchor}'`);
    }
    expect(destinationsSource).toContain('id={key}');
  });

  it('describes route coverage as strongest in South Asia and the Gulf rather than claiming global route depth', () => {
    const normalised = routesSource.replace(/\s+/g, ' ');
    expect(normalised).toContain('Current route coverage is deepest in South Asia and the Gulf.');
    expect(normalised).not.toContain('All Routes: UK Airports to Pakistan, India & the Gulf');
  });
});
