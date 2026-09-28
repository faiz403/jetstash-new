import { NextRequest, NextResponse } from 'next/server';
import { cleanInput } from '@/lib/arrive-by-shared/manchester-clean-input';
import { computeManchesterJourney } from '@/lib/arrive-by-shared/manchester-journey';
import { getAirportProfile, POLICY_PENDING } from '@/lib/arrive-by-shared/airport-registry';

export const dynamic = 'force-dynamic';

function founderEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

/** Founder-only Manchester journey check. Same engine as the public route (app/api/arrive-by-manchester/google/route.ts) via lib/arrive-by-shared/manchester-journey.ts -- this file only adds the founder gate, no rate limit (not public). */
export async function POST(request: NextRequest) {
  if (!founderEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Live journey lookup is not configured.' }, { status: 503 });
  const profile = getAirportProfile('MAN');
  if (!profile) return NextResponse.json({ error: 'Manchester is not configured.' }, { status: 503 });
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
