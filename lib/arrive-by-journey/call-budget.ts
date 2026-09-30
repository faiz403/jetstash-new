/**
 * Google-call accounting for the full-journey product (F0/F1).
 *
 * Two independent, call-based limits -- deliberately NOT pounds, because the
 * current Geocoding/Routes billing mix and each solve path's exact call count
 * are unverified (founder decision, 30 Sep 2026):
 *
 *   per journey   at most JOURNEY_CALL_CEILING (10) billable Google calls. The
 *                 ledger refuses the 11th; the journey becomes CANNOT CONFIRM.
 *   per month     MONTHLY_CALL_LIMIT (2,000) calls in total across all journeys,
 *                 with internal alerts at 50% and 80% and a hard stop at 100%.
 *
 * The visitor rate limit (5 submissions / 60 s) is a separate mechanism and is
 * never charged for the sub-calls one journey makes.
 *
 * SHARED STORAGE DECISION (F0). A monthly counter has to be atomic and shared
 * across serverless instances, so it cannot live in memory. The store is an
 * interface with one primitive -- an atomic add that returns the new value --
 * which Redis INCRBY provides directly. The intended production backing is
 * Upstash Redis via the Vercel Marketplace (REST, fetch-only, no new runtime
 * dependency); UpstashRedisCallBudgetStore below is that adapter and is not
 * activated until the env vars exist. Vercel Edge Config (read-mostly) and Blob
 * (no atomic add) were rejected. Without a durable store the guard FAILS
 * CLOSED in production: a Google-backed full-journey check is refused rather
 * than run unmetered. The in-memory store exists for tests and local
 * development only and reports `durable = false`.
 */

export const JOURNEY_CALL_CEILING = 10;
export const MONTHLY_CALL_LIMIT = 2000;
export const MONTHLY_ALERT_LEVELS = [50, 80] as const;

export type GoogleCallKind = 'geocode' | 'routes' | 'identity' | 'other';

export class CallCeilingExceeded extends Error {
  constructor(public readonly ceiling: number) {
    super(`Google call ceiling of ${ceiling} reached for this journey.`);
    this.name = 'CallCeilingExceeded';
  }
}

/**
 * Per-journey ledger. `fetch` is a drop-in for global fetch that counts every
 * Google request and refuses to send one past the ceiling. The engines swallow
 * network errors (they turn into "unresolved"/"route unavailable"), so the
 * refusal is also recorded on the ledger (`exhausted`) -- the orchestrator
 * reads that flag, not the engine's message, to decide CANNOT CONFIRM.
 */
export class GoogleCallLedger {
  private count = 0;
  private refused = false;
  private readonly byKind: Record<GoogleCallKind, number> = { geocode: 0, routes: 0, identity: 0, other: 0 };

  constructor(
    public readonly ceiling: number = JOURNEY_CALL_CEILING,
    private readonly baseFetch: typeof fetch = (...args) => fetch(...args),
  ) {
    if (!Number.isInteger(ceiling) || ceiling < 1) throw new Error('Call ceiling must be a positive integer.');
  }

  get used(): number { return this.count; }
  get exhausted(): boolean { return this.refused; }
  get remaining(): number { return Math.max(0, this.ceiling - this.count); }
  breakdown(): Readonly<Record<GoogleCallKind, number>> { return { ...this.byKind }; }

  /** Counts one billable call, or throws (and remembers that it did) when the ceiling is already used up. */
  charge(kind: GoogleCallKind = 'other'): void {
    if (this.count >= this.ceiling) {
      this.refused = true;
      throw new CallCeilingExceeded(this.ceiling);
    }
    this.count += 1;
    this.byKind[kind] += 1;
  }

  readonly fetch: typeof fetch = (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    this.charge(url.includes('/geocode/') ? 'geocode' : url.includes('routes.googleapis.com') ? 'routes' : 'other');
    return this.baseFetch(input, init);
  };
}

/** The single primitive the monthly guard needs: an atomic add (negative allowed) that returns the new total. */
export interface CallBudgetStore {
  /** False for a store that cannot be trusted across serverless instances (in-memory). */
  readonly durable: boolean;
  incrementBy(key: string, delta: number, ttlSeconds: number): Promise<number>;
}

export class InMemoryCallBudgetStore implements CallBudgetStore {
  readonly durable = false;
  private readonly values = new Map<string, number>();
  async incrementBy(key: string, delta: number, _ttlSeconds?: number): Promise<number> {
    const next = (this.values.get(key) ?? 0) + delta;
    this.values.set(key, next);
    return next;
  }
}

/**
 * Upstash Redis REST adapter (also what Vercel KV exposes). One pipelined
 * request: INCRBY then EXPIRE. Any transport or protocol failure THROWS, and
 * the guard turns a throw into a refusal -- an unreachable counter never
 * means "unlimited".
 */
export class UpstashRedisCallBudgetStore implements CallBudgetStore {
  readonly durable = true;
  constructor(private readonly url: string, private readonly token: string, private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async incrementBy(key: string, delta: number, ttlSeconds: number): Promise<number> {
    const response = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCRBY', key, String(delta)], ['EXPIRE', key, String(ttlSeconds)]]),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Call budget store request failed.');
    const json = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const value = json?.[0]?.result;
    if (json?.[0]?.error || typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Call budget store returned an unexpected response.');
    return value;
  }
}

/** The durable store the environment provides, or undefined. Never guesses a fallback. */
export function getConfiguredCallBudgetStore(env: Record<string, string | undefined> = process.env): CallBudgetStore | undefined {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? new UpstashRedisCallBudgetStore(url, token) : undefined;
}

export type BudgetDenial = 'MONTHLY_LIMIT_REACHED' | 'STORE_UNAVAILABLE';

export type Reservation =
  | { granted: true; reserved: number; monthlyUsedAfterReserve: number; month: string }
  | { granted: false; reason: BudgetDenial; month: string };

export interface MonthlyGuardOptions {
  store?: CallBudgetStore;
  limit?: number;
  /** Fired once per month per level when reservations first take usage to 50% / 80% of the limit. Internal signal only. */
  onAlert?: (alert: { level: 50 | 80; used: number; limit: number; month: string }) => void;
  /** Production requires a durable store; the default follows NODE_ENV. Tests and `next dev` may use in-memory. */
  requireDurable?: boolean;
  now?: () => Date;
}

const MONTH_TTL_SECONDS = 40 * 24 * 3600;

/**
 * Monthly hard stop. A journey RESERVES its worst case (the per-journey
 * ceiling) up front and SETTLES to its actual use afterwards, so concurrent
 * journeys cannot together overshoot the limit. The price of that safety is
 * that the guard may refuse up to ceiling-1 calls early. It fails closed: no
 * durable store in production, or any store error, is a refusal.
 */
export class MonthlyCallGuard {
  private readonly store?: CallBudgetStore;
  private readonly limit: number;
  private readonly onAlert?: MonthlyGuardOptions['onAlert'];
  private readonly requireDurable: boolean;
  private readonly now: () => Date;

  constructor(options: MonthlyGuardOptions = {}) {
    this.store = options.store;
    this.limit = options.limit ?? MONTHLY_CALL_LIMIT;
    this.onAlert = options.onAlert;
    this.requireDurable = options.requireDurable ?? process.env.NODE_ENV === 'production';
    this.now = options.now ?? (() => new Date());
  }

  private month(): string { return this.now().toISOString().slice(0, 7); }
  private key(month: string): string { return `arrive-by:google-calls:${month}`; }

  async reserve(amount: number = JOURNEY_CALL_CEILING): Promise<Reservation> {
    const month = this.month();
    if (!this.store || (this.requireDurable && !this.store.durable)) return { granted: false, reason: 'STORE_UNAVAILABLE', month };
    try {
      const used = await this.store.incrementBy(this.key(month), amount, MONTH_TTL_SECONDS);
      if (used > this.limit) {
        await this.store.incrementBy(this.key(month), -amount, MONTH_TTL_SECONDS);
        return { granted: false, reason: 'MONTHLY_LIMIT_REACHED', month };
      }
      await this.raiseAlerts(month, used - amount, used);
      return { granted: true, reserved: amount, monthlyUsedAfterReserve: used, month };
    } catch {
      return { granted: false, reason: 'STORE_UNAVAILABLE', month };
    }
  }

  /** Gives back the unused part of a reservation. A failure here only over-counts (safe direction), so it is swallowed. */
  async settle(reservation: Reservation, actuallyUsed: number): Promise<void> {
    if (!reservation.granted || !this.store) return;
    const unused = Math.max(0, reservation.reserved - actuallyUsed);
    if (unused === 0) return;
    try {
      await this.store.incrementBy(this.key(reservation.month), -unused, MONTH_TTL_SECONDS);
    } catch {
      /* over-counting is the safe failure */
    }
  }

  private async raiseAlerts(month: string, before: number, after: number): Promise<void> {
    if (!this.onAlert || !this.store) return;
    for (const level of MONTHLY_ALERT_LEVELS) {
      const threshold = (this.limit * level) / 100;
      if (before < threshold && after >= threshold) {
        // The alert flag is its own counter so each level fires once per month even across instances.
        const first = (await this.store.incrementBy(`${this.key(month)}:alert${level}`, 1, MONTH_TTL_SECONDS)) === 1;
        if (first) this.onAlert({ level, used: after, limit: this.limit, month });
      }
    }
  }
}
