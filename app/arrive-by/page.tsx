import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArriveByShell } from '@/components/arrive-by-shell';

/**
 * The canonical Arrive By public beta — one product, airport-driven
 * configuration (see lib/arrive-by-shared/airport-registry.ts), rather
 * than a separate page per country. Deliberately noindex, follow and
 * absent from app/sitemap.ts for this beta stage, and not linked from
 * main navigation — we validate the unified experience first.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arrive By (Beta)',
  description: "Find out when you'll actually reach where you're going after you land — a live traffic-aware and public-transport journey estimate.",
  robots: { index: false, follow: true },
};

export default function ArriveByPage() {
  return <Suspense fallback={null}>
    <ArriveByShell />
  </Suspense>;
}
