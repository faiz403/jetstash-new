import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { siteConfig } from '@/lib/site-config';

const sitemapUrls = sitemap().map((entry) => entry.url);
const read = (path: string) => readFileSync(path, 'utf8');

describe('public indexing plumbing', () => {
  it('uses canonical production URLs with no duplicate or private sitemap entries', () => {
    expect(new Set(sitemapUrls).size).toBe(sitemapUrls.length);
    for (const url of sitemapUrls) {
      expect(url.startsWith(`${siteConfig.url}/`) || url === siteConfig.url).toBe(true);
      expect(url).not.toMatch(/\/(?:api|founder)(?:\/|$)/);
      // Arrive By is listed only as its one public page (3 November 2026), never a legacy, API or query variant.
      if (url.includes('arrive-by')) expect(url).toBe(`${siteConfig.url}/arrive-by`);
    }
  });

  it('disallows the founder area and advertises the same sitemap URL', () => {
    expect(robots().rules).toEqual({ userAgent: '*', allow: '/', disallow: '/founder' });
    expect(robots().sitemap).toBe(`${siteConfig.url}/sitemap.xml`);
  });

  it('lists public Arrive By once, indexable and self-canonical (3 November 2026 launch)', () => {
    const source = read('app/arrive-by/page.tsx');
    expect(source).not.toMatch(/index:\s*false/);
    expect(source).toContain('canonical: `${siteConfig.url}/arrive-by`');
    expect(sitemapUrls.filter((url) => url === `${siteConfig.url}/arrive-by`)).toHaveLength(1);
  });

  it('builds dynamic route, airport, destination, and guide canonicals from their sitemap paths', () => {
    expect(read('app/routes/[slug]/page.tsx')).toContain('canonical: `${siteConfig.url}/routes/${route.slug}`');
    expect(read('app/airports/[slug]/page.tsx')).toContain('canonical: `${siteConfig.url}/airports/${airport.slug}`');
    expect(read('app/destinations/[slug]/page.tsx')).toContain('canonical: `${siteConfig.url}/destinations/${dest.slug}`');
    expect(read('app/guides/[slug]/page.tsx')).toContain('canonical: `${siteConfig.url}/guides/${guide.slug}`');
  });
});
