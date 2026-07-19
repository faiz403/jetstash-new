import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JourneyDeskHome } from '@/components/homepage-v2/journey-desk-home';

/**
 * Homepage v2 — protected prototype (founder-only).
 *
 * Same access gate as app/founder/page.tsx: 404s in production unless
 * FOUNDER_DASHBOARD_ENABLED=true, available on localhost. This does NOT touch
 * or replace the public homepage (app/page.tsx). It reuses the real JetStash
 * app, components, data and imagery — no standalone HTML concept — and shows
 * only verified route intelligence or an honest "not yet".
 *
 * Note: the app's global Header and Footer (root layout) still wrap this
 * route; a production rollout of this homepage would pair with a header/
 * footer redesign, which is out of scope for this non-destructive prototype.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Homepage v2 — Journey Brief',
    robots: { index: false, follow: false },
  };
}

export default function HomepageV2Page() {
  if (!dashboardEnabled()) {
    notFound();
  }

  return <JourneyDeskHome />;
}
