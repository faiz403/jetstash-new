import { siteConfig } from '@/lib/site-config';

/**
 * JSON-LD structured data helpers.
 *
 * Only facts that exist elsewhere on the page/data files are emitted — no
 * ratings, review counts, or invented aggregate data (fabricated structured
 * data is both a content-integrity violation and a Google penalty risk).
 */

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: `${siteConfig.url}/icon.png`,
    // No `email` field: there is no working public inbox yet. Structured
    // data gets cached/indexed long-term, so this stays omitted rather
    // than pointing at an address that doesn't exist — add it back once
    // a real mailbox is live. Visitors are directed to /contact instead.
  };
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
  };
}

export function breadcrumbSchema(items: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${siteConfig.url}${item.href}`,
    })),
  };
}
