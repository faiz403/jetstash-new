import { NextRequest, NextResponse } from 'next/server';
import { cleanInput } from '@/lib/arrive-by-shared/manchester-clean-input';
import { computeManchesterJourney } from '@/lib/arrive-by-shared/manchester-journey';
import { getAirportProfile, canEnablePublicly, POLICY_PENDING } from '@/lib/arrive-by-shared/airport-registry';
import { checkPublicJourneyRateLimit } from '@/lib/arrive-by-shared/rate-limit';
import { PublicCallBudgetUnavailable, runPublicGoogleCalculation } from '@/lib/arrive-by-shared/public-call-budget';

export const dynamic = 'force-dynamic';

/**
 * Public Manchester Arrive By beta endpoint. Reuses the exact same
 * computeManchesterJourney engine and cleanInput validation as the
 * founder-only route -- lib/arrive-by-shared/manchester-journey.ts is the
 * only place any of that orchestration lives -- this file only adds what a
 * public, unauthenticated surface needs: rate limiting and a registry
 * public-enablement check.
 *
 * The durable calculation limiter and monthly Google allowance are shared
 * with the canonical journey API and every legacy public endpoint. Switching
 * airports or APIs never grants a fresh allowance.
 */
export async function POST(request: NextRequest) {
  const rate = await checkPublicJourneyRateLimit(request);
  if (rate.unavailable) {
    return NextResponse.json({ error: "Arrive By can't run live checks right now. Please try again later." }, { status: 503 });
  }
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
    const result = await runPublicGoogleCalculation((meteredFetch) => computeManchesterJourney(apiKey, input, destinationRules, meteredFetch));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PublicCallBudgetUnavailable) return NextResponse.json({ error: error.message }, { status: 503 });
    const message = error instanceof Error ? error.message : 'Arrive By could not check this journey.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
