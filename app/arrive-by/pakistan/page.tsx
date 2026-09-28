import type { Metadata } from 'next';
import { ArriveByPakistanPublic } from '@/components/arrive-by-pakistan-public';

/**
 * Public Pakistan Arrive By beta — the existing founder-only prototype
 * proved out across ISB/LHE/KHI, now open to the public at a small scale.
 * Deliberately noindex, follow and absent from app/sitemap.ts for this beta
 * stage: a real, working page that isn't being promoted for search
 * discovery yet, not a hidden one — unlike the founder-only surface,
 * nothing here 404s a genuine visitor who has the link.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pakistan Arrive By (Beta)',
  description: 'A traffic-aware road-journey estimate for Islamabad, Lahore and Karachi arrivals in Pakistan.',
  robots: { index: false, follow: true },
};

export default function ArriveByPakistanPublicPage() {
  return <ArriveByPakistanPublic />;
}
