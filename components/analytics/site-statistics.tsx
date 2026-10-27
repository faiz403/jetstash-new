'use client';

import { useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { hasSiteStatisticsConsent, STATS_CONSENT_STORAGE_KEY, STATS_PREFERENCE_CHANGED_EVENT, VERCEL_ANALYTICS_STORAGE_KEY } from '@/lib/consent';
import { sanitiseStatisticsEvent } from '@/lib/analytics-privacy';

/**
 * Vercel Analytics and Speed Insights, behind the visitor's separate Site statistics permission (October 2026, consent-first).
 *
 * OFF by default. The scripts are mounted only when the visitor has explicitly allowed Site statistics, and that is read before
 * anything is mounted: a visitor who has not decided, who declined or who withdrew never requests either script (first load, reload
 * or later navigation). Suppressing events after the script has loaded would not be enough: the script itself reads browser storage
 * and adds the referrer. Mounted scripts get a beforeSend hook that cleans advertising identifiers out of the URL they would
 * otherwise send. If the permission is withdrawn in another tab, this tab reloads, because a script already running cannot be
 * unloaded.
 *
 * Until the effect has read the preference nothing is mounted, so no request is made before the choice is known.
 */
export function SiteStatistics() {
  const [on, setOn] = useState(false);
  const onRef = useRef(false);
  onRef.current = on;
  useEffect(() => {
    const sync = () => {
      const allowed = hasSiteStatisticsConsent();
      // No permission: also remove anything Vercel's script left from an earlier allowed period.
      if (!allowed) {
        try {
          window.localStorage.removeItem(VERCEL_ANALYTICS_STORAGE_KEY);
        } catch {
          // storage blocked
        }
      }
      setOn(allowed);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STATS_CONSENT_STORAGE_KEY) return;
      if (!hasSiteStatisticsConsent() && onRef.current) window.location.reload();
      else sync();
    };
    sync();
    window.addEventListener(STATS_PREFERENCE_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(STATS_PREFERENCE_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  if (!on) return null;
  return (
    <>
      <Analytics beforeSend={sanitiseStatisticsEvent} />
      <SpeedInsights beforeSend={sanitiseStatisticsEvent} />
    </>
  );
}
