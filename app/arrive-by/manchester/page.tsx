import type { Metadata } from 'next';
import { ArriveByManchesterPublic } from '@/components/arrive-by-manchester-public';

/**
 * Public Manchester Arrive By beta — a temporary route until the canonical
 * /arrive-by shell exists (see docs/product/ARRIVE_BY_MVP.md), mirroring
 * /arrive-by/pakistan's own beta pattern. Deliberately noindex, follow and
 * absent from app/sitemap.ts for this beta stage, and not linked from main
 * navigation — a real, working page for anyone with the link, not a hidden
 * one.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Manchester Arrive By (Beta)',
  description: 'A live public-transport and traffic-aware road-journey estimate for Manchester Airport arrivals.',
  robots: { index: false, follow: true },
};

export default function ArriveByManchesterPublicPage() {
  return <ArriveByManchesterPublic />;
}
