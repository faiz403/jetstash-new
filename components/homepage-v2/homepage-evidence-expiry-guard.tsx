'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isHomepageEvidenceExpired } from '@/lib/homepage-evidence-expiry';

/**
 * Hides the homepage evidence card once its own eligibility has passed.
 * The page is ISR-cached, so a card rendered while eligible could otherwise be
 * served for a while after the underlying fare or verification stops
 * qualifying. Starts visible so it matches the server HTML, then compares the
 * visitor's current UK date with the expiry date computed on the server
 * (lib/homepage-evidence.ts getHomepageEvidenceExpiryIso). The comparison runs
 * on mount, every minute, and whenever a suspended or restored tab becomes
 * visible again, so a tab left open across the expiry date also drops the card.
 * Stale server HTML (no-JS visitors, crawlers) is bounded only by ISR
 * regeneration, the same as every other time-sensitive page on the site.
 */
export function HomepageEvidenceExpiryGuard({ expiresOnIso, children }: { expiresOnIso: string | null; children: ReactNode }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!expiresOnIso) return;
    const check = () => {
      if (isHomepageEvidenceExpired(expiresOnIso, new Date())) setExpired(true);
    };
    check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('pageshow', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', check);
    };
  }, [expiresOnIso]);
  return expired ? null : <>{children}</>;
}
