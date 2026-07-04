import { NextRequest, NextResponse } from 'next/server';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { isValidEmail, upsertBrevoContact } from '@/lib/email';
import { isFareWatchIntent } from '@/lib/fare-watch-options';

/**
 * Per-route fare-watch signup endpoint.
 *
 * Same provider as /api/subscribe — Brevo (brevo.com), reusing
 * BREVO_API_KEY and BREVO_LIST_ID rather than requiring a separate list.
 * This is the same "curated, not automated" model documented in the
 * README's "Running Travel Club" section, scoped to one specific route
 * instead of a broad region: when data/fare-observations.ts gets a new,
 * meaningfully better observation for a watched route, the contact tagged
 * with that route can be emailed manually.
 *
 * Requires four Brevo custom contact attributes in addition to the
 * existing NEAREST_AIRPORT / TRAVEL_INTEREST ones (Contacts → Settings →
 * Contact Attributes → Add attribute, type "Text") before this will save
 * correctly: WATCH_AIRPORT, WATCH_DESTINATION, WATCH_ROUTE, WATCH_REGION,
 * WATCH_INTENT. Brevo silently drops attributes it doesn't recognise.
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const airportSlug = body?.airportSlug;
  const destinationSlug = body?.destinationSlug;
  const intent = typeof body?.intent === 'string' ? body.intent : undefined;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const airport = typeof airportSlug === 'string' ? getAirportBySlug(airportSlug) : undefined;
  if (!airport) {
    return NextResponse.json({ error: 'Please choose a valid departure airport.' }, { status: 400 });
  }

  const destination = typeof destinationSlug === 'string' ? getDestinationBySlug(destinationSlug) : undefined;
  if (!destination) {
    return NextResponse.json({ error: 'Please choose a valid destination.' }, { status: 400 });
  }

  if (intent && !isFareWatchIntent(intent)) {
    return NextResponse.json({ error: 'Unrecognised intent selection.' }, { status: 400 });
  }

  const matchedRoute = getRouteByAirportAndDestination(airport.slug, destination.slug);

  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  if (!apiKey || !listId) {
    console.warn('Fare-watch signup received but no email provider is configured:', { email, airportSlug, destinationSlug });
    return NextResponse.json(
      { error: 'Fare watching is not yet configured. Please try again later or contact us directly.' },
      { status: 503 }
    );
  }

  const attributes: Record<string, string> = {
    WATCH_AIRPORT: airport.slug,
    WATCH_DESTINATION: destination.slug,
    WATCH_REGION: destination.region,
  };
  if (matchedRoute) attributes.WATCH_ROUTE = matchedRoute.slug;
  if (intent) attributes.WATCH_INTENT = intent;

  const result = await upsertBrevoContact({ apiKey, listId, email, attributes });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true, routeSlug: matchedRoute?.slug ?? null });
}
