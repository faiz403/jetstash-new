import type { Metadata } from 'next';
import { JourneyDeskHome } from '@/components/homepage-v2/journey-desk-home';
import { siteConfig } from '@/lib/site-config';

// A plain string here would run through the root layout's "%s | JetStash"
// title template, duplicating the brand name — title.absolute keeps this
// exact brand-first framing explicit at the page level (matching every other
// page having its own metadata) without changing what's rendered.
// openGraph/twitter are deliberately left unset so they inherit the root
// layout's images/type/siteName untouched — Next resolves their title and
// description from these fields automatically.
export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name}: ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: siteConfig.url },
};

/**
 * The public homepage now renders the approved Journey Desk / "Pull Your
 * Brief" experience, promoted from the founder preview at
 * /founder/homepage-v2 (which is retained as a fallback). JourneyDeskHome is
 * the single source of truth for the composition — no logic is duplicated
 * between the two routes. The experience carries no runtime data, so this
 * page is statically rendered.
 */
export default function HomePage() {
  return <JourneyDeskHome />;
}
