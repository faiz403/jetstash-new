import type { NextRequest } from 'next/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/form-security';
import { InMemoryVisitorWindowStore, createVisitorRateLimiter, getConfiguredVisitorWindowStore } from '@/lib/arrive-by-shared/visitor-window-store';

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

const WINDOW_SECONDS = ARRIVE_BY_RATE_LIMIT_WINDOW_MS / 1000;
const localVisitorWindowStore = new InMemoryVisitorWindowStore();

type LimitResult = { limited: boolean; unavailable?: boolean };

/**
 * Per-visitor, fixed-window limiter on its own counter (visitor-window-store.ts), not on the monthly Google-call budget. The window
 * opens on a visitor's first request and closes on its own; refused requests never extend it. Production uses the shared store and
 * fails closed if it is unavailable.
 */
function checkVisitorWindow(request: NextRequest, env: Record<string, string | undefined>, kind: 'journey' | 'interaction', max: number): Promise<LimitResult> {
  const configured = getConfiguredVisitorWindowStore(env);
  if (env.NODE_ENV === 'production' && !configured) return Promise.resolve({ limited: true, unavailable: true });
  return createVisitorRateLimiter({
    store: configured ?? localVisitorWindowStore,
    keyPrefix: `arrive-by:visitor-window:${kind}`,
    max,
    windowSeconds: WINDOW_SECONDS,
  }).check(getClientIdentifier(request));
}

/** Full journeys spend billable calls, so production uses a shared limiter and fails closed if it is unavailable. */
export function checkPublicJourneyRateLimit(request: NextRequest, env: Record<string, string | undefined> = process.env): Promise<LimitResult> {
  return checkVisitorWindow(request, env, 'journey', ARRIVE_BY_RATE_LIMIT_MAX);
}

/** UI counters are non-billable and must not consume the five-call journey allowance. */
export function checkPublicJourneyInteractionRateLimit(request: NextRequest, env: Record<string, string | undefined> = process.env): Promise<LimitResult> {
  return checkVisitorWindow(request, env, 'interaction', ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX);
}
