'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import {
  compareJourneyOptions,
  groupStillUnknownByOption,
  hoursMinutesToMinutes,
  isJourneyOptionComplete,
  minutesToHoursMinutes,
  validateJourneyOption,
  type BaggageState,
  type JourneyComparisonResult,
  type JourneyOptionInput,
  type PriceBasis,
  type TriState,
} from '@/lib/journey-decision-brief';

/**
 * Journey Decision Brief — generic founder-only MVP (August 2026).
 *
 * Deliberately NOT the Manchester-Mumbai prototype
 * (components/journey-brief/journey-brief-manchester-mumbai.tsx), and does
 * not reuse its evidence bundle, route logic or copy. This surface answers
 * exactly one question — "bring two shortlisted flights, see the factual
 * differences" — and nothing else. No route data, no fare archive, no
 * Travel Ready, no booking handoff, no save/share, no accounts. Access is
 * gated entirely at the route level (see
 * app/founder/journey-brief/page.tsx), same model as every other founder
 * preview.
 *
 * Every price/time/stop/baggage/connection field the traveller enters is
 * explicitly their own entry, never JetStash-verified — every label and
 * result sentence says so. The comparison output never suggests which
 * option to choose, favours one over the other, or ranks them in any
 * way — see lib/journey-decision-brief.ts's compareJourneyOptions() and
 * tests/journey-decision-brief.test.ts's FORBIDDEN_WORDS list for the
 * enforced rules.
 *
 * UX refinement (August 2026, pre-real-user-test pass): duration entry
 * moved from raw minutes to separate hours/minutes fields via
 * lib/journey-decision-brief.ts's hoursMinutesToMinutes()/
 * minutesToHoursMinutes() adapter, connection/airport-change/self-transfer/
 * baggage fields moved behind a progressive-disclosure <details>, and hero/
 * button copy shortened — none of it touches the comparison engine's
 * arithmetic, validation semantics, or safety rules, only how the same
 * required/optional fields are presented.
 */

const EMPTY_OPTION: Partial<JourneyOptionInput> = {
  label: '',
  priceBasis: 'per-person',
  airportChange: 'unknown',
  selfTransfer: 'unknown',
  baggage: 'not-stated',
};

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min = 0,
  step,
  prefix,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  /** Pass 1 for whole-number fields (stops) — the engine also rejects a non-integer regardless, this just steers native input behaviour. */
  step?: number;
  /** Visible currency affordance, e.g. "£" — display only, MVP stays GBP-only regardless. */
  prefix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-ink-300">
        {label}
      </label>
      {hint && <p className="text-[11px] text-ink-300">{hint}</p>}
      <div className="relative mt-1.5">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-300">{prefix}</span>}
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className={`h-11 w-full rounded-sm border border-ink-100 bg-white text-sm text-ink-900 focus-visible:border-brass ${prefix ? 'pl-7 pr-3' : 'px-3'}`}
        />
      </div>
    </div>
  );
}

/**
 * Hours + minutes duration entry. Holds its own local hours/minutes state
 * (seeded once from the incoming total-minutes value) so two separate
 * number inputs can compose one JourneyOptionInput duration field without
 * either input fighting a derived-from-total round trip on every keystroke.
 * Resets cleanly on "Start again" because the parent remounts this whole
 * subtree via a React `key` change — see JourneyDecisionBrief below.
 */
function DurationField({
  idPrefix,
  label,
  hint,
  totalMinutes,
  onChange,
}: {
  idPrefix: string;
  label: string;
  hint?: string;
  totalMinutes: number | undefined;
  onChange: (total: number | undefined) => void;
}) {
  const initial = minutesToHoursMinutes(totalMinutes);
  const [hours, setHours] = useState<number | undefined>(initial.hours);
  const [minutes, setMinutes] = useState<number | undefined>(initial.minutes);
  const [touched, setTouched] = useState(false);

  function update(nextHours: number | undefined, nextMinutes: number | undefined) {
    setHours(nextHours);
    setMinutes(nextMinutes);
    setTouched(true);
    onChange(hoursMinutesToMinutes({ hours: nextHours, minutes: nextMinutes }));
  }

  const hoursInvalid = touched && hours !== undefined && (!Number.isInteger(hours) || hours < 0);
  const minutesInvalid = touched && minutes !== undefined && (!Number.isInteger(minutes) || minutes < 0 || minutes > 59);

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">{label}</span>
      {hint && <p className="text-[11px] text-ink-300">{hint}</p>}
      <div className="mt-1.5 flex gap-2">
        <div className="flex-1">
          <input
            id={`${idPrefix}-hours`}
            type="number"
            min={0}
            step={1}
            aria-label={`${label} — hours`}
            placeholder="Hours"
            value={hours ?? ''}
            onChange={(e) => update(e.target.value === '' ? undefined : Number(e.target.value), minutes)}
            className="h-11 w-full rounded-sm border border-ink-100 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
          />
          <span className="mt-1 block text-[11px] text-ink-300">hours</span>
        </div>
        <div className="flex-1">
          <input
            id={`${idPrefix}-minutes`}
            type="number"
            min={0}
            max={59}
            step={1}
            aria-label={`${label} — minutes`}
            placeholder="Minutes"
            value={minutes ?? ''}
            onChange={(e) => update(hours, e.target.value === '' ? undefined : Number(e.target.value))}
            className="h-11 w-full rounded-sm border border-ink-100 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
          />
          <span className="mt-1 block text-[11px] text-ink-300">minutes</span>
        </div>
      </div>
      {hoursInvalid && <p className="mt-1 text-xs text-terracotta-600">Hours must be zero or a positive whole number.</p>}
      {minutesInvalid && <p className="mt-1 text-xs text-terracotta-600">Minutes must be a whole number from 0–59.</p>}
    </div>
  );
}

function OptionForm({
  idPrefix,
  option,
  onChange,
}: {
  idPrefix: string;
  option: Partial<JourneyOptionInput>;
  onChange: (next: Partial<JourneyOptionInput>) => void;
}) {
  const set = <K extends keyof JourneyOptionInput>(key: K, value: JourneyOptionInput[K]) =>
    onChange({ ...option, [key]: value });

  return (
    <div className="rounded-md border border-ink-100 bg-white p-5">
      <div>
        <label htmlFor={`${idPrefix}-label`} className="text-xs font-semibold uppercase tracking-wide text-ink-300">
          Flight / airline
        </label>
        <p className="text-[11px] text-ink-300">As it appeared where you saw it — not verified by JetStash.</p>
        <input
          id={`${idPrefix}-label`}
          type="text"
          value={option.label ?? ''}
          onChange={(e) => set('label', e.target.value)}
          placeholder="e.g. Turkish Airlines via Istanbul"
          className="mt-1.5 h-11 w-full rounded-sm border border-ink-100 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField id={`${idPrefix}-price`} label="Price" value={option.priceGBP} onChange={(v) => set('priceGBP', v as number)} min={0} prefix="£" />
        <div>
          <label htmlFor={`${idPrefix}-basis`} className="text-xs font-semibold uppercase tracking-wide text-ink-300">
            Price basis
          </label>
          <select
            id={`${idPrefix}-basis`}
            value={option.priceBasis ?? 'per-person'}
            onChange={(e) => set('priceBasis', e.target.value as PriceBasis)}
            className="mt-1.5 h-11 w-full rounded-sm border border-ink-100 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
          >
            <option value="per-person">Per person</option>
            <option value="party-total">Total for the party</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <DurationField
          idPrefix={`${idPrefix}-outbound-duration`}
          label="Outbound duration"
          totalMinutes={option.outboundDurationMinutes}
          onChange={(v) => set('outboundDurationMinutes', v as number)}
        />
        <DurationField
          idPrefix={`${idPrefix}-return-duration`}
          label="Return duration"
          totalMinutes={option.returnDurationMinutes}
          onChange={(v) => set('returnDurationMinutes', v as number)}
        />
        <NumberField
          id={`${idPrefix}-outbound-stops`}
          label="Outbound stops"
          hint="0 = direct"
          value={option.outboundStops}
          onChange={(v) => set('outboundStops', v as number)}
          min={0}
          step={1}
        />
        <NumberField
          id={`${idPrefix}-return-stops`}
          label="Return stops"
          hint="0 = direct"
          value={option.returnStops}
          onChange={(v) => set('returnStops', v as number)}
          min={0}
          step={1}
        />
      </div>

      <details className="mt-5 rounded-md border border-ink-100 bg-sand-50 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-300">
          Add connection &amp; baggage details
        </summary>

        <p className="mt-3 text-[11px] text-ink-300">Optional — leave unknown rather than guessing.</p>

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-connection`} className="text-xs font-semibold uppercase tracking-wide text-ink-300">
              Connection airport(s)
            </label>
            <input
              id={`${idPrefix}-connection`}
              type="text"
              value={option.connectionAirports ?? ''}
              onChange={(e) => set('connectionAirports', e.target.value || undefined)}
              placeholder="e.g. Istanbul (IST)"
              className="mt-1.5 h-11 w-full rounded-sm border border-ink-100 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
            />
          </div>
          <DurationField
            idPrefix={`${idPrefix}-layover`}
            label="Longest layover"
            totalMinutes={option.layoverMinutes}
            onChange={(v) => set('layoverMinutes', v)}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Airport change</span>
            <div className="mt-1.5 flex gap-4">
              {(['yes', 'no', 'unknown'] as TriState[]).map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input type="radio" name={`${idPrefix}-airport-change`} checked={(option.airportChange ?? 'unknown') === v} onChange={() => set('airportChange', v)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-300">Self-transfer</span>
            <div className="mt-1.5 flex gap-4">
              {(['yes', 'no', 'unknown'] as TriState[]).map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input type="radio" name={`${idPrefix}-self-transfer`} checked={(option.selfTransfer ?? 'unknown') === v} onChange={() => set('selfTransfer', v)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor={`${idPrefix}-baggage`} className="text-xs font-semibold uppercase tracking-wide text-ink-300">
            Baggage
          </label>
          <select
            id={`${idPrefix}-baggage`}
            value={option.baggage ?? 'not-stated'}
            onChange={(e) => set('baggage', e.target.value as BaggageState)}
            className="mt-1.5 h-11 w-full rounded-sm border border-ink-100 bg-white px-3 text-sm text-ink-900 focus-visible:border-brass"
          >
            <option value="not-stated">Not stated</option>
            <option value="included">Included</option>
            <option value="known-extra-cost">Extra cost — known amount</option>
            <option value="extra-cost-unknown">Extra cost — amount unknown</option>
          </select>
          {option.baggage === 'known-extra-cost' && (
            <div className="mt-3 max-w-xs">
              <NumberField id={`${idPrefix}-baggage-cost`} label="Baggage cost" value={option.baggageCostGBP} onChange={(v) => set('baggageCostGBP', v)} min={0} prefix="£" />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

export function JourneyDecisionBrief() {
  const [resetCount, setResetCount] = useState(0);
  const [optionA, setOptionA] = useState<Partial<JourneyOptionInput>>({ ...EMPTY_OPTION });
  const [optionB, setOptionB] = useState<Partial<JourneyOptionInput>>({ ...EMPTY_OPTION });
  const [result, setResult] = useState<JourneyComparisonResult | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [started, setStarted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const issuesA = validateJourneyOption(optionA);
  const issuesB = validateJourneyOption(optionB);

  function markStarted() {
    if (!started) {
      setStarted(true);
      track('journey_decision_brief_started');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (!isJourneyOptionComplete(optionA) || !isJourneyOptionComplete(optionB)) {
      setResult(null);
      return;
    }
    const comparison = compareJourneyOptions(optionA, optionB);
    setResult(comparison);
    track('journey_decision_brief_completed');
  }

  // Moves focus and scrolls to the result heading whenever a comparison is
  // freshly produced, so it's immediately obvious the comparison exists —
  // fires only when `result` transitions to a non-null value (a successful
  // submission), never on Edit flights (no state change) or Start again
  // (sets result back to null, so this effect is a no-op there).
  useEffect(() => {
    if (result) {
      resultHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultHeadingRef.current?.focus();
    }
  }, [result]);

  function handleStartAgain() {
    setResetCount((n) => n + 1);
    setOptionA({ ...EMPTY_OPTION });
    setOptionB({ ...EMPTY_OPTION });
    setResult(null);
    setAttempted(false);
    setStarted(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleEditFlights() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="bg-sand-50">
      <section className="border-b border-ink-100 bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brass-500">Founder-only experiment</span>
          <h1 className="mt-3 font-display text-3xl leading-[1.05] tracking-tight text-ink-900 sm:text-4xl">
            Journey Decision Brief
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-900">Compare the two flights you&apos;re deciding between.</p>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-ink-700">
            See the factual differences in price, journey time, stops and baggage before you book.
          </p>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ink-300">
            Enter what you were shown for each flight — JetStash does not verify any of it, and this
            never tells you which one to book.
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-14" onFocusCapture={markStarted} onClickCapture={markStarted}>
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <form ref={formRef} onSubmit={handleSubmit} key={resetCount}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 font-display text-lg text-ink-900">Option A</h2>
                <OptionForm idPrefix="jdb-a" option={optionA} onChange={setOptionA} />
                {attempted && issuesA.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-terracotta-600">
                    {issuesA.map((issue) => (
                      <li key={issue.field}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="mb-3 font-display text-lg text-ink-900">Option B</h2>
                <OptionForm idPrefix="jdb-b" option={optionB} onChange={setOptionB} />
                {attempted && issuesB.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs text-terracotta-600">
                    {issuesB.map((issue) => (
                      <li key={issue.field}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-sm bg-ink-900 px-6 text-sm font-semibold text-sand-50 transition hover:bg-ink-700 active:scale-[0.985]"
              >
                Compare these flights
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-10 max-w-3xl rounded-md border border-ink-100 bg-white p-6 sm:p-8" aria-labelledby="jdb-result-heading">
              <h2 ref={resultHeadingRef} id="jdb-result-heading" tabIndex={-1} className="font-display text-xl text-ink-900">
                What the entered facts show
              </h2>

              {/* Section A — decision-relevant comparisons only. */}
              <ul className="mt-5 space-y-2 text-sm text-ink-900">
                {result.comparisonStatements.map((statement, i) => (
                  <li key={i} className="rounded-sm bg-sand-50 px-3 py-2 font-medium">
                    {statement}
                  </li>
                ))}
              </ul>

              {/* Section B — compact per-option summary, always identified as Option A / Option B first. */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[result.optionASummary, result.optionBSummary].map((summary) => (
                  <div key={summary.identifier} className="rounded-md border border-ink-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                      {summary.identifier}
                      {summary.label && <span className="normal-case text-ink-300"> — {summary.label}</span>}
                    </p>
                    <dl className="mt-2 space-y-1 text-sm text-ink-900">
                      <div>{summary.priceText}</div>
                      <div>{summary.totalTimeText}</div>
                      <div>{summary.outboundStopsText}</div>
                      <div>{summary.returnStopsText}</div>
                      {summary.extras.map((extra, i) => (
                        <div key={i} className="text-ink-700">
                          {extra}
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>

              {/* Section C — every unknown still named, grouped into one line per option (presentation-only; the full per-field list stays in result.stillUnknown). */}
              {result.stillUnknown.length > 0 && (
                <div className="mt-6 rounded-md border border-dashed border-ink-200 bg-sand-50 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-300">Still unknown</h3>
                  <ul className="mt-2 space-y-1 text-sm text-ink-700">
                    {(() => {
                      const grouped = groupStillUnknownByOption(result.stillUnknown);
                      return (
                        <>
                          {grouped.optionA && (
                            <li>
                              <span className="font-semibold text-ink-900">Option A:</span> {grouped.optionA}
                            </li>
                          )}
                          {grouped.optionB && (
                            <li>
                              <span className="font-semibold text-ink-900">Option B:</span> {grouped.optionB}
                            </li>
                          )}
                        </>
                      );
                    })()}
                  </ul>
                </div>
              )}

              <p className="mt-6 text-xs leading-relaxed text-ink-300">
                Every figure above comes directly from what you entered for Option A and Option B.
                JetStash has not checked either price or itinerary against a live source, and is
                not suggesting which option to book.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleEditFlights}
                  className="inline-flex h-10 items-center justify-center rounded-sm border border-ink-100 px-5 text-sm font-semibold text-ink-700 transition hover:bg-sand-50"
                >
                  Edit flights
                </button>
                <button
                  type="button"
                  onClick={handleStartAgain}
                  className="inline-flex h-10 items-center justify-center rounded-sm border border-ink-100 px-5 text-sm font-semibold text-ink-700 transition hover:bg-sand-50"
                >
                  Start again
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
