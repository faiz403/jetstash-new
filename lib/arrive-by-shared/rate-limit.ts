import type { NextRequest } from 'next/server';
import { checkRateLimit, getClientIdentifier } from '@/lib/form-security';

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

export function checkArriveByRateLimit(request: NextRequest): { limited: boolean } {
  return checkRateLimit(`arrive-by:${getClientIdentifier(request)}`, ARRIVE_BY_RATE_LIMIT_MAX, ARRIVE_BY_RATE_LIMIT_WINDOW_MS);
}
