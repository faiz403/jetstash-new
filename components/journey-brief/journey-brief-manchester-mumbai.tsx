'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Pencil,
  Plane,
  ShieldCheck,
} from 'lucide-react';
import { airports } from '@/data/airports';
import { destinations } from '@/data/destinations';
import { formatChecked } from '@/data/deals';
import { PROVIDER_REL } from '@/lib/booking-providers';
import { AffiliateLinkDisclosure } from '@/components/ui/affiliate-link-disclosure';
import { TrackedOutboundLink } from '@/components/ui/tracked-outbound-link';
import { track } from '@/lib/analytics';
import { Badge } from '@/components/ui/badge';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { getDestinationImage } from '@/lib/brand-images';
import { evaluateTravelReadiness, type ExemptionDocument } from '@/lib/travel-ready-check';
import {
  assembleManchesterMumbaiBrief,
  formatRouteStatusDate,
  formatWhatYouCouldMiss,
  getManchesterMumbaiNextAction,
  getManchesterMumbaiUnconfirmedItems,
  hasNoMaterialConsequence,
  MANCHESTER_MUMBAI_ROUTE_SLUG,
  NO_MATERIAL_CONSEQUENCE_COPY,
  NO_UNCONFIRMED_ITEMS_COPY,
  SELF_TRANSFER_EXPLANATION,
  VERIFY_BEFORE_PAYING_COPY,
} from '@/lib/journey-brief-phase1-manchester-mumbai';

/**
 * Journey Brief Phase 1 — Manchester → Mumbai founder-only pilot (5 Sept
 * 2026, product implementation following Astra's "30-second Journey Brief"
 * recommendation — a concise briefing built around five answers: what
 * actually operates, the viable journey choice, the decisive consequence a
 * traveller could otherwise miss, entry-readiness, and one clear next step).
 *
 * Full rewrite of the Gate 1/2 prototype this founder-only page previously
 * rendered. That prototype's own hardcoded evidence bundle
 * (lib/journey-brief-manchester-mumbai.ts) had gone stale — see this
 * session's Phase 0 audit — so this version is built entirely on canonical,
 * reused sources instead (see lib/journey-brief-phase1-manchester-mumbai.ts's
 * own header comment for exactly which ones and why). The old file and its
 * exports are left completely untouched: components/homepage-v2/
 * journey-brief-hero.tsx (a separate, protected homepage-v2 preview) still
 * depends on them and is out of this task's scope.
 *
 * Founder-only surface — access is gated entirely at the route level (see
 * app/founder/journey-brief/manchester-mumbai/page.tsx), not by any wording
 * on this page.
 */

const NOW_ISO = new Date().toISOString().slice(0, 10);

function EyebrowLabel({ children, tone = 'ink' }: { children: React.ReactNode; tone?: 'ink' | 'terracotta' }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tone === 'terracotta' ? 'text-terracotta-600' : 'text-ink-500'}`}>
      {children}
    </p>
  );
}

export function JourneyBriefManchesterMumbai() {
  const [stage, setStage] = useState<'entry' | 'result'>('entry');
  const [airportSlug, setAirportSlug] = useState('manchester');
  const [destinationSlug, setDestinationSlug] = useState('mumbai');
  const [departureDate, setDepartureDate] = useState('');
  // PR #230 final reference-event correction (5 September 2026): India's
  // passport-validity rule is arrival-anchored — this brief collects a real
  // arrival date too, rather than passing departureDate as a stand-in.
  const [arrivalDate, setArrivalDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isBritishPassport, setIsBritishPassport] = useState<'yes' | 'no' | ''>('');
  const [exemptionDocument, setExemptionDocument] = useState<ExemptionDocument>('none');
  const [passportExpiryDate, setPassportExpiryDate] = useState('');
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  // PR #233 product-acceptance correction (5 Sept 2026, founder review):
  // Finding 1 — the entry form previously unmounted entirely once
  // stage === 'result', so "Add your travel dates and passport details
  // above" pointed at nothing. All the field values below already live in
  // this component's own state (never cleared by a stage change), so
  // returning to 'entry' restores a fully usable, pre-filled form for
  // free — this ref+effect only adds the missing focus outcome.
  const fromFieldRef = useRef<HTMLSelectElement>(null);
  const [focusEntryOnReturn, setFocusEntryOnReturn] = useState(false);
  // Result-viewport fix (6 Sept 2026, founder-directed following a 5-person
  // usability failure investigation): the entry form lives inside the same
  // dark hero as the h1/backdrop image. On submit, that tall form unmounts
  // and the hero collapses (measured: 1336px -> 373px at 320px width) while
  // the browser leaves scrollY exactly where it was — wherever the user had
  // scrolled to reach the button. On mobile that stranded the viewport deep
  // inside the newly-reflowed page, well past the result's own heading, in
  // some cases still inside the now-much-shorter hero showing nothing but
  // the dimmed backdrop image. resultSectionRef/resultHeadingRef below are
  // the two-part fix: scroll the result card's own top into view (so
  // "Journey Brief" is the first thing the reader sees, not blindly
  // scrolling to page top), then move focus to its heading — the exact same
  // ref+effect-after-commit pattern already established above for the
  // return-to-entry direction, just for the forward direction, which never
  // got the equivalent treatment.
  const resultSectionRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const brief = useMemo(() => assembleManchesterMumbaiBrief(NOW_ISO), []);

  function editJourneyDetails() {
    setStage('entry');
    setFocusEntryOnReturn(true);
  }

  useEffect(() => {
    if (stage === 'entry' && focusEntryOnReturn) {
      fromFieldRef.current?.focus();
      setFocusEntryOnReturn(false);
    }
  }, [stage, focusEntryOnReturn]);

  // Runs after React has committed the 'result' render (a plain effect
  // keyed on `stage`, not code run synchronously inside handleSubmit) —
  // resultSectionRef/resultHeadingRef only resolve to real DOM nodes once
  // that render has actually happened, which is exactly what this ordering
  // guarantees. Re-fires on every entry->result transition, including
  // resubmission after "Edit journey details".
  useEffect(() => {
    if (stage === 'result') {
      // html { scroll-padding-top: 6rem } (app/globals.css) already keeps
      // scroll targets clear of the sticky header site-wide — reused here
      // rather than a new offset calculation local to this component.
      resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // preventScroll: focusing the heading must not trigger a second,
      // competing scroll (the browser's own default focus-scroll
      // behaviour) that could fight the scrollIntoView call above.
      resultHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [stage]);

  const hasEnteredTravelDetails = Boolean(isBritishPassport && departureDate && arrivalDate && returnDate && passportExpiryDate);

  const travelReadyResult = useMemo(() => {
    if (stage !== 'result' || !hasEnteredTravelDetails) return null;
    return evaluateTravelReadiness(
      {
        destinationSlug: 'mumbai',
        isBritishPassport: isBritishPassport === 'yes',
        exemptionDocument,
        departureDate,
        arrivalDate,
        returnDate,
        passportExpiryDate,
      },
      new Date()
    );
  }, [stage, hasEnteredTravelDetails, isBritishPassport, exemptionDocument, departureDate, arrivalDate, returnDate, passportExpiryDate]);

  const nextAction = useMemo(
    () =>
      getManchesterMumbaiNextAction({
        hasEnteredTravelDetails,
        travelReadySignal: travelReadyResult?.engineSignal ?? null,
        hasCurrentFareSignal: brief?.hasCurrentFareSignal ?? false,
      }),
    [hasEnteredTravelDetails, travelReadyResult, brief]
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

  if (!brief) {
    // Fails closed rather than throwing — should never happen in production
    // for this hardcoded route slug (see assembleManchesterMumbaiBrief's own
    // doc comment).
    return (
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8">
        <p className="text-sm text-ink-600">This Journey Brief isn&apos;t available right now.</p>
      </div>
    );
  }

  const { routeReality, evidencedOption, hasCurrentFareSignal, tripComUrl } = brief;

  return (
    <div className="bg-sand-50">
      {/* ── Hero + entry form ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink-900 py-16 sm:py-24">
        <HeroBackdrop image={(() => { const img = getDestinationImage('mumbai'); return img ? { ...img, alt: '' } : null; })()} />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brass-200">Journey Brief</span>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-sand-50 sm:text-5xl">
            Manchester to Mumbai
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-200">
            What actually operates, your realistic choice, and the one thing you could miss — in about 30 seconds.
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
                    ref={fromFieldRef}
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
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  />
                </div>
                <div>
                  <label htmlFor="jb-arrival" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Arrival date in Mumbai
                  </label>
                  <input
                    id="jb-arrival"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  />
                </div>
                <div>
                  <label htmlFor="jb-return" className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                    Return date
                  </label>
                  <input
                    id="jb-return"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-sm border border-white/15 bg-white/5 px-3 text-sm text-sand-50 focus-visible:border-brass"
                  />
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
                Dates and passport details are optional — add what you know now and JetStash will show exactly what it
                can and can&apos;t confirm yet.
              </p>
            </form>
          )}
        </div>
      </section>

      {stage === 'result' && (
        <>
          {/* ── The Brief: Route Reality → Journey Choice → What You Could
              Miss, one restrained card, mobile-first order matches reading
              order ──────────────────────────────────────────────────── */}
          <section className="bg-white py-8 sm:py-10" aria-labelledby="jb-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <div ref={resultSectionRef} className="max-w-2xl rounded-md border border-ink-200 bg-sand-50 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-600">Journey Brief</p>
                    {/* tabIndex={-1}: programmatically focusable (via the
                        effect above) without joining the normal Tab order —
                        a heading isn't naturally interactive, and adding it
                        to Tab order would be the "intrusive/unnatural
                        keyboard behaviour" the fix must avoid. */}
                    <h2 ref={resultHeadingRef} id="jb-heading" tabIndex={-1} className="mt-1 font-display text-2xl text-ink-900 sm:text-3xl">Manchester to Mumbai</h2>
                  </div>
                  {/* PR #233 product-acceptance correction: Finding 1 — a
                      real, keyboard-reachable way back to the entry form.
                      A plain <button>, not an anchor to a non-existent
                      form. */}
                  <button
                    type="button"
                    onClick={editJourneyDetails}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-600 underline decoration-ink-300 underline-offset-2 hover:text-terracotta-600"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                    Edit journey details
                  </button>
                </div>

                {/* 1. Route reality */}
                <div className="mt-5">
                  <EyebrowLabel>Route reality</EyebrowLabel>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="ink">{routeReality.badgeLabel}</Badge>
                  </div>
                  <p className="mt-2 text-base leading-relaxed text-ink-800">{routeReality.headline}</p>

                  {routeReality.detail && routeReality.detail.kind !== 'neutral-pending' && (
                    <details className="mt-3 rounded-md border border-ink-100 bg-white p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-ink-700">How JetStash checked this</summary>
                      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-600">
                        {'headline' in routeReality.detail && (
                          <p className="font-medium text-ink-800">{routeReality.detail.headline}</p>
                        )}
                        {'explanation' in routeReality.detail && <p>{routeReality.detail.explanation}</p>}
                        {'effectiveFrom' in routeReality.detail && (
                          <p>
                            <strong>Effective from:</strong> {formatRouteStatusDate(routeReality.detail.effectiveFrom)}.
                          </p>
                        )}
                        {'citations' in routeReality.detail && routeReality.detail.citations.length > 0 && (
                          <ul className="mt-1 space-y-1">
                            {routeReality.detail.citations.map((c, i) => (
                              <li key={i}>
                                <strong>{c.publisher}</strong>
                                {c.title ? ` — ${c.title}` : ''}
                                {c.accessedAt ? ` (checked ${formatRouteStatusDate(c.accessedAt)})` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  )}
                </div>

                {/* 2. Recorded example — PR #233 product-acceptance
                    correction: renamed from "Your journey option" (read as
                    endorsement) to a neutral evidence label, and now shows
                    the recorded example's own travel dates distinctly from
                    the date JetStash checked it. */}
                <div className="mt-5 border-t border-ink-100 pt-5">
                  <EyebrowLabel>{evidencedOption?.isCurrentRepresentativeFare ? 'Tracked fare' : 'Recorded example'}</EyebrowLabel>
                  {evidencedOption ? (
                    <>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="font-display text-2xl text-ink-900">
                          £{evidencedOption.price.toLocaleString('en-GB')}
                        </span>
                        <span className="text-sm text-ink-500">return · {evidencedOption.cabin}</span>
                      </div>
                      <p className="mt-1 text-sm text-ink-600">
                        {evidencedOption.airline}
                        {evidencedOption.directness === 'direct' ? ' · Direct' : evidencedOption.directness === 'connecting' ? ' · Connecting' : ''}
                      </p>
                      {evidencedOption.departureDate && evidencedOption.returnDate && (
                        <p className="mt-1 text-sm text-ink-600">
                          For travel {formatChecked(evidencedOption.departureDate)} – {formatChecked(evidencedOption.returnDate)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ink-400">
                        {evidencedOption.isCurrentRepresentativeFare ? 'Checked' : 'Recorded'} {formatChecked(evidencedOption.observedDate)}
                      </p>
                      {!hasCurrentFareSignal && (
                        <p className="mt-2 text-sm leading-relaxed text-ink-500">
                          JetStash doesn&apos;t currently track a live representative fare for this route since the
                          direct service ended — this is the most recent check on file, not today&apos;s price.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                      JetStash has no fare evidence on file for this route right now — search current options directly
                      below.
                    </p>
                  )}
                </div>

                {/* 3. What you could miss — PR #233 product-acceptance
                    correction: leads with the specific decision-changing
                    facts (formatWhatYouCouldMiss(), which surfaces the
                    single longest named wait when one exists) rather than
                    only the generic total-duration figure, states plainly
                    when nothing material was found, and gives self-transfer
                    a bounded, founder-approved explanation. */}
                {evidencedOption && (
                  <div className="mt-5 border-t border-ink-100 pt-5">
                    <EyebrowLabel tone={hasNoMaterialConsequence(evidencedOption) ? 'ink' : 'terracotta'}>What you could miss</EyebrowLabel>
                    {hasNoMaterialConsequence(evidencedOption) ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{NO_MATERIAL_CONSEQUENCE_COPY}</p>
                    ) : (
                      <>
                        <p className="mt-1.5 flex items-start gap-2 text-base font-medium leading-relaxed text-terracotta-700">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                          <span>{formatWhatYouCouldMiss(evidencedOption).join(' · ')}</span>
                        </p>
                        {evidencedOption.journeyConsequences.includes('Self-transfer') && (
                          <p className="mt-2 text-sm leading-relaxed text-ink-600">{SELF_TRANSFER_EXPLANATION}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 4. What remains unconfirmed — PR #233 product-acceptance
                    correction: a first-class, explicit answer rather than
                    something scattered across disclaimers. Data-driven —
                    see getManchesterMumbaiUnconfirmedItems()'s own doc
                    comment for exactly what each item is gated on. */}
                {evidencedOption && (() => {
                  const unconfirmed = getManchesterMumbaiUnconfirmedItems({ evidencedOption, hasCurrentFareSignal });
                  return (
                    <div className="mt-5 border-t border-ink-100 pt-5">
                      <EyebrowLabel>What remains unconfirmed</EyebrowLabel>
                      {unconfirmed.length > 0 ? (
                        <ul className="mt-1.5 flex flex-col gap-1.5 text-sm leading-relaxed text-ink-600">
                          {unconfirmed.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{NO_UNCONFIRMED_ITEMS_COPY}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* ── 4. Travel Ready — compact, bounded, reuses the existing engine ── */}
          <section className="bg-sand-50 py-8 sm:py-10" aria-labelledby="jb-readiness-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Entry readiness
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
                  <a
                    href="/travel-ready-check"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-terracotta-600"
                  >
                    Open the full Travel Ready Check
                    <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
                  </a>
                </div>
              ) : (
                <div className="max-w-2xl rounded-md border border-dashed border-ink-200 bg-white p-5">
                  <h2 id="jb-readiness-heading" className="font-display text-lg text-ink-900">
                    Add your travel dates and passport details above for a specific entry-readiness check.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    Passport validity and visa guidance depend on your exact dates and document status — JetStash
                    won&apos;t guess at these.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── 5. What to do next — one primary action ─────────────────── */}
          <section className="bg-ink-900 py-8 sm:py-10" aria-labelledby="jb-next-heading">
            <div className="mx-auto max-w-content px-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-brass-200">What to do next</p>
              <h2 id="jb-next-heading" className="mt-2 font-display text-2xl text-sand-50 sm:text-3xl">
                {nextAction.label}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">{nextAction.reason}</p>

              {/* PR #233 final product-acceptance fix: a still-open Travel
                  Ready caution (e.g. a document to arrange) stays visible
                  right beside the primary action, not just in the Entry
                  Readiness section above it — see getManchesterMumbaiNextAction's
                  own doc comment for why this stays a reminder, not an
                  escalation to a different primary action. */}
              {nextAction.kind === 'search-current-options' && nextAction.openDocumentTask && (
                <p className="mt-3 flex items-start gap-2 max-w-2xl rounded-sm border border-brass/30 bg-brass/10 px-4 py-3 text-sm leading-relaxed text-brass-100">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2} aria-hidden="true" />
                  <span>Still open: {nextAction.openDocumentTask}</span>
                </p>
              )}

              {nextAction.kind === 'search-current-options' && tripComUrl && (
                <div className="mt-5">
                  <TrackedOutboundLink
                    event="journey_brief_live_price_click"
                    properties={{ route: MANCHESTER_MUMBAI_ROUTE_SLUG, source: 'journey-brief' }}
                    href={tripComUrl}
                    target="_blank"
                    rel={PROVIDER_REL}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-brass px-5 py-2.5 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
                  >
                    <Plane className="h-4 w-4" strokeWidth={2.25} />
                    Search on Trip.com
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                  </TrackedOutboundLink>
                  {/* PR #233 product-acceptance correction, Finding 5: locks
                      the product meaning that Trip.com is a fresh search,
                      not a promise the recorded example above is still
                      bookable — the shortlisted result still needs
                      verifying before paying. */}
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">{VERIFY_BEFORE_PAYING_COPY}</p>
                  <div className="mt-2">
                    <AffiliateLinkDisclosure providerName="Trip.com" className="text-ink-400">
                      Check the itinerary, baggage allowance and booking terms before paying.
                    </AffiliateLinkDisclosure>
                  </div>
                </div>
              )}

              {nextAction.kind === 'check-travel-ready' && (
                <a
                  href="#jb-readiness-heading"
                  className="mt-5 inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-brass px-6 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 hover:shadow-brass-glow active:scale-[0.985]"
                >
                  Go to entry readiness
                </a>
              )}

              {/* PR #233 product-acceptance correction, Finding 1: this
                  used to link to "#jb-readiness-heading" — a dead end,
                  since the input form no longer exists once stage ===
                  'result'. A real button that returns to the entry stage
                  (preserving already-entered values) and moves focus to
                  the first field, matching the "Edit journey details"
                  action in the card header above. */}
              {nextAction.kind === 'enter-travel-details' && (
                <button
                  type="button"
                  onClick={editJourneyDetails}
                  className="mt-5 inline-flex h-12 items-center justify-center gap-1.5 rounded-sm border border-white/20 px-6 text-sm font-semibold text-sand-50 transition-colors hover:bg-white/5"
                >
                  Add travel dates and passport details
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
