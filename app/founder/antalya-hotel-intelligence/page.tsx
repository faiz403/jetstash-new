import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { antalyaHotelEvidence } from '@/data/hotel-evidence';
import { AntalyaHotelIntelligence } from '@/components/founder/antalya-hotel-intelligence';

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return { title: 'Antalya Hotel Intelligence — Founder Preview', robots: { index: false, follow: false } };
}

export default function AntalyaHotelIntelligencePage() {
  if (!dashboardEnabled()) notFound();
  return <AntalyaHotelIntelligence records={antalyaHotelEvidence} />;
}
