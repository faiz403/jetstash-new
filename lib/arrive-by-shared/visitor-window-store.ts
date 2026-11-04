/**
 * Counter for the Arrive By per-visitor limiter only. Deliberately separate from lib/arrive-by-journey/call-budget.ts, whose atomic
 * add is shared with the monthly Google-call budget and must not change.
 *
 * It is a FIXED window: the first request opens a window of `windowSeconds`, later requests in it only count, and the window closes
 * on its own. Refused requests never extend it. (The previous limiter re-armed the expiry on every request, refused ones included, so
 * a visitor who kept retrying stayed locked out until they stopped for a whole window. Found on Production on 4 November 2026.)
 */
import { createHash } from 'node:crypto';

export interface VisitorWindowStore {
  /** False for a store that cannot be trusted across serverless instances (in-memory). */
  readonly durable: boolean;
  /** Counts one hit for `key` in its current fixed window and returns the count including this hit. Throws on any failure. */
  hit(key: string, windowSeconds: number): Promise<number>;
}

export class InMemoryVisitorWindowStore implements VisitorWindowStore {
  readonly durable = false;
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly now: () => number = () => Date.now()) {}

  async hit(key: string, windowSeconds: number): Promise<number> {
    const at = this.now();
    const current = this.windows.get(key);
    if (!current || at >= current.resetAt) {
      if (this.windows.size > 5000) for (const [k, w] of this.windows) if (at >= w.resetAt) this.windows.delete(k);
      this.windows.set(key, { count: 1, resetAt: at + windowSeconds * 1000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}

/**
 * The whole fixed-window step as one atomic script, so concurrent requests cannot interleave: count the hit, and set the expiry only
 * when the counter is new (count 1) or somehow has none (TTL -1). An existing window's expiry is never moved, so refused requests
 * cannot extend a lockout, and a counter can never be left without an expiry.
 */
export const VISITOR_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 or redis.call('TTL', KEYS[1]) == -1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  'return count',
].join('\n');

/**
 * Upstash Redis REST adapter (also what Vercel KV exposes): one authenticated request running VISITOR_WINDOW_SCRIPT. Any transport or
 * protocol failure, or a result that is not a positive integer, THROWS and the limiter turns that into a refusal: an unreachable or
 * confusing counter never means "unlimited".
 */
export class UpstashVisitorWindowStore implements VisitorWindowStore {
  readonly durable = true;
  constructor(private readonly url: string, private readonly token: string, private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async hit(key: string, windowSeconds: number): Promise<number> {
    const response = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['EVAL', VISITOR_WINDOW_SCRIPT, '1', key, String(windowSeconds)]]),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Visitor window store request failed.');
    const json = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const entry = Array.isArray(json) && json.length === 1 ? json[0] : undefined;
    const count = entry?.result;
    if (!entry || entry.error || typeof count !== 'number' || !Number.isInteger(count) || count < 1) throw new Error('Visitor window store returned an unexpected response.');
    return count;
  }
}

/** The durable store the environment provides, or undefined. Never guesses a fallback. */
export function getConfiguredVisitorWindowStore(env: Record<string, string | undefined> = process.env): VisitorWindowStore | undefined {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? new UpstashVisitorWindowStore(url, token) : undefined;
}

export interface VisitorRateLimiterOptions {
  store: VisitorWindowStore;
  keyPrefix: string;
  max: number;
  windowSeconds: number;
}

/** `check(identifier)` hashes the identifier (so no raw client identity reaches the store) and returns whether the visitor is over `max`. */
export function createVisitorRateLimiter({ store, keyPrefix, max, windowSeconds }: VisitorRateLimiterOptions) {
  return {
    async check(identifier: string): Promise<{ limited: boolean; unavailable?: boolean }> {
      const hash = createHash('sha256').update(identifier).digest('hex');
      try {
        const count = await store.hit(`${keyPrefix}:${hash}`, windowSeconds);
        return { limited: count > max };
      } catch {
        return { limited: true, unavailable: true };
      }
    },
  };
}
