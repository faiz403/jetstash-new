import { MetadataRoute } from 'next';
import { destinations } from '@/data/destinations';
import { airports } from '@/data/airports';
import { routes, getRoutesByDestination } from '@/data/routes';
import { guides } from '@/data/guides';
import { getObservationsByRoute } from '@/data/fare-observations';
import { siteConfig } from '@/lib/site-config';

/**
 * A real content-change signal, not request-time new Date() — every page
 * built from static /data files only actually changes when a fare
 * observation is logged or a data file is hand-edited, and we can only
 * verify the former from code. Returns undefined (omits lastModified
 * entirely) rather than guessing, when no real signal exists — an absent
 * date tells crawlers nothing false; a fabricated "changed today" does.
 */
function latestObservedDate(routeSlugs: string[]): Date | undefined {
  const dates = routeSlugs.flatMap((slug) => getObservationsByRoute(slug).map((o) => o.observedDate));
  if (dates.length === 0) return undefined;
  return new Date(dates.reduce((max, d) => (d > max ? d : max)));
}

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
    '/quote-request',
    '/travel-club',
    '/about',
    '/contact',
    '/affiliate-disclosure',
    '/privacy-policy',
  ].map((path) => ({
    url: `${siteConfig.url}${path}`,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }));

  const destinationPages = destinations.map((d) => ({
    url: `${siteConfig.url}/destinations/${d.slug}`,
    lastModified: latestObservedDate(getRoutesByDestination(d.slug).map((r) => r.slug)),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const airportPages = airports.map((a) => ({
    url: `${siteConfig.url}/airports/${a.slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const routePages = routes.map((r) => ({
    url: `${siteConfig.url}/routes/${r.slug}`,
    lastModified: latestObservedDate([r.slug]),
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }));

  const guidePages = guides.map((g) => ({
    url: `${siteConfig.url}/guides/${g.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...destinationPages, ...airportPages, ...routePages, ...guidePages];
}
