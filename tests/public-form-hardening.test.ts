import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';

/**
 * Abuse-protection hardening for the four public submission endpoints
 * (contact, quote-request, subscribe/newsletter, route-watch) — server-side
 * field limits/type checks, a basic in-memory rate limiter, and a shared
 * honeypot field. See lib/form-security.ts for the shared utilities and
 * tests/form-security.test.ts for their direct unit coverage.
 *
 * The route handlers are plain exported async functions, so — unlike the
 * 'use client' form components (asserted below via source scan, following
 * this repo's existing convention in e.g. quote-request-trip-type.test.ts) —
 * they can be imported and invoked directly with a real NextRequest, same
 * pattern as tests/fare-reminder-cron-security.test.ts.
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

import { POST as contactPOST } from '@/app/api/contact/route';
import { POST as quoteRequestPOST } from '@/app/api/quote-request/route';
import { POST as subscribePOST } from '@/app/api/subscribe/route';
import { POST as routeWatchPOST } from '@/app/api/route-watch/route';
import { HONEYPOT_FIELD_NAME } from '@/lib/form-security';

const ORIGINAL_ENV = { ...process.env };

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

function jsonRequest(url: string, body: unknown, ip: string) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('API route hardening', () => {
  beforeEach(() => {
    mocks.sendResendEmail.mockReset();
    mocks.upsertBrevoContact.mockReset();
    mocks.getBrevoContact.mockReset();
    mocks.sendResendEmail.mockResolvedValue({ ok: true });
    mocks.upsertBrevoContact.mockResolvedValue({ ok: true });
    mocks.getBrevoContact.mockResolvedValue(null);
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.CONTACT_TO_EMAIL = 'operations@example.test';
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_LIST_ID = '42';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  describe('contact', () => {
    const url = 'https://jetstash.test/api/contact';
    const valid = { name: 'Amina', email: 'amina@example.test', message: 'Hello there, quick question.' };

    it('a valid submission reaches the mocked provider and returns the existing success shape', async () => {
      const res = await contactPOST(jsonRequest(url, valid, freshIp()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mocks.sendResendEmail).toHaveBeenCalledOnce();
    });

    it('rejects an oversized name (over 100 chars) without contacting the provider', async () => {
      const res = await contactPOST(jsonRequest(url, { ...valid, name: 'A'.repeat(101) }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects an oversized message (over 5000 chars) without contacting the provider', async () => {
      const res = await contactPOST(jsonRequest(url, { ...valid, message: 'A'.repeat(5001) }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects an invalid email address', async () => {
      const res = await contactPOST(jsonRequest(url, { ...valid, email: 'not-an-email' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects a name field submitted as an object instead of a string', async () => {
      const res = await contactPOST(jsonRequest(url, { ...valid, name: { first: 'Amina' } }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects a message field submitted as an array instead of a string', async () => {
      const res = await contactPOST(jsonRequest(url, { ...valid, message: ['Hello'] }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('silently accepts a honeypot-triggered submission without contacting the provider', async () => {
      const res = await contactPOST(jsonRequest(url, { ...valid, [HONEYPOT_FIELD_NAME]: 'filled-in-by-a-bot' }, freshIp()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('returns 429 and stops contacting the provider once the rate limit is exceeded', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        const res = await contactPOST(jsonRequest(url, valid, ip));
        expect(res.status).toBe(200);
      }
      mocks.sendResendEmail.mockClear();
      const limited = await contactPOST(jsonRequest(url, valid, ip));
      expect(limited.status).toBe(429);
      const body = await limited.json();
      expect(typeof body.error).toBe('string');
      expect(JSON.stringify(body)).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/); // no IP leaked to the client
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('does not leak provider error details when the provider call itself fails', async () => {
      mocks.sendResendEmail.mockResolvedValueOnce({
        ok: false,
        status: 502,
        message: 'Could not send your message. Please try again.',
      });
      const res = await contactPOST(jsonRequest(url, valid, freshIp()));
      const body = await res.json();
      expect(res.status).toBe(502);
      expect(body).toEqual({ error: 'Could not send your message. Please try again.' });
      expect(JSON.stringify(body)).not.toMatch(/RESEND_API_KEY|api[_-]?key/i);
    });

    it('fails clearly with 503 and no leaked env var names when the provider is not configured', async () => {
      delete process.env.RESEND_API_KEY;
      const res = await contactPOST(jsonRequest(url, valid, freshIp()));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(/RESEND_API_KEY/);
    });
  });

  describe('quote-request', () => {
    const url = 'https://jetstash.test/api/quote-request';
    const valid = { name: 'Amina', email: 'amina@example.test', tripType: 'solo', region: 'pakistan' };

    it('a valid submission reaches the mocked provider and returns the existing success shape', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, valid, freshIp()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mocks.sendResendEmail).toHaveBeenCalledOnce();
    });

    it('empty optional fields (phone, traveller count, message) still succeed', async () => {
      const res = await quoteRequestPOST(
        jsonRequest(url, { ...valid, phone: '', travellerCount: '', travelWindow: '', budgetNote: '', message: '' }, freshIp())
      );
      expect(res.status).toBe(200);
    });

    it('required fields (name, email, trip type, region) remain required', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, { name: 'Amina', email: 'amina@example.test' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects an oversized phone number (over 30 chars)', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, { ...valid, phone: '1'.repeat(31) }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects an unsupported trip type value', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, { ...valid, tripType: 'safari' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects an unsupported region value', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, { ...valid, region: 'antarctica' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('rejects travellerCount submitted as an object instead of a string', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, { ...valid, travellerCount: { count: 2 } }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('silently accepts a honeypot-triggered submission without contacting the provider', async () => {
      const res = await quoteRequestPOST(jsonRequest(url, { ...valid, [HONEYPOT_FIELD_NAME]: 'filled-in' }, freshIp()));
      expect(res.status).toBe(200);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });

    it('returns 429 and stops contacting the provider once the rate limit is exceeded', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        await quoteRequestPOST(jsonRequest(url, valid, ip));
      }
      mocks.sendResendEmail.mockClear();
      const limited = await quoteRequestPOST(jsonRequest(url, valid, ip));
      expect(limited.status).toBe(429);
      expect(mocks.sendResendEmail).not.toHaveBeenCalled();
    });
  });

  describe('subscribe (newsletter)', () => {
    const url = 'https://jetstash.test/api/subscribe';

    it('a valid submission reaches the mocked provider and returns the existing success shape', async () => {
      const res = await subscribePOST(jsonRequest(url, { email: 'amina@example.test' }, freshIp()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mocks.upsertBrevoContact).toHaveBeenCalledOnce();
    });

    it('empty optional fields (no nearestAirport/interest) still succeed', async () => {
      const res = await subscribePOST(jsonRequest(url, { email: 'amina@example.test' }, freshIp()));
      expect(res.status).toBe(200);
    });

    it('rejects an invalid email address', async () => {
      const res = await subscribePOST(jsonRequest(url, { email: 'not-an-email' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('rejects an unsupported interest value', async () => {
      const res = await subscribePOST(jsonRequest(url, { email: 'amina@example.test', interest: 'skiing' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('rejects an unrecognised airport selection', async () => {
      const res = await subscribePOST(
        jsonRequest(url, { email: 'amina@example.test', nearestAirport: 'nowhereville' }, freshIp())
      );
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('rejects nearestAirport submitted as an array instead of a string', async () => {
      const res = await subscribePOST(
        jsonRequest(url, { email: 'amina@example.test', nearestAirport: ['manchester'] }, freshIp())
      );
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('silently accepts a honeypot-triggered submission without contacting the provider', async () => {
      const res = await subscribePOST(
        jsonRequest(url, { email: 'bot@example.test', [HONEYPOT_FIELD_NAME]: 'filled-in' }, freshIp())
      );
      expect(res.status).toBe(200);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('returns 429 and stops contacting the provider once the rate limit is exceeded', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        await subscribePOST(jsonRequest(url, { email: 'amina@example.test' }, ip));
      }
      mocks.upsertBrevoContact.mockClear();
      const limited = await subscribePOST(jsonRequest(url, { email: 'amina@example.test' }, ip));
      expect(limited.status).toBe(429);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });
  });

  describe('route-watch', () => {
    const url = 'https://jetstash.test/api/route-watch';
    const valid = { email: 'amina@example.test', airportSlug: 'manchester', destinationSlug: 'mumbai' };

    it('a valid submission reaches the mocked provider and returns the existing success shape', async () => {
      const res = await routeWatchPOST(jsonRequest(url, valid, freshIp()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mocks.upsertBrevoContact).toHaveBeenCalledOnce();
    });

    it('rejects an unrecognised airport slug', async () => {
      const res = await routeWatchPOST(jsonRequest(url, { ...valid, airportSlug: 'nowhereville' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('rejects an unrecognised destination slug', async () => {
      const res = await routeWatchPOST(jsonRequest(url, { ...valid, destinationSlug: 'nowhereville' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('rejects an unsupported intent value', async () => {
      const res = await routeWatchPOST(jsonRequest(url, { ...valid, intent: 'shopping-spree' }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('rejects airportSlug submitted as an object instead of a string', async () => {
      const res = await routeWatchPOST(jsonRequest(url, { ...valid, airportSlug: { slug: 'manchester' } }, freshIp()));
      expect(res.status).toBe(400);
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('silently accepts a honeypot-triggered submission without contacting Brevo at all — not even the read lookup', async () => {
      const res = await routeWatchPOST(jsonRequest(url, { ...valid, [HONEYPOT_FIELD_NAME]: 'filled-in' }, freshIp()));
      expect(res.status).toBe(200);
      expect(mocks.getBrevoContact).not.toHaveBeenCalled();
      expect(mocks.upsertBrevoContact).not.toHaveBeenCalled();
    });

    it('returns 429 and stops contacting Brevo (read or write) once the rate limit is exceeded', async () => {
      const ip = freshIp();
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
});

describe('client form wiring — honeypot and maxLength (source-scan, matching this repo\'s convention for \'use client\' components)', () => {
  const contactFormSrc = readFileSync(join(process.cwd(), 'components/sections/contact-form.tsx'), 'utf8');
  const quoteRequestFormSrc = readFileSync(join(process.cwd(), 'components/sections/quote-request-form.tsx'), 'utf8');
  const newsletterSrc = readFileSync(join(process.cwd(), 'components/sections/newsletter-section.tsx'), 'utf8');
  const routeWatchFormSrc = readFileSync(join(process.cwd(), 'components/route/route-watch-form.tsx'), 'utf8');
  const honeypotFieldSrc = readFileSync(join(process.cwd(), 'components/forms/honeypot-field.tsx'), 'utf8');

  const forms = [
    { name: 'contact', src: contactFormSrc },
    { name: 'quote-request', src: quoteRequestFormSrc },
    { name: 'newsletter', src: newsletterSrc },
    { name: 'route-watch', src: routeWatchFormSrc },
  ];

  it('every form imports and renders the shared HoneypotField', () => {
    for (const { name, src } of forms) {
      expect(src, `${name} imports HoneypotField`).toMatch(/import\s*\{\s*HoneypotField\s*\}\s*from\s*'@\/components\/forms\/honeypot-field'/);
      expect(src, `${name} renders <HoneypotField`).toMatch(/<HoneypotField/);
    }
  });

  it('every form submits the honeypot value under the shared HONEYPOT_FIELD_NAME key', () => {
    for (const { name, src } of forms) {
      expect(src, `${name} imports HONEYPOT_FIELD_NAME`).toMatch(/HONEYPOT_FIELD_NAME/);
      expect(src, `${name} includes it in the submitted body`).toMatch(/\[HONEYPOT_FIELD_NAME\]:\s*honeypot/);
    }
  });

  it('the shared honeypot field is excluded from the tab order and hidden from assistive tech', () => {
    expect(honeypotFieldSrc).toMatch(/aria-hidden="true"/);
    expect(honeypotFieldSrc).toMatch(/tabIndex=\{-1\}/);
    expect(honeypotFieldSrc).toMatch(/autoComplete="off"/);
    // Off-screen positioning, not the `hidden` utility class (Tailwind's
    // display:none) or an inline display:none style — some simple bots skip
    // inputs hidden that way. `overflow-hidden` is a different, unrelated
    // utility and must not trip this check.
    const wrapperClassName = honeypotFieldSrc.match(/<div aria-hidden="true" className="([^"]*)"/)?.[1] ?? '';
    const classTokens = wrapperClassName.split(/\s+/);
    expect(classTokens).toContain('absolute');
    expect(classTokens).not.toContain('hidden');
    expect(honeypotFieldSrc).not.toMatch(/style=\{\{[^}]*display:\s*['"]?none/);
  });

  it('contact form: name, email and message carry maxLength attributes matching the server limits (100 / 254 / 5000)', () => {
    expect(contactFormSrc).toMatch(/MAX_NAME_LENGTH = 100/);
    expect(contactFormSrc).toMatch(/MAX_EMAIL_LENGTH = 254/);
    expect(contactFormSrc).toMatch(/MAX_MESSAGE_LENGTH = 5000/);
    expect(contactFormSrc).toMatch(/maxLength=\{MAX_NAME_LENGTH\}/);
    expect(contactFormSrc).toMatch(/maxLength=\{MAX_EMAIL_LENGTH\}/);
    expect(contactFormSrc).toMatch(/maxLength=\{MAX_MESSAGE_LENGTH\}/);
  });

  it('quote-request form: every free-text field carries a maxLength attribute matching its server limit', () => {
    const expectedConstants = [
      'MAX_NAME_LENGTH = 100',
      'MAX_EMAIL_LENGTH = 254',
      'MAX_PHONE_LENGTH = 30',
      'MAX_TRIP_TYPE_OTHER_LENGTH = 150',
      'MAX_TRAVELLER_COUNT_LENGTH = 40',
      'MAX_TRAVEL_WINDOW_LENGTH = 100',
      'MAX_BUDGET_NOTE_LENGTH = 150',
      'MAX_MESSAGE_LENGTH = 3000',
    ];
    for (const line of expectedConstants) {
      expect(quoteRequestFormSrc).toContain(line);
    }
    for (const propUsage of [
      'maxLength={MAX_NAME_LENGTH}',
      'maxLength={MAX_EMAIL_LENGTH}',
      'maxLength={MAX_PHONE_LENGTH}',
      'maxLength={MAX_TRIP_TYPE_OTHER_LENGTH}',
      'maxLength={MAX_TRAVELLER_COUNT_LENGTH}',
      'maxLength={MAX_TRAVEL_WINDOW_LENGTH}',
      'maxLength={MAX_BUDGET_NOTE_LENGTH}',
      'maxLength={MAX_MESSAGE_LENGTH}',
    ]) {
      expect(quoteRequestFormSrc).toContain(propUsage);
    }
  });

  it('newsletter form: the email input carries a maxLength attribute', () => {
    expect(newsletterSrc).toMatch(/MAX_EMAIL_LENGTH = 254/);
    expect(newsletterSrc).toMatch(/maxLength=\{MAX_EMAIL_LENGTH\}/);
  });

  it('Route Watch form: the email input carries a maxLength attribute', () => {
    expect(routeWatchFormSrc).toMatch(/MAX_EMAIL_LENGTH = 254/);
    expect(routeWatchFormSrc).toMatch(/maxLength=\{MAX_EMAIL_LENGTH\}/);
  });

  it('no personal Gmail address was reintroduced by this change', () => {
    for (const { src } of [...forms, { name: 'honeypot', src: honeypotFieldSrc }]) {
      expect(src).not.toMatch(/@gmail\.com/);
    }
  });
});

describe('no live external network call occurs anywhere in this test file', () => {
  it('the only network-calling functions (sendResendEmail, upsertBrevoContact, getBrevoContact) are mocked, never the real implementation', () => {
    expect(vi.isMockFunction(mocks.sendResendEmail)).toBe(true);
    expect(vi.isMockFunction(mocks.upsertBrevoContact)).toBe(true);
    expect(vi.isMockFunction(mocks.getBrevoContact)).toBe(true);
  });
});
