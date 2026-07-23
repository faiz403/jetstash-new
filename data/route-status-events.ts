/**
 * Route Status V1 — the append-only evidence ledger. Phase 1: data model,
 * validation, and pure ledger-query helpers only. No UI, no page wiring, no
 * founder-ops integration — see data/routes.ts's getRouteStatus() for the
 * per-route derivation that consumes this file.
 *
 * Ledger-managed routes only: a route with zero events here is NOT part of
 * Route Status V1 and continues through the existing
 * getRoutePresentation()/getDisplayDirectness() behaviour, completely
 * unchanged. This file has no dependency on data/routes.ts — routeSlug is
 * just a string key here, validated against a caller-supplied set of known
 * slugs rather than importing the route list, to avoid a circular import
 * with data/routes.ts (which imports FROM this file).
 *
 * Core invariants (binding, from the Route Status V1 corrected spec +
 * implementation errata):
 *   - An announcement is never proof of occurrence. Only a freshly verified
 *     'service-ended' event may assert a direct service actually ended —
 *     the clock passing effectiveFrom on its own produces verification-
 *     pending, never a silent transition to "ended".
 *   - History is permanent; only CURRENT-status eligibility expires.
 *     `currentClaimValidBefore` gates whether an event may drive a current
 *     claim (isCurrentClaimValid uses a STRICT nowIso < validBefore check —
 *     deliberately stricter than the existing, inclusive
 *     isVerificationCurrent() elsewhere in the codebase). The event itself
 *     is never deleted or hidden once stale.
 *   - `supersedesEventId` is reserved for correcting a fact JetStash
 *     recorded incorrectly — never for lifecycle progression (an
 *     announcement is not superseded by its own cancellation, reschedule,
 *     or the service later ending; all of those stay historically true).
 *     Lifecycle relationships use `serviceId` (grouping) + `relatedEventId`
 *     (an optional pointer to another event in the SAME serviceId).
 *   - Neither `isDirect:false` nor a route's `connectingAlternative` may
 *     ever be read as evidence that current connecting services operate —
 *     there is no sourced current-connecting-service model in V1, so no
 *     'connecting' status is ever produced by this ledger.
 *   - No operational policy (e.g. "is this worth a Route Watch send") is
 *     stored on an event — that judgement belongs to the founder ops layer
 *     in a later phase, derived from event type + verification state.
 */

// ── Source attribution ──────────────────────────────────────────────────

/**
 * One claim-specific source. An event's `sources` array holds only the
 * sources that actually support THAT event's claim — never padded with an
 * unrelated release just to record it somewhere. See data/routes.ts's
 * route.verification for where a route's *current schedule* evidence lives
 * when it's a separate claim from a withdrawal recorded here.
 */
export interface SourceRef {
  publisher: string;
  title?: string;
  url: string;
  /** ISO date — the source's own publication date, when known. */
  publishedAt?: string;
  /** ISO date — when JetStash actually read this source. */
  accessedAt: string;
}

/**
 * 'airline' — the event concerns one specific airline's service on the
 * route (e.g. IndiGo's Manchester–Mumbai withdrawal on a route another
 * airline might also serve). 'route' — the event concerns the route as a
 * whole, not attributable to a single operator.
 */
export type RouteStatusScope = { kind: 'airline'; airlineSlug: string } | { kind: 'route' };

interface EventBase {
  id: string;
  routeSlug: string;
  /**
   * Stable id grouping every event in one service's lifecycle (launch,
   * withdrawal, reschedule, cancellation, end) — e.g.
   * 'indigo-manchester-mumbai-direct'. Lifecycle events for the same real
   * service MUST share this; a relatedEventId may only point within it.
   */
  serviceId: string;
  scope: RouteStatusScope;
  /** Customer-facing one-liner. States only what `sources` actually supports. */
  headline: string;
  /** Plain-language detail. Never invents a frequency, date, airline, or status fact. */
  explanation: string;
  /** >= 1 source, each supporting this event's own claim (never padded). */
  sources: SourceRef[];
  /** ISO date — when JetStash last read the sources behind this record. */
  verifiedAt: string;
  /**
   * FACTUAL CORRECTION ONLY — this event corrects, retracts, or replaces an
   * older event JetStash recorded incorrectly. The superseded event is
   * excluded from derivation but never deleted. Never used for lifecycle
   * progression (see `relatedEventId`). A correction must target the SAME
   * routeSlug and serviceId as the event it corrects — a correction never
   * silently crosses routes or services.
   */
  supersedesEventId?: string;
  /**
   * Set only when `supersedesEventId` is also set and the correcting event's
   * `scope` deliberately differs from the corrected event's own scope (e.g.
   * an event was originally recorded as route-scoped but should have named
   * one specific airline). Without this flag, a scope mismatch between a
   * correction and its target is a validation error, not a silent allowance
   * — see validateStatusLedger()'s 'unflagged-scope-correction' code.
   */
  correctsScope?: boolean;
  /**
   * Lifecycle link to another event with the SAME routeSlug, serviceId, and
   * scope (identical kind, and identical airlineSlug for airline scope) —
   * e.g. a cancellation relates back to the announcement it cancels. Does
   * NOT exclude the target from derivation — both stay historically true.
   */
  relatedEventId?: string;
}

/**
 * Discriminated on `type` so every field required to make a CURRENT claim
 * is enforced by the type system, not left to runtime convention.
 * `currentClaimValidBefore` is REQUIRED on every variant that can drive a
 * current status (withdrawal-announced, service-ended,
 * withdrawal-rescheduled, withdrawal-cancelled) — a missing value on those
 * is a compile-time error, never "valid forever" by omission.
 * `service-launched` and `frequency-change` are historical/advisory only in
 * V1: they render as dated history, never as a current-status input, so
 * they carry no validity horizon.
 */
export type RouteStatusEvent =
  | (EventBase & {
      type: 'withdrawal-announced';
      announcedAt: string;
      effectiveFrom: string;
      /** Undefined unless a stable primary source states a specific final flight — never inferred. */
      lastOperatingDate?: string;
      currentClaimValidBefore: string;
    })
  | (EventBase & {
      type: 'service-ended';
      /** Must be true — occurrence is asserted only when actually verified, never inferred from a passed date. */
      verifiedOccurrence: true;
      effectiveFrom: string;
      observedEndDate?: string;
      currentClaimValidBefore: string;
    })
  | (EventBase & {
      type: 'withdrawal-rescheduled';
      announcedAt: string;
      newEffectiveFrom: string;
      currentClaimValidBefore: string;
    })
  | (EventBase & {
      type: 'withdrawal-cancelled';
      announcedAt: string;
      currentClaimValidBefore: string;
    })
  | (EventBase & {
      type: 'service-launched';
      basis: 'announced' | 'observed';
      announcedAt?: string;
      effectiveFrom: string;
    })
  | (EventBase & {
      type: 'frequency-change';
      announcedAt?: string;
      effectiveFrom: string;
      detail: string;
    });

/** Events that can drive a CURRENT status claim (i.e. carry currentClaimValidBefore). */
export type CurrentClaimEvent = Extract<
  RouteStatusEvent,
  { type: 'withdrawal-announced' | 'service-ended' | 'withdrawal-rescheduled' | 'withdrawal-cancelled' }
>;

export function isCurrentClaimEvent(e: RouteStatusEvent): e is CurrentClaimEvent {
  return (
    e.type === 'withdrawal-announced' ||
    e.type === 'service-ended' ||
    e.type === 'withdrawal-rescheduled' ||
    e.type === 'withdrawal-cancelled'
  );
}

// ── Freshness ────────────────────────────────────────────────────────────

/**
 * The ONLY freshness rule for current-status assertions on ledger-managed
 * routes. `validBefore` is the FIRST STALE date: a claim is current
 * strictly before it. Deliberately stricter than the codebase's existing
 * isVerificationCurrent() (data/routes.ts), which is inclusive on
 * reviewDueDate — that inclusive check must never be allowed to drive a
 * Route Status result.
 */
export function isCurrentClaimValid(validBefore: string, nowIso: string): boolean {
  return nowIso < validBefore;
}

// ── Ledger queries (supersession + lifecycle grouping) ──────────────────

/**
 * Every event id referenced by any `supersedesEventId`, transitively. For a
 * correction chain A <- B <- C (B supersedes A, C supersedes B), this
 * returns {A, B} — both are excluded from derivation. Because the set is
 * built from every event's own supersedesEventId (including B's, even
 * though B is itself superseded), an ancestor can never be reactivated by
 * its immediate successor being superseded in turn.
 */
export function getSupersededIds(events: RouteStatusEvent[]): Set<string> {
  const superseded = new Set<string>();
  for (const e of events) {
    if (e.supersedesEventId) superseded.add(e.supersedesEventId);
  }
  return superseded;
}

/** Every event NOT excluded by supersession — the set derivation reads from. */
export function getActiveEvents(events: RouteStatusEvent[]): RouteStatusEvent[] {
  const superseded = getSupersededIds(events);
  return events.filter((e) => !superseded.has(e.id));
}

export function getEventsForRoute(routeSlug: string, events: RouteStatusEvent[]): RouteStatusEvent[] {
  return events.filter((e) => e.routeSlug === routeSlug);
}

/** Groups events by serviceId — lifecycle resolution must never combine every service on a route into one. */
export function groupByServiceId(events: RouteStatusEvent[]): Map<string, RouteStatusEvent[]> {
  const map = new Map<string, RouteStatusEvent[]>();
  for (const e of events) {
    const list = map.get(e.serviceId) ?? [];
    list.push(e);
    map.set(e.serviceId, list);
  }
  return map;
}

// ── Validation ───────────────────────────────────────────────────────────

export interface LedgerValidationError {
  code:
    | 'duplicate-id'
    | 'missing-route'
    | 'unknown-route'
    | 'missing-service'
    | 'empty-sources'
    | 'invalid-source'
    | 'invalid-date'
    | 'missing-supersession-target'
    | 'self-reference'
    | 'supersession-cycle'
    | 'multiple-successors'
    | 'missing-related-target'
    | 'cross-service-link'
    | 'ambiguous-relationship'
    | 'lifecycle-cycle'
    | 'correction-cross-route'
    | 'correction-cross-service'
    | 'unflagged-scope-correction'
    | 'cross-route-link'
    | 'cross-scope-link'
    | 'reused-service-id'
    | 'inconsistent-active-service-scope';
  message: string;
  eventId?: string;
}

/** Whether two RouteStatusScope values describe the same operator (same kind, and same airlineSlug for 'airline'). Exported so getRouteStatus() (data/routes.ts) can apply the identical rule when defending against a caller bypassing validateStatusLedger(). */
export function scopesMatch(a: RouteStatusScope, b: RouteStatusScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'airline' && b.kind === 'airline') return a.airlineSlug === b.airlineSlug;
  return true;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function eventDateFields(e: RouteStatusEvent): Array<[string, string | undefined]> {
  const fields: Array<[string, string | undefined]> = [['verifiedAt', e.verifiedAt]];
  if ('announcedAt' in e) fields.push(['announcedAt', e.announcedAt]);
  if ('effectiveFrom' in e) fields.push(['effectiveFrom', e.effectiveFrom]);
  if ('newEffectiveFrom' in e) fields.push(['newEffectiveFrom', e.newEffectiveFrom]);
  if ('lastOperatingDate' in e) fields.push(['lastOperatingDate', e.lastOperatingDate]);
  if ('observedEndDate' in e) fields.push(['observedEndDate', e.observedEndDate]);
  if ('currentClaimValidBefore' in e) fields.push(['currentClaimValidBefore', e.currentClaimValidBefore]);
  return fields;
}

/**
 * Validates the full ledger. `knownRouteSlugs` is optional and
 * caller-supplied (typically routes.map(r => r.slug)) so this file never
 * needs to import data/routes.ts. Returns every violation found — callers
 * decide whether to throw, log, or assert in tests.
 */
export function validateStatusLedger(
  events: RouteStatusEvent[],
  knownRouteSlugs?: Set<string>
): LedgerValidationError[] {
  const errors: LedgerValidationError[] = [];
  const byId = new Map<string, RouteStatusEvent>();

  for (const e of events) {
    if (byId.has(e.id)) {
      errors.push({ code: 'duplicate-id', message: `Duplicate event id "${e.id}"`, eventId: e.id });
    } else {
      byId.set(e.id, e);
    }
  }

  for (const e of events) {
    if (!e.routeSlug) {
      errors.push({ code: 'missing-route', message: 'routeSlug is empty', eventId: e.id });
    } else if (knownRouteSlugs && !knownRouteSlugs.has(e.routeSlug)) {
      errors.push({ code: 'unknown-route', message: `routeSlug "${e.routeSlug}" does not match a known route`, eventId: e.id });
    }

    if (!e.serviceId) {
      errors.push({ code: 'missing-service', message: 'serviceId is empty', eventId: e.id });
    }

    if (!e.sources || e.sources.length === 0) {
      errors.push({ code: 'empty-sources', message: 'sources array is empty', eventId: e.id });
    } else {
      for (const s of e.sources) {
        if (!s.publisher || !s.url || !s.accessedAt) {
          errors.push({ code: 'invalid-source', message: 'source is missing publisher, url, or accessedAt', eventId: e.id });
        }
        if (s.accessedAt && !isValidIsoDate(s.accessedAt)) {
          errors.push({ code: 'invalid-date', message: `invalid source.accessedAt "${s.accessedAt}"`, eventId: e.id });
        }
        if (s.publishedAt && !isValidIsoDate(s.publishedAt)) {
          errors.push({ code: 'invalid-date', message: `invalid source.publishedAt "${s.publishedAt}"`, eventId: e.id });
        }
      }
    }

    for (const [field, value] of eventDateFields(e)) {
      if (value !== undefined && !isValidIsoDate(value)) {
        errors.push({ code: 'invalid-date', message: `invalid ${field} "${value}"`, eventId: e.id });
      }
    }

    if (e.supersedesEventId === e.id) {
      errors.push({ code: 'self-reference', message: 'supersedesEventId references itself', eventId: e.id });
    }
    if (e.relatedEventId === e.id) {
      errors.push({ code: 'self-reference', message: 'relatedEventId references itself', eventId: e.id });
    }

    if (e.supersedesEventId) {
      const target = byId.get(e.supersedesEventId);
      if (!target) {
        errors.push({
          code: 'missing-supersession-target',
          message: `supersedesEventId "${e.supersedesEventId}" not found`,
          eventId: e.id,
        });
      } else {
        if (target.routeSlug !== e.routeSlug) {
          errors.push({
            code: 'correction-cross-route',
            message: `supersedesEventId "${e.supersedesEventId}" belongs to a different routeSlug`,
            eventId: e.id,
          });
        }
        if (target.serviceId !== e.serviceId) {
          errors.push({
            code: 'correction-cross-service',
            message: `supersedesEventId "${e.supersedesEventId}" belongs to a different serviceId`,
            eventId: e.id,
          });
        }
        if (!scopesMatch(target.scope, e.scope) && !e.correctsScope) {
          errors.push({
            code: 'unflagged-scope-correction',
            message: `supersedesEventId "${e.supersedesEventId}" has a different scope — set correctsScope:true if this is an intentional scope correction`,
            eventId: e.id,
          });
        }
      }
    }

    if (e.relatedEventId) {
      const target = byId.get(e.relatedEventId);
      if (!target) {
        errors.push({ code: 'missing-related-target', message: `relatedEventId "${e.relatedEventId}" not found`, eventId: e.id });
      } else {
        if (target.routeSlug !== e.routeSlug) {
          errors.push({
            code: 'cross-route-link',
            message: `relatedEventId "${e.relatedEventId}" belongs to a different routeSlug`,
            eventId: e.id,
          });
        }
        if (target.serviceId !== e.serviceId) {
          errors.push({
            code: 'cross-service-link',
            message: `relatedEventId "${e.relatedEventId}" belongs to a different serviceId`,
            eventId: e.id,
          });
        }
        if (!scopesMatch(target.scope, e.scope)) {
          errors.push({
            code: 'cross-scope-link',
            message: `relatedEventId "${e.relatedEventId}" has a different scope (kind or airlineSlug) — a lifecycle link must stay on the same operator`,
            eventId: e.id,
          });
        }
      }
    }

    if (e.supersedesEventId && e.relatedEventId && e.supersedesEventId === e.relatedEventId) {
      errors.push({
        code: 'ambiguous-relationship',
        message: 'supersedesEventId and relatedEventId cannot target the same event — a correction is not a lifecycle step',
        eventId: e.id,
      });
    }
  }

  // Supersession cycles.
  for (const e of events) {
    const visited = new Set<string>();
    let current: RouteStatusEvent | undefined = e;
    while (current?.supersedesEventId) {
      if (visited.has(current.id)) {
        errors.push({ code: 'supersession-cycle', message: `Supersession cycle detected starting at "${e.id}"`, eventId: e.id });
        break;
      }
      visited.add(current.id);
      current = byId.get(current.supersedesEventId);
    }
  }

  // Lifecycle (relatedEventId) cycles — a cancellation/reschedule chain must
  // terminate, never loop back on itself. Detected the same way as
  // supersession cycles: walk each event's own relatedEventId chain and
  // flag a revisit. This also guarantees that, once a ledger passes
  // validation, resolving "the latest plan" within one serviceId's active
  // events always has a well-defined terminal node.
  for (const e of events) {
    const visited = new Set<string>();
    let current: RouteStatusEvent | undefined = e;
    while (current?.relatedEventId) {
      if (visited.has(current.id)) {
        errors.push({ code: 'lifecycle-cycle', message: `Lifecycle (relatedEventId) cycle detected starting at "${e.id}"`, eventId: e.id });
        break;
      }
      visited.add(current.id);
      current = byId.get(current.relatedEventId);
    }
  }

  // A serviceId must identify exactly one real service, never be reused
  // across different routes — otherwise lifecycle grouping (by serviceId
  // alone) could silently merge two unrelated services' histories.
  const routesByServiceId = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.serviceId) continue;
    const set = routesByServiceId.get(e.serviceId) ?? new Set<string>();
    set.add(e.routeSlug);
    routesByServiceId.set(e.serviceId, set);
  }
  for (const [serviceId, routeSlugs] of routesByServiceId) {
    if (routeSlugs.size > 1) {
      errors.push({
        code: 'reused-service-id',
        message: `serviceId "${serviceId}" is used across multiple routes: ${Array.from(routeSlugs).join(', ')}`,
      });
    }
  }

  // A single serviceId's ACTIVE (supersession-filtered) events must all
  // share one scope. An active mix of, say, {kind:'route'} and
  // {kind:'airline', airlineSlug:'pia'} within the same serviceId would let
  // input order decide whether getRouteStatus() treats the service as
  // route-scoped or airline-scoped (it currently reads events[0].scope) —
  // this check closes that gap at the data layer. Deliberately scoped to
  // ACTIVE events only: a legitimate correctsScope:true correction
  // supersedes the old-scope event, removing it from the active set, so a
  // real scope correction still passes once superseded.
  const activeEvents = getActiveEvents(events);
  const activeByServiceId = groupByServiceId(activeEvents);
  for (const [serviceId, serviceEvents] of activeByServiceId) {
    const distinctScopes: RouteStatusScope[] = [];
    for (const e of serviceEvents) {
      if (!distinctScopes.some((s) => scopesMatch(s, e.scope))) {
        distinctScopes.push(e.scope);
      }
    }
    if (distinctScopes.length > 1) {
      errors.push({
        code: 'inconsistent-active-service-scope',
        message: `serviceId "${serviceId}" has more than one distinct scope among its active (non-superseded) events`,
      });
    }
  }

  // Multiple direct successors for the same predecessor.
  const successorsByTarget = new Map<string, string[]>();
  for (const e of events) {
    if (e.supersedesEventId) {
      const list = successorsByTarget.get(e.supersedesEventId) ?? [];
      list.push(e.id);
      successorsByTarget.set(e.supersedesEventId, list);
    }
  }
  for (const [target, successors] of successorsByTarget) {
    if (successors.length > 1) {
      errors.push({
        code: 'multiple-successors',
        message: `Event "${target}" has multiple direct successors: ${successors.join(', ')}`,
      });
    }
  }

  return errors;
}

// ── Phase 1 ledger data — Manchester–Mumbai and Manchester–Delhi only ────

/**
 * Both IndiGo withdrawal events below are sourced solely to IndiGo's own
 * 2 June 2026 discontinuation release — never the February schedule
 * release, which supports a different claim (the current reduced
 * schedule) and remains authoritative on each route's own
 * `route.verification` in data/routes.ts.
 *
 * Provenance, stated precisely: the URL below is IndiGo's own official
 * domain (goindigo.in), identified via independent corroboration across
 * multiple search results that quote the same title and content. Two
 * direct fetch attempts against that URL both timed out this session — the
 * page itself was never successfully read directly. The release's content
 * (title, "with effect from 31 August 2026", "temporary", no resumption
 * date) is drawn from those independent search-result summaries, plus one
 * secondary aviation-industry source (AeroRoutes) that WAS fetched
 * directly and used to cross-check the details — that secondary source
 * used different phrasing ("last flight by 31AUG26" / "eff 01SEP26"),
 * which is exactly why `lastOperatingDate` is deliberately left undefined
 * here rather than inferred as 30 or 31 August from either source. See
 * this event's `explanation`.
 */
const INDIGO_WITHDRAWAL_SOURCE: SourceRef = {
  publisher: 'IndiGo',
  title:
    'Amidst unfavorable cost and operational environment, IndiGo temporarily discontinues flights to / from Manchester starting 31 August 2026',
  url: 'https://www.goindigo.in/press-releases/indigo-temporarily-discontinues-manchester-flights.html',
  publishedAt: '2026-06-02',
  accessedAt: '2026-07-23',
};

export const routeStatusEvents: RouteStatusEvent[] = [
  {
    id: 'man-bom-indigo-withdrawal-2026-06',
    routeSlug: 'manchester-mumbai',
    serviceId: 'indigo-manchester-mumbai-direct',
    scope: { kind: 'airline', airlineSlug: 'indigo' },
    type: 'withdrawal-announced',
    headline: 'IndiGo direct service withdrawal announced, effective 31 August 2026',
    explanation:
      "IndiGo announced on 2 June 2026 that it would temporarily discontinue flights to and from Manchester — including this Mumbai service — with effect from 31 August 2026. IndiGo describes the discontinuation as temporary and has not announced a resumption date. The release does not state a specific final operating flight; no last-operating date is recorded here, and none should be inferred.",
    sources: [INDIGO_WITHDRAWAL_SOURCE],
    verifiedAt: '2026-07-23',
    announcedAt: '2026-06-02',
    effectiveFrom: '2026-08-31',
    currentClaimValidBefore: '2026-08-31',
  },
  {
    id: 'man-del-indigo-withdrawal-2026-06',
    routeSlug: 'manchester-delhi',
    serviceId: 'indigo-manchester-delhi-direct',
    scope: { kind: 'airline', airlineSlug: 'indigo' },
    type: 'withdrawal-announced',
    headline: 'IndiGo direct service withdrawal announced, effective 31 August 2026',
    explanation:
      "IndiGo announced on 2 June 2026 that it would temporarily discontinue flights to and from Manchester — including this Delhi service — with effect from 31 August 2026. IndiGo describes the discontinuation as temporary and has not announced a resumption date. The release does not state a specific final operating flight; no last-operating date is recorded here, and none should be inferred.",
    sources: [INDIGO_WITHDRAWAL_SOURCE],
    verifiedAt: '2026-07-23',
    announcedAt: '2026-06-02',
    effectiveFrom: '2026-08-31',
    currentClaimValidBefore: '2026-08-31',
  },
];
