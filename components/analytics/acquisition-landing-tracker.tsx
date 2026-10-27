'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';
import { getOrClassifyAcquisitionSource, getStoredAcquisitionSource, purgeAcquisitionSource } from '@/lib/acquisition';
import { CONSENT_GRANTED_EVENT, CONSENT_STORAGE_KEY, hasAdMeasurementConsent, hasSiteStatisticsConsent, STATS_PREFERENCE_CHANGED_EVENT, STATS_CONSENT_STORAGE_KEY } from '@/lib/consent';

/**
 * Fires exactly one 'acquisition_landing' event per browser session, on the
 * first page this component mounts on, never on every navigation. Mounted
 * once in app/layout.tsx (alongside CookieConsentBanner), so it survives
 * client-side route changes rather than remounting per page.
 *
 * Advertising attribution, so it runs ONLY with BOTH of the visitor's separate
 * permissions (October 2026): Google Ads measurement (it is advertising
 * attribution) and Site statistics (the event is sent to Vercel Analytics).
 * No decision, Decline and withdrawal of either mean it does
 * nothing, reads no click identifier and keeps nothing in storage (and any
 * classification left over from before is removed). If the visitor accepts
 * while still on the landing page, the classification runs then, from that
 * page, so a visitor who accepts is still attributed.
 *
 * No visible output, no cookie, no persistent ID. See lib/acquisition.ts.
 */
/**
 * Vercel's track() silently drops an event if its script has not set up its queue yet (window.va). When the statistics scripts are
 * mounted by <SiteStatistics /> after the preference is read, that can be a moment after this component's first effect, so the
 * landing event waits (briefly, then gives up) for the queue instead of being lost.
 */
function whenStatisticsQueueReady(run: () => void): () => void {
  let tries = 0;
  const id = window.setInterval(() => {
    tries += 1;
    if (typeof (window as unknown as { va?: unknown }).va === 'function' || tries > 60) {
      window.clearInterval(id);
      run();
    }
  }, 50);
  return () => window.clearInterval(id);
}

export function AcquisitionLandingTracker() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelPending: (() => void) | null = null;
    const run = () => {
      if (!hasAdMeasurementConsent() || !hasSiteStatisticsConsent()) {
        purgeAcquisitionSource();
        return;
      }
      const alreadyClassifiedThisSession = getStoredAcquisitionSource() !== null;
      const channel = getOrClassifyAcquisitionSource();
      if (alreadyClassifiedThisSession) return;
      const route = pathRef.current;
      cancelPending?.();
      cancelPending = whenStatisticsQueueReady(() => {
        // The visitor may have withdrawn (here or in another tab) while this was waiting: check again at the moment of sending.
        if (hasAdMeasurementConsent() && hasSiteStatisticsConsent()) track('acquisition_landing', { route, channel });
      });
    };
    // Another tab changing either permission arrives as a storage event: withdrawal removes what this tab
    // kept and cancels anything pending, acceptance lets attribution start here.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === CONSENT_STORAGE_KEY || e.key === STATS_CONSENT_STORAGE_KEY) {
        if (!hasAdMeasurementConsent() || !hasSiteStatisticsConsent()) cancelPending?.();
        run();
      }
    };
    run();
    window.addEventListener(CONSENT_GRANTED_EVENT, run);
    window.addEventListener(STATS_PREFERENCE_CHANGED_EVENT, run);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelPending?.();
      window.removeEventListener(CONSENT_GRANTED_EVENT, run);
      window.removeEventListener(STATS_PREFERENCE_CHANGED_EVENT, run);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
