import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

function request(authorization?: string) {
  return new NextRequest('https://jetstash.test/api/cron/fare-check-reminder', {
    headers: authorization ? { authorization } : undefined,
  });
}

function configureDueReminder() {
  mocks.getFounderSnapshot.mockReturnValue({
    grouped: {
      'nice-to-have': [
        {
          id: 'bookby-cadence',
          items: [{ status: 'attention', label: 'Manchester to Lahore', detail: '61 days old' }],
        },
      ],
    },
  });
}

describe('fare-check reminder cron authorization', () => {
  beforeEach(() => {
    mocks.getFounderSnapshot.mockReset();
    mocks.sendResendEmail.mockReset();
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.CONTACT_TO_EMAIL = 'operations@example.test';
    configureDueReminder();
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

  it.each([undefined, '', '   '])('fails closed without a usable CRON_SECRET (%j)', async (secret) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    if (secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secret;

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Service unavailable' });
    expect(mocks.getFounderSnapshot).not.toHaveBeenCalled();
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Fare-check reminder cron is not configured: CRON_SECRET is required.');
  });

  it('rejects a missing authorization header without running the job', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getFounderSnapshot).not.toHaveBeenCalled();
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it('rejects an incorrect authorization value without running the job', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';

    const response = await GET(request('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getFounderSnapshot).not.toHaveBeenCalled();
    expect(mocks.sendResendEmail).not.toHaveBeenCalled();
  });

  it('preserves successful reminder behaviour for the correct authorization value', async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    mocks.sendResendEmail.mockResolvedValue({ ok: true });

    const response = await GET(request('Bearer test-cron-secret'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true, count: 1 });
    expect(mocks.getFounderSnapshot).toHaveBeenCalledOnce();
    expect(mocks.sendResendEmail).toHaveBeenCalledOnce();
    expect(mocks.sendResendEmail).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-resend-key',
      to: 'operations@example.test',
    }));
  });
});
