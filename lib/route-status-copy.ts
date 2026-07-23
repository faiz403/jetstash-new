import {
  type Route,
  type RouteStatusResult,
  type ServiceLevelNotice,
  type VerifiedDirectBasis,
  type RoutePresentation,
  getRouteAirport,
  getRouteDestination,
  getAirlineVerification,
  getRouteStatus,
  getRoutePresentation,
  buildServiceEndedPresentation,
  buildUnverifiedPresentation,
} from '@/data/routes';
import {
  type RouteStatusEvent,
  type RouteStatusScope,
  type SourceRef,
  type NonEmptyArray,
  getEventsForRoute,
  getActiveEvents,
  isCurrentClaimValid,
  scopesMatch,
} from '@/data/route-status-events';
import { getAirlineBySlug } from '@/data/airlines';

/**
 * Route Status V1 Phase 2 — the customer-facing view-model layer. This is
 * the ONLY place a RouteStatusResult is turned into words. It re-validates
 * every piece of cited evidence at render time, independently of whatever
 * the result object already encoded (defence in depth — see the Route
 * Status V1 final errata §6), and fails closed to a neutral, evidence-free
 * pending variant whenever that validation cannot be completed. Reads no
 * wall clock: `nowIso` is always supplied by the caller.
 *
 * getEffectiveRoutePresentation() (below) is deliberately routed THROUGH
 * this file's own getRouteStatusCopy(), not built directly from
 * getRouteStatus()'s raw result — see the final audit's closing invariant:
 * a RouteStatusResult carrying malformed/tampered evidence must never leak
 * "direct" facts through the presentation layer just because it never
 * passed through the stricter validation this file applies for customer
 * copy. Both surfaces now share one evidence gate.
 */

/** A source cited by a resolved, validated event or verification record. Deliberately the same shape for both a ledger event's SourceRef and a route/airline VerifiedDirectBasis entry, so a positive-claim citation list can mix either origin without the caller needing to know which. */
export interface ResolvedCitation {
  publisher: string;
  title?: string;
  url?: string;
  accessedAt?: string;
}

export interface ResolvedServiceNotice {
  airlineSlug: string;
  /** Resolved display name — only ever a real data/airlines.ts entry. A notice whose airline can't be resolved is dropped entirely by resolveServiceNotices(), never rendered with a raw slug. */
  airlineName: string;
  kind: ServiceLevelNotice['kind'];
  effectiveFrom: string;
  /** This notice's own validated evidence — independent of, and additional to, the parent view model's citations. */
  citations: NonEmptyArray<ResolvedCitation>;
}

/**
 * Discriminated on `kind` so every field a variant needs is enforced at
 * compile time. Only 'transition-boundary-pending' carries evidence in a
 * pending state — it is the one pending reason that is itself a sourced
 * claim ("a publisher's announced date has passed"). 'neutral-pending' is
 * the ONLY variant with no evidence fields at all: a resolution failure for
 * any other variant always produces a fresh 'neutral-pending' value, never
 * a partially-filled positive or transition-boundary variant — see the
 * Route Status V1 micro-errata §3.
 */
export type RouteStatusViewModel =
  | { kind: 'verified-direct'; badgeLabel: string; citations: NonEmptyArray<ResolvedCitation>; serviceNotices: ResolvedServiceNotice[] }
  | {
      kind: 'withdrawal-announced';
      badgeLabel: string;
      headline: string;
      explanation: string;
      announcedAt: string;
      effectiveFrom: string;
      citations: NonEmptyArray<ResolvedCitation>;
      serviceNotices: ResolvedServiceNotice[];
    }
  | {
      kind: 'service-ended';
      badgeLabel: string;
      headline: string;
      explanation: string;
      effectiveFrom: string;
      citations: NonEmptyArray<ResolvedCitation>;
      serviceNotices: ResolvedServiceNotice[];
    }
  | {
      kind: 'transition-boundary-pending';
      badgeLabel: string;
      body: string;
      publisher: string;
      effectiveFrom: string;
      drivingEventId: string;
      citations: NonEmptyArray<ResolvedCitation>;
    }
  | { kind: 'neutral-pending'; badgeLabel: string; body: string };

const NEUTRAL_PENDING_BODY = "We can't currently confirm this route's direct service — check directly with the airline before booking.";

function neutralPending(): RouteStatusViewModel {
  return { kind: 'neutral-pending', badgeLabel: 'Verification pending', body: NEUTRAL_PENDING_BODY };
}

function toCitations(sources: SourceRef[] | undefined): ResolvedCitation[] {
  if (!sources) return [];
  return sources
    .filter((s) => Boolean(s.publisher && s.url && s.accessedAt))
    .map((s) => ({ publisher: s.publisher, title: s.title, url: s.url, accessedAt: s.accessedAt }));
}

function basisToCitation(b: VerifiedDirectBasis): ResolvedCitation {
  return { publisher: b.sourceName, url: b.sourceUrl, accessedAt: b.verifiedDate };
}

/** Converts an array already proven non-empty by the caller (always guarded by an `if (arr.length === 0) return ...` immediately above) into the compile-time NonEmptyArray shape. Never call this without first checking length > 0. */
function nonEmpty<T>(arr: T[]): NonEmptyArray<T> {
  const [first, ...rest] = arr;
  return [first, ...rest];
}

function eventEffectiveDate(event: RouteStatusEvent): string | undefined {
  if (event.type === 'withdrawal-rescheduled') return event.newEffectiveFrom;
  if ('effectiveFrom' in event) return event.effectiveFrom;
  return undefined;
}

/**
 * Re-verifies one VerifiedDirectBasis entry against the ACTUAL current
 * route.verification / AirlineVerification record it claims to summarise —
 * never trusting sourceName/sourceUrl/verifiedDate/reviewDueDate merely
 * because they arrived inside a RouteStatusResult. A basis item that
 * doesn't exactly match a real, currently-'verified' record (or whose real
 * record has since gone stale relative to `nowIso`) is dropped. See the
 * final audit §3.
 */
function revalidateBasisItem(b: VerifiedDirectBasis, route: Route, nowIso: string): VerifiedDirectBasis | null {
  const real = b.kind === 'route' ? route.verification : b.airlineSlug ? getAirlineVerification(route, b.airlineSlug) : undefined;
  if (!real || real.status !== 'verified') return null;
  if (real.sourceName !== b.sourceName) return null;
  if ((real.sourceUrl ?? undefined) !== (b.sourceUrl ?? undefined)) return null;
  if (real.verifiedDate !== b.verifiedDate) return null;
  if (real.reviewDueDate !== b.reviewDueDate) return null;
  if (!isCurrentClaimValid(real.reviewDueDate, nowIso)) return null;
  return b;
}

interface ResolveOpts {
  requireFreshness: boolean;
  requireReachedDate: boolean;
  requireVerifiedOccurrence: boolean;
}

/**
 * Resolves and fully validates the exact ledger event behind a positive,
 * transition-boundary, or service-notice claim — an id match alone is
 * necessary but not sufficient. Returns null (fail closed) on ANY
 * mismatch: wrong route, wrong/superseded event, wrong type, wrong scope,
 * wrong effective date, missing/invalid sources, stale when freshness is
 * required, not yet reached when reaching the date is required, or missing
 * verifiedOccurrence when occurrence is required. See the Route Status V1
 * micro-errata §5 and the final audit §3 (the same rule now also gates
 * every service notice, not only the primary claim).
 */
function resolveDrivingEvent(
  eventId: string,
  route: Route,
  expectedScope: RouteStatusScope,
  expectedTypes: RouteStatusEvent['type'][],
  expectedEffectiveFrom: string,
  routeActiveEvents: RouteStatusEvent[],
  nowIso: string,
  opts: ResolveOpts
): RouteStatusEvent | null {
  const event = routeActiveEvents.find((e) => e.id === eventId);
  if (!event) return null; // not found, or superseded/inactive — routeActiveEvents already excludes both
  if (event.routeSlug !== route.slug) return null;
  if (!expectedTypes.includes(event.type)) return null;
  if (!scopesMatch(event.scope, expectedScope)) return null;
  if (eventEffectiveDate(event) !== expectedEffectiveFrom) return null;
  if (!event.sources || event.sources.length === 0) return null;
  for (const s of event.sources) {
    if (!s.publisher || !s.url || !s.accessedAt) return null;
  }
  if (opts.requireFreshness) {
    if (!('currentClaimValidBefore' in event) || !isCurrentClaimValid(event.currentClaimValidBefore, nowIso)) return null;
  }
  if (opts.requireVerifiedOccurrence) {
    if (event.type !== 'service-ended' || event.verifiedOccurrence !== true) return null;
  }
  if (opts.requireReachedDate) {
    if (nowIso < expectedEffectiveFrom) return null;
  }
  return event;
}

/** The exact validation rule for each ServiceLevelNotice kind — mirrors the freshness/occurrence/reached-date requirements getRouteStatus() itself applies when constructing that kind of notice. */
const NOTICE_VALIDATION: Record<ServiceLevelNotice['kind'], { expectedTypes: RouteStatusEvent['type'][]; opts: ResolveOpts }> = {
  'withdrawal-announced': {
    expectedTypes: ['withdrawal-announced', 'withdrawal-rescheduled'],
    opts: { requireFreshness: true, requireReachedDate: false, requireVerifiedOccurrence: false },
  },
  'service-ended': {
    expectedTypes: ['service-ended'],
    opts: { requireFreshness: true, requireReachedDate: true, requireVerifiedOccurrence: true },
  },
  'status-reverification-pending': {
    // Deliberately NOT freshness-gated — this notice exists precisely
    // because the driving event's own claim horizon has expired without
    // reverification; it must still have reached its own effective date.
    expectedTypes: ['withdrawal-announced', 'withdrawal-rescheduled'],
    opts: { requireFreshness: false, requireReachedDate: true, requireVerifiedOccurrence: false },
  },
};

/**
 * Resolves every service notice through the SAME full validation as the
 * primary claim (active/non-superseded, route slug, airline scope, event
 * type, effective date, non-empty valid sources, freshness/occurrence/
 * reached-date per its kind) and attaches its own validated citations. A
 * notice that fails any check, or whose airline cannot be resolved against
 * the real airline registry, is dropped entirely — never rendered with a
 * raw slug or with no evidence behind it.
 */
function resolveServiceNotices(notices: ServiceLevelNotice[], route: Route, routeActiveEvents: RouteStatusEvent[], nowIso: string): ResolvedServiceNotice[] {
  const resolved: ResolvedServiceNotice[] = [];
  for (const notice of notices) {
    const rule = NOTICE_VALIDATION[notice.kind];
    const expectedScope: RouteStatusScope = { kind: 'airline', airlineSlug: notice.airlineSlug };
    const event = resolveDrivingEvent(notice.drivingEventId, route, expectedScope, rule.expectedTypes, notice.effectiveFrom, routeActiveEvents, nowIso, rule.opts);
    if (!event) continue;
    const citations = toCitations(event.sources);
    if (citations.length === 0) continue;
    const airline = getAirlineBySlug(notice.airlineSlug);
    if (!airline) continue; // never fall back to a raw slug — omit instead
    resolved.push({
      airlineSlug: notice.airlineSlug,
      airlineName: airline.name,
      kind: notice.kind,
      effectiveFrom: notice.effectiveFrom,
      citations: nonEmpty(citations),
    });
  }
  return resolved;
}

/**
 * Turns a RouteStatusResult into the exact words a customer-facing surface
 * may render. `allEvents` is the full ledger (same array getRouteStatus()
 * was given) — this function re-derives its own active/current-route event
 * set rather than trusting anything about the result object's provenance.
 */
export function getRouteStatusCopy(route: Route, result: RouteStatusResult, allEvents: RouteStatusEvent[], nowIso: string): RouteStatusViewModel {
  const routeActiveEvents = getActiveEvents(getEventsForRoute(route.slug, allEvents));

  if (result.status === 'verified-direct') {
    // Independent re-check (final errata §6, hardened per the final audit
    // §3): every basis entry is re-verified against the ACTUAL
    // route.verification / AirlineVerification record it claims to
    // summarise, not merely re-checked for freshness against its own,
    // possibly-forged fields.
    const revalidatedBasis = result.verifiedDirectBasis
      .map((b) => revalidateBasisItem(b, route, nowIso))
      .filter((b): b is VerifiedDirectBasis => b !== null);
    if (revalidatedBasis.length === 0) return neutralPending();
    const citations = nonEmpty(revalidatedBasis.map(basisToCitation));
    return {
      kind: 'verified-direct',
      badgeLabel: 'Direct',
      citations,
      serviceNotices: resolveServiceNotices(result.serviceNotices, route, routeActiveEvents, nowIso),
    };
  }

  if (result.status === 'withdrawal-announced') {
    const event = resolveDrivingEvent(
      result.drivingEventId,
      route,
      result.scope,
      ['withdrawal-announced', 'withdrawal-rescheduled'],
      result.effectiveFrom,
      routeActiveEvents,
      nowIso,
      { requireFreshness: true, requireReachedDate: false, requireVerifiedOccurrence: false }
    );
    if (!event) return neutralPending();
    const citations = toCitations(event.sources);
    if (citations.length === 0) return neutralPending();
    return {
      kind: 'withdrawal-announced',
      badgeLabel: 'Withdrawal announced',
      headline: event.headline,
      explanation: event.explanation,
      announcedAt: 'announcedAt' in event && event.announcedAt ? event.announcedAt : '',
      effectiveFrom: result.effectiveFrom,
      citations: nonEmpty(citations),
      serviceNotices: resolveServiceNotices(result.serviceNotices, route, routeActiveEvents, nowIso),
    };
  }

  if (result.status === 'service-ended') {
    const event = resolveDrivingEvent(
      result.drivingEventId,
      route,
      result.scope,
      ['service-ended'],
      result.effectiveFrom,
      routeActiveEvents,
      nowIso,
      { requireFreshness: true, requireReachedDate: true, requireVerifiedOccurrence: true }
    );
    if (!event) return neutralPending();
    const citations = toCitations(event.sources);
    if (citations.length === 0) return neutralPending();
    return {
      kind: 'service-ended',
      badgeLabel: 'Direct service ended',
      headline: event.headline,
      explanation: event.explanation,
      effectiveFrom: result.effectiveFrom,
      citations: nonEmpty(citations),
      serviceNotices: resolveServiceNotices(result.serviceNotices, route, routeActiveEvents, nowIso),
    };
  }

  // result.status === 'verification-pending'
  if (result.pendingReason.kind === 'transition-boundary-reached') {
    const { drivingEventId, effectiveFrom, scope } = result.pendingReason;
    const event = resolveDrivingEvent(
      drivingEventId,
      route,
      scope,
      ['withdrawal-announced', 'withdrawal-rescheduled'],
      effectiveFrom,
      routeActiveEvents,
      nowIso,
      // Freshness deliberately NOT required here — the event may (and, for
      // a real transition-boundary, typically will) be stale by
      // currentClaimValidBefore. It must still have reached its own
      // effective date.
      { requireFreshness: false, requireReachedDate: true, requireVerifiedOccurrence: false }
    );
    if (!event) return neutralPending();
    const citations = toCitations(event.sources);
    if (citations.length === 0) return neutralPending();
    const publisher = citations[0].publisher;
    return {
      kind: 'transition-boundary-pending',
      badgeLabel: 'Verification pending',
      body: `${publisher}'s announced withdrawal date has passed. We haven't yet re-confirmed whether the direct service ended, was postponed, or continues — check current options with the airline before booking.`,
      publisher,
      effectiveFrom,
      drivingEventId: event.id,
      citations: nonEmpty(citations),
    };
  }

  // no-current-direct-evidence, or any conflicting-ledger-evidence
  // diagnostic — always the shared neutral sentence. The diagnostic itself
  // is never read here; it exists for tests/founder ops only.
  return neutralPending();
}

/**
 * The single reusable adapter every public surface must call instead of
 * getRoutePresentation() directly, for consistency between the pre-existing
 * (inclusive-freshness) presentation layer and the Route Status V1 ledger's
 * strict, evidence-validated derivation. A route with zero ledger events
 * (getRouteStatus returns null) passes straight through to the unchanged
 * legacy behaviour.
 *
 * Deliberately routed through getRouteStatusCopy() rather than switching
 * directly on getRouteStatus()'s raw result — see this file's header
 * comment. A RouteStatusResult that fails the copy layer's own evidence
 * validation (a forged/malformed basis, a driving event that doesn't
 * actually match) must fall closed to the same neutral presentation a
 * customer would see, not silently keep showing "Direct" because the
 * presentation layer used a looser check than the copy layer.
 *
 *   - viewModel 'verified-direct' / 'withdrawal-announced' (evidence
 *     validated): the legacy presentation is safe to reuse as-is — both
 *     statuses require strict freshness, which is a STRICTLY narrower
 *     condition than getDisplayDirectness()'s own inclusive check, so
 *     whenever the ledger's validated evidence supports either status the
 *     legacy gate independently agrees. For 'verified-direct' specifically,
 *     any airline carrying a 'service-ended' or 'status-reverification-
 *     pending' notice (final audit fix) is additionally removed from
 *     `airlineSlugs` — the route as a whole stays "Direct" on another
 *     airline's evidence, but the affected airline's own attribution must
 *     not linger in the safe airline list once its service has ended or
 *     gone unreconfirmed past its announced date. A 'withdrawal-announced'
 *     notice does NOT remove the airline — that state is reached only while
 *     the affected airline's own plan is still pre-boundary, so retaining
 *     it is not a stale claim.
 *   - viewModel 'service-ended': a dedicated, evidence-suppressed
 *     presentation — see buildServiceEndedPresentation. Never mapped to
 *     'unverified': "Service ended" and "Verification pending" are
 *     different customer claims.
 *   - viewModel 'transition-boundary-pending' / 'neutral-pending':
 *     buildUnverifiedPresentation() unconditionally — never
 *     getRoutePresentation()/getDisplayDirectness(), which can still read
 *     'direct' at the exact nowIso the ledger's stricter rule already
 *     reads 'pending' (e.g. nowIso equal to a reviewDueDate).
 */
export function getEffectiveRoutePresentation(route: Route, allEvents: RouteStatusEvent[], nowIso: string): RoutePresentation {
  const status = getRouteStatus(route, allEvents, nowIso);
  if (!status) return getRoutePresentation(route, nowIso);
  const viewModel = getRouteStatusCopy(route, status, allEvents, nowIso);
  if (viewModel.kind === 'service-ended') return buildServiceEndedPresentation(route);
  if (viewModel.kind === 'neutral-pending' || viewModel.kind === 'transition-boundary-pending') return buildUnverifiedPresentation(route);

  const presentation = getRoutePresentation(route, nowIso);
  if (viewModel.kind !== 'verified-direct') return presentation;

  const suppressedAirlineSlugs = new Set(
    viewModel.serviceNotices.filter((n) => n.kind === 'service-ended' || n.kind === 'status-reverification-pending').map((n) => n.airlineSlug)
  );
  if (suppressedAirlineSlugs.size === 0) return presentation;
  return { ...presentation, airlineSlugs: presentation.airlineSlugs.filter((slug) => !suppressedAirlineSlugs.has(slug)) };
}

/** Convenience for surfaces that only need the safe route name/airport pairing alongside the view model (e.g. building a citation footnote). Not required by getRouteStatusCopy itself. */
export function getRoutePairLabel(route: Route): string {
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  return airport && dest ? `${airport.city} to ${dest.city}` : 'This route';
}
