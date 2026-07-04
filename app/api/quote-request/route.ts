import { NextRequest, NextResponse } from 'next/server';
import { isQuoteTripType, isQuoteRegion, TRIP_TYPE_OPTIONS, QUOTE_REGION_OPTIONS } from '@/lib/quote-request-options';
import { isValidEmail, sendResendEmail } from '@/lib/email';

/**
 * Umrah / family trip / group travel quote-request endpoint.
 *
 * Same provider as /api/contact — Resend (resend.com). Reuses RESEND_API_KEY
 * and CONTACT_TO_EMAIL rather than requiring separate environment variables.
 * This is a lead-capture form, not a live marketplace: submissions are
 * emailed to the address below for manual follow-up (by JetStash or a
 * partner agent), matching the same "curated, not automated" model already
 * used for Travel Club. Fails clearly with a 503 if no provider is
 * configured, rather than pretending to succeed — same rule as every other
 * form on this site.
 */

function tripTypeLabel(value: string): string {
  return TRIP_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function regionLabel(value: string): string {
  return QUOTE_REGION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, email, phone, tripType, region, travellerCount, travelWindow, budgetNote, message } = body ?? {};

  if (!name || !email || !tripType || !region) {
    return NextResponse.json(
      { error: 'Name, email, trip type and region are all required.' },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (!isQuoteTripType(tripType)) {
    return NextResponse.json({ error: 'Unrecognised trip type.' }, { status: 400 });
  }
  if (!isQuoteRegion(region)) {
    return NextResponse.json({ error: 'Unrecognised region.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Quote request received but no email provider is configured:', { name, email, tripType, region });
    return NextResponse.json(
      { error: 'Quote requests are not yet fully configured. Please email hello@jetstash.co.uk directly.' },
      { status: 503 }
    );
  }

  const lines = [
    `Trip type: ${tripTypeLabel(tripType)}`,
    `Region: ${regionLabel(region)}`,
    phone ? `Phone: ${phone}` : null,
    travellerCount ? `Number of travellers: ${travellerCount}` : null,
    travelWindow ? `Approximate travel dates: ${travelWindow}` : null,
    budgetNote ? `Budget note: ${budgetNote}` : null,
    '',
    `From: ${name} (${email})`,
    message ? `\nAdditional details:\n${message}` : null,
  ].filter((line): line is string => line !== null);

  const result = await sendResendEmail({
    apiKey,
    to: process.env.CONTACT_TO_EMAIL ?? 'hello@jetstash.co.uk',
    subject: `New quote request: ${tripTypeLabel(tripType)} — ${regionLabel(region)}`,
    text: lines.join('\n'),
    replyTo: email,
    failureMessage: 'Could not send your quote request. Please try again.',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
