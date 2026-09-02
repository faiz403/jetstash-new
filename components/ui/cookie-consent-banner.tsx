'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import {
  CONSENT_SETTINGS_OPEN_EVENT,
  getStoredConsentChoice,
  storeConsentChoice,
  type ConsentChoice,
} from '@/lib/consent';
import { GOOGLE_ADS_TAG_ID } from '@/lib/google-ads-conversions';

/**
 * The one component that owns JetStash's optional Google Ads measurement,
 * front to back: the accept/decline banner, the permanent "reopen and
 * change your mind" entry point (fired via CONSENT_SETTINGS_OPEN_EVENT from
 * components/ui/cookie-settings-button.tsx in the footer), and — this is
 * the part that changed — actually loading the Google tag itself.
 *
 * BASIC CONSENT MODE, not Advanced: an earlier version of this file set
 * Consent Mode v2 signals to 'denied' by default and loaded gtag.js
 * unconditionally on every visit (in app/layout.tsx), only ever calling
 * `gtag('consent','update', ...)` on acceptance. Google's own documentation
 * is explicit that this is Advanced Consent Mode — the tag loads regardless
 * of the visitor's choice and can send cookieless pings even after a
 * decline. That's not the privacy-preserving behaviour JetStash committed
 * to. Basic Consent Mode is stricter and simpler: nothing about Google Ads
 * loads at all — no script request, no dataLayer, no window.gtag — until
 * the visitor actively accepts. `loadTag` below is literally the only thing
 * that decides whether the two <Script> tags near the bottom of this file
 * render; while it's false, there is nothing in the page for Google to see.
 *
 * JetStash fails closed by construction, not by trusting Google to suppress
 * a network request after the fact.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [loadTag, setLoadTag] = useState(false);

  useEffect(() => {
    const stored = getStoredConsentChoice();
    setChoice(stored);
    if (stored === 'granted') {
      // A returning visitor who already accepted — load the tag again on
      // this fresh page load. (It genuinely wasn't loaded until now: Basic
      // Consent Mode never loads it speculatively, so there's no state to
      // "resume" here, only a decision to re-apply.)
      setLoadTag(true);
    } else if (!stored) {
      setVisible(true);
    }

    function handleReopen() {
      setVisible(true);
    }
    window.addEventListener(CONSENT_SETTINGS_OPEN_EVENT, handleReopen);
    return () => window.removeEventListener(CONSENT_SETTINGS_OPEN_EVENT, handleReopen);
  }, []);

  function handleChoice(next: ConsentChoice) {
    const wasGranted = choice === 'granted';
    storeConsentChoice(next);
    setChoice(next);
    setVisible(false);

    if (next === 'granted') {
      setLoadTag(true);
      return;
    }

    // Declining for the first time (wasGranted === false, loadTag === false)
    // needs nothing further — the tag was never requested, so there's
    // nothing to undo. Withdrawing after an earlier acceptance is different:
    // the tag has already been downloaded and is running in this tab, and
    // there's no supported way to make an already-loaded third-party script
    // un-execute itself. The honest fix is a full reload — the next page
    // load reads the freshly-stored 'denied' choice and simply never
    // requests the tag again, rather than JetStash pretending a script that
    // already ran can be silently erased from the current page.
    if (wasGranted) {
      window.location.reload();
    }
  }

  return (
    <>
      {loadTag && (
        <>
          <Script id="google-ads-tag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('consent', 'default', {
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'denied',
                analytics_storage: 'denied'
              });
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_TAG_ID}');
            `}
          </Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`} strategy="afterInteractive" />
        </>
      )}

      {/* Compact mobile treatment (September 2026, homepage-hero-console
          overlap fix): shorter, factually-equivalent copy plus explicit
          h-11 (44px) buttons — a fixed height via flex centring, not a
          padding/line-height estimate, so the tap target is exact regardless
          of font metrics. Fine print stays at the normal text-xs (12px) —
          clearance comes from a small mobile-only spacing trim in the
          homepage hero instead of shrinking the privacy notice
          (homepage-opening-hero.tsx's own doc comment explains why).

          Safe-area note: `app/layout.tsx`'s viewport metadata does not set
          `viewportFit: 'cover'`, so under the current app configuration
          `env(safe-area-inset-bottom)` genuinely evaluates to 0 on every
          real device today — WebKit only lets a page's layout extend under
          the home-indicator/gesture area (and therefore only reports a
          nonzero inset back) once a page opts into viewport-fit=cover,
          which this app does not. This banner's own `pb` still uses
          `env(safe-area-inset-bottom, 0px)` directly (no artificial floor)
          as forward-looking correctness in case that ever changes — paired
          with an exactly-cancelling compensation in
          homepage-opening-hero.tsx's own mobile pull-up margin, verified
          by simulating 20px/34px insets locally (see that file's own
          comment). Ships with genuinely zero simulation code — this is the
          real, permanent formula either way. */}
      {visible && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white px-3 pb-[env(safe-area-inset-bottom,0px)] pt-1 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] sm:px-8 sm:pb-4 sm:pt-4"
        >
          <div className="mx-auto flex max-w-content flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="text-xs leading-snug text-ink-600 sm:text-sm sm:leading-relaxed">
              <p>
                Optional Google Ads measurement checks whether ads lead to partner link clicks. Accept loads the
                tag; Decline keeps it off. No personalised ads. Vercel Analytics and Speed Insights run
                separately.{' '}
                <Link href="/privacy-policy" className="underline hover:text-brass-700">
                  Privacy Policy
                </Link>{' '}
                · Cookie settings.
              </p>
              {choice && (
                <p className="mt-1 text-xs text-ink-400">
                  {choice === 'granted' ? "You've currently accepted this — changing to Decline switches it off." : "You've currently declined this — changing to Accept switches it on."}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => handleChoice('denied')}
                className="flex h-11 items-center justify-center rounded-sm border border-ink-200 px-4 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 sm:text-sm"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleChoice('granted')}
                className="flex h-11 items-center justify-center rounded-sm bg-ink-900 px-4 text-xs font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985] sm:text-sm"
              >
                Accept measurement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
