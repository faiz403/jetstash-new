import { describe, it, expect } from 'vitest';
import {
  assembleManchesterMumbaiBrief,
  getManchesterMumbaiNextAction,
  formatRouteStatusDate,
  formatWhatYouCouldMiss,
  hasNoMaterialConsequence,
  getManchesterMumbaiUnconfirmedItems,
  extractLongestNamedWait,
  SELF_TRANSFER_EXPLANATION,
  NO_MATERIAL_CONSEQUENCE_COPY,
  NO_UNCONFIRMED_ITEMS_COPY,
  type EvidencedFareOption,
} from '@/lib/journey-brief-phase1-manchester-mumbai';
import { getJourneyConsequences, formatJourneyConsequenceSummary } from '@/lib/journey-consequence';
import { fareObservations } from '@/data/fare-observations';

/**
 * Journey Brief Phase 1 — Manchester → Mumbai (5 Sept 2026). Protects the
 * product contract the founder's brief required: the ended direct service
 * can never appear as current, no fabricated fare/baggage/self-transfer
 * facts, journey consequences reuse PR #232's canonical logic verbatim, the
 * partner handoff never implies live availability, and missing evidence
 * fails closed rather than inventing a second comparison option.
 *
 * A fixed evaluation date is used throughout — the real service-ended event
 * (verifiedAt 2026-09-02, currentClaimValidBefore 2027-03-02) and the real
 * Sept 2026 fare observations are both well inside this window, so nothing
 * here is time-bomb-fragile the way `new Date()` would be.
 */
const NOW_ISO = '2026-09-05';

describe('Route reality never claims the ended direct service is current', () => {
  const brief = assembleManchesterMumbaiBrief(NOW_ISO)!;

  it('resolves', () => {
    expect(brief).not.toBeNull();
  });

  it('states the service has ended, not that it currently operates direct', () => {
    expect(brief.routeReality.badgeLabel).toBe('Direct service ended');
    expect(brief.routeReality.headline.toLowerCase()).toContain('ended');
    expect(brief.routeReality.headline.toLowerCase()).not.toMatch(/\boperates\b/);
  });

  it('the full sourced explanation is available for progressive disclosure, with real citations and an effective date', () => {
    expect(brief.routeReality.detail).not.toBeNull();
    expect(brief.routeReality.detail!.kind).toBe('service-ended');
    if (brief.routeReality.detail!.kind === 'service-ended') {
      expect(brief.routeReality.detail!.citations.length).toBeGreaterThan(0);
      expect(brief.routeReality.detail!.effectiveFrom).toBe('2026-08-31');
    }
  });

  it('formatRouteStatusDate renders UK long-form, matching every other Route Status surface', () => {
    expect(formatRouteStatusDate('2026-08-31')).toBe('31 August 2026');
  });
});

describe('Journey option: no live representative fare, honest historical fallback', () => {
  const brief = assembleManchesterMumbaiBrief(NOW_ISO)!;

  it('has no current Fare Signal — the route\'s service-ended status makes every observation non-publishable via the same gate every other route uses', () => {
    expect(brief.hasCurrentFareSignal).toBe(false);
  });

  it('falls back to the single most recent publicly-publishable historical check, not a fabricated live price', () => {
    expect(brief.evidencedOption).not.toBeNull();
    expect(brief.evidencedOption!.isCurrentRepresentativeFare).toBe(false);
    expect(brief.evidencedOption!.observedDate).toBe('2026-09-01');
    expect(brief.evidencedOption!.price).toBe(395);
  });

  it('never claims unknown baggage as included or free — PR #233 added a real `baggage` field, reused verbatim from the observation\'s own recorded value ("not stated"), never defaulted to "included" or a £0 claim', () => {
    expect(brief.evidencedOption!.baggage).toBe('not stated');
    expect(brief.evidencedOption!.baggage).not.toMatch(/included|£0|free/i);
  });
});

describe('Journey consequences reuse PR #232\'s canonical logic verbatim', () => {
  const brief = assembleManchesterMumbaiBrief(NOW_ISO)!;

  it('the fallback historical option surfaces its real, evidence-backed self-transfer and duration consequence', () => {
    expect(brief.evidencedOption!.journeyConsequences).toEqual(['Self-transfer', 'Outbound: 43h', 'Return: 14h 30m']);
  });

  it('never fabricates a consequence beyond what lib/journey-consequence.ts itself would produce for the same raw observation', async () => {
    const { fareObservations } = await import('@/data/fare-observations');
    const { getJourneyConsequences, formatJourneyConsequenceSummary } = await import('@/lib/journey-consequence');
    const obs = fareObservations.find((o) => o.id === 'obs-man-bom-economy-20260901-8w-v1')!;
    expect(obs).toBeDefined();
    const expected = formatJourneyConsequenceSummary(getJourneyConsequences(obs, 'BOM'));
    expect(brief.evidencedOption!.journeyConsequences).toEqual(expected);
  });
});

describe('Partner handoff never implies live fare availability', () => {
  const brief = assembleManchesterMumbaiBrief(NOW_ISO)!;

  it('the Trip.com URL is present (a genuine, dashboard-verified handoff) but is a search link, never a claim this exact fare is bookable', () => {
    expect(brief.tripComUrl).toContain('trip.com');
    // The handoff URL itself carries no price/fare-id parameter that could
    // read as "this exact observed fare is live" — it's a route search.
    expect(brief.tripComUrl).not.toMatch(/price=|fareId=/);
  });
});

describe('Missing evidence fails closed — never invents a second comparison option', () => {
  it('the brief exposes at most ONE evidencedOption, never a fabricated second choice to fill visual symmetry — enforced at the type level (EvidencedFareOption | null, never an array)', () => {
    const brief = assembleManchesterMumbaiBrief(NOW_ISO)!;
    // Runtime confirmation that the single value really is a plain object
    // or null, not a collection something could later push a second,
    // unevidenced entry into.
    expect(Array.isArray(brief.evidencedOption)).toBe(false);
  });

  it('an evaluation date before any observation exists correctly returns no evidenced option, rather than inventing one out of future data', () => {
    const brief = assembleManchesterMumbaiBrief('2026-01-01')!;
    expect(brief.evidencedOption).toBeNull();
  });
});

describe('Primary next action — worst-true-signal-wins, no obsolete withdrawal-boundary branch', () => {
  it('a critical Travel Ready signal always wins, regardless of fare state', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: { severity: 'critical', label: 'x', detail: 'Your passport needs renewing before you travel.' },
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('check-travel-ready');
    expect(action.reason).toBe('Your passport needs renewing before you travel.');
  });

  it('with no travel details entered yet, the action asks for them rather than guessing', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: false,
      travelReadySignal: null,
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('enter-travel-details');
  });

  it('with details entered and no critical signal, the action is to search current options — honest about no live fare being tracked', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: { severity: 'info', label: 'x', detail: 'y' },
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('search-current-options');
    expect(action.reason).toMatch(/doesn't currently track a live representative fare/);
  });

  it('once a genuine current Fare Signal exists, the action wording changes to reflect it (future-proofing, not a claim made today)', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: null,
      hasCurrentFareSignal: true,
    });
    expect(action.kind).toBe('search-current-options');
    expect(action.reason).toBe('JetStash has a recent tracked fare for this route.');
  });
});

describe('PR #233 final product-acceptance fix: a "caution" Travel Ready signal correctly stays secondary, but is never silently dropped', () => {
  it('a "caution" signal (e.g. document-timing-may-affect-booking — its own next-action text explicitly allows continued shopping with a flexible fare) does NOT escalate to check-travel-ready — "critical" alone gates that, matching the two verdicts whose own wording says "before booking"', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: { severity: 'caution', label: 'A document you still need to arrange may affect your timing — avoid a non-refundable fare for now.', detail: 'Start your application now.' },
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('search-current-options');
  });

  it('...but the same caution IS carried forward as openDocumentTask, verbatim from the signal\'s own label — never a second, independently-worded reminder', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: { severity: 'caution', label: 'A document you still need to arrange may affect your timing — avoid a non-refundable fare for now.', detail: 'Start your application now.' },
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('search-current-options');
    if (action.kind === 'search-current-options') {
      expect(action.openDocumentTask).toBe('A document you still need to arrange may affect your timing — avoid a non-refundable fare for now.');
    }
  });

  it('with no Travel Ready signal at all (nothing entered, or a clean "ready to continue"), openDocumentTask is null — never a fabricated reminder', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: null,
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('search-current-options');
    if (action.kind === 'search-current-options') {
      expect(action.openDocumentTask).toBeNull();
    }
  });

  it('an "info"-severity signal (e.g. ready-to-continue never produces a signal, but a hypothetical low-priority one) does not populate openDocumentTask either — only a genuine caution does', () => {
    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: { severity: 'info', label: 'x', detail: 'y' },
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('search-current-options');
    if (action.kind === 'search-current-options') {
      expect(action.openDocumentTask).toBeNull();
    }
  });
});

describe('The real India visa-timing scenario, end to end (evaluateTravelReadiness itself, unmodified)', () => {
  it('a British passport holder with no OCI/exemption, travelling comfortably ahead of India\'s eVisa processing window, produces "document-timing-may-affect-booking" — caution, not critical — and Journey Brief correctly keeps "search options" primary while surfacing the open task', async () => {
    const { evaluateTravelReadiness } = await import('@/lib/travel-ready-check');
    const result = evaluateTravelReadiness(
      {
        destinationSlug: 'mumbai',
        isBritishPassport: true,
        exemptionDocument: 'none',
        departureDate: '2026-11-01',
        arrivalDate: '2026-11-02',
        returnDate: '2026-11-15',
        passportExpiryDate: '2031-01-01',
      },
      new Date('2026-09-05T12:00:00Z')
    );
    expect(result.verdict).toBe('document-timing-may-affect-booking');
    expect(result.engineSignal?.severity).toBe('caution');

    const action = getManchesterMumbaiNextAction({
      hasEnteredTravelDetails: true,
      travelReadySignal: result.engineSignal,
      hasCurrentFareSignal: false,
    });
    expect(action.kind).toBe('search-current-options');
    if (action.kind === 'search-current-options') {
      expect(action.openDocumentTask).toBe(result.engineSignal!.label);
    }
  });
});

describe('PR #233 product-acceptance correction — Finding 3: the decisive facts, verified against the real canonical record', () => {
  const NOW_ISO = '2026-09-05';
  const brief = assembleManchesterMumbaiBrief(NOW_ISO)!;
  const rawObservation = fareObservations.find((o) => o.id === 'obs-man-bom-economy-20260901-8w-v1')!;

  it('the real observation genuinely records 3 outbound stops and a 23h15m Katowice wait among its layovers — confirmed directly against the canonical record, not trusted from the review alone', () => {
    expect(rawObservation).toBeDefined();
    expect(rawObservation.outboundStops).toBe(3);
    expect(rawObservation.priceNote).toContain('23h15m Katowice');
    expect(rawObservation.priceNote).toContain('3 stops');
  });

  it('extractLongestNamedWait finds the same 23h15m Katowice wait directly from that priceNote', () => {
    expect(extractLongestNamedWait(rawObservation.priceNote, 'outbound')).toEqual({ city: 'Katowice', duration: '23h 15m' });
  });

  it('the assembled brief surfaces both facts prominently — 3 stops outbound AND the 23h15m Katowice wait — not just the generic 43h total', () => {
    const summary = formatWhatYouCouldMiss(brief.evidencedOption!);
    expect(summary).toContain('3 stops outbound');
    expect(summary).toContain('23h 15m wait in Katowice');
    expect(summary).toContain('Self-transfer');
  });

  it('does not overload the summary with the return leg\'s own unremarkable 2h30m Riyadh wait — only the leg getJourneyConsequences() already flags as decisive', () => {
    const summary = formatWhatYouCouldMiss(brief.evidencedOption!);
    expect(summary.join(' ')).not.toContain('Riyadh');
  });

  it('PR #232 consequence truth is not contradicted: the underlying journeyConsequences field is exactly what lib/journey-consequence.ts itself produces for this record, unmodified', () => {
    const destinationIataCode = 'BOM';
    const expected = formatJourneyConsequenceSummary(getJourneyConsequences(rawObservation, destinationIataCode));
    expect(brief.evidencedOption!.journeyConsequences).toEqual(expected);
    expect(expected).toEqual(['Self-transfer', 'Outbound: 43h', 'Return: 14h 30m']);
  });

  it('self-transfer gets the founder-approved bounded explanation, never an invented consequence', () => {
    expect(brief.evidencedOption!.journeyConsequences).toContain('Self-transfer');
    expect(SELF_TRANSFER_EXPLANATION).toBe('This itinerary includes a self-transfer, so check the connection and baggage conditions carefully before booking.');
    expect(SELF_TRANSFER_EXPLANATION).not.toMatch(/missed.connection.responsibility|baggage.recheck|not protected/i);
  });
});

describe('PR #233 product-acceptance correction — Finding 3: no false drama for a genuinely clean itinerary', () => {
  const cleanOption: EvidencedFareOption = {
    price: 200,
    currency: 'GBP',
    cabin: 'Economy',
    airline: 'Fixture Air',
    observedDate: '2026-09-01',
    departureDate: '2026-10-01',
    returnDate: '2026-10-15',
    baggage: '1 free checked bag included',
    directness: 'direct',
    outboundStops: 0,
    returnStops: 0,
    outboundDuration: '7h',
    returnDuration: '7h 30m',
    journeyConsequences: [],
    longestNamedWait: null,
    connectionProtectionMentioned: false,
    isCurrentRepresentativeFare: true,
  };

  it('hasNoMaterialConsequence is true when neither PR #232\'s journeyConsequences nor a named wait was found', () => {
    expect(hasNoMaterialConsequence(cleanOption)).toBe(true);
  });

  it('formatWhatYouCouldMiss falls back to the (empty) canonical summary — never fabricates an airport change, self-transfer, long connection or baggage problem for a clean itinerary', () => {
    const summary = formatWhatYouCouldMiss(cleanOption);
    expect(summary).toEqual([]);
  });

  it('the component-facing copy for this state is the plain, honest "no material issue" sentence, not silence and not an invented warning', () => {
    expect(NO_MATERIAL_CONSEQUENCE_COPY).toBe('No material issue identified within the checks performed.');
    expect(NO_MATERIAL_CONSEQUENCE_COPY.toLowerCase()).not.toMatch(/self-transfer|airport change|risk|warning|delay/);
  });
});

describe('PR #233 product-acceptance correction — Finding 2: "What remains unconfirmed" is explicit and data-driven', () => {
  it('the real Manchester-Mumbai brief lists genuinely unconfirmed items: no current fare, not the current exact itinerary, unknown baggage, unconfirmed connection protection', () => {
    const brief = assembleManchesterMumbaiBrief('2026-09-05')!;
    const items = getManchesterMumbaiUnconfirmedItems(brief);
    expect(items).toEqual([
      'A current, live representative fare for this route',
      'The exact itinerary and operating airline for a fresh search — the recorded example below may no longer be offered as shown',
      'Checked baggage allowance and cost',
      'Whether a missed connection is protected, since this itinerary includes a self-transfer',
    ]);
  });

  it('never lists an item as unknown when the evidence actually establishes it — a fully-confirmed synthetic current fare with known baggage, no self-transfer, produces zero unconfirmed items', () => {
    const confirmedOption: EvidencedFareOption = {
      price: 400,
      currency: 'GBP',
      cabin: 'Economy',
      airline: 'Fixture Air',
      observedDate: '2026-09-05',
      departureDate: '2026-10-01',
      returnDate: '2026-10-15',
      baggage: '1 free checked bag included',
      directness: 'direct',
      outboundStops: 0,
      returnStops: 0,
      outboundDuration: '7h',
      returnDuration: '7h 30m',
      journeyConsequences: [],
      longestNamedWait: null,
      connectionProtectionMentioned: false,
      isCurrentRepresentativeFare: true,
    };
    const items = getManchesterMumbaiUnconfirmedItems({ evidencedOption: confirmedOption, hasCurrentFareSignal: true });
    expect(items).toEqual([]);
  });

  it('the connection-protection item only ever appears when self-transfer is actually present — never a generic checklist entry for a direct or single-ticket itinerary', () => {
    const directOption: EvidencedFareOption = {
      price: 400, currency: 'GBP', cabin: 'Economy', airline: 'Fixture Air', observedDate: '2026-09-05',
      departureDate: '2026-10-01', returnDate: '2026-10-15', baggage: 'not stated', directness: 'direct',
      outboundStops: 0, returnStops: 0, outboundDuration: '7h', returnDuration: '7h 30m',
      journeyConsequences: [], longestNamedWait: null, connectionProtectionMentioned: false, isCurrentRepresentativeFare: true,
    };
    const items = getManchesterMumbaiUnconfirmedItems({ evidencedOption: directOption, hasCurrentFareSignal: true });
    expect(items.some((i) => i.includes('missed connection'))).toBe(false);
  });

  it('the component-facing fallback copy for zero unconfirmed items is explicit, not silence', () => {
    expect(NO_UNCONFIRMED_ITEMS_COPY).toBe('No material unknown identified within these checks.');
  });
});
