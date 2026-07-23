import type { Metadata } from 'next';
import { JourneyDeskHome } from '@/components/homepage-v2/journey-desk-home';
import { siteConfig } from '@/lib/site-config';

// Pure ISR, same interval as the route pages — the featured Manchester→Mumbai
// thread renders Route Status V1-derived copy (see journey-desk-home.tsx's
// buildFlagshipStatusCopy), which must regenerate without a deploy once a
// ledger event's effective date passes. See app/routes/[slug]/page.tsx's own
// revalidate comment for the full reasoning.
export const revalidate = 21600;

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
 * between the two routes. The featured thread's Route Status copy IS
 * time-sensitive (see revalidate above), so this page is ISR, not fully
 * static.
 */
export default function HomePage() {
  return <JourneyDeskHome />;
}
