import { MetadataRoute } from 'next';
import { destinations } from '@/data/destinations';
import { airports } from '@/data/airports';
import { routes } from '@/data/routes';
import { siteConfig } from '@/lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '',
    '/deals',
    '/destinations',
    '/airports',
    '/routes',
    '/guides',
    '/pakistan',
    '/india',
    '/gulf',
    '/umrah',
    '/family-holidays',
    '/business-class',
    '/travel-club',
    '/about',
    '/contact',
    '/affiliate-disclosure',
    '/privacy-policy',
  ].map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }));

  const destinationPages = destinations.map((d) => ({
    url: `${siteConfig.url}/destinations/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const airportPages = airports.map((a) => ({
    url: `${siteConfig.url}/airports/${a.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const routePages = routes.map((r) => ({
    url: `${siteConfig.url}/routes/${r.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }));

  return [...staticPages, ...destinationPages, ...airportPages, ...routePages];
}
