import { NextRequest, NextResponse } from 'next/server';
import { cleanInput } from '@/lib/arrive-by-shared/manchester-clean-input';
import { computeManchesterJourney } from '@/lib/arrive-by-shared/manchester-journey';
import { getAirportProfile, canEnablePublicly, POLICY_PENDING } from '@/lib/arrive-by-shared/airport-registry';
import { checkArriveByRateLimit } from '@/lib/arrive-by-shared/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Public Manchester Arrive By beta endpoint. Reuses the exact same
 * computeManchesterJourney engine and cleanInput validation as the
 * founder-only route -- lib/arrive-by-shared/manchester-journey.ts is the
 * only place any of that orchestration lives -- this file only adds what a
 * public, unauthenticated surface needs: rate limiting and a registry
 * public-enablement check.
 *
 * checkArriveByRateLimit (lib/arrive-by-shared/rate-limit.ts) shares one
 * budget across every Arrive By public endpoint -- Pakistan and Manchester
 * together -- keyed by client only, not per airport, so switching airports
 * never grants a fresh allowance.
 */
export async function POST(request: NextRequest) {
  const rate = checkArriveByRateLimit(request);
  if (rate.limited) {
    return NextResponse.json({ error: "You've checked several journeys in a short time. Please wait a moment and try again." }, { status: 429 });
  }

  const profile = getAirportProfile('MAN');
  if (!profile || !profile.publiclyEnabled || !canEnablePublicly(profile.validationStatus)) {
    return NextResponse.json({ error: 'Manchester Arrive By is not available.' }, { status: 404 });
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Live journey lookup is not configured.' }, { status: 503 });
  try {
    const input = cleanInput(await request.json());
    const destinationRules = profile.destinationRules.expectedCountryCodes === POLICY_PENDING
      ? {}
      : { expectedCountryCodes: profile.destinationRules.expectedCountryCodes, regionBias: profile.destinationRules.regionBias };
    const result = await computeManchesterJourney(apiKey, input, destinationRules);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Arrive By could not check this journey.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
