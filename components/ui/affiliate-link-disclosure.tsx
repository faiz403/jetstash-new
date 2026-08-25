import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const AFFILIATE_DISCLOSURE_PREFIX = 'Ad · Affiliate link.';
export const AFFILIATE_DISCLOSURE_BODY =
  'JetStash earns commission on eligible bookings through this link, at no extra cost to you.';
export const AFFILIATE_DISCLOSURE_TEXT = `${AFFILIATE_DISCLOSURE_PREFIX} ${AFFILIATE_DISCLOSURE_BODY}`;

interface AffiliateLinkDisclosureProps {
  providerName: string;
  className?: string;
  children?: ReactNode;
}

/**
 * The one visible disclosure rendered beside every compensated outbound CTA.
 * Provider/open-tab detail and surface-specific evidence warnings remain
 * additive, so the commercial disclosure never replaces booking caveats.
 */
export function AffiliateLinkDisclosure({
  providerName,
  className,
  children,
}: AffiliateLinkDisclosureProps) {
  return (
    <p className={cn('text-xs leading-snug text-ink-500', className)}>
      <span className="font-semibold text-ink-700">{AFFILIATE_DISCLOSURE_PREFIX}</span>{' '}
      {AFFILIATE_DISCLOSURE_BODY} Opens {providerName} in a new tab.
      {children ? <> {children}</> : null}
    </p>
  );
}
