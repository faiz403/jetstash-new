import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { checkRateLimit, getClientIdentifier } from '@/lib/form-security';
import { InMemoryCallBudgetStore, getConfiguredCallBudgetStore } from '@/lib/arrive-by-journey/call-budget';

/**
 * One shared rate-limit budget across every public Arrive By endpoint
 * (currently Pakistan's; Manchester's will use this too once it goes
 * public), keyed by client identifier only — not per airport or engine —
 * so a visitor cannot get a fresh allowance by switching which airport
 * they're checking. Same best-effort, in-memory, per-serverless-instance
 * limiter already used by this codebase's other public form endpoints
 * (lib/form-security.ts) — not a distributed WAF, not a hard spend cap.
 */
export const ARRIVE_BY_RATE_LIMIT_MAX = 5;
export const ARRIVE_BY_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX = 30;

export function checkArriveByRateLimit(request: NextRequest): { limited: boolean } {
  return checkRateLimit(`arrive-by:${getClientIdentifier(request)}`, ARRIVE_BY_RATE_LIMIT_MAX, ARRIVE_BY_RATE_LIMIT_WINDOW_MS);
}

/** Full journeys spend billable calls, so production uses a shared limiter and fails closed if it is unavailable. */
const localJourneyRateStore = new InMemoryCallBudgetStore();

export async function checkPublicJourneyRateLimit(
  request: NextRequest,
  env: Record<string, string | undefined> = process.env,
): Promise<{ limited: boolean; unavailable?: boolean }> {
  const configured = getConfiguredCallBudgetStore(env);
  if (env.NODE_ENV === 'production' && !configured) return { limited: true, unavailable: true };
  const store = configured ?? localJourneyRateStore;
  const clientHash = createHash('sha256').update(getClientIdentifier(request)).digest('hex');
  try {
    const count = await store.incrementBy(`arrive-by:journey-rate:${clientHash}`, 1, ARRIVE_BY_RATE_LIMIT_WINDOW_MS / 1000);
    return { limited: count > ARRIVE_BY_RATE_LIMIT_MAX };
  } catch {
    return { limited: true, unavailable: true };
  }
}

/** UI counters are non-billable and must not consume the five-call journey allowance. */
export async function checkPublicJourneyInteractionRateLimit(
  request: NextRequest,
  env: Record<string, string | undefined> = process.env,
): Promise<{ limited: boolean; unavailable?: boolean }> {
  const configured = getConfiguredCallBudgetStore(env);
  if (env.NODE_ENV === 'production' && !configured) return { limited: true, unavailable: true };
  const store = configured ?? localJourneyRateStore;
  const clientHash = createHash('sha256').update(getClientIdentifier(request)).digest('hex');
  try {
    const count = await store.incrementBy(`arrive-by:interaction-rate:${clientHash}`, 1, ARRIVE_BY_RATE_LIMIT_WINDOW_MS / 1000);
    return { limited: count > ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX };
  } catch {
    return { limited: true, unavailable: true };
  }
}
