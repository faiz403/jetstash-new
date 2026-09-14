'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';
import { getOrClassifyAcquisitionSource, getStoredAcquisitionSource } from '@/lib/acquisition';

/**
 * Fires exactly one 'acquisition_landing' event per browser session, on the
 * first page this component mounts on — never on every navigation. Mounted
 * once in app/layout.tsx (alongside CookieConsentBanner), so it survives
 * client-side route changes rather than remounting per page; the effect's
 * empty dependency array is deliberate, not an oversight.
 *
 * No visible output, no cookie, no persistent ID — see lib/acquisition.ts
 * for the sessionStorage-only classification this reads.
 */
export function AcquisitionLandingTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadyClassifiedThisSession = getStoredAcquisitionSource() !== null;
    const channel = getOrClassifyAcquisitionSource();
    if (alreadyClassifiedThisSession) return;
    track('acquisition_landing', { route: pathname, channel });
    // Deliberately empty — this must fire once per session on first mount
    // only, never re-fire on later client-side navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
