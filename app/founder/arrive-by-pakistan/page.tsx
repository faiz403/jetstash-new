import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArriveByPakistan } from '@/components/founder/arrive-by-pakistan';

/**
 * Arrive By Pakistan — founder-only prototype (private, product-evaluation
 * only), built as a fully separate country model from Manchester's Arrive
 * By, per the founder's explicit instruction not to add country
 * conditionals to a shared engine. Same access model as every other
 * /founder page: 404s in production unless FOUNDER_DASHBOARD_ENABLED=true
 * is explicitly set, available on localhost during development. /founder
 * is already disallowed in app/robots.ts as a path prefix, which covers
 * this route too, and it is not listed in app/sitemap.ts.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Arrive By Pakistan (Founder Preview)',
    robots: { index: false, follow: false },
  };
}

export default function ArriveByPakistanFounderPage() {
  if (!dashboardEnabled()) {
    notFound();
  }
  return <ArriveByPakistan />;
}
