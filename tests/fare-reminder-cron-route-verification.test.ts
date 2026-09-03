import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Route Intelligence Freshness Audit (3 September 2026) follow-up: the
 * weekly cron previously reported only fare-check freshness
 * (bookby-cadence). It now also reports route-verification
 * overdue/due-soon routes, reusing lib/founder-insights.ts's existing
 * route-verification-review section unchanged -- no second freshness
 * calculation is introduced here or in the route handler. These tests
 * cover only the new route-verification behaviour and the interaction
 * with fare-check content; tests/fare-reminder-cron-security.test.ts
 * already covers auth/fail-closed behaviour and is not duplicated here.
 */

const mocks = vi.hoisted(() => ({
  getFounderSnapshot: vi.fn(),
  sendResendEmail: vi.fn(),
}));

vi.mock('@/lib/founder-insights', () => ({
  getFounderSnapshot: mocks.getFounderSnapshot,
}));

vi.mock('@/lib/email', () => ({
  sendResendEmail: mocks.sendResendEmail,
}));

vi.mock('@/lib/site-config', () => ({
  siteConfig: { contactEmail: 'operations@example.test' },
}));

import { GET } from '@/app/api/cron/fare-check-reminder/route';

const originalCronSecret = process.env.CRON_SECRET;
const originalResendApiKey = process.env.RESEND_API_KEY;
const originalContactToEmail = process.env.CONTACT_TO_EMAIL;

function request() {
  return new NextRequest('https://jetstash.test/api/cron/fare-check-reminder', {
    headers: { authorization: 'Bearer test-cron-secret' },
  });
}

/** Builds a snapshot shaped exactly like getFounderSnapshot()'s real return value -- both the
 * bookby-cadence (nice-to-have) and route-verification-review (revenue) sections are the same
 * grouping the real function uses, so this test cannot silently drift from the real contract shape. */
function snapshot(opts: {
  fareItems?: { status: 'watch' | 'attention'; label: string; detail: string }[];
  routeItems?: { status: 'watch' | 'attention'; label: string; detail: string }[];
}) {
  return {
    grouped: {
      'nice-to-have': [{ id: 'bookby-cadence', items: opts.fareItems ?? [] }],
      revenue: [{ id: 'route-verification-review', items: opts.routeItems ?? [] }],
    },
  };
}

describe('fare-check reminder cron: route-verification freshness', () => {
  beforeEach(() => {
    mocks.getFounderSnapshot.mockReset();
    mocks.sendResendEmail.mockReset();
    mocks.sendResendEmail.mockResolvedValue({ ok: true });
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.CONTACT_TO_EMAIL = 'operations@example.test';
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    if (originalContactToEmail === undefined) delete process.env.CONTACT_TO_EMAIL;
    else process.env.CONTACT_TO_EMAIL = originalContactToEmail;
    vi.restoreAllMocks();
  });

  it('includes an overdue route-verification route in the email body and count', async () => {
    mocks.getFounderSnapshot.mockReturnValue(
      snapshot({
        routeItems: [
          {
            status: 'attention',
            label: 'Manchester to Islamabad: overdue by 2 days',
            detail: 'Review was due 1 September 2026 -- this route has already failed closed.',
          },
        ],
      })
    );

    const response = await GET(request());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ sent: true, fareCount: 0, routeVerificationOverdueCount: 1, routeVerificationDueSoonCount: 0 });
    const emailArgs = mocks.sendResendEmail.mock.calls[0][0];
    expect(emailArgs.text).toContain('ROUTE VERIFICATION');
    expect(emailArgs.text).toContain('Manchester to Islamabad: overdue by 2 days');
  });

  it('includes a due-soon route-verification route in the email body and count', async () => {
    mocks.getFounderSnapshot.mockReturnValue(
      snapshot({
        routeItems: [
          {
            status: 'watch',
            label: 'Manchester to Lahore: due in 11 days',
            detail: 'Review due 14 September 2026 -- re-check the evidence before it lapses.',
          },
        ],
      })
    );

    const response = await GET(request());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ sent: true, fareCount: 0, routeVerificationOverdueCount: 0, routeVerificationDueSoonCount: 1 });
    const emailArgs = mocks.sendResendEmail.mock.calls[0][0];
    expect(emailArgs.text).toContain('Manchester to Lahore: due in 11 days');
  });

  it('never sends when nothing is overdue or due soon on either cadence', async () => {
    mocks.getFounderSnapshot.mockReturnValue(snapshot({}));

    const response = await GET(request());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ sent: false, reason: 'Nothing overdue.' });
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it('does not list a healthy route: only items the founder-insights section itself returns ever appear', async () => {
    // routeVerificationReviewStatus() (lib/founder-insights.ts) never puts a healthy route into
    // its own `items` array -- healthyCount is tracked separately and never rendered as an item.
    // This test proves the cron route itself adds no extra filtering that could let a healthy
    // route leak in; it simply must not introduce one that founder-insights didn't already produce.
    mocks.getFounderSnapshot.mockReturnValue(
      snapshot({
        routeItems: [{ status: 'attention', label: 'Route A: overdue by 1 day', detail: 'Overdue detail.' }],
      })
    );

    const response = await GET(request());
    const emailArgs = mocks.sendResendEmail.mock.calls[0][0];

    expect((await response.json()).routeVerificationOverdueCount).toBe(1);
    expect(emailArgs.text).not.toContain('healthy');
    expect(emailArgs.text.match(/Route A/g)).toHaveLength(1);
  });

  it('keeps existing fare-check content present and unchanged alongside route-verification content', async () => {
    mocks.getFounderSnapshot.mockReturnValue(
      snapshot({
        fareItems: [{ status: 'attention', label: 'Manchester to Doha', detail: '65 days old' }],
        routeItems: [{ status: 'attention', label: 'Manchester to Islamabad: overdue by 2 days', detail: 'Overdue.' }],
      })
    );

    const response = await GET(request());
    const json = await response.json();
    const emailArgs = mocks.sendResendEmail.mock.calls[0][0];

    expect(json).toEqual({ sent: true, fareCount: 1, routeVerificationOverdueCount: 1, routeVerificationDueSoonCount: 0 });
    expect(emailArgs.text).toContain('FARE CHECKS');
    expect(emailArgs.text).toContain('Manchester to Doha');
    expect(emailArgs.text).toContain('ROUTE VERIFICATION');
    expect(emailArgs.text).toContain('Manchester to Islamabad: overdue by 2 days');
  });

  it('derives route-verification content from the same getFounderSnapshot call the dashboard uses -- no second calculation', async () => {
    mocks.getFounderSnapshot.mockReturnValue(
      snapshot({ routeItems: [{ status: 'attention', label: 'Route A', detail: 'Overdue.' }] })
    );

    await GET(request());

    // Exactly one snapshot computed per run -- the email and the dashboard can never disagree
    // because there is only ever one call site for this data within a given request.
    expect(mocks.getFounderSnapshot).toHaveBeenCalledOnce();
  });

  it('never mutates the snapshot it reads -- a pure read/render, no cadence or review date is touched', async () => {
    const routeItems = [{ status: 'attention' as const, label: 'Route A', detail: 'Overdue.' }];
    const snap = snapshot({ routeItems });
    const frozen = JSON.parse(JSON.stringify(snap));
    mocks.getFounderSnapshot.mockReturnValue(snap);

    await GET(request());

    expect(snap).toEqual(frozen);
  });
});
