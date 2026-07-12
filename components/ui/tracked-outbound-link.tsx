'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { track } from '@/lib/analytics';

/**
 * A plain outbound `<a>` with one added behaviour: fire an analytics event
 * on click. Exists so server components (deal-card.tsx, the route hero in
 * app/routes/[slug]/page.tsx) can get a tracked TravelUp click without
 * becoming client components themselves — this is the only client-side
 * logic they need, isolated to the smallest possible leaf.
 */
export function TrackedOutboundLink({
  event,
  properties,
  children,
  ...anchorProps
}: {
  event: string;
  properties?: Record<string, string | number | boolean>;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...anchorProps} onClick={() => track(event, properties)}>
      {children}
    </a>
  );
}
