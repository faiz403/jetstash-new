import { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    // /founder is the private command centre — 404s in production by default,
    // but crawlers are told to stay out regardless in case it's ever enabled.
    rules: { userAgent: '*', allow: '/', disallow: '/founder' },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
