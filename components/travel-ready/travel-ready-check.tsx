'use client';

import { useState, FormEvent } from 'react';
import { ShieldCheck, ArrowUpRight, BellRing, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import {
  evaluateTravelReadiness,
  TRAVEL_READY_SUPPORTED_COUNTRIES,
  type ExemptionDocument,
  type TravelReadyResult,
  type TravelReadyVerdict,
} from '@/lib/travel-ready-check';
import type { TravelReadySignal } from '@/lib/travel-intelligence-engine';
import { getRouteBookingUrl, getGeneralBookingUrl, getPrimaryBookingProvider } from '@/lib/booking-providers';
import { RouteWatchForm } from '@/components/route/route-watch-form';

/**
 * Travel Ready Check — answers "can I actually travel on these dates with
 * the documents I have?", the connected-but-different question to Book-By
 * Countdown's "when should I book?" (JETSTASH_PRINCIPLES.md §14.3). Feeds
 * its result into the Travel Intelligence Engine via `onResult`; on routes
 * where no engine badge exists yet, this card simply stands alone.
 *
 * Entirely client-side, no API call — nothing entered here is sent
 * anywhere or persisted (see lib/travel-ready-check.ts's own privacy note).
 */

const TONE_STYLES: Record<'critical' | 'caution' | 'ready' | 'neutral', string> = {
  critical: 'border-terracotta-300 bg-terracotta-50 text-terracotta-700',
  caution: 'border-brass/40 bg-brass-50 text-brass-700',
  ready: 'border-brass/40 bg-brass-50 text-brass-700',
  neutral: 'border-ink-200 bg-ink-50 text-ink-600',
};

const VERDICT_TONE: Record<TravelReadyVerdict, 'critical' | 'caution' | 'ready' | 'neutral'> = {
  'ready-to-continue': 'ready',
  'check-passport-validity': 'critical',
  'visa-or-entry-permission-needed': 'critical',
  'document-timing-may-affect-booking': 'caution',
  'official-confirmation-required': 'caution',
  'not-enough-information': 'neutral',
};

const CHECK_ICON: Record<'pass' | 'fail' | 'caution' | 'unknown', string> = {
  pass: 'text-brass-600',
  fail: 'text-terracotta-600',
  caution: 'text-terracotta-600',
  unknown: 'text-ink-400',
};

function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface TravelReadyCheckProps {
  defaultDestinationSlug?: string;
  /** Present when embedded on a route page — used to build a destination-specific booking link. */
  airportSlugForCta?: string;
  /**
   * Whether to render a Route Watch form inline when the traveller isn't
   * ready yet. Set false on route pages that already render their own
   * RouteWatchForm lower on the page, to avoid two sign-up forms on one
   * page. Defaults to true (for the standalone /travel-ready-check page).
   */
  showInlineRouteWatch?: boolean;
  onResult?: (signal: TravelReadySignal | null) => void;
}

const supportedDestinations = destinations.filter((d) => TRAVEL_READY_SUPPORTED_COUNTRIES.includes(d.country));

export function TravelReadyCheck({
  defaultDestinationSlug,
  airportSlugForCta,
  showInlineRouteWatch = true,
  onResult,
}: TravelReadyCheckProps) {
  const [destinationSlug, setDestinationSlug] = useState(defaultDestinationSlug ?? '');
  const [isBritishPassport, setIsBritishPassport] = useState<'yes' | 'no' | ''>('');
  const [exemptionDocument, setExemptionDocument] = useState<ExemptionDocument>('none');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [result, setResult] = useState<TravelReadyResult | null>(null);

  const destination = destinationSlug ? getDestinationBySlug(destinationSlug) : undefined;
  const country = destination?.country;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!destinationSlug || !isBritishPassport || !departureDate || !returnDate || !passportExpiryDate) return;
    const outcome = evaluateTravelReadiness(
      {
        destinationSlug,
        isBritishPassport: isBritishPassport === 'yes',
        exemptionDocument,
        departureDate,
        returnDate,
        passportExpiryDate,
      },
      new Date()
    );
    setResult(outcome);
    onResult?.(outcome.engineSignal);
  }

  function handleReset() {
    setResult(null);
    onResult?.(null);
  }

  const provider = getPrimaryBookingProvider();
  const bookingUrl =
    airportSlugForCta && destination
      ? getRouteBookingUrl(getAirportBySlug(airportSlugForCta)!, destination, undefined, `ready-check-${result?.verdict}`)
      : getGeneralBookingUrl(`ready-check-${destinationSlug || 'general'}`);

  return (
    <section
      aria-label="Travel Ready Check"
      className="rounded-md border border-ink-100 bg-white p-6 shadow-card sm:p-8"
    >
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
        <span className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Travel Ready Check</span>
      </div>
      <h2 className="mt-3 max-w-2xl font-display text-2xl leading-snug text-ink-900 sm:text-[1.7rem]">
        Can you actually travel on these dates, with the documents you have?
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-500">
        A private readiness check, not a price check — passport validity and visa guidance for your specific trip,
        sourced from official government pages.
      </p>

      {!result ? (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="ready-destination" className="text-xs text-ink-400">Destination</label>
            <select
              id="ready-destination"
              required
              value={destinationSlug}
              onChange={(e) => {
                setDestinationSlug(e.target.value);
                // A document exemption (e.g. NICOP) only makes sense for the
                // country it was selected for — never carry it over silently
                // when the destination changes.
                setExemptionDocument('none');
              }}
              className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass sm:max-w-sm"
            >
              <option value="">Select destination</option>
              {supportedDestinations.map((d) => (
                <option key={d.slug} value={d.slug}>{d.city}, {d.country}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-400">
              V1 covers Pakistan, India, Saudi Arabia, UAE, Qatar, Turkey and Morocco only — every other destination
              is marked as not yet covered rather than guessed.
            </p>
          </div>

          <fieldset>
            <legend className="text-xs text-ink-400">Are you travelling on a British passport?</legend>
            <div className="mt-1.5 flex gap-4">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="radio"
                    name="british-passport"
                    required
                    checked={isBritishPassport === v}
                    onChange={() => setIsBritishPassport(v)}
                  />
                  {v === 'yes' ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
          </fieldset>

          {(country === 'Pakistan' || country === 'India') && (
            <div>
              <label htmlFor="ready-exemption" className="text-xs text-ink-400">Do you hold any of these documents for this trip?</label>
              <select
                id="ready-exemption"
                value={exemptionDocument}
                onChange={(e) => setExemptionDocument(e.target.value as ExemptionDocument)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass sm:max-w-sm"
              >
                <option value="none">None of these</option>
                {country === 'Pakistan' && <option value="nicop-poc">NICOP or Pakistan Origin Card (POC)</option>}
                {country === 'India' && <option value="oci">OCI card (Overseas Citizen of India)</option>}
                <option value="visa-or-permit">I already hold a visa or entry permit for this trip</option>
              </select>
            </div>
          )}
          {country && country !== 'Pakistan' && country !== 'India' && (
            <div>
              <label htmlFor="ready-exemption-generic" className="text-xs text-ink-400">Do you already hold a visa or entry permit for this trip?</label>
              <select
                id="ready-exemption-generic"
                value={exemptionDocument}
                onChange={(e) => setExemptionDocument(e.target.value as ExemptionDocument)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass sm:max-w-sm"
              >
                <option value="none">No, not yet</option>
                <option value="visa-or-permit">Yes, I already hold one</option>
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="ready-departure" className="text-xs text-ink-400">Departure date</label>
              <input
                id="ready-departure"
                type="date"
                required
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 px-3 text-sm text-ink-900 focus-visible:border-brass"
              />
            </div>
            <div>
              <label htmlFor="ready-return" className="text-xs text-ink-400">Return date</label>
              <input
                id="ready-return"
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 px-3 text-sm text-ink-900 focus-visible:border-brass"
              />
            </div>
            <div>
              <label htmlFor="ready-passport-expiry" className="text-xs text-ink-400">Passport expiry date</label>
              <input
                id="ready-passport-expiry"
                type="date"
                required
                value={passportExpiryDate}
                onChange={(e) => setPassportExpiryDate(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-ink-200 px-3 text-sm text-ink-900 focus-visible:border-brass"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              data-analytics="ready-check-submit"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
            >
              Check my travel readiness
            </button>
          </div>
          <p className="text-xs text-ink-400">
            We don&apos;t ask for or store passport numbers, dates of birth, or any other document details — only
            what&apos;s above, checked in your browser and never saved.
          </p>
        </form>
      ) : (
        <div className="mt-6" data-analytics={`ready-check-verdict-${result.verdict}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${TONE_STYLES[VERDICT_TONE[result.verdict]]}`}
            >
              {result.verdict === 'ready-to-continue' && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
              {(result.verdict === 'check-passport-validity' || result.verdict === 'visa-or-entry-permission-needed') && (
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              )}
              {(result.verdict === 'official-confirmation-required' || result.verdict === 'not-enough-information') && (
                <HelpCircle className="mr-1 h-3.5 w-3.5" />
              )}
              {result.verdict.replace(/-/g, ' ')}
            </span>
          </div>

          <h3 className="mt-3 max-w-2xl font-display text-xl leading-snug text-ink-900">{result.headline}</h3>

          {result.checks.length > 0 && (
            <ul className="mt-5 flex flex-col gap-3">
              {result.checks.map((check) => (
                <li key={check.id} className="rounded-sm border border-ink-100 bg-sand-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${CHECK_ICON[check.status].replace('text-', 'bg-')}`} />
                    <span className="text-sm font-semibold text-ink-900">{check.label}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-600">{check.detail}</p>
                  {check.officialSource && (
                    <p className="mt-1.5 text-xs text-ink-400">
                      <a
                        href={check.officialSource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-analytics="ready-check-source-click"
                        className="underline underline-offset-2 hover:text-terracotta-600"
                      >
                        {check.officialSource.title}
                      </a>
                      {check.lastVerifiedDate && ` — verified ${formatShortDate(check.lastVerifiedDate)}`}
                      {check.stale && ' (due for re-verification)'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-sm font-medium text-ink-800">{result.nextAction}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {result.verdict === 'ready-to-continue' ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel={provider.rel}
                data-analytics="ready-check-book-cta"
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
              >
                Check live price
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
              </a>
            ) : showInlineRouteWatch ? null : (
              <a
                href="#route-watch"
                data-analytics="ready-check-watch"
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
              >
                <BellRing className="h-4 w-4" strokeWidth={2.25} />
                Watch this route
              </a>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-brass-600 hover:decoration-brass-600"
            >
              Check different dates
            </button>
          </div>

          {result.verdict !== 'ready-to-continue' && showInlineRouteWatch && (
            <div className="mt-6">
              <RouteWatchForm defaultDestinationSlug={destinationSlug} defaultIntent="document-timing" />
            </div>
          )}

          <p className="mt-5 text-xs text-ink-400">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
