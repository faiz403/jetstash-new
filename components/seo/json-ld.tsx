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

/**
 * Deliberately NOT a Product/Offer schema: that would require a specific
 * price, and this site never claims one (see data/deals.ts's header
 * comment) — a stale or wrong structured-data price is a real Google
 * Merchant penalty risk, not just a content-integrity one. An ItemList of
 * the tracked routes is the honest structured-data shape for this page:
 * real names and URLs, no price claim either way.
 */
export function dealsListSchema(items: { fromCity: string; toCity: string; cabin: string; toDestinationSlug: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${item.fromCity} to ${item.toCity} (${item.cabin})`,
      url: `${siteConfig.url}/destinations/${item.toDestinationSlug}`,
    })),
  };
}
