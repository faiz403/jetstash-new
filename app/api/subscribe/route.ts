import { NextRequest, NextResponse } from 'next/server';
import { getAirportBySlug } from '@/data/airports';
import { isValidEmail, upsertBrevoContact } from '@/lib/email';
import { isTravelInterest } from '@/lib/travel-club-options';
import { BREVO_ATTRIBUTE_NAMES } from '@/lib/brevo-attributes';
import {
  checkRateLimit,
  getClientIdentifier,
  HONEYPOT_FIELD_NAME,
  isHoneypotTriggered,
  validateTextField,
} from '@/lib/form-security';

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
 * If using Brevo: run `npm run brevo:setup` (see scripts/setup-brevo-attributes.mjs)
 * to create the required custom contact attributes — NEAREST_AIRPORT and
 * TRAVEL_INTEREST, defined in lib/brevo-attributes.ts — before this will
 * populate correctly, otherwise Brevo silently drops fields it doesn't
 * recognise.
 */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_SLUG_LENGTH = 100;

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`subscribe:${getClientIdentifier(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (isHoneypotTriggered(body?.[HONEYPOT_FIELD_NAME])) {
    return NextResponse.json({ success: true });
  }

  const email = body?.email;
  const nearestAirport = body?.nearestAirport;
  const interest = body?.interest;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const nearestAirportError = validateTextField(nearestAirport, {
    required: false,
    maxLength: MAX_SLUG_LENGTH,
    fieldName: 'Nearest airport',
  });
  if (nearestAirportError) {
    return NextResponse.json({ error: nearestAirportError }, { status: 400 });
  }
  const interestError = validateTextField(interest, {
    required: false,
    maxLength: MAX_SLUG_LENGTH,
    fieldName: 'Interest',
  });
  if (interestError) {
    return NextResponse.json({ error: interestError }, { status: 400 });
  }

  // Validate against the same sources the form is rendered from
  // (data/airports.ts and lib/travel-club-options.ts) so form and API
  // can never drift apart when an airport or segment is added.
  if (nearestAirport && !getAirportBySlug(nearestAirport)) {
    return NextResponse.json({ error: 'Unrecognised airport selection.' }, { status: 400 });
  }

  if (interest && !isTravelInterest(interest)) {
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
  if (nearestAirport) attributes[BREVO_ATTRIBUTE_NAMES.NEAREST_AIRPORT] = nearestAirport;
  if (interest) attributes[BREVO_ATTRIBUTE_NAMES.TRAVEL_INTEREST] = interest;

  const result = await upsertBrevoContact({ apiKey, listId, email, attributes });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
