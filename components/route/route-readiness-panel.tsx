'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { BookByCountdown } from '@/components/route/book-by-countdown';
import { TravelReadyCheck } from '@/components/travel-ready/travel-ready-check';
import type { BookBySnapshot } from '@/lib/booking-intelligence';
import type { EngineSnapshot, TravelReadySignal } from '@/lib/travel-intelligence-engine';

/**
 * Route-page client wrappers that keep the Book-By Countdown and the Travel
 * Ready Check connected now that they no longer sit side by side.
 *
 * The Travel Ready Check used to follow the Book-By panel directly, inside one
 * `RouteReadinessPanel`, which lifted the check's result so the Book-By
 * panel's engine badge could fold it into the one verdict (the 5
 * JETSTASH_PRINCIPLES.md §14.1 priority routes). Route-page PR B (November
 * 2026) moved the check below the fare history so travellers reach the fare
 * evidence sooner. The two panels are therefore separate sections of the page,
 * and this context carries the same signal between them: `TravelReadySlot`
 * publishes the result, `BookByPanel` reads it. Nothing leaves the visitor's
 * browser, exactly as before. The provider renders no DOM, and both slots work
 * without one (the signal is then simply never shared).
 */
const TravelReadySignalContext = createContext<{
  signal: TravelReadySignal | null;
  setSignal: (signal: TravelReadySignal | null) => void;
} | null>(null);

export function RouteReadinessProvider({ children }: { children: ReactNode }) {
  const [signal, setSignal] = useState<TravelReadySignal | null>(null);
  return <TravelReadySignalContext.Provider value={{ signal, setSignal }}>{children}</TravelReadySignalContext.Provider>;
}

export function BookByPanel({
  initialSnapshot,
  initialEngineSnapshot,
}: {
  initialSnapshot: BookBySnapshot;
  initialEngineSnapshot: EngineSnapshot | null;
}) {
  const shared = useContext(TravelReadySignalContext);
  return (
    <BookByCountdown
      initialSnapshot={initialSnapshot}
      initialEngineSnapshot={initialEngineSnapshot}
      travelReadySignal={shared?.signal ?? null}
    />
  );
}

export function TravelReadySlot({
  destinationSlug,
  airportSlug,
}: {
  destinationSlug: string;
  airportSlug: string;
}) {
  const shared = useContext(TravelReadySignalContext);
  // Duplicate Route Watch fix (30 Aug 2026): a route page always renders its own full-context RouteWatchForm, so the
  // check's inline one must stay suppressed.
  return (
    <TravelReadyCheck
      defaultDestinationSlug={destinationSlug}
      airportSlugForCta={airportSlug}
      showInlineRouteWatch={false}
      onResult={shared?.setSignal}
    />
  );
}
