import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail, sendResendEmail } from '@/lib/email';
import { siteConfig } from '@/lib/site-config';
import {
  checkRateLimit,
  getClientIdentifier,
  HONEYPOT_FIELD_NAME,
  isHoneypotTriggered,
  validateTextField,
} from '@/lib/form-security';

/**
 * Contact form endpoint. Sends via Resend (resend.com) — set RESEND_API_KEY
 * and CONTACT_TO_EMAIL in Vercel's environment variables before launch.
 */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 5000;

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`contact:${getClientIdentifier(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (isHoneypotTriggered(body?.[HONEYPOT_FIELD_NAME])) {
    return NextResponse.json({ success: true });
  }

  const { name, email, message } = body ?? {};

  const nameError = validateTextField(name, { required: true, maxLength: MAX_NAME_LENGTH, fieldName: 'Name' });
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }
  const messageError = validateTextField(message, {
    required: true,
    maxLength: MAX_MESSAGE_LENGTH,
    fieldName: 'Message',
  });
  if (messageError) {
    return NextResponse.json({ error: messageError }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Never log the submitted name or email — this only records that the
    // route is unconfigured, not who submitted it.
    console.warn('Contact form submission received but no email provider is configured');
    return NextResponse.json(
      { error: `The contact form is not yet fully configured. Please email ${siteConfig.contactEmail} directly.` },
      { status: 503 }
    );
  }

  const result = await sendResendEmail({
    apiKey,
    to: process.env.CONTACT_TO_EMAIL ?? siteConfig.contactEmail,
    subject: `New contact form message from ${name}`,
    text: `From: ${name} (${email})\n\n${message}`,
    replyTo: email,
    failureMessage: 'Could not send your message. Please try again.',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
