'use client';

import { useState } from 'react';
import { BookByCountdown } from '@/components/route/book-by-countdown';
import { TravelReadyCheck } from '@/components/travel-ready/travel-ready-check';
import type { BookBySnapshot } from '@/lib/booking-intelligence';
import type { EngineSnapshot, TravelReadySignal } from '@/lib/travel-intelligence-engine';

/**
 * Thin client wrapper used only on route pages that have both Book-By
 * coverage and a Travel Ready Check-supported destination — the 5
 * JETSTASH_PRINCIPLES.md §14.1 priority routes all qualify today, since
 * they happen to serve the same 7 countries §14.3 covers. Lifts the
 * Travel Ready Check result so the Book-By panel's engine badge above can
 * fold it into the one verdict, instead of two disconnected cards.
 */
export function RouteReadinessPanel({
  initialSnapshot,
  initialEngineSnapshot,
  destinationSlug,
  airportSlug,
}: {
  initialSnapshot: BookBySnapshot;
  initialEngineSnapshot: EngineSnapshot | null;
  destinationSlug: string;
  airportSlug: string;
}) {
  const [travelReadySignal, setTravelReadySignal] = useState<TravelReadySignal | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <BookByCountdown
        initialSnapshot={initialSnapshot}
        initialEngineSnapshot={initialEngineSnapshot}
        travelReadySignal={travelReadySignal}
      />
      <TravelReadyCheck
        defaultDestinationSlug={destinationSlug}
        airportSlugForCta={airportSlug}
        showInlineRouteWatch={false}
        onResult={setTravelReadySignal}
      />
    </div>
  );
}
