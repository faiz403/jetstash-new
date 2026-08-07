import { NextRequest, NextResponse } from 'next/server';
import { isQuoteTripType, isQuoteRegion, TRIP_TYPE_OPTIONS, QUOTE_REGION_OPTIONS } from '@/lib/quote-request-options';
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
 * Quote-request endpoint — any trip type (solo, couple, family, group,
 * business, student, Umrah or other).
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

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const MAX_TRIP_TYPE_OTHER_LENGTH = 150;
const MAX_TRAVELLER_COUNT_LENGTH = 40;
const MAX_TRAVEL_WINDOW_LENGTH = 100;
const MAX_BUDGET_NOTE_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 3000;

function tripTypeLabel(value: string): string {
  return TRIP_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function regionLabel(value: string): string {
  return QUOTE_REGION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`quote-request:${getClientIdentifier(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (isHoneypotTriggered(body?.[HONEYPOT_FIELD_NAME])) {
    return NextResponse.json({ success: true });
  }

  const { name, email, phone, tripType, tripTypeOther, region, travellerCount, travelWindow, budgetNote, message } =
    body ?? {};

  const fieldChecks: { value: unknown; opts: { required: boolean; maxLength: number; fieldName: string } }[] = [
    { value: name, opts: { required: true, maxLength: MAX_NAME_LENGTH, fieldName: 'Name' } },
    { value: phone, opts: { required: false, maxLength: MAX_PHONE_LENGTH, fieldName: 'Phone' } },
    {
      value: tripTypeOther,
      opts: { required: false, maxLength: MAX_TRIP_TYPE_OTHER_LENGTH, fieldName: 'Trip type detail' },
    },
    {
      value: travellerCount,
      opts: { required: false, maxLength: MAX_TRAVELLER_COUNT_LENGTH, fieldName: 'Number of travellers' },
    },
    { value: travelWindow, opts: { required: false, maxLength: MAX_TRAVEL_WINDOW_LENGTH, fieldName: 'Travel dates' } },
    { value: budgetNote, opts: { required: false, maxLength: MAX_BUDGET_NOTE_LENGTH, fieldName: 'Budget note' } },
    { value: message, opts: { required: false, maxLength: MAX_MESSAGE_LENGTH, fieldName: 'Message' } },
  ];
  for (const { value, opts } of fieldChecks) {
    const error = validateTextField(value, opts);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
  }

  if (!email || !tripType || !region) {
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
    // Never log the submitted name or email — tripType/region are internal
    // classification values, not user data, so they're safe to keep.
    console.warn('Quote request received but no email provider is configured', { tripType, region });
    return NextResponse.json(
      { error: `Quote requests are not yet fully configured. Please email ${siteConfig.contactEmail} directly.` },
      { status: 503 }
    );
  }

  // A free-text elaboration only ever matters for the 'other' escape hatch —
  // sent for every other trip type, it would just be stale leftover state.
  const tripTypeDetail =
    tripType === 'other' && typeof tripTypeOther === 'string' && tripTypeOther.trim()
      ? ` (${tripTypeOther.trim()})`
      : '';

  const lines = [
    `Trip type: ${tripTypeLabel(tripType)}${tripTypeDetail}`,
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
    to: process.env.CONTACT_TO_EMAIL ?? siteConfig.contactEmail,
    subject: `New quote request: ${tripTypeLabel(tripType)} (${regionLabel(region)})`,
    text: lines.join('\n'),
    replyTo: email,
    failureMessage: 'Could not send your quote request. Please try again.',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
