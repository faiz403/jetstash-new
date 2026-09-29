import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { checkArriveByRateLimit, ARRIVE_BY_RATE_LIMIT_MAX } from '@/lib/arrive-by-shared/rate-limit';
import { POST as postPakistan } from '@/app/api/arrive-by-pakistan/google/route';
import { POST as postManchester } from '@/app/api/arrive-by-manchester/google/route';

/**
 * Proves the shared-budget design from the Phase 2 brief: a visitor cannot
 * get a fresh rate-limit allowance by switching which Arrive By airport/
 * engine they call. Changing Pakistan's public API from its own
 * `arrive-by-pakistan:${clientId}` key to this shared `arrive-by:${clientId}`
 * key is a real behaviour change, so this test proves the intended new
 * behaviour directly rather than only asserting the old one still passes.
 */

function requestFrom(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/arrive-by-pakistan/google', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('checkArriveByRateLimit — one shared budget across the whole Arrive By product', () => {
  it('exhausts after ARRIVE_BY_RATE_LIMIT_MAX requests from the same client, regardless of which "call site" makes them', () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`; // unique per test run to avoid cross-test bucket collisions
    for (let i = 0; i < ARRIVE_BY_RATE_LIMIT_MAX; i += 1) {
      // Simulates alternating calls as if Pakistan and a future Manchester
      // public endpoint both used this same helper — the identifier is what
      // determines the bucket, not which route object calls it.
      expect(checkArriveByRateLimit(requestFrom(ip)).limited).toBe(false);
    }
    expect(checkArriveByRateLimit(requestFrom(ip)).limited).toBe(true);
  });

  it('a different client identifier gets its own independent budget', () => {
    const ipA = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    const ipB = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    if (ipA === ipB) return; // astronomically unlikely, but skip rather than flake
    for (let i = 0; i < ARRIVE_BY_RATE_LIMIT_MAX; i += 1) checkArriveByRateLimit(requestFrom(ipA));
    expect(checkArriveByRateLimit(requestFrom(ipA)).limited).toBe(true);
    expect(checkArriveByRateLimit(requestFrom(ipB)).limited).toBe(false);
  });

  it('the budget constant matches the product requirement: 5 requests / 60 seconds', () => {
    expect(ARRIVE_BY_RATE_LIMIT_MAX).toBe(5);
  });

  it('switching between the real Pakistan and Manchester public endpoints does NOT reset the allowance', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
    const pakistanBody = JSON.stringify({ airportCode: 'ISB', landingAt: '2026-09-29T12:00', airportExitBufferMinutes: 60, destination: 'Anywhere', pickupMode: 'family' });
    const manchesterBody = JSON.stringify({ originId: 'man-terminal-2', destination: 'Sheffield', availableAt: '2026-09-29T12:00', deadline: '2026-09-29T14:30' });
    const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': ip };

    // 3 calls to Pakistan, 2 to Manchester -- 5 total, same shared budget.
    // MAN isn't publicly enabled yet (registry POLICY_PENDING), so its
    // calls 404 at the registry check, but the rate limiter runs before
    // that check and still consumes a slot -- exactly what "shared across
    // endpoints" means.
    for (let i = 0; i < 3; i += 1) {
      const response = await postPakistan(new NextRequest('http://localhost/api/arrive-by-pakistan/google', { method: 'POST', body: pakistanBody, headers }));
      expect(response.status).not.toBe(429);
    }
    for (let i = 0; i < 2; i += 1) {
      const response = await postManchester(new NextRequest('http://localhost/api/arrive-by-manchester/google', { method: 'POST', body: manchesterBody, headers }));
      expect(response.status).not.toBe(429);
    }
    // The 6th request, to either endpoint, must be rate-limited.
    const sixth = await postPakistan(new NextRequest('http://localhost/api/arrive-by-pakistan/google', { method: 'POST', body: pakistanBody, headers }));
    expect(sixth.status).toBe(429);
  });
});
