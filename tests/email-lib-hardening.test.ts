import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Direct unit coverage of lib/email.ts against a mocked global fetch — the
 * A6 security-hardening finding (docs/project-control/LAUNCH_CHECKLIST.md
 * §A, A6). Proves two things the real implementation must guarantee:
 *
 *  1. getBrevoContact's 3-state result never conflates a confirmed
 *     "contact not found" (HTTP 404) with an uncertain outcome (network
 *     failure, non-404 error status, or a malformed/unexpected response
 *     body) — collapsing those was the bug that let an uncertain Route
 *     Watch lookup silently overwrite a real contact's preferences.
 *  2. No console.error call in this module ever includes a raw provider
 *     response body or a raw caught Error object — both routinely echo
 *     back the submitted email address.
 *
 * This file deliberately does NOT vi.mock('@/lib/email') — it exercises
 * the real implementation against a stubbed fetch. See
 * tests/route-watch-brevo-hardening.test.ts for the route-level
 * integration coverage, which does mock lib/email and so must live in a
 * separate file (vi.mock is hoisted file-wide and would otherwise shadow
 * the real implementation these tests need).
 */

describe('getBrevoContact — not_found vs. uncertain', () => {
  const fetchMock = vi.fn();
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });

  it('a confirmed HTTP 404 resolves to status: not_found', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'not_found' });
  });

  it('a 200 with attributes resolves to status: found, carrying those attributes', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ attributes: { WATCH_ROUTE: 'manchester-mumbai' } }), { status: 200 })
    );
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'found', attributes: { WATCH_ROUTE: 'manchester-mumbai' } });
  });

  it('a 200 with no attributes key resolves to status: found with an empty attributes object (not malformed)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ email: 'amina@example.test' }), { status: 200 }));
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'found', attributes: {} });
  });

  it.each([401, 429, 500, 503])('a non-404 error status (%i) resolves to status: uncertain, never not_found', async (status) => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status }));
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'uncertain' });
  });

  it('a 200 response with an unparseable body resolves to status: uncertain', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'uncertain' });
  });

  it('a 200 response whose attributes field is the wrong type resolves to status: uncertain', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ attributes: 'not-an-object' }), { status: 200 }));
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'uncertain' });
  });

  it('a thrown network error resolves to status: uncertain, never not_found', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed: getaddrinfo ENOTFOUND api.brevo.com/v3/contacts/amina%40example.test'));
    const { getBrevoContact } = await import('@/lib/email');
    const result = await getBrevoContact('key', 'amina@example.test');
    expect(result).toEqual({ status: 'uncertain' });
  });
});

describe('lib/email.ts — production logs never contain submitted identifiers or payloads', () => {
  const fetchMock = vi.fn();
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const SUBMITTED_EMAIL = 'private.person@example.test';

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });

  // Every console.error call this suite provokes is checked against this —
  // any occurrence anywhere in the logged arguments (message text, or a
  // nested value in a logged object) is a leak.
  function assertNoLeak() {
    const rendered = errorSpy.mock.calls.map((args: unknown[]) => JSON.stringify(args)).join('\n');
    expect(rendered).not.toContain(SUBMITTED_EMAIL);
  }

  it('getBrevoContact: a provider error response body naming the email is never logged', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: `Contact ${SUBMITTED_EMAIL} lookup blocked: rate limited` }), { status: 429 })
    );
    const { getBrevoContact } = await import('@/lib/email');
    await getBrevoContact('key', SUBMITTED_EMAIL);
    expect(errorSpy).toHaveBeenCalled();
    assertNoLeak();
  });

  it('getBrevoContact: a network-error message embedding the request URL (and thus the email) is never logged', async () => {
    fetchMock.mockRejectedValue(new Error(`fetch failed: https://api.brevo.com/v3/contacts/${encodeURIComponent(SUBMITTED_EMAIL)}`));
    const { getBrevoContact } = await import('@/lib/email');
    await getBrevoContact('key', SUBMITTED_EMAIL);
    expect(errorSpy).toHaveBeenCalled();
    assertNoLeak();
  });

  it('upsertBrevoContact: a non-duplicate 400 that also names the email in its body is never logged raw', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'invalid_parameter', message: `Bad request for ${SUBMITTED_EMAIL}` }), { status: 400 })
    );
    const { upsertBrevoContact } = await import('@/lib/email');
    await upsertBrevoContact({ apiKey: 'key', listId: '1', email: SUBMITTED_EMAIL, attributes: { WATCH_ROUTE: 'x' } });
    expect(errorSpy).toHaveBeenCalled();
    assertNoLeak();
  });

  it('upsertBrevoContact: a thrown network error is never logged with its raw message', async () => {
    fetchMock.mockRejectedValue(new Error(`network error while upserting ${SUBMITTED_EMAIL}`));
    const { upsertBrevoContact } = await import('@/lib/email');
    await upsertBrevoContact({ apiKey: 'key', listId: '1', email: SUBMITTED_EMAIL, attributes: {} });
    expect(errorSpy).toHaveBeenCalled();
    assertNoLeak();
  });

  it('sendResendEmail: a provider error body echoing the recipient address is never logged', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: `Invalid recipient ${SUBMITTED_EMAIL}` }), { status: 422 }));
    const { sendResendEmail } = await import('@/lib/email');
    await sendResendEmail({
      apiKey: 'key',
      to: SUBMITTED_EMAIL,
      subject: 'Test',
      text: 'body',
      replyTo: SUBMITTED_EMAIL,
      failureMessage: 'failed',
    });
    expect(errorSpy).toHaveBeenCalled();
    assertNoLeak();
  });

  it('sendResendEmail: a thrown network error is never logged with its raw message', async () => {
    fetchMock.mockRejectedValue(new Error(`send failed for ${SUBMITTED_EMAIL}`));
    const { sendResendEmail } = await import('@/lib/email');
    await sendResendEmail({
      apiKey: 'key',
      to: SUBMITTED_EMAIL,
      subject: 'Test',
      text: 'body',
      replyTo: SUBMITTED_EMAIL,
      failureMessage: 'failed',
    });
    expect(errorSpy).toHaveBeenCalled();
    assertNoLeak();
  });
});
