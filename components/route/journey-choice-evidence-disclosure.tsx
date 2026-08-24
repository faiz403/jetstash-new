'use client';

import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';

/**
 * Isolated client leaf (same pattern as components/ui/tracked-outbound-link.tsx)
 * so components/route/journey-choice.tsx itself can stay a server component.
 * Fires 'journey_choice_evidence_opened' only on the open transition, never
 * on close, so re-toggling doesn't inflate the count.
 */
export function JourneyChoiceEvidenceDisclosure({
  routeSlug,
  summaryLabel,
  children,
}: {
  routeSlug: string;
  summaryLabel: string;
  children: ReactNode;
}) {
  return (
    <details
      className="group mt-6 rounded-sm border border-ink-100 bg-sand-50 px-4 py-3"
      onToggle={(event) => {
        if ((event.target as HTMLDetailsElement).open) {
          track('journey_choice_evidence_opened', { route: routeSlug, source: 'journey-choice' });
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold text-ink-700 transition-colors hover:text-ink-900">
        {summaryLabel}
      </summary>
      {children}
    </details>
  );
}
