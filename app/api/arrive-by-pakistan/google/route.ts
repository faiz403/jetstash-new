import { NextRequest, NextResponse } from 'next/server';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { cleanInput } from '@/lib/arrive-by-pakistan/clean-input';
import { checkArriveByRateLimit } from '@/lib/arrive-by-shared/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Public Pakistan Arrive By beta endpoint. Reuses the exact same
 * computePakistanJourney engine and cleanInput validation as the founder-
 * only route (lib/arrive-by-pakistan is the only place any of that logic
 * lives) — this file only adds what a public, unauthenticated surface
 * needs: rate limiting.
 *
 * checkArriveByRateLimit (lib/arrive-by-shared/rate-limit.ts) shares one
 * budget across every Arrive By public endpoint, keyed by client only, not
 * per airport — so switching airports never grants a fresh allowance. Same
 * best-effort, in-memory, per-serverless-instance limiter already used by
 * the four public form endpoints — not a distributed WAF, not a hard spend
 * cap. That's a deliberate, disclosed choice for a small beta: it is
 * proven in production for this codebase's other public routes, adds no
 * new infrastructure, and the existing Google budget alert remains the
 * (non-hard) backstop above it. Revisit with stronger, distributed
 * enforcement only if real beta traffic shows this isn't enough.
 */

export async function POST(request: NextRequest) {
  const rate = checkArriveByRateLimit(request);
  if (rate.limited) {
    return NextResponse.json({ error: "You've checked several journeys in a short time. Please wait a moment and try again." }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Live journey lookup is not configured.' }, { status: 503 });
  try {
    const input = cleanInput(await request.json());
    const result = await computePakistanJourney(apiKey, input);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Arrive By could not check this journey.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
