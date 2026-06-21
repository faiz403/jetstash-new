import { NextRequest, NextResponse } from 'next/server';

/**
 * Contact form endpoint.
 *
 * Wire this up to a real provider before launch. The simplest option for a
 * Vercel project is Resend (resend.com) — free tier covers low-volume contact
 * forms easily. Set RESEND_API_KEY and CONTACT_TO_EMAIL in Vercel's
 * environment variables, then uncomment the Resend call below.
 *
 * import { Resend } from 'resend';
 * const resend = new Resend(process.env.RESEND_API_KEY);
 * await resend.emails.send({
 *   from: 'JetStash <forms@jetstash.co.uk>',
 *   to: process.env.CONTACT_TO_EMAIL!,
 *   subject: `New contact form message from ${name}`,
 *   text: message,
 *   replyTo: email,
 * });
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, email, message } = body ?? {};

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email and message are all required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JetStash <forms@jetstash.co.uk>',
        to: process.env.CONTACT_TO_EMAIL ?? 'hello@jetstash.co.uk',
        subject: `New contact form message from ${name}`,
        text: `From: ${name} (${email})\n\n${message}`,
        reply_to: email,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Resend error:', res.status, text);
      return NextResponse.json({ error: 'Could not send your message. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact form failed:', err);
    return NextResponse.json({ error: 'Could not send your message. Please try again.' }, { status: 500 });
  }
}
