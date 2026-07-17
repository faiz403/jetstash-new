'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  MapPinned,
  Plane,
  ShieldCheck,
} from 'lucide-react';
import { airports, getAirportBySlug } from '@/data/airports';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getRouteBookingUrl, getPrimaryBookingProvider } from '@/lib/booking-providers';
import { track } from '@/lib/analytics';
import { RouteMapHero } from '@/components/sections/route-map-hero';
import { Badge } from '@/components/ui/badge';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { getDestinationImage } from '@/lib/brand-images';
import { evaluateTravelReadiness, type ExemptionDocument } from '@/lib/travel-ready-check';
import {
  BAGGAGE_NEED_OPTIONS,
  BOOK_BY_UNAVAILABLE_COPY,
  BOUNDARY_STATE_COPY,
  BUSINESS_CLASS_COPY,
  CABIN_PREFERENCE_OPTIONS,
  ECONOMY_COPY,
  EVIDENCE_BUNDLE,
  FLIGHT_CONSIDERATIONS,
  WITHDRAWAL_BOUNDARY_DATE,
  getBaggageNote,
  getDateBoundaryState,
  getDominantAction,
  type BaggageNeed,
  type CabinPreference,
  type DateBoundaryState,
} from '@/lib/journey-brief-manchester-mumbai';

/**
 * Manchester → Mumbai Journey Brief.
 *
 * Founder-only surface — access is gated entirely at the route level (see
 * app/founder/journey-brief/manchester-mumbai/page.tsx), not by any wording
 * on this page. The Book-By and fare-integrity honesty rules from Gate 1/2
 * carry over unchanged: no fare is ever shown without a complete, dated
 * observation on record; Book-By stays in its honest-unavailable state;
 * Business Class shows no cabin claim; Route Watch and Save stay disabled
 * (no infrastructure exists yet), with wording that discloses that plainly
 * without labelling it a "prototype".
 */

const airport = getAirportBySlug('manchester')!;
const destination = getDestinationBySlug('mumbai')!;

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function JourneyBriefManchesterMumbai() {
  const [stage, setStage] = useState<'entry' | 'result'>('entry');
  const [airportSlug, setAirportSlug] = useState('manchester');
  const [destinationSlug, setDestinationSlug] = useState('mumbai');
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isBritishPassport, setIsBritishPassport] = useState<'yes' | 'no' | ''>('');
  const [exemptionDocument, setExemptionDocument] = useState<ExemptionDocument>('none');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [cabinPreference, setCabinPreference] = useState<CabinPreference>('Economy');
  const [baggageNeed, setBaggageNeed] = useState<BaggageNeed>('not-sure');
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);

  const boundaryState: DateBoundaryState | null = stage === 'result' && departureDate ? getDateBoundaryState(departureDate) : null;

  const travelReadyResult = useMemo(() => {
    if (stage !== 'result' || !isBritishPassport || !departureDate || !returnDate || !passportExpiryDate) return null;
    return evaluateTravelReadiness(
      {
        destinationSlug: 'mumbai',
        isBritishPassport: isBritishPassport === 'yes',
        exemptionDocument,
        departureDate,
        returnDate,
        passportExpiryDate,
      },
      new Date()
    );
  }, [stage, isBritishPassport, exemptionDocument, departureDate, returnDate, passportExpiryDate]);

  const dominantAction = useMemo(
    () => getDominantAction({ boundaryState, travelReadySignal: travelReadyResult?.engineSignal ?? null }),
    [boundaryState, travelReadyResult]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (airportSlug !== 'manchester' || destinationSlug !== 'mumbai') {
      setRouteUnavailable(true);
      return;
    }
    setRouteUnavailable(false);
    setStage('result');
    track('journey_brief_started', { route: `${airportSlug}-${destinationSlug}` });
  }

  return (
    <div className="bg-sand-50">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-24">
        <HeroBackdrop image={(() => { const img = getDestinationImage('mumbai'); return img ? { ...img, alt: '' } : null; })()} />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brass-200">Journey Brief</span>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-sand-50 sm:text-5xl">
            Manchester to Mumbai
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-200">
            Everything that matters before you book — checked, dated and sourced, not assumed.
          </p>

          {stage === 'entry' && (
            <form onSubmit={handleSubmit} className="mt-9 max-w-3xl rounded-md border border-white/10 bg-ink-950/70 p-6 backdrop-blur-sm sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="jb-from" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Flying from
                  </label>
                  <select
                    id="jb-from"
                    value={airportSlug}
                    onChange={(e) => { setAirportSlug(e.target.value); setRouteUnavailable(false); }}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  >
                    {airports.map((a) => (
                      <option key={a.slug} value={a.slug} className="bg-ink-900 text-sand-50">{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="jb-to" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Going to
                  </label>
                  <select
                    id="jb-to"
                    value={destinationSlug}
                    onChange={(e) => { setDestinationSlug(e.target.value); setRouteUnavailable(false); }}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  >
                    {destinations.map((d) => (
                      <option key={d.slug} value={d.slug} className="bg-ink-900 text-sand-50">{d.city}, {d.country}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="jb-departure" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Departure date
                  </label>
                  <input
                    id="jb-departure"
                    type="date"
                    disabled={flexibleDates}
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass disabled:opacity-40"
                  />
                </div>
                <div>
                  <label htmlFor="jb-return" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Return date
                  </label>
                  <input
                    id="jb-return"
                    type="date"
                    disabled={flexibleDates}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass disabled:opacity-40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-ink-200">
                    <input
                      type="checkbox"
                      checked={flexibleDates}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFlexibleDates(checked);
                        if (checked) {
                          setDepartureDate('');
                          setReturnDate('');
                        }
                      }}
                    />
                    My dates are flexible
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Are you travelling on a British passport?</span>
                  <div className="mt-2 flex gap-5">
                    {(['yes', 'no'] as const).map((v) => (
                      <label key={v} className="flex items-center gap-1.5 text-sm text-ink-200">
                        <input type="radio" name="jb-passport" checked={isBritishPassport === v} onChange={() => setIsBritishPassport(v)} />
                        {v === 'yes' ? 'Yes' : 'No'}
                      </label>
                    ))}
                  </div>
                </div>

                {isBritishPassport && (
                  <>
                    <div>
                      <label htmlFor="jb-exemption" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                        Do you hold any of these documents?
                      </label>
                      <select
                        id="jb-exemption"
                        value={exemptionDocument}
                        onChange={(e) => setExemptionDocument(e.target.value as ExemptionDocument)}
                        className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                      >
                        <option value="none" className="bg-ink-900 text-sand-50">None of these</option>
                        <option value="oci" className="bg-ink-900 text-sand-50">OCI card (Overseas Citizen of India)</option>
                        <option value="visa-or-permit" className="bg-ink-900 text-sand-50">I already hold a visa or entry permit</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="jb-passport-expiry" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                        Passport expiry date
                      </label>
                      <input
                        id="jb-passport-expiry"
                        type="date"
                        value={passportExpiryDate}
                        onChange={(e) => setPassportExpiryDate(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                      />
                    </div>
                  </>
                )}

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Cabin</span>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {CABIN_PREFERENCE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink-200">
                        <input
                          type="radio"
                          name="jb-cabin"
                          checked={cabinPreference === opt.value}
                          onChange={() => setCabinPreference(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="jb-baggage" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Baggage
                  </label>
                  <select
                    id="jb-baggage"
                    value={baggageNeed}
                    onChange={(e) => setBaggageNeed(e.target.value as BaggageNeed)}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  >
                    {BAGGAGE_NEED_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-ink-900 text-sand-50">{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {routeUnavailable && (
                <p role="alert" className="mt-4 rounded-sm border border-terracotta-400/40 bg-terracotta-950/30 px-4 py-3 text-sm text-terracotta-200">
                  This route isn't part of the Journey Brief yet — currently available for Manchester → Mumbai only.
                </p>
              )}

              <button
                type="submit"
                className="mt-6 inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-7 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
              >
                Build my Journey Brief
              </button>
              <p className="mt-3 text-xs text-ink-400">
                Dates, passport details and baggage are optional — add what you know now and JetStash will show exactly
                what it can and can't confirm yet.
              </p>
            </form>
          )}
        </div>
      </section>

      {stage === 'result' && (
        <>
          {/* ── Route overview + evidence ────────────────────────────────── */}
          <section className="border-b border-ink-100 bg-white py-8 sm:py-10" aria-labelledby="jb-verdict-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Route overview</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="brass">Direct service on record</Badge>
                <Badge variant="ink">Time-bound — see below</Badge>
              </div>
              <h2 id="jb-verdict-heading" className="mt-3 font-display text-2xl text-ink-900 sm:text-3xl">
                {EVIDENCE_BUNDLE.route.airline} operates this route direct, with an announced end date.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                IndiGo has announced it will temporarily discontinue Manchester services from{' '}
                {formatDate(WITHDRAWAL_BOUNDARY_DATE)}. {EVIDENCE_BUNDLE.characterisation}
              </p>

              <details className="mt-5 max-w-2xl rounded-md border border-ink-100 bg-sand-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink-700">How JetStash checked this</summary>
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600">
                  <p>
                    <strong>Source:</strong> {EVIDENCE_BUNDLE.primarySource.organisation} — “{EVIDENCE_BUNDLE.primarySource.title}”
                    (published {formatDate(EVIDENCE_BUNDLE.primarySource.publicationDate)}), and{' '}
                    {EVIDENCE_BUNDLE.corroboratingSource.organisation} — “{EVIDENCE_BUNDLE.corroboratingSource.title}”
                    (published {formatDate(EVIDENCE_BUNDLE.corroboratingSource.publicationDate)}).
                  </p>
                  <p>
                    <strong>Last checked:</strong> {formatDate(EVIDENCE_BUNDLE.primarySource.accessedDate)}. <strong>Next
                    review:</strong> {formatDate(EVIDENCE_BUNDLE.nextReviewDate)}, with a mandatory boundary review on{' '}
                    {formatDate(EVIDENCE_BUNDLE.boundaryReviewDate)}.
                  </p>
                  <p>
                    <strong>What this doesn&apos;t confirm:</strong> current-week frequency, whether{' '}
                    {formatDate(WITHDRAWAL_BOUNDARY_DATE)} itself is a still-operating day, or Business Class availability.
                    Confirm your exact travel date directly with IndiGo before booking.
                  </p>
                </div>
              </details>

              {/* ── Flight and airport considerations ───────────────────── */}
              <div className="mt-6 max-w-2xl rounded-md border border-ink-100 bg-sand-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                  <Plane className="h-4 w-4" strokeWidth={2} />
                  Flight and airport considerations
                </div>
                <dl className="mt-3 space-y-2 text-sm text-ink-600">
                  <div className="flex flex-wrap justify-between gap-x-4"><dt className="text-ink-500">Departure airport</dt><dd className="font-medium text-ink-800">{FLIGHT_CONSIDERATIONS.departureAirport}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-4"><dt className="text-ink-500">Arrival airport</dt><dd className="font-medium text-ink-800">{FLIGHT_CONSIDERATIONS.arrivalAirport}</dd></div>
                  <div className="flex flex-wrap justify-between gap-x-4"><dt className="text-ink-500">Flight numbers</dt><dd className="font-medium text-ink-800">{FLIGHT_CONSIDERATIONS.flightNumbers}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-ink-500">{FLIGHT_CONSIDERATIONS.note}</p>
              </div>

              {/* ── Journey Map, focused on this one route ──────────────── */}
              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <MapPinned className="h-3.5 w-3.5" strokeWidth={2} />
                  Journey Map — focused on this route
                </div>
                <RouteMapHero
                  initialActiveSlug="mumbai"
                  lockedSlug="mumbai"
                  onDestinationActivate={(slug) =>
                    setMapMessage(
                      slug === 'mumbai' ? null : 'Journey Brief is currently available for Manchester → Mumbai only.'
                    )
                  }
                />
                {mapMessage && (
                  <p role="status" aria-live="polite" className="mt-3 max-w-2xl text-sm leading-relaxed text-terracotta-700">
                    {mapMessage}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Entry-readiness summary ──────────────────────────────────── */}
          <section className="bg-sand-50 py-8 sm:py-10" aria-labelledby="jb-readiness-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Entry-readiness summary
              </div>
              {travelReadyResult ? (
                <div
                  role="status"
                  className={
                    travelReadyResult.verdict === 'ready-to-continue'
                      ? 'max-w-2xl rounded-md border border-brass/40 bg-brass-50 p-5'
                      : travelReadyResult.verdict === 'check-passport-validity' || travelReadyResult.verdict === 'visa-or-entry-permission-needed'
                        ? 'max-w-2xl rounded-md border border-terracotta-200 bg-terracotta-50 p-5'
                        : 'max-w-2xl rounded-md border border-ink-100 bg-white p-5'
                  }
                >
                  <h2 id="jb-readiness-heading" className="font-display text-xl text-ink-900">{travelReadyResult.headline}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700">{travelReadyResult.nextAction}</p>
                  <p className="mt-3 text-xs text-ink-500">{travelReadyResult.disclaimer}</p>
                </div>
              ) : (
                <div className="max-w-2xl rounded-md border border-dashed border-ink-200 bg-white p-5">
                  <h2 id="jb-readiness-heading" className="font-display text-lg text-ink-900">
                    {flexibleDates
                      ? 'Add your passport details and a specific date when you have one, for a full entry-readiness check.'
                      : 'Add your travel dates and passport details above for a specific entry-readiness check.'}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    Passport validity and visa guidance depend on your exact dates and document status — JetStash won&apos;t
                    guess at these.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── What to check before booking ─────────────────────────────── */}
          <section className="bg-white py-8 sm:py-10" aria-labelledby="jb-boundary-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">What to check before booking</p>

              {boundaryState ? (
                <div
                  role="status"
                  aria-live="polite"
                  className={
                    (boundaryState === 'after'
                      ? 'rounded-md border border-terracotta-200 bg-terracotta-50 p-5'
                      : boundaryState === 'boundary'
                        ? 'rounded-md border border-brass/40 bg-brass-50 p-5'
                        : 'rounded-md border border-ink-100 bg-sand-50 p-5') + ' mt-3 max-w-2xl'
                  }
                >
                  <Badge variant={boundaryState === 'after' ? 'terracotta' : boundaryState === 'boundary' ? 'brass' : 'ink'}>
                    {BOUNDARY_STATE_COPY[boundaryState].label}
                  </Badge>
                  <h2 id="jb-boundary-heading" className="mt-2.5 font-display text-xl text-ink-900">
                    {BOUNDARY_STATE_COPY[boundaryState].headline}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-700">{BOUNDARY_STATE_COPY[boundaryState].body}</p>
                </div>
              ) : (
                <p id="jb-boundary-heading" className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
                  {flexibleDates
                    ? "You said your dates are flexible — once you have a specific date in mind, add it above to check it against IndiGo's announced 31 August 2026 change."
                    : "Add a departure date above for a date-specific check against IndiGo's announced 31 August 2026 change."}
                </p>
              )}

              <div className="mt-6 max-w-2xl rounded-md border border-dashed border-ink-200 bg-sand-50 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                  <CalendarClock className="h-4 w-4" strokeWidth={2} />
                  Book By guidance
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{BOOK_BY_UNAVAILABLE_COPY.headline}</p>
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-600">
                  {BOOK_BY_UNAVAILABLE_COPY.actions.map((a) => (
                    <li key={a} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-600">{getBaggageNote(baggageNeed)}</p>
            </div>
          </section>

          {/* ── Cabin ────────────────────────────────────────────────────── */}
          <section className="bg-sand-50 py-8 sm:py-10" aria-labelledby="jb-cabin-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <h2 id="jb-cabin-heading" className="font-display text-xl text-ink-900 sm:text-2xl">
                How would you like to travel?
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className={`rounded-md border bg-white p-5 ${cabinPreference !== 'Business' ? 'border-brass/50' : 'border-ink-100'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Economy</p>
                    {cabinPreference !== 'Business' && <Badge variant="brass">Your preference</Badge>}
                  </div>
                  <p className="mt-2 font-display text-lg text-ink-900">{ECONOMY_COPY.headline}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{ECONOMY_COPY.body}</p>
                  <a
                    href={getRouteBookingUrl(airport, destination)}
                    target="_blank"
                    rel={getPrimaryBookingProvider().rel}
                    onClick={() => track('journey_brief_live_price_click', { route: 'manchester-mumbai', cabin: 'economy' })}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline underline-offset-2 hover:text-brass-600"
                  >
                    Check live price
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </a>
                  <p className="mt-1.5 text-[11px] text-ink-400">Partner link. Confirm the final price before booking.</p>
                </div>
                <div className={`rounded-md border bg-white p-5 ${cabinPreference === 'Business' ? 'border-brass/50' : 'border-ink-100'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Business Class</p>
                    {cabinPreference === 'Business' && <Badge variant="brass">Your preference</Badge>}
                  </div>
                  <p className="mt-2 font-display text-lg text-ink-900">{BUSINESS_CLASS_COPY.headline}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{BUSINESS_CLASS_COPY.body}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── One dominant recommendation ─────────────────────────────── */}
          <section className="bg-ink-900 py-8 sm:py-10" aria-labelledby="jb-decision-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-brass-200">Your recommendation</p>
              <h2 id="jb-decision-heading" className="mt-2 font-display text-2xl text-sand-50 sm:text-3xl">
                {dominantAction.label}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">{dominantAction.reason}</p>
            </div>
          </section>

          {/* ── Route Watch ──────────────────────────────────────────────── */}
          <section className="bg-sand-50 py-8 sm:py-10" aria-labelledby="jb-watch-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <div className="max-w-xl rounded-md border border-ink-100 bg-white p-6">
                <div className="flex items-center gap-2.5">
                  <BellRing className="h-4.5 w-4.5 text-terracotta-600" strokeWidth={2} />
                  <h2 id="jb-watch-heading" className="font-display text-lg text-ink-900">Register for route updates</h2>
                </div>
                <p className="mt-1.5 text-sm text-ink-500">Updates are reviewed and sent manually when available.</p>

                <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
                  <label htmlFor="jb-watch-email" className="sr-only">Email address</label>
                  <input
                    id="jb-watch-email"
                    type="email"
                    disabled
                    placeholder="you@example.com"
                    className="h-11 flex-1 rounded-sm border border-ink-200 bg-ink-50 px-4 text-sm text-ink-400"
                  />
                  <button
                    type="submit"
                    disabled
                    aria-disabled="true"
                    className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-sm bg-ink-200 px-5 text-sm font-semibold text-ink-500"
                  >
                    Register
                  </button>
                </form>
                <p className="mt-3 text-xs text-ink-500">Sign-up isn&apos;t connected yet — nothing is sent until this is switched on.</p>
              </div>
            </div>
          </section>

          {/* ── Save ─────────────────────────────────────────────────────── */}
          <section className="bg-white py-8 sm:py-10" aria-labelledby="jb-save-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <h2 id="jb-save-heading" className="font-display text-lg text-ink-900">Save this Journey Brief</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
                My Stash doesn&apos;t exist yet — this button is disabled, since saving here would not actually store
                anything.
              </p>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="mt-4 inline-flex h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-sm border border-ink-200 bg-ink-50 px-5 text-sm font-semibold text-ink-400"
              >
                Save this Journey Brief
              </button>
              <p className="mt-3 text-xs text-ink-500">Not connected yet — nothing is stored when you click save.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
