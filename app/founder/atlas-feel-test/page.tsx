import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AtlasFeelTest } from '@/components/founder/atlas-feel-test';
import { buildAtlasAirports } from '@/lib/atlas-network-data';

/**
 * Founder-only preview for the Route Atlas. The network builder is shared
 * with the public homepage so the preview and production cannot drift.
 */
export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return { title: 'Atlas Feel Test — Prototype', robots: { index: false, follow: false } };
}

export default function AtlasFeelTestPage() {
  if (!dashboardEnabled()) notFound();
  return <AtlasFeelTest airports={buildAtlasAirports()} defaultAirportSlug="manchester" />;
}
