import { NextRequest, NextResponse } from 'next/server';

/**
 * Newsletter subscribe endpoint.
 *
 * This route validates the email and forwards it to your email provider.
 * Wire up a real provider before launch — recommended options:
 *
 *   1. Resend (resend.com) — simplest for a Vercel project, generous free tier
 *   2. Brevo (brevo.com) — free up to 300 emails/day, has list management
 *   3. Mailchimp — widely used, free up to 500 contacts
 *
 * Add your provider's API key as a Vercel environment variable
 * (Project Settings → Environment Variables) — never hardcode it in source.
 *
 * Example for Brevo (uncomment and set BREVO_API_KEY + BREVO_LIST_ID in Vercel):
 *
 * const res = await fetch('https://api.brevo.com/v3/contacts', {
 *   method: 'POST',
 *   headers: {
 *     'api-key': process.env.BREVO_API_KEY!,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({ email, listIds: [Number(process.env.BREVO_LIST_ID)] }),
 * });
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  if (!apiKey || !listId) {
    // No provider configured yet — fail clearly rather than pretending to succeed.
    console.warn('Newsletter signup received but no email provider is configured:', email);
    return NextResponse.json(
      { error: 'Newsletter sign-up is not yet configured. Please try again later or contact us directly.' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, listIds: [Number(listId)], updateEnabled: true }),
    });

    if (!res.ok && res.status !== 400) {
      // 400 from Brevo often means "contact already exists" — treat as success.
      const text = await res.text();
      console.error('Brevo error:', res.status, text);
      return NextResponse.json({ error: 'Could not complete sign-up. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Newsletter signup failed:', err);
    return NextResponse.json({ error: 'Could not complete sign-up. Please try again.' }, { status: 500 });
  }
}
