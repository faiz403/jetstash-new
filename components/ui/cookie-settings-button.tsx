'use client';

import { requestCookieSettingsOpen } from '@/lib/consent';

/**
 * The permanent withdrawal control the ICO's consent guidance requires:
 * refusing (or later changing) optional advertising measurement must be as
 * easy as accepting it, not a one-time banner a visitor can never find
 * again. Lives in the footer (components/layout/footer.tsx) on every page.
 * Reopens the same banner that first asked (components/ui/cookie-consent-banner.tsx)
 * via a plain DOM event — the two components don't otherwise share state.
 */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={requestCookieSettingsOpen}
      className="text-xs text-ink-300 underline decoration-ink-500 underline-offset-4 transition-colors hover:text-brass-300 hover:decoration-brass-300"
    >
      Cookie settings
    </button>
  );
}
