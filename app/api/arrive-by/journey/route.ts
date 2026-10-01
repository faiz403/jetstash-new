import { NextRequest, NextResponse } from 'next/server';
import { cleanJourneyInput } from '@/lib/arrive-by-journey/clean-journey-input';
import { createJourneyCallGuard } from '@/lib/arrive-by-journey/internal-access';
import { planFullJourney } from '@/lib/arrive-by-journey/plan';
import { checkPublicJourneyRateLimit } from '@/lib/arrive-by-shared/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Public full journey (start -> departure airport -> flight -> arrival airport
 * -> destination). It spends Google calls only after the shared public limiter
 * and durable monthly guard have accepted a submission.
 *
 * Controls, in order:
 *   1. shared public rate limit: five submissions per client per 60 seconds
 *   2. durable monthly storage must be configured in production or NO Google
 *      call is made (503)
 *   3. one ledger (10 calls for the whole journey) and the monthly
 *      guard (2,000 calls, alerts at 50% / 80%, hard stop at 100%)
 *
 * The API is always LIVE: it never accepts an entered origin duration, and only allow-listed
 * fields are read from the body, so client coordinates, time zones or countries are ignored.
 * Nothing is stored, logged or sent to analytics; the only server log is a monthly-budget
 * alert carrying counts, never any journey detail.
 */

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const rate = await checkPublicJourneyRateLimit(request);
  if (rate.unavailable) {
    return NextResponse.json({ error: "Arrive By can't run live checks right now. Please try again later." }, { status: 503 });
  }
  if (rate.limited) {
    return NextResponse.json({ error: "You've checked several journeys in a short time. Please wait a moment and try again." }, { status: 429 });
  }

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'That request is too large.' }, { status: 413 });

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Live journey lookup is not configured.' }, { status: 503 });

  const { guard, durableConfigured } = createJourneyCallGuard(process.env, {
    onAlert: (alert) => console.warn(`[arrive-by] monthly Google call allowance at ${alert.level}%: ${alert.used}/${alert.limit} (${alert.month})`),
  });
  if (process.env.NODE_ENV === 'production' && !durableConfigured) {
    return NextResponse.json({ error: 'Durable call-budget storage is not configured, so live journey checks are switched off.' }, { status: 503 });
  }

  let input;
  try {
    input = cleanJourneyInput(await request.json());
  } catch (error) {
    // Only our own validation messages reach the client; a malformed body is a generic failure.
    const message = error instanceof Error && /^Enter |^Choose |That .* reference is not valid\.$|^Enter a valid/.test(error.message) ? error.message : 'Enter the journey details.';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  try {
    const plan = await planFullJourney(input, { apiKey, guard, nowIso: new Date().toISOString(), airportMode: 'public', originMode: 'LIVE', transitFirst: 'LIVE', placeNames: 'LIVE' });
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: 'Arrive By could not check this journey.' }, { status: 500 });
  }
}
