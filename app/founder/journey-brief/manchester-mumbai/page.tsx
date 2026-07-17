import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JourneyBriefManchesterMumbai } from '@/components/journey-brief/journey-brief-manchester-mumbai';

/**
 * Journey Brief prototype — Manchester → Mumbai (Gate 2, founder-only).
 *
 * Same access model as app/founder/page.tsx: 404s in production unless
 * FOUNDER_DASHBOARD_ENABLED=true is explicitly set, and is available on
 * localhost during development. This is a Gate 2 prototype-approval
 * surface, not a public route — see docs/COMMERCIAL_RESET_PHASE_1.md and
 * this session's Journey Brief Gate 1 report for the product context.
 * /founder is already disallowed in app/robots.ts as a path prefix, which
 * covers this route too.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Manchester to Mumbai — Journey Brief',
    robots: { index: false, follow: false },
  };
}

export default function JourneyBriefManchesterMumbaiPage() {
  if (!dashboardEnabled()) {
    notFound();
  }
  return <JourneyBriefManchesterMumbai />;
}
