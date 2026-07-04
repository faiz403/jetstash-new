import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail, sendResendEmail } from '@/lib/email';

/**
 * Contact form endpoint. Sends via Resend (resend.com) — set RESEND_API_KEY
 * and CONTACT_TO_EMAIL in Vercel's environment variables before launch.
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, email, message } = body ?? {};

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email and message are all required.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Contact form submission received but no email provider is configured:', { name, email });
    return NextResponse.json(
      { error: 'The contact form is not yet fully configured. Please email hello@jetstash.co.uk directly.' },
      { status: 503 }
    );
  }

  const result = await sendResendEmail({
    apiKey,
    to: process.env.CONTACT_TO_EMAIL ?? 'hello@jetstash.co.uk',
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
