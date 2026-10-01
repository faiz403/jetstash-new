import { NextRequest, NextResponse } from 'next/server';
import { cleanRoadInput } from '@/lib/arrive-by-shared/clean-road-input';
import { computeRoadJourney } from '@/lib/arrive-by-shared/road-journey';
import { getAirportCapability, getEstimateLabel, resolveAirportProfile } from '@/lib/arrive-by-shared/airport-capability';
import { resolveRoutingOrigin, POLICY_PENDING } from '@/lib/arrive-by-shared/airport-registry';
import { checkArriveByRateLimit } from '@/lib/arrive-by-shared/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Generic worldwide road-first Arrive By endpoint -- one route for every
 * ROAD_PICKUP_FIRST airport, not one per country.
 *
 * The client sends an airport CODE and the journey inputs, nothing else is
 * read. Everything about the airport is resolved here, server-side:
 *
 *   code -> override profile OR catalogue-derived generic profile
 *        -> capability gate (only road_supported / special_profile may run)
 *        -> trusted routing origin (catalogue coordinates, or a validated override)
 *        -> destination policy (expectedCountryCodes / regionBias)
 *        -> shared road engine (lib/arrive-by-shared/road-journey.ts)
 *
 * Client-supplied coordinates, timezones or country codes are never read
 * (cleanRoadInput only copies the journey fields), so they cannot steer
 * the origin, the clock or the country gate. A catalogued-only,
 * route_testable or blocked airport fails closed with 404 -- and, like an
 * unknown code, without revealing which, and before any Google call.
 *
 * Shares the product-wide rate-limit budget (arrive-by:<client>, 5/60s)
 * with every other public Arrive By endpoint. Airport search is local and
 * never reaches this route, so it does not consume that budget. Same
 * best-effort, in-memory limiter as the other public routes -- not a
 * distributed WAF or a hard spend cap; revisit before any indexing or
 * promotion.
 */
const AIRPORT_UNAVAILABLE = 'Arrive By can\'t calculate this airport journey yet.';

export async function POST(request: NextRequest) {
  const rate = checkArriveByRateLimit(request);
  if (rate.limited) {
    return NextResponse.json({ error: "You've checked several journeys in a short time. Please wait a moment and try again." }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Live journey lookup is not configured.' }, { status: 503 });

  let input;
  try {
    // Shape check only (three letters); the real gate is the capability check below.
    input = cleanRoadInput(await request.json(), (code) => /^[A-Za-z]{3}$/.test(code));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Arrive By could not check this journey.';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const code = input.airportCode.toUpperCase();
  const capability = getAirportCapability(code);
  const profile = resolveAirportProfile(code);
  if (!capability?.journeyEligible || !profile || profile.journeyEngine !== 'ROAD_PICKUP_FIRST' || profile.destinationRules.expectedCountryCodes === POLICY_PENDING) {
    return NextResponse.json({ error: AIRPORT_UNAVAILABLE }, { status: 404 });
  }

  try {
    const result = await computeRoadJourney(
      apiKey,
      { code: profile.code, displayName: profile.displayName, timeZone: profile.timeZone, origin: resolveRoutingOrigin(profile) },
      { ...input, airportCode: profile.code },
      { expectedCountryCodes: profile.destinationRules.expectedCountryCodes, regionBias: profile.destinationRules.regionBias },
    );
    return NextResponse.json({ ...result, estimateLabel: getEstimateLabel(profile) });
  } catch (error) {
    // Only our own validation message is passed through; anything else (a malformed
    // Google payload, say) becomes a generic failure -- never a raw upstream error.
    const message = error instanceof Error && error.message === 'Enter a valid date and time.' ? error.message : 'Arrive By could not check this journey.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
