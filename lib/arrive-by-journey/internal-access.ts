import { timingSafeEqual } from 'node:crypto';
import { MonthlyCallGuard, InMemoryCallBudgetStore, getConfiguredCallBudgetStore, type CallBudgetStore, type MonthlyGuardOptions } from './call-budget';

/**
 * Access control and spend wiring for the INTERNAL full-journey API.
 *
 * The full journey spends real Google money (about 5 calls each), so the
 * founder flag alone (FOUNDER_DASHBOARD_ENABLED) is not enough for a deployed
 * internal beta: anyone who finds the URL could run up the bill. In
 * production the endpoint also needs a server-side shared secret sent in a
 * header, compared in constant time; without it (or without the secret being
 * configured) the endpoint behaves as if it does not exist. In development
 * (`next dev`, tests) neither the flag nor a token is required, but an
 * ARRIVE_BY_INTERNAL_TOKEN that IS set is still enforced.
 */

export const INTERNAL_TOKEN_HEADER = 'x-arrive-by-internal-token';

export function founderEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // Compare fixed-length digests' worth of bytes: never short-circuit on length alone leaking through timing.
  if (x.length !== y.length) {
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}

export type AccessDecision = { allowed: true } | { allowed: false; reason: 'FOUNDER_DISABLED' | 'TOKEN_NOT_CONFIGURED' | 'TOKEN_MISMATCH' };

export function checkInternalAccess(presentedToken: string | null | undefined, env: Record<string, string | undefined> = process.env): AccessDecision {
  if (!founderEnabled(env)) return { allowed: false, reason: 'FOUNDER_DISABLED' };
  const expected = env.ARRIVE_BY_INTERNAL_TOKEN;
  const production = env.NODE_ENV === 'production';
  if (!expected || expected.length < 16) {
    // A weak or missing secret is never accepted in production; in development an unset token means "open on localhost".
    return production ? { allowed: false, reason: 'TOKEN_NOT_CONFIGURED' } : { allowed: true };
  }
  return presentedToken && safeEqual(presentedToken, expected) ? { allowed: true } : { allowed: false, reason: 'TOKEN_MISMATCH' };
}

/** A single dev/test store so the monthly counter behaves across requests in one process. Never used in production. */
const devStore = new InMemoryCallBudgetStore();

export interface GuardSetup {
  guard: MonthlyCallGuard;
  /** True when the store is durable and shared across instances. In production a non-durable/absent store means Google calls are refused. */
  durableConfigured: boolean;
}

export function createJourneyCallGuard(
  env: Record<string, string | undefined> = process.env,
  options: { onAlert?: MonthlyGuardOptions['onAlert']; store?: CallBudgetStore } = {},
): GuardSetup {
  const production = env.NODE_ENV === 'production';
  const configured = options.store ?? getConfiguredCallBudgetStore(env);
  const store = configured ?? (production ? undefined : devStore);
  return {
    guard: new MonthlyCallGuard({ store, requireDurable: production, onAlert: options.onAlert }),
    durableConfigured: Boolean(configured?.durable),
  };
}
