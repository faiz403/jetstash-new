/**
 * The bounded backward search for the LATEST departure that still meets an
 * airport-readiness deadline.
 *
 * Why a search at all: Google's traffic-aware DRIVE routing takes a
 * DEPARTURE time (an arrival time is only supported for transit), and the
 * drive duration itself depends on when you leave. So "leave by when?" is a
 * fixed point: find the largest T with  T + drive(T) <= D  (D = flight
 * departure - chosen airport buffer).
 *
 * The iteration is the fixed-point map T' = D - drive(T) - tolerance/2 (aiming for the middle of the
 * acceptable window, so a small traffic wobble between two nearby times still lands feasible instead of
 * missing by a minute and forcing another call):
 *
 *   T0 = D - seed                     (a first guess; the seed is a constant, not a guess about this route)
 *   d  = drive(T)                     (one Google call)
 *   slack = D - (T + d)               (>= 0 means leaving at T arrives in time)
 *   slack in [0, tolerance]  -> converged: T is within tolerance of the latest safe departure
 *   otherwise                -> T' = D - d and query again
 *
 * Deterministic and bounded on purpose (founder: "Leave Preston by around
 * 05:25", not endless optimisation):
 *   - at most `maxQueries` calls, whatever happens;
 *   - it keeps the LATEST departure it has actually VERIFIED as arriving in
 *     time, and never reports an unverified time as safe;
 *   - it stops early when the next guess would repeat a point already queried;
 *   - if no verified-feasible departure is found in budget it returns FAILED --
 *     the caller turns that into CANNOT CONFIRM, never a guess.
 * All arithmetic is exact epoch milliseconds (UTC); rounding for display is
 * the solver's job, and rounds DOWN (earlier is safe).
 */

export const SEARCH_SEED_MINUTES = 60;
export const SEARCH_TOLERANCE_MINUTES = 5;
export const SEARCH_MAX_QUERIES = 4;

export interface DriveSample {
  durationSeconds: number;
  staticSeconds?: number;
}

/** One traffic-aware DRIVE query at a departure instant. `exhausted` means the call ledger refused it. */
export type DriveQuery = (departureMs: number) => Promise<{ ok: true; sample: DriveSample } | { ok: false; exhausted?: boolean }>;

export interface SearchTraceEntry {
  departureMs: number;
  durationSeconds: number;
  /** D - (departure + duration), in minutes (fractional). Positive = arrives with time to spare. */
  slackMinutes: number;
}

export type SearchResult =
  | {
      status: 'OK';
      /** The latest VERIFIED-feasible departure found. */
      departureMs: number;
      durationSeconds: number;
      staticSeconds?: number;
      slackMinutes: number;
      /** True when the last verified point was within tolerance of the deadline; false when the budget ended first (still safe, possibly earlier than necessary). */
      converged: boolean;
      queries: number;
      trace: SearchTraceEntry[];
    }
  | {
      /** Even leaving as early as `nowMs` cannot meet the deadline. `departureMs` is D - drive, which is before now. Not a verified departure. */
      status: 'ALREADY_TOO_LATE';
      departureMs: number;
      durationSeconds: number;
      queries: number;
      trace: SearchTraceEntry[];
    }
  | { status: 'FAILED'; reason: 'QUERY_FAILED' | 'BUDGET_EXHAUSTED' | 'NO_FEASIBLE_WITHIN_BUDGET'; queries: number; trace: SearchTraceEntry[] };

export interface SearchParams {
  /** D: the instant the traveller must be at the airport (flight departure minus their chosen buffer). */
  deadlineMs: number;
  /** Google will not route a departure in the past; queries are clamped to now + 1 min. */
  nowMs: number;
  query: DriveQuery;
  seedMinutes?: number;
  toleranceMinutes?: number;
  maxQueries?: number;
}

const MIN = 60000;
const SAME_POINT_MS = 60000;

export async function searchLatestDeparture(params: SearchParams): Promise<SearchResult> {
  const { deadlineMs, nowMs, query } = params;
  const tolerance = (params.toleranceMinutes ?? SEARCH_TOLERANCE_MINUTES) * MIN;
  const maxQueries = Math.max(1, params.maxQueries ?? SEARCH_MAX_QUERIES);
  const earliestQueryMs = nowMs + MIN;

  const trace: SearchTraceEntry[] = [];
  const asked: number[] = [];
  let best: { departureMs: number; sample: DriveSample; slackMs: number } | undefined;
  let nextMs = deadlineMs - (params.seedMinutes ?? SEARCH_SEED_MINUTES) * MIN;
  let stoppedOnTolerance = false;
  let lastClamped: { departureMs: number; durationSeconds: number } | undefined;

  for (let i = 0; i < maxQueries; i += 1) {
    const clamped = nextMs < earliestQueryMs;
    const at = clamped ? earliestQueryMs : nextMs;
    if (asked.some((previous) => Math.abs(previous - at) < SAME_POINT_MS)) break; // the map has revisited a point: nothing new to learn

    asked.push(at);
    const result = await query(at);
    if (!result.ok) {
      if (best) break; // keep the verified answer we already have
      return { status: 'FAILED', reason: result.exhausted ? 'BUDGET_EXHAUSTED' : 'QUERY_FAILED', queries: asked.length, trace };
    }
    const durationMs = result.sample.durationSeconds * 1000;
    const slackMs = deadlineMs - (at + durationMs);
    trace.push({ departureMs: at, durationSeconds: result.sample.durationSeconds, slackMinutes: Math.round((slackMs / MIN) * 100) / 100 });

    if (slackMs >= 0) {
      if (!best || at > best.departureMs) best = { departureMs: at, sample: result.sample, slackMs };
      if (slackMs <= tolerance) {
        stoppedOnTolerance = true;
        break;
      }
    } else if (clamped) {
      // Leaving as early as Google will route (now) already misses the deadline.
      lastClamped = { departureMs: deadlineMs - durationMs, durationSeconds: result.sample.durationSeconds };
      return { status: 'ALREADY_TOO_LATE', departureMs: lastClamped.departureMs, durationSeconds: lastClamped.durationSeconds, queries: asked.length, trace };
    }
    nextMs = deadlineMs - durationMs - tolerance / 2;
  }

  if (!best) return { status: 'FAILED', reason: 'NO_FEASIBLE_WITHIN_BUDGET', queries: asked.length, trace };
  return {
    status: 'OK',
    departureMs: best.departureMs,
    durationSeconds: best.sample.durationSeconds,
    staticSeconds: best.sample.staticSeconds,
    slackMinutes: Math.round((best.slackMs / MIN) * 100) / 100,
    converged: stoppedOnTolerance && best.slackMs <= tolerance,
    queries: asked.length,
    trace,
  };
}
