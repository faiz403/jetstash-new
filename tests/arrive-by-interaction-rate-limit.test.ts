import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const store = vi.hoisted(() => {
  const counts = new Map<string, number>();
  return {
    incrementBy: vi.fn(async (key: string) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count;
    }),
  };
});

vi.mock('@/lib/arrive-by-journey/call-budget', () => ({
  InMemoryCallBudgetStore: class {},
  getConfiguredCallBudgetStore: () => store,
}));

import {
  ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX,
  ARRIVE_BY_RATE_LIMIT_MAX,
  checkPublicJourneyInteractionRateLimit,
  checkPublicJourneyRateLimit,
} from '@/lib/arrive-by-shared/rate-limit';

const env = { NODE_ENV: 'production', KV_REST_API_URL: 'https://kv.example.test', KV_REST_API_TOKEN: 'token' };
const request = (ip: string) => new NextRequest('https://jetstash.test/api/arrive-by', { headers: { 'x-forwarded-for': ip } });

describe('Arrive By interaction rate limit', () => {
  it('keeps UI counters independent from the billable journey calculation allowance', async () => {
    for (let i = 0; i < 3; i += 1) expect(await checkPublicJourneyInteractionRateLimit(request('198.51.100.1'), env)).toEqual({ limited: false });
    for (let i = 0; i < ARRIVE_BY_RATE_LIMIT_MAX; i += 1) expect(await checkPublicJourneyRateLimit(request('198.51.100.1'), env)).toEqual({ limited: false });
    expect(await checkPublicJourneyRateLimit(request('198.51.100.1'), env)).toEqual({ limited: true });
  });

  it('has its own bounded interaction allowance and stores only a hashed client key', async () => {
    for (let i = 0; i < ARRIVE_BY_INTERACTION_RATE_LIMIT_MAX; i += 1) expect(await checkPublicJourneyInteractionRateLimit(request('203.0.113.24'), env)).toEqual({ limited: false });
    expect(await checkPublicJourneyInteractionRateLimit(request('203.0.113.24'), env)).toEqual({ limited: true });
    const keys = store.incrementBy.mock.calls.map(([key]) => key);
    expect(keys).toContainEqual(expect.stringMatching(/^arrive-by:interaction-rate:[a-f0-9]{64}$/));
    expect(keys.some((key) => key.includes('203.0.113.24'))).toBe(false);
  });
});
