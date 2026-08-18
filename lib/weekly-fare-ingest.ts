import type { DealCabin } from '@/data/deals';
import type { FareObservation } from '@/data/fare-observations';
import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';

/**
 * Weekly Full Fare Observation Refresh — Stage B ingestion helper (18 August
 * 2026, first full-catalogue run).
 *
 * JetStash's fare research is deliberately split into two separate
 * processes (see docs/project-control/WEEKLY_FARE_REFRESH_WORKFLOW.md):
 *
 *  STAGE A — a human, or a browser-capable session, manually checks Google
 *  Flights / Trip.com / an airline's own booking page for each route and
 *  records what was actually shown. This module has no access to a browser
 *  and never performs Stage A itself — it has no fare-source connectivity
 *  of any kind and must not be given any.
 *
 *  STAGE B — this module. It takes Stage A's already-observed evidence,
 *  validates it against the exact schema `data/fare-observations.ts`
 *  requires (see FARE_OBSERVATION_ARCHIVE.md's "Required record fields" and
 *  FARE_COLLECTION_CHECKLIST.md), and prepares ready-to-append
 *  `FareObservation` records. It never invents a price, a directness value
 *  or a baggage figure — every field it produces is copied straight from
 *  the supplied entry; the only things it computes are the derived id,
 *  profileId and priceNote (deterministic string composition, not
 *  evidence).
 *
 * This is explicitly NOT a fare-source integration. It does not fetch,
 * scrape or poll anything. It has no network access and takes no URL other
 * than the `sourceUrl` string the human researcher already supplies. If
 * that ever needs to change (e.g. a licensed fare-data feed), that is a
 * different, separately-approved project — see FARE_OBSERVATION_ARCHIVE.md
 * on why automated collection isn't currently used.
 *
 * Reuses the existing `FareObservation` type and the existing publication
 * gate (`isObservationPublishable` in data/fare-observations.ts) unchanged
 * — this module does not define a second, parallel fare model. It also
 * never decides whether a route is "verified": `isRouteVerificationBlocked`
 * below is purely informational, computed from the route's own existing
 * `verification.status`, and is never used to skip, alter or discard an
 * observation. Fare evidence and route-verification evidence remain
 * separate questions, exactly as JETSTASH_PRINCIPLES.md requires.
 */

// ---------------------------------------------------------------------------
// Locked weekly profile
// ---------------------------------------------------------------------------

export interface WeeklyFareProfile {
  /** The date this batch of checks was actually performed. */
  observedDate: string;
  /** Fixed ~8-week-out outbound date every route in the batch searches for. */
  departureDate: string;
  /** 14 nights after departureDate, per the archive's baseline stay length. */
  returnDate: string;
  observationReason: NonNullable<FareObservation['observationReason']>;
}

/**
 * The locked profile for the first full weekly refresh (18 August 2026 run).
 * Derived from FARE_OBSERVATION_ARCHIVE.md's binding methodology: a fixed
 * 8-week booking horizon from `observedDate`, 14-night stay. Do not mutate
 * this constant for a later week — define a new one and pass it explicitly,
 * so historical calls in tests/records stay reproducible.
 */
export const WEEKLY_FARE_PROFILE_2026_08_18: WeeklyFareProfile = {
  observedDate: '2026-08-18',
  departureDate: '2026-10-13',
  returnDate: '2026-10-27',
  observationReason: 'routine-weekly',
};

const APPROVED_SOURCES: ReadonlyArray<NonNullable<FareObservation['observedVia']>> = ['google-flights', 'trip.com', 'airline'];
const APPROVED_DIRECTNESS: ReadonlyArray<'direct' | 'connecting' | 'unknown'> = ['direct', 'connecting', 'unknown'];
const DEFAULT_CABIN: DealCabin = 'Economy';

// ---------------------------------------------------------------------------
// Structured input — the shape a human/Stage-A researcher pastes in
// ---------------------------------------------------------------------------

/**
 * One route's worth of Stage A evidence, in a shape that maps close to
 * 1:1 onto what a manual researcher naturally records (and onto
 * `FareObservation` itself) — chosen deliberately to minimise
 * reformatting/transcription between "what was observed" and "what gets
 * validated", since transcription is exactly the risk this module exists
 * to remove.
 */
export interface WeeklyFareEvidenceEntry {
  /** Optional — for matching the researcher's own sequence numbering back to a report. Not used for anything else. */
  seq?: number;
  routeSlug: string;
  /** Optional cross-check only — the route's own airport/destination is the source of truth. */
  origin?: string;
  /** Optional cross-check only — the route's own airport/destination is the source of truth. */
  destination?: string;
  cabin?: DealCabin;

  /** false = "NO USABLE OBSERVATION" was Stage A's honest result for this route. */
  usable: boolean;
  /** Required when usable is false — the factual reason no result was recorded. */
  noResultReason?: string;

  // --- Required when usable is true ---
  fare?: number;
  /** Airline(s) actually named by the result — free text, e.g. "KLM outbound, Air India return". */
  airline?: string;
  outboundDirectness?: 'direct' | 'connecting' | 'unknown';
  outboundConnectionAirports?: string[];
  returnDirectness?: 'direct' | 'connecting' | 'unknown';
  returnConnectionAirports?: string[];
  /** Exactly what the source showed, or the literal string 'not stated'. Never inferred. */
  baggage?: string;
  source?: NonNullable<FareObservation['observedVia']>;
  sourceUrl?: string;
  /** Brief factual identification of where the result came from, e.g. "Google Flights results list, GBP display confirmed". */
  sourceDetail?: string;
  /** Anything materially important about the itinerary that doesn't fit another field. */
  evidenceNote?: string;
  /** Informational only — e.g. "CURRENT ROUTE VERIFICATION BLOCK — DO NOT USE THIS FARE TO RESOLVE ROUTE VERIFICATION". Never parsed or acted on; carried straight into the validation report. */
  publicationNote?: string;
  /** Rare override — defaults to 'current'. Only set 'historical' deliberately (e.g. logging a secondary alternate fare alongside the primary one). */
  comparisonEligibility?: 'current' | 'historical';
  /**
   * Explicit human-supplied profileId for this route/cabin, only needed when
   * `resolveProfileId` cannot determine one automatically (see its own doc
   * comment) — e.g. a route with more than one distinct historical
   * profileId, where picking one algorithmically would risk silently
   * reviving a superseded/excluded series. Supplying this is the ONLY way
   * past that fail-closed state; the helper never guesses. Ignored (and
   * unnecessary) when the route has zero or exactly one historical
   * profileId, since those cases resolve automatically.
   */
  profileIdOverride?: string;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type WeeklyFareEvidenceStatus = 'VALID' | 'INVALID' | 'NO RESULT' | 'SKIPPED';

export interface WeeklyFareValidationIssue {
  field: string;
  message: string;
}

export interface WeeklyFareValidationResult {
  routeSlug: string;
  status: WeeklyFareEvidenceStatus;
  issues: WeeklyFareValidationIssue[];
  /** Only populated when status === 'VALID'. Ready to append to data/fare-observations.ts. */
  preparedObservation: FareObservation | null;
  /**
   * Informational only, from the route's OWN existing verification record —
   * never computed from this observation, never used to change its status.
   * Surfaced so a founder reviewing the batch immediately sees which
   * genuinely-observed fares are currently blocked from public display by
   * pre-existing route-verification rules, without confusing that with the
   * observation itself being invalid.
   */
  isRouteVerificationBlocked: boolean;
  /** Carried straight through from the entry's own publicationNote, verbatim — never parsed or acted on. Human annotation only; not part of the FareObservation itself. */
  publicationNote: string | undefined;
}

function issue(field: string, message: string): WeeklyFareValidationIssue {
  return { field, message };
}

function slugifyCabin(cabin: DealCabin): string {
  return cabin.toLowerCase().replace(/\s+/g, '-');
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, '');
}

/**
 * Deterministic string composition from already-supplied fields only —
 * never invents new facts. Mirrors the level of detail existing archive
 * entries record (see FARE_COLLECTION_CHECKLIST.md §4/§6).
 */
function buildPriceNote(entry: WeeklyFareEvidenceEntry): string {
  const parts = ['return, per person, one adult'];
  if (entry.airline) parts.push(entry.airline);
  const outboundBits: string[] = [];
  if (entry.outboundDirectness) {
    outboundBits.push(`outbound ${entry.outboundDirectness}`);
    if (entry.outboundDirectness === 'connecting' && entry.outboundConnectionAirports?.length) {
      outboundBits.push(`via ${entry.outboundConnectionAirports.join(', ')}`);
    }
  }
  const returnBits: string[] = [];
  if (entry.returnDirectness) {
    returnBits.push(`return ${entry.returnDirectness}`);
    if (entry.returnDirectness === 'connecting' && entry.returnConnectionAirports?.length) {
      returnBits.push(`via ${entry.returnConnectionAirports.join(', ')}`);
    }
  }
  if (outboundBits.length) parts.push(outboundBits.join(' '));
  if (returnBits.length) parts.push(returnBits.join(' '));
  parts.push(`baggage ${entry.baggage}`);
  if (entry.sourceDetail) parts.push(entry.sourceDetail);
  if (entry.evidenceNote) parts.push(entry.evidenceNote);
  return parts.join('; ');
}

/**
 * Both legs' directness aggregate into the route-level `fareDirectness`
 * exactly per FARE_COLLECTION_CHECKLIST.md §6: 'direct' only when BOTH legs
 * were reviewed and confirmed nonstop; 'connecting' when EITHER leg shows a
 * confirmed stop (itinerary-level evidence, not round-trip-completeness
 * confirmation); 'unknown' otherwise. Never inferred from the route's own
 * `isDirect` flag.
 */
function aggregateEntryDirectness(
  outbound: 'direct' | 'connecting' | 'unknown',
  ret: 'direct' | 'connecting' | 'unknown'
): 'direct' | 'connecting' | 'unknown' {
  if (outbound === 'direct' && ret === 'direct') return 'direct';
  if (outbound === 'connecting' || ret === 'connecting') return 'connecting';
  return 'unknown';
}

export interface ProfileIdResolution {
  /** Populated only when resolution succeeded. */
  profileId: string | null;
  /**
   * true when the route/cabin has more than one distinct historical
   * profileId and no override was supplied — the caller must fail the
   * entry closed rather than guess.
   */
  ambiguous: boolean;
  /** The competing historical profileIds found, when ambiguous. */
  competingProfileIds: string[];
}

/**
 * Determines the profileId a new observation should use, per the 18 August
 * 2026 Fare Profile Decision Audit: `profileId` is an opaque, stable
 * comparison-series identifier — Fare Watcher's comparability gate depends
 * on it matching EXACTLY across a route's series
 * (`lib/fare-watcher.ts`'s `profileId !== candidate.profileId` check) — so
 * a new observation must continue whatever profileId that route/cabin's
 * prior observations already established, never invent a new one where a
 * series already exists.
 *
 * Resolution order:
 *  1. `override`, if supplied — always wins, no further checks. This is
 *     the ONLY way to resolve a genuinely ambiguous route (see case 3)
 *     without guessing.
 *  2. Zero distinct historical profileIds for this routeSlug+cabin → this
 *     is genuinely the route's first observation (or first under the
 *     current methodology); mint the neutral
 *     `<route-slug>-<cabin>-1adult-baseline-v1`. Never `-23kg-v1` — see
 *     FARE_OBSERVATION_ARCHIVE.md's profileId semantics note for why that
 *     token is never assigned to a fresh series.
 *  3. Exactly one distinct historical profileId → continue it exactly,
 *     whatever its own naming happens to be (a legacy `-23kg-v1` series,
 *     an existing `-baseline-v1` series, or anything else). This is the
 *     common case and requires no human input.
 *  4. More than one distinct historical profileId → FAIL CLOSED
 *     (`ambiguous: true`). This helper has no reliable way to know which
 *     of several historical series is the "current" one — e.g.
 *     london-gatwick-istanbul has both a superseded, methodology-excluded
 *     generic-Istanbul series AND the current valid exact-airport (`-saw-`)
 *     series; picking automatically (even "most recent" or "most common")
 *     risks silently reviving evidence the archive has already rejected.
 *     The caller must supply `profileIdOverride` for that specific route.
 */
export function resolveProfileId(
  routeSlug: string,
  cabin: DealCabin,
  existingObservations: readonly FareObservation[],
  override: string | undefined
): ProfileIdResolution {
  if (override && override.trim().length > 0) {
    return { profileId: override, ambiguous: false, competingProfileIds: [] };
  }

  const cabinSlug = slugifyCabin(cabin);
  const historicalProfileIds = new Set(
    existingObservations
      .filter((o) => o.routeSlug === routeSlug && o.cabin === cabin && o.profileId)
      .map((o) => o.profileId as string)
  );

  if (historicalProfileIds.size === 0) {
    return { profileId: `${routeSlug}-${cabinSlug}-1adult-baseline-v1`, ambiguous: false, competingProfileIds: [] };
  }
  if (historicalProfileIds.size === 1) {
    return { profileId: [...historicalProfileIds][0], ambiguous: false, competingProfileIds: [] };
  }
  return { profileId: null, ambiguous: true, competingProfileIds: [...historicalProfileIds] };
}

/**
 * Validates one Stage A entry and, only when fully valid, prepares the
 * exact `FareObservation` record it would become. Fails closed: any
 * missing or malformed required field returns 'INVALID' with a specific
 * reason rather than guessing or defaulting.
 *
 * Never writes anything — this is pure validation + preparation. The
 * caller (a human or the Stage-B agent) still decides whether and when to
 * actually append the prepared records to data/fare-observations.ts.
 */
export function validateWeeklyFareEntry(
  entry: WeeklyFareEvidenceEntry,
  profile: WeeklyFareProfile,
  existingObservations: readonly FareObservation[]
): WeeklyFareValidationResult {
  const issues: WeeklyFareValidationIssue[] = [];

  const route = getRouteBySlug(entry.routeSlug);
  if (!route) {
    return {
      routeSlug: entry.routeSlug,
      status: 'INVALID',
      issues: [issue('routeSlug', `No route exists in data/routes.ts for slug "${entry.routeSlug}".`)],
      preparedObservation: null,
      isRouteVerificationBlocked: false,
      publicationNote: entry.publicationNote,
    };
  }

  const isRouteVerificationBlocked = route.verification?.status === 'unverified' || route.verification?.status === 'paused';

  const airport = getRouteAirport(route);
  const destination = getRouteDestination(route);

  if (entry.origin && airport && entry.origin.toUpperCase() !== airport.code.toUpperCase()) {
    issues.push(issue('origin', `Supplied origin "${entry.origin}" does not match the route's own airport code "${airport.code}".`));
  }
  if (entry.destination && destination && entry.destination.toUpperCase() !== destination.iataCode.toUpperCase()) {
    issues.push(issue('destination', `Supplied destination "${entry.destination}" does not match the route's own destination code "${destination.iataCode}".`));
  }
  if (!airport) issues.push(issue('routeSlug', `Route "${entry.routeSlug}" has no matching Airport record — cannot derive an id/profileId.`));
  if (!destination) issues.push(issue('routeSlug', `Route "${entry.routeSlug}" has no matching Destination record — cannot derive an id/profileId.`));

  if (issues.length > 0) {
    return { routeSlug: entry.routeSlug, status: 'INVALID', issues, preparedObservation: null, isRouteVerificationBlocked, publicationNote: entry.publicationNote };
  }

  // NO USABLE OBSERVATION — a legitimate, honest result. Never a failure.
  if (!entry.usable) {
    if (!entry.noResultReason || entry.noResultReason.trim().length === 0) {
      return {
        routeSlug: entry.routeSlug,
        status: 'INVALID',
        issues: [issue('noResultReason', 'usable is false but no factual noResultReason was supplied.')],
        preparedObservation: null,
        isRouteVerificationBlocked,
        publicationNote: entry.publicationNote,
      };
    }
    return { routeSlug: entry.routeSlug, status: 'NO RESULT', issues: [], preparedObservation: null, isRouteVerificationBlocked, publicationNote: entry.publicationNote };
  }

  // usable === true — every field below is required, never defaulted from nothing.
  if (entry.fare === undefined || entry.fare === null || !(entry.fare > 0)) {
    issues.push(issue('fare', 'usable is true but no positive fare was supplied.'));
  }
  if (!entry.airline || entry.airline.trim().length === 0) {
    issues.push(issue('airline', 'usable is true but no airline/provider was supplied.'));
  }
  if (!entry.outboundDirectness || !APPROVED_DIRECTNESS.includes(entry.outboundDirectness)) {
    issues.push(issue('outboundDirectness', "Missing or invalid outboundDirectness — must be 'direct', 'connecting' or 'unknown'. The outbound leg must actually be inspected, never left blank."));
  }
  if (!entry.returnDirectness || !APPROVED_DIRECTNESS.includes(entry.returnDirectness)) {
    issues.push(issue('returnDirectness', "Missing or invalid returnDirectness — must be 'direct', 'connecting' or 'unknown'. This is a RETURN fare: the return leg must actually be inspected, never assumed from the outbound alone."));
  }
  if (!entry.baggage || entry.baggage.trim().length === 0) {
    issues.push(issue('baggage', "Missing baggage — record exactly what the source showed, or the literal string 'not stated'. Never leave unset."));
  }
  if (!entry.source || !APPROVED_SOURCES.includes(entry.source)) {
    issues.push(issue('source', `Missing or unapproved source — must be one of: ${APPROVED_SOURCES.join(', ')}.`));
  }

  if (issues.length > 0) {
    return { routeSlug: entry.routeSlug, status: 'INVALID', issues, preparedObservation: null, isRouteVerificationBlocked, publicationNote: entry.publicationNote };
  }

  const cabin = entry.cabin ?? DEFAULT_CABIN;
  const cabinSlug = slugifyCabin(cabin);
  const originCode = airport!.code.toLowerCase();
  const destCode = destination!.iataCode.toLowerCase();
  const id = `obs-${originCode}-${destCode}-${cabinSlug}-${compactDate(profile.observedDate)}-8w-v1`;

  // profileId: continue the route's own established comparison series
  // where one exists; never invent a new one out from under it. See
  // resolveProfileId's own doc comment and the 18 August 2026 Fare Profile
  // Decision Audit for the full reasoning — profileId is an opaque, stable
  // comparison-series identifier (Fare Watcher matches it by exact string
  // equality), never baggage evidence; a legacy '-23kg-v1' token is never
  // a claim that a 23kg bag was searched or found.
  const profileResolution = resolveProfileId(entry.routeSlug, cabin, existingObservations, entry.profileIdOverride);
  if (profileResolution.ambiguous) {
    issues.push(
      issue(
        'profileId',
        `Route "${entry.routeSlug}" (${cabin}) has more than one historical profileId (${profileResolution.competingProfileIds.join(', ')}) — cannot determine which comparison series is current without guessing. Supply profileIdOverride explicitly.`
      )
    );
  }

  if (issues.length > 0) {
    return { routeSlug: entry.routeSlug, status: 'INVALID', issues, preparedObservation: null, isRouteVerificationBlocked, publicationNote: entry.publicationNote };
  }

  const profileId = profileResolution.profileId!;

  // Duplicate protection — never silently re-insert the same evidence twice.
  const idCollision = existingObservations.find((o) => o.id === id);
  if (idCollision) {
    issues.push(issue('id', `Computed id "${id}" already exists in the archive (observation for this route/cabin/date appears to have already been ingested).`));
  }
  const nearDuplicate = existingObservations.find(
    (o) =>
      o.routeSlug === entry.routeSlug &&
      o.cabin === cabin &&
      o.departureDate === profile.departureDate &&
      o.returnDate === profile.returnDate &&
      o.price === entry.fare &&
      o.source === entry.airline
  );
  if (nearDuplicate) {
    issues.push(issue('duplicate', `An existing observation (${nearDuplicate.id}) already records the same route, cabin, dates, price and source — likely a duplicate ingestion.`));
  }

  if (issues.length > 0) {
    return { routeSlug: entry.routeSlug, status: 'INVALID', issues, preparedObservation: null, isRouteVerificationBlocked, publicationNote: entry.publicationNote };
  }

  const fareDirectness = aggregateEntryDirectness(entry.outboundDirectness!, entry.returnDirectness!);

  const preparedObservation: FareObservation = {
    id,
    routeSlug: entry.routeSlug,
    cabin,
    observedDate: profile.observedDate,
    price: entry.fare!,
    priceNote: buildPriceNote(entry),
    source: entry.airline!,
    observedVia: entry.source,
    sourceUrl: entry.sourceUrl,
    currency: 'GBP',
    baggage: entry.baggage,
    profileId,
    observationReason: profile.observationReason,
    comparisonEligibility: entry.comparisonEligibility ?? 'current',
    departureDate: profile.departureDate,
    returnDate: profile.returnDate,
    fareDirectness,
    outboundDirectness: entry.outboundDirectness,
    returnDirectness: entry.returnDirectness,
    outboundConnectionAirports: entry.outboundConnectionAirports,
    returnConnectionAirports: entry.returnConnectionAirports,
  };

  return { routeSlug: entry.routeSlug, status: 'VALID', issues: [], preparedObservation, isRouteVerificationBlocked, publicationNote: entry.publicationNote };
}

/**
 * Validates a full batch. Also catches a route appearing twice within the
 * SAME supplied batch (the second occurrence is marked INVALID rather than
 * silently accepted) — a batch is meant to carry exactly one observation
 * per route/cabin for this week's check.
 */
export function validateWeeklyFareEvidenceBatch(
  entries: readonly WeeklyFareEvidenceEntry[],
  profile: WeeklyFareProfile,
  existingObservations: readonly FareObservation[]
): WeeklyFareValidationResult[] {
  const seenInBatch = new Set<string>();
  const results: WeeklyFareValidationResult[] = [];

  for (const entry of entries) {
    const cabin = entry.cabin ?? DEFAULT_CABIN;
    const batchKey = `${entry.routeSlug}|${cabin}`;
    if (seenInBatch.has(batchKey)) {
      results.push({
        routeSlug: entry.routeSlug,
        status: 'INVALID',
        issues: [issue('routeSlug', `Route "${entry.routeSlug}" (${cabin}) appears more than once in this supplied batch.`)],
        preparedObservation: null,
        isRouteVerificationBlocked: false,
        publicationNote: entry.publicationNote,
      });
      continue;
    }
    seenInBatch.add(batchKey);
    results.push(validateWeeklyFareEntry(entry, profile, existingObservations));
  }

  return results;
}

/**
 * Freezes the universe check: given the manifest of routes the run was
 * supposed to cover, reports which are missing from the supplied evidence
 * (silently skipped) and which supplied entries don't correspond to any
 * expected route (a typo'd or out-of-scope slug). Neither list overrides
 * anything — it's a completeness report for the founder to review.
 */
export function checkManifestCompleteness(
  entries: readonly WeeklyFareEvidenceEntry[],
  expectedRouteSlugs: readonly string[]
): { missing: string[]; unexpected: string[] } {
  const suppliedSlugs = new Set(entries.map((e) => e.routeSlug));
  const expectedSlugs = new Set(expectedRouteSlugs);
  return {
    missing: expectedRouteSlugs.filter((slug) => !suppliedSlugs.has(slug)),
    unexpected: [...suppliedSlugs].filter((slug) => !expectedSlugs.has(slug)),
  };
}

/**
 * Renders a VALID result's prepared observation as a single-line TS object
 * literal, formatted to match the existing style in
 * data/fare-observations.ts, ready to paste directly into the array.
 * Returns null for anything that isn't VALID — this never manufactures a
 * record for a NO RESULT or INVALID entry.
 */
export function generateFareObservationCode(result: WeeklyFareValidationResult): string | null {
  if (result.status !== 'VALID' || !result.preparedObservation) return null;
  const o = result.preparedObservation;

  const fields: string[] = [
    `id: '${o.id}'`,
    `routeSlug: '${o.routeSlug}'`,
    `cabin: '${o.cabin}'`,
    `observedDate: '${o.observedDate}'`,
    `price: ${o.price}`,
    `priceNote: ${JSON.stringify(o.priceNote)}`,
    `source: ${JSON.stringify(o.source)}`,
  ];
  if (o.observedVia) fields.push(`observedVia: '${o.observedVia}'`);
  if (o.sourceUrl) fields.push(`sourceUrl: ${JSON.stringify(o.sourceUrl)}`);
  if (o.currency) fields.push(`currency: '${o.currency}'`);
  if (o.baggage) fields.push(`baggage: ${JSON.stringify(o.baggage)}`);
  if (o.profileId) fields.push(`profileId: '${o.profileId}'`);
  if (o.observationReason) fields.push(`observationReason: '${o.observationReason}'`);
  if (o.comparisonEligibility) fields.push(`comparisonEligibility: '${o.comparisonEligibility}'`);
  if (o.departureDate) fields.push(`departureDate: '${o.departureDate}'`);
  if (o.returnDate) fields.push(`returnDate: '${o.returnDate}'`);
  if (o.fareDirectness) fields.push(`fareDirectness: '${o.fareDirectness}'`);
  if (o.outboundDirectness) fields.push(`outboundDirectness: '${o.outboundDirectness}'`);
  if (o.returnDirectness) fields.push(`returnDirectness: '${o.returnDirectness}'`);
  if (o.outboundConnectionAirports?.length) fields.push(`outboundConnectionAirports: ${JSON.stringify(o.outboundConnectionAirports)}`);
  if (o.returnConnectionAirports?.length) fields.push(`returnConnectionAirports: ${JSON.stringify(o.returnConnectionAirports)}`);

  return `  { ${fields.join(', ')} },`;
}

export interface WeeklyFareBatchSummary {
  total: number;
  valid: number;
  invalid: number;
  noResult: number;
  skipped: number;
  routeVerificationBlockedCount: number;
}

export function summarizeWeeklyFareBatch(results: readonly WeeklyFareValidationResult[]): WeeklyFareBatchSummary {
  return {
    total: results.length,
    valid: results.filter((r) => r.status === 'VALID').length,
    invalid: results.filter((r) => r.status === 'INVALID').length,
    noResult: results.filter((r) => r.status === 'NO RESULT').length,
    skipped: results.filter((r) => r.status === 'SKIPPED').length,
    routeVerificationBlockedCount: results.filter((r) => r.isRouteVerificationBlocked).length,
  };
}
