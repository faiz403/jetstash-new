import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * A6 security-hardening regression coverage for app/api/route-watch/route.ts
 * (docs/project-control/LAUNCH_CHECKLIST.md §A, A6) — proves the fail-closed
 * behaviour on an uncertain Brevo lookup, and that a confirmed existing
 * contact's preferences are merged rather than overwritten or discarded.
 *
 * See tests/email-lib-hardening.test.ts for the unit-level coverage of
 * getBrevoContact's not_found/uncertain contract this route consumes, and
 * tests/public-form-hardening.test.ts for the pre-existing rate-limit/
 * honeypot/validation coverage this file doesn't duplicate.
 */

const mocks = vi.hoisted(() => ({
  sendResendEmail: vi.fn(),
  upsertBrevoContact: vi.fn(),
  getBrevoContact: vi.fn(),
}));

vi.mock('@/lib/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email')>();
  return {
    ...actual,
    sendResendEmail: mocks.sendResendEmail,
    upsertBrevoContact: mocks.upsertBrevoContact,
    getBrevoContact: mocks.getBrevoContact,
  };
});

import { POST as routeWatchPOST } from '@/app/api/route-watch/route';
import { POST as contactPOST } from '@/app/api/contact/route';

const ORIGINAL_ENV = { ...process.env };

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter % 250}`;
}

function jsonRequest(url: string, body: unknown, ip: string) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('Route Watch — Brevo lookup result handling', () => {
  const url = 'https://jetstash.test/api/route-watch';
  const valid = { email: 'amina@example.test', airportSlug: 'manchester', destinationSlug: 'mumbai' };

  beforeEach(() => {
    mocks.sendResendEmail.mockReset();
    mocks.upsertBrevoContact.mockReset();
    mocks.getBrevoContact.mockReset();
    mocks.upsertBrevoContact.mockResolvedValue({ ok: true });
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_LIST_ID = '42';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('an uncertain lookup fails closed: returns a temporary error and performs no create/update side effect', async () => {
    mocks.getBrevoContact.mockResolvedValue({ status: 'uncertain' });
    const res = await routeWatchPOST(jsonRequest(url, valid, freshIp()));
    expect(res.status).toBe(503);
    expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('a confirmed not_found result still proceeds to create a new contact (existing behaviour preserved)', async () => {
    mocks.getBrevoContact.mockResolvedValue({ status: 'not_found' });
    const res = await routeWatchPOST(jsonRequest(url, valid, freshIp()));
    expect(res.status).toBe(200);
    expect(mocks.upsertBrevoContact).toHaveBeenCalledOnce();
    const [[call]] = mocks.upsertBrevoContact.mock.calls;
    // A genuinely new contact has nothing to merge with — WATCH_ROUTE is
    // just the one route just submitted.
    expect(call.attributes.WATCH_ROUTE).toBe('manchester-mumbai');
  });

  it('a confirmed existing contact merges the new route into its existing WATCH_ROUTE value rather than discarding it', async () => {
    mocks.getBrevoContact.mockResolvedValue({
      status: 'found',
      attributes: { WATCH_ROUTE: 'manchester-lahore,manchester-karachi' },
    });
    const res = await routeWatchPOST(jsonRequest(url, valid, freshIp()));
    expect(res.status).toBe(200);
    expect(mocks.upsertBrevoContact).toHaveBeenCalledOnce();
    const [[call]] = mocks.upsertBrevoContact.mock.calls;
    const routes: string[] = call.attributes.WATCH_ROUTE.split(',');
    // The two pre-existing routes must still be present — this is the
    // exact "existing preferences are not overwritten" guarantee.
    expect(routes).toContain('manchester-lahore');
    expect(routes).toContain('manchester-karachi');
    expect(routes).toContain('manchester-mumbai');
  });

  it('the existing MAX_WATCHED_ROUTES cap (3) is still enforced when merging onto an existing contact', async () => {
    mocks.getBrevoContact.mockResolvedValue({
      status: 'found',
      attributes: { WATCH_ROUTE: 'manchester-lahore,manchester-karachi,manchester-islamabad' },
    });
    const res = await routeWatchPOST(jsonRequest(url, valid, freshIp()));
    expect(res.status).toBe(200);
    const [[call]] = mocks.upsertBrevoContact.mock.calls;
    const routes: string[] = call.attributes.WATCH_ROUTE.split(',');
    expect(routes).toHaveLength(3);
    expect(routes).toContain('manchester-mumbai');
  });

  it('rate-limit rejection causes no Brevo lookup or upsert call at all', async () => {
    const ip = freshIp();
    mocks.getBrevoContact.mockResolvedValue({ status: 'not_found' });
    for (let i = 0; i < 5; i++) {
      await routeWatchPOST(jsonRequest(url, valid, ip));
    }
    mocks.getBrevoContact.mockClear();
    mocks.upsertBrevoContact.mockClear();
    const limited = await routeWatchPOST(jsonRequest(url, valid, ip));
    expect(limited.status).toBe(429);
    expect(mocks.getBrevoContact).not.toHaveBeenCalled();
    expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
  });
});

describe('contact route — misconfigured-provider log never includes the submitted name or email', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const ORIGINAL_CONTACT_ENV = { ...process.env };

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env = { ...ORIGINAL_CONTACT_ENV };
  });

  it('logs the misconfiguration without the submitted name or email', async () => {
    const url = 'https://jetstash.test/api/contact';
    const res = await contactPOST(
      jsonRequest(
        url,
        { name: 'Private Person', email: 'private.person@example.test', message: 'Hello there, this is a real message.' },
        freshIp()
      )
    );
    expect(res.status).toBe(503);
    expect(warnSpy).toHaveBeenCalled();
    const rendered = warnSpy.mock.calls.map((args: unknown[]) => JSON.stringify(args)).join('\n');
    expect(rendered).not.toContain('Private Person');
    expect(rendered).not.toContain('private.person@example.test');
  });
});
