import type { NextRequest } from 'next/server';

/**
 * Shared abuse-reduction utilities for the four public submission
 * endpoints (contact, quote-request, subscribe, route-watch) — kept as one
 * small module so rate-limiting, honeypot and field-validation behaviour
 * can't drift between routes.
 *
 * Rate limiting here is an in-memory, per-serverless-instance counter.
 * Vercel functions are stateless and can run as multiple concurrent
 * instances with no shared memory, so this is NOT a globally consistent
 * limit across all traffic — a determined attacker spread across
 * instances/regions can exceed the nominal limit. It is a basic,
 * best-effort abuse-reduction layer, not a robust distributed rate
 * limiter. A shared store (e.g. Upstash Redis or Vercel KV) would be
 * needed for a stronger guarantee; none is wired into this project today.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Bounds the map's growth — attacker-controlled keys (spoofable IPs) could
// otherwise grow this map without limit. Once full, the oldest bucket
// (first inserted, per Map's insertion-order iteration) is evicted to make
// room, a simple trade-off rather than a true LRU.
const MAX_RATE_LIMIT_BUCKETS = 5000;

/**
 * Fixed-window counter keyed by caller-supplied string (endpoint + client
 * identifier). Not exported with any persistence guarantee — see the
 * module-level caveat above.
 */
export function checkRateLimit(key: string, limitCount: number, windowMs: number): { limited: boolean } {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (oldestKey !== undefined) rateLimitBuckets.delete(oldestKey);
    }
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  existing.count += 1;
  return { limited: existing.count > limitCount };
}

/** Best-effort client identifier for rate-limit keying only — never echoed back to the client or logged. */
export function getClientIdentifier(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Name shared by every form's hidden bot-trap field and its client-side
 * component (components/forms/honeypot-field.tsx). Deliberately not a
 * common autofill token (e.g. "website", "company") so browsers/password
 * managers have no heuristic reason to populate it for a real visitor.
 */
export const HONEYPOT_FIELD_NAME = 'inquiryReference';

/** True when the honeypot field was filled in — real visitors never see or fill it. */
export function isHoneypotTriggered(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates one text field against a single, explicit shape: required or
 * not, and a maximum length — and always a genuine string. Arrays,
 * objects, numbers and booleans are rejected outright rather than
 * silently coerced or ignored, even for optional fields. Returns an error
 * message safe to send to the client, or null when the value is
 * acceptable (including "absent and optional").
 */
export function validateTextField(
  value: unknown,
  { required, maxLength, fieldName }: { required: boolean; maxLength: number; fieldName: string }
): string | null {
  if (value === undefined || value === null || value === '') {
    return required ? `${fieldName} is required.` : null;
  }
  if (typeof value !== 'string') {
    return `${fieldName} is invalid.`;
  }
  if (value.trim().length === 0) {
    return required ? `${fieldName} is required.` : null;
  }
  if (value.length > maxLength) {
    return `${fieldName} is too long.`;
  }
  return null;
}
