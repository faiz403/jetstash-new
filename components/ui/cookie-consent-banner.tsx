'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import {
  CONSENT_GRANTED_EVENT,
  CONSENT_SETTINGS_OPEN_EVENT,
  CONSENT_STORAGE_KEY,
  getStoredConsentChoice,
  getStoredStatisticsChoice,
  STATS_CONSENT_STORAGE_KEY,
  storeConsentChoice,
  storeStatisticsChoice,
  type ConsentChoice,
} from '@/lib/consent';
import { purgeAcquisitionSource } from '@/lib/acquisition';
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
const CHOICE_BUTTON =
  'flex h-11 flex-1 items-center justify-center rounded-sm border border-ink-900 bg-white px-4 text-xs font-semibold text-ink-900 transition-colors hover:bg-ink-50 sm:flex-none sm:text-sm';

/**
 * Two SEPARATE optional permissions (October 2026, consent-first): Google Ads measurement (the tag) and Site statistics (Vercel
 * Analytics and Speed Insights). Each has its own Decline and Accept, nothing is preselected, and neither implies the other. On a
 * first visit only the undecided ones are shown; Cookie settings in the footer shows both so either can be changed or withdrawn.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [statsChoice, setStatsChoice] = useState<ConsentChoice | null>(null);
  const [loadTag, setLoadTag] = useState(false);
  // Cookie settings (opened from the footer): the same panel, with both permissions shown whatever was chosen before.
  const [settingsMode, setSettingsMode] = useState(false);
  // First layer (October 2026): a compact summary with Reject all / Accept all. "Choose individual settings" opens the two separate
  // groups. Opening them, or leaving the panel alone, changes nothing: no permission is granted until a button says so.
  const [showDetails, setShowDetails] = useState(false);
  const loadTagRef = useRef(false);
  loadTagRef.current = loadTag;
  const panelRef = useRef<HTMLDivElement>(null);
  /** What had focus when Cookie settings was opened (the footer link), so closing returns the visitor to where they were. */
  const openerRef = useRef<HTMLElement | null>(null);

  function closeSettings() {
    setVisible(false);
    setSettingsMode(false);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && typeof opener.focus === 'function') requestAnimationFrame(() => opener.focus());
  }

  // Opening Cookie settings from the footer moves focus into the panel (the panel is early in the page for keyboard users).
  useEffect(() => {
    if (visible && settingsMode) panelRef.current?.focus();
  }, [visible, settingsMode]);

  useEffect(() => {
    const stored = getStoredConsentChoice();
    const storedStats = getStoredStatisticsChoice();
    setChoice(stored);
    setStatsChoice(storedStats);
    if (stored === 'granted') {
      // A returning visitor who already accepted — load the tag again on
      // this fresh page load. (It genuinely wasn't loaded until now: Basic
      // Consent Mode never loads it speculatively, so there's no state to
      // "resume" here, only a decision to re-apply.)
      setLoadTag(true);
    } else if (!stored) {
      setVisible(true);
    }
    // Site statistics is a separate permission: undecided shows the panel even for a visitor who already decided on measurement.
    if (!storedStats) setVisible(true);

    function handleReopen() {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setChoice(getStoredConsentChoice());
      setStatsChoice(getStoredStatisticsChoice());
      setSettingsMode(true);
      setVisible(true);
    }
    // Consent withdrawn in ANOTHER tab: the Google tag already running here cannot be unloaded, so this tab reloads (as it would had the
    // visitor withdrawn here). The reload reads the stored choice first and never requests the tag again.
    function handleStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== CONSENT_STORAGE_KEY && e.key !== STATS_CONSENT_STORAGE_KEY) return;
      const now = getStoredConsentChoice();
      setChoice(now);
      setStatsChoice(getStoredStatisticsChoice());
      if (now !== 'granted' && loadTagRef.current) window.location.reload();
    }
    window.addEventListener(CONSENT_SETTINGS_OPEN_EVENT, handleReopen);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CONSENT_SETTINGS_OPEN_EVENT, handleReopen);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  function handleChoice(next: ConsentChoice) {
    const wasGranted = choice === 'granted';
    storeConsentChoice(next);
    setChoice(next);
    settleAfterChoice(next, statsChoice);

    if (next === 'granted') {
      setLoadTag(true);
      // Lets advertising attribution (which needs this consent) start on the page the visitor is on.
      window.dispatchEvent(new Event(CONSENT_GRANTED_EVENT));
      return;
    }

    // Decline or withdrawal: no advertising attribution, and any classification already kept in this session is removed.
    purgeAcquisitionSource();

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

  /** Reject all / Accept all on the first layer. Two separate stored permissions are set together; neither is a combined permission. */
  function handleAll(next: ConsentChoice) {
    const adsWasOn = choice === 'granted';
    const statsWasOn = statsChoice === 'granted';
    storeConsentChoice(next);
    storeStatisticsChoice(next);
    setChoice(next);
    setStatsChoice(next);
    setVisible(false);
    if (next === 'granted') {
      setLoadTag(true);
      window.dispatchEvent(new Event(CONSENT_GRANTED_EVENT));
      return;
    }
    purgeAcquisitionSource();
    // Anything already running in this page cannot be unloaded, so a fresh load is the honest way to stop it.
    if (adsWasOn || statsWasOn) window.location.reload();
  }

  function openDetails() {
    setShowDetails(true);
    requestAnimationFrame(() => panelRef.current?.focus());
  }

  function closeDetails() {
    setShowDetails(false);
    requestAnimationFrame(() => panelRef.current?.focus());
  }

  function handleStatsChoice(next: ConsentChoice) {
    const statsWasGranted = statsChoice === 'granted';
    storeStatisticsChoice(next);
    setStatsChoice(next);
    settleAfterChoice(choice, next);
    if (next === 'granted') return;
    // Attribution events travel through the statistics scripts, so without them the classification kept in this session is removed.
    purgeAcquisitionSource();
    // The statistics scripts already running in this page cannot be unloaded, so a fresh load is the honest way to stop them: the
    // next load reads the withdrawal first and never requests either script.
    if (statsWasGranted) window.location.reload();
  }

  /** After a choice: on a first visit the panel goes once both permissions are decided (nothing is forced on the visitor); in Cookie settings it stays until Close. */
  function settleAfterChoice(adsNow: ConsentChoice | null, statsNow: ConsentChoice | null) {
    if (settingsMode) return;
    if (adsNow && statsNow) setVisible(false);
    else requestAnimationFrame(() => panelRef.current?.focus());
  }

  const summaryView = !settingsMode && !showDetails && choice === null && statsChoice === null;

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

          Ordinary fixed padding, not safe-area-aware: JetStash's viewport
          metadata (app/layout.tsx) does not set `viewportFit: 'cover'`, so
          under the current app configuration `env(safe-area-inset-bottom)`
          genuinely evaluates to 0 on every real device today — WebKit only
          reports a nonzero inset once a page opts into viewport-fit=cover,
          which this app does not. An earlier draft of this fix coupled this
          padding to `env(safe-area-inset-bottom)` with a matching
          compensation in homepage-opening-hero.tsx's own margin, as
          forward-looking insurance — deliberately removed (2 Sep 2026,
          founder review): that coupling only reads the banner's own state
          while the banner is visible, but the hero's compensating margin is
          a static CSS rule with no such condition, so it would have stayed
          pulled up after Accept/Decline too. If viewport-fit=cover is ever
          adopted, that should trigger its own site-wide safe-area review,
          not a homepage-specific hidden coupling landed years earlier. */}
      {visible && (
        <div
          role="region"
          aria-label="Cookie consent"
          ref={panelRef}
          tabIndex={-1}
          className="fixed inset-x-0 bottom-0 z-50 outline-none border-t border-ink-200 bg-white px-3 pb-1 pt-1 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] sm:px-8 sm:pb-4 sm:pt-4"
        >
          {summaryView ? (
            <div className="mx-auto flex max-w-content flex-col gap-1.5 text-xs leading-snug text-ink-600 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-sm sm:leading-relaxed">
              <div>
                <p>
                  <strong className="font-semibold text-ink-800">Your privacy choices.</strong> Optional Vercel Analytics and Speed Insights measure
                  site use and page speed. Optional Google Ads measurement checks whether ads lead to partner link clicks. All are off until you
                  choose.
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3">
                  <button type="button" onClick={openDetails} className="min-h-8 font-semibold text-ink-800 underline hover:text-brass-700">
                    Choose individual settings
                  </button>
                  <Link href="/privacy-policy" className="underline hover:text-brass-700">
                    Privacy Policy
                  </Link>
                </p>
              </div>
              {/* Equal prominence: Reject all and Accept all share one style and, on phones, one width. */}
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                <button type="button" onClick={() => handleAll('denied')} className={CHOICE_BUTTON}>
                  Reject all
                </button>
                <button type="button" onClick={() => handleAll('granted')} className={CHOICE_BUTTON}>
                  Accept all
                </button>
              </div>
            </div>
          ) : (
          <div className="mx-auto flex max-w-content flex-col gap-1.5 text-xs leading-snug text-ink-600 sm:gap-3 sm:text-sm sm:leading-relaxed">
            <p>
              Two optional settings, both off until you choose, and each is separate. Change either later with Cookie settings in the
              footer.{' '}
              <Link href="/privacy-policy" className="underline hover:text-brass-700">
                Privacy Policy
              </Link>
            </p>
            {(settingsMode || choice === null) && (
              <div role="group" aria-labelledby="ads-measurement-heading" className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p>
                  <strong id="ads-measurement-heading" className="font-semibold text-ink-800">
                    Google Ads measurement:
                  </strong>{' '}
                  Optional Google Ads measurement checks whether ads lead to partner link clicks. Accept loads the tag; Decline keeps it off.
                  No personalised ads.
                  {choice && <span className="text-ink-400"> Currently {choice === 'granted' ? 'on' : 'off'}.</span>}
                </p>
                <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                  <button type="button" onClick={() => handleChoice('denied')} aria-label="Decline Google Ads measurement" className={CHOICE_BUTTON}>
                    Decline
                  </button>
                  <button type="button" onClick={() => handleChoice('granted')} aria-label="Accept Google Ads measurement" className={CHOICE_BUTTON}>
                    Accept measurement
                  </button>
                </div>
              </div>
            )}
            {(settingsMode || statsChoice === null) && (
              <div role="group" aria-labelledby="site-statistics-heading" className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p>
                  <strong id="site-statistics-heading" className="font-semibold text-ink-800">
                    Site statistics:
                  </strong>{' '}
                  Vercel Analytics and Speed Insights count visits and page speed so JetStash can improve. They set no cookies. Accept loads them;
                  Decline keeps them off.
                  {statsChoice && <span className="text-ink-400"> Currently {statsChoice === 'granted' ? 'on' : 'off'}.</span>}
                </p>
                <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                  <button type="button" onClick={() => handleStatsChoice('denied')} aria-label="Decline site statistics" className={CHOICE_BUTTON}>
                    Decline
                  </button>
                  <button type="button" onClick={() => handleStatsChoice('granted')} aria-label="Accept site statistics" className={CHOICE_BUTTON}>
                    Accept statistics
                  </button>
                </div>
              </div>
            )}
            {settingsMode && (
              <div className="flex">
                <button type="button" onClick={closeSettings} className={`${CHOICE_BUTTON} w-full sm:w-auto`}>
                  Close
                </button>
              </div>
            )}
            {!settingsMode && showDetails && choice === null && statsChoice === null && (
              <div className="flex">
                <button type="button" onClick={closeDetails} className={`${CHOICE_BUTTON} w-full sm:w-auto`}>
                  Back
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </>
  );
}
