import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JourneyDecisionBrief } from '@/components/journey-brief/journey-decision-brief';

/**
 * Journey Decision Brief — generic founder-only MVP (August 2026).
 *
 * Same access model as app/founder/page.tsx and
 * app/founder/journey-brief/manchester-mumbai/page.tsx: 404s in production
 * unless FOUNDER_DASHBOARD_ENABLED=true is explicitly set, available on
 * localhost during development. This is a founder-only real-user-test
 * surface, not a public route — do not link it from any public page or
 * remove the gate to "make it easier to test"; the gate is the only thing
 * standing between this and an unproven customer experiment going public.
 * /founder is already disallowed in app/robots.ts as a path prefix, which
 * covers this route too.
 *
 * Deliberately at /founder/journey-brief (not nested under
 * /manchester-mumbai) — this is the generic engine, not a route-specific
 * one. The existing Manchester-Mumbai prototype at
 * /founder/journey-brief/manchester-mumbai is untouched and left in place
 * as a visual/evidence reference; this route does not build on it, reuse
 * its evidence bundle, or replace it.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Journey Decision Brief',
    robots: { index: false, follow: false },
  };
}

export default function JourneyDecisionBriefPage() {
  if (!dashboardEnabled()) {
    notFound();
  }
  return <JourneyDecisionBrief />;
}
