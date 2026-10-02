import { after } from 'next/server';
import { cleanJourneyInput } from './clean-journey-input';
import { getConfiguredCallBudgetStore, type CallBudgetStore } from './call-budget';
import type { JourneyPlan, NotEvidencedReason } from './types';

/**
 * Anonymous outcome counters for the public Arrive By journey beta.
 *
 * Purpose: answer "did people submit a journey, and what happened?" with counts
 * only. For every genuine submission exactly ONE terminal outcome is counted, so
 * submissions = result_usable + cannot_confirm:* + refused:* + error.
 *
 * Privacy: nothing about the traveller or their request can reach a key or a
 * value. Keys are built only from a UTC date and a field name taken from a fixed
 * allowlist below; a CANNOT CONFIRM reason is accepted only if it is in the fixed
 * reason list, otherwise it is counted as UNSPECIFIED. No place text, airport,
 * time, place id, request body, IP, user agent, cookie or raw error message is
 * ever passed in or stored. Counters live in the same durable Upstash store the
 * monthly call guard already uses, under a daily key with a 90-day expiry.
 *
 * Measurement must never affect a journey: writes run after the response is sent
 * (Next.js `after()`), and every failure is contained here.
 */

export const BETA_METRIC_TTL_SECONDS = 90 * 24 * 60 * 60;

/** Every CANNOT CONFIRM reason that can become a counter name. MONTHLY_BUDGET_UNAVAILABLE is counted as refused:budget instead. */
export const CANNOT_CONFIRM_REASONS = [
  'ORIGIN_LEG_MISSING',
  'START_LOCATION_UNCONFIRMED',
  'START_LOCATION_UNSUITABLE',
  'ORIGIN_ROUTE_UNAVAILABLE',
  'ORIGIN_SEARCH_NO_FEASIBLE',
  'DEPARTURE_AIRPORT_NOT_EVIDENCED',
  'ARRIVAL_DESTINATION_UNCONFIRMED',
  'ARRIVAL_ROUTE_UNAVAILABLE',
  'CALL_CEILING_REACHED',
  'CONNECTION_NOT_MODELLED',
  'AIRPORT_NOT_SUPPORTED',
  'INVALID_INPUT',
] as const;
export type CannotConfirmReason = (typeof CANNOT_CONFIRM_REASONS)[number];

// Compile-time guard: adding a NotEvidencedReason without deciding how it is counted is a type error.
type _EveryReasonIsCounted = Exclude<NotEvidencedReason, CannotConfirmReason | 'MONTHLY_BUDGET_UNAVAILABLE'> extends never ? true : never;
const _everyReasonIsCounted: _EveryReasonIsCounted = true;
void _everyReasonIsCounted;

export type BetaOutcome =
  | { kind: 'result_usable' }
  | { kind: 'cannot_confirm'; reason: CannotConfirmReason | 'UNSPECIFIED' }
  | { kind: 'refused_rate_limit' }
  | { kind: 'refused_budget' }
  | { kind: 'error' };

const REASON_SET: ReadonlySet<string> = new Set(CANNOT_CONFIRM_REASONS);

/** Accepts anything, returns only an allowlisted reason (or UNSPECIFIED). Free text can never pass through. */
export function toAllowedReason(value: unknown): CannotConfirmReason | 'UNSPECIFIED' {
  return typeof value === 'string' && REASON_SET.has(value) ? (value as CannotConfirmReason) : 'UNSPECIFIED';
}

/** The single terminal outcome for a plan the engine returned. Never throws. */
export function classifyPlan(plan: Pick<JourneyPlan, 'state' | 'notEvidenced'> | null | undefined): BetaOutcome {
  try {
    if (!plan || plan.state !== 'CANNOT_CONFIRM') return { kind: 'result_usable' };
    if (plan.notEvidenced?.reason === 'MONTHLY_BUDGET_UNAVAILABLE') return { kind: 'refused_budget' };
    return { kind: 'cannot_confirm', reason: toAllowedReason(plan.notEvidenced?.reason) };
  } catch {
    return { kind: 'error' };
  }
}

/** The fixed counter field name for an outcome. */
export function outcomeField(outcome: BetaOutcome): string {
  switch (outcome.kind) {
    case 'result_usable': return 'result_usable';
    case 'cannot_confirm': return `cannot_confirm:${toAllowedReason(outcome.reason)}`;
    case 'refused_rate_limit': return 'refused:rate_limit';
    case 'refused_budget': return 'refused:budget';
    default: return 'error';
  }
}

export function metricKey(utcDay: string, field: string): string {
  return `arrive-by:metric:${utcDay}:${field}`;
}

export interface RecordDeps {
  /** Tests inject a store. In production the configured Upstash store is used. */
  store?: CallBudgetStore;
  now?: Date;
}

/**
 * Production traffic only: a Preview deployment shares the same Upstash database, and its test journeys must not
 * count as beta usage. An injected store (tests) bypasses the gate.
 */
function resolveStore(deps: RecordDeps): CallBudgetStore | undefined {
  if (deps.store) return deps.store;
  if (process.env.VERCEL_ENV !== 'production') return undefined;
  return getConfiguredCallBudgetStore(process.env);
}

/** Adds one submission and its one terminal outcome. Counts only; never throws. */
export async function recordBetaOutcome(outcome: BetaOutcome, deps: RecordDeps = {}): Promise<void> {
  try {
    const store = resolveStore(deps);
    if (!store) return;
    const day = (deps.now ?? new Date()).toISOString().slice(0, 10);
    await Promise.all(['submissions', outcomeField(outcome)].map((field) => store.incrementBy(metricKey(day, field), 1, BETA_METRIC_TTL_SECONDS)));
  } catch {
    // A counter failure must never change what the traveller experiences.
  }
}

/** Runs the write after the response has gone out. Falls back to running it directly where `after()` has no request scope. */
export function scheduleBetaMetric(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task().catch(() => undefined);
  }
}

/**
 * Whether a request that was refused BEFORE its body was read (rate limit, missing config) was nevertheless a genuine,
 * well-formed submission. Malformed or oversized bot/API noise is not counted. Only reads a body that declares a small
 * Content-Length, so a refused request can never make us parse an arbitrarily large payload.
 */
export async function isGenuineSubmission(request: Request, maxBytes: number): Promise<boolean> {
  try {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (!Number.isFinite(declared) || declared <= 0 || declared > maxBytes) return false;
    cleanJourneyInput(await request.clone().json());
    return true;
  } catch {
    return false;
  }
}
