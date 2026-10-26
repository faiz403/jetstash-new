'use client';

import { useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { isSiteStatisticsObjected, STATS_OBJECTION_STORAGE_KEY, STATS_PREFERENCE_CHANGED_EVENT } from '@/lib/consent';
import { sanitiseStatisticsEvent } from '@/lib/analytics-privacy';

/**
 * Vercel Analytics and Speed Insights, behind the visitor's Site statistics preference (October 2026; proposed compliance approach,
 * pending legal review of the statistical-purpose basis).
 *
 * The scripts are mounted only when the visitor has NOT objected, and the preference is read before anything is mounted: an
 * objecting visitor never requests either script, on first load, on reload or on later navigation. (Suppressing events after the
 * script has loaded would not be enough: the script itself reads browser storage.) Mounted scripts get a beforeSend hook that
 * cleans advertising identifiers out of the URL they would otherwise send.
 *
 * Until the effect has read the preference nothing is mounted, so no request is made before the choice is known.
 */
export function SiteStatistics() {
  const [on, setOn] = useState(false);
  const onRef = useRef(false);
  onRef.current = on;
  useEffect(() => {
    const sync = () => setOn(!isSiteStatisticsObjected());
    // The objection made in ANOTHER tab arrives as a storage event. Scripts already running in this tab cannot be unloaded (they keep
    // observing the page even if their sends are cancelled), so this tab is reloaded, exactly as the tab where the visitor objected.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STATS_OBJECTION_STORAGE_KEY) return;
      if (isSiteStatisticsObjected() && onRef.current) window.location.reload();
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
