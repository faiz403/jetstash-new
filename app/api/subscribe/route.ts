import { NextRequest, NextResponse } from 'next/server';

/**
 * Newsletter / Travel Club subscribe endpoint.
 *
 * IMPORTANT — what this actually is: a preference-tagged mailing list, not
 * an automated price-drop detector. JetStash has no live fare-monitoring
 * backend. "Fare alerts" in practice means: when the site owner manually
 * updates data/deals.ts with a genuinely better fare on a route, contacts
 * tagged with that region/airport get emailed. Keep all UI copy honest
 * about this — never imply real-time or automated price tracking.
 *
 * This route validates the email and forwards it, with two optional
 * preference fields, to your email provider. Both fields exist so Travel
 * Club emails can genuinely be filtered by what the subscriber said they
 * care about — this is what makes the Travel Club page's promise true
 * rather than aspirational copy.
 *
 * Wire up a real provider before launch — recommended options:
 *
 *   1. Resend (resend.com) — simplest for a Vercel project, generous free tier
 *   2. Brevo (brevo.com) — free up to 300 emails/day, has list management
 *      AND supports custom contact attributes (used below for both fields).
 *   3. Mailchimp — widely used, free up to 500 contacts, supports merge fields.
 *
 * Add your provider's API key as a Vercel environment variable
 * (Project Settings → Environment Variables) — never hardcode it in source.
 *
 * If using Brevo: create two custom contact attributes —
 * NEAREST_AIRPORT and TRAVEL_INTEREST (Contacts → Settings → Contact
 * Attributes → Add attribute, type "Text") — before this will populate
 * correctly, otherwise Brevo silently drops fields it doesn't recognise.
 */

const VALID_AIRPORTS = [
  'manchester',
  'birmingham',
  'london-heathrow',
  'london-gatwick',
  'leeds-bradford',
  'liverpool',
  'newcastle',
  'glasgow',
  'edinburgh',
  'bristol',
  'birmingham-east-midlands',
];

const VALID_INTERESTS = ['pakistan', 'india', 'gulf', 'umrah', 'business-class'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const nearestAirport = typeof body?.nearestAirport === 'string' ? body.nearestAirport : undefined;
  const interest = typeof body?.interest === 'string' ? body.interest : undefined;

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  if (nearestAirport && !VALID_AIRPORTS.includes(nearestAirport)) {
    return NextResponse.json({ error: 'Unrecognised airport selection.' }, { status: 400 });
  }

  if (interest && !VALID_INTERESTS.includes(interest)) {
    return NextResponse.json({ error: 'Unrecognised interest selection.' }, { status: 400 });
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

  const attributes: Record<string, string> = {};
  if (nearestAirport) attributes.NEAREST_AIRPORT = nearestAirport;
  if (interest) attributes.TRAVEL_INTEREST = interest;

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        listIds: [Number(listId)],
        updateEnabled: true,
        ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
      }),
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
