import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArriveByFounderPreview } from '@/components/founder/arrive-by-preview';

/**
 * Arrive By — Stage 2 founder preview (private, product-evaluation only).
 *
 * Same access model as app/founder/page.tsx and
 * app/founder/journey-brief/manchester-mumbai/page.tsx: 404s in production
 * unless FOUNDER_DASHBOARD_ENABLED=true is explicitly set, available on
 * localhost during development. /founder is already disallowed in
 * app/robots.ts as a path prefix, which covers this route too, and this
 * route is not listed in app/sitemap.ts. See docs/product/ARRIVE_BY_MVP.md
 * §16 for the product context — this is Stage 2, not Stage 3 public release.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Arrive By — Planning Window (Founder Preview)',
    robots: { index: false, follow: false },
  };
}

export default function ArriveByFounderPage() {
  if (!dashboardEnabled()) {
    notFound();
  }
  return <ArriveByFounderPreview />;
}
