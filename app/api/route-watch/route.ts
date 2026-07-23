import { NextRequest, NextResponse } from 'next/server';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { isValidEmail, upsertBrevoContact, getBrevoContact } from '@/lib/email';
import { isRouteWatchIntent } from '@/lib/route-watch-options';
import { BREVO_ATTRIBUTE_NAMES } from '@/lib/brevo-attributes';
import { MAX_WATCHED_ROUTES } from '@/lib/route-watch-config';

/**
 * Route Watch signup endpoint — stores a subscriber's route preferences in
 * Brevo (same provider/env vars as /api/subscribe) for a person to review
 * and email about later. No automated detection runs here today.
 *
 * One subscription can cover more than one route: WATCH_ROUTE holds a
 * small comma-delimited list (capped at MAX_WATCHED_ROUTES) rather than a
 * single value. Deliberately NOT a new Brevo attribute — reuses the
 * existing, already-provisioned field to avoid the attribute-drift bug
 * described in CLAUDE.md.
 *
 * Requires the same seven Brevo custom contact attributes as
 * /api/subscribe — run `npm run brevo:setup` (lib/brevo-attributes.json)
 * if they're not yet created. Brevo silently drops attributes it doesn't
 * recognise.
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

  if (intent && !isRouteWatchIntent(intent)) {
    return NextResponse.json({ error: 'Unrecognised intent selection.' }, { status: 400 });
  }

  const matchedRoute = getRouteByAirportAndDestination(airport.slug, destination.slug);

  const apiKey = process.env.BREVO_API_KEY;
  const listId = process.env.BREVO_LIST_ID;

  if (!apiKey || !listId) {
    console.warn('Route Watch signup received but no email provider is configured:', { email, airportSlug, destinationSlug });
    return NextResponse.json(
      { error: 'Route Watch is not yet configured. Please try again later or contact us directly.' },
      { status: 503 }
    );
  }

  // Merge into any routes this contact already watches rather than
  // overwriting. A lookup failure (new contact, transient Brevo error) is
  // treated as "nothing to merge with".
  const existing = await getBrevoContact(apiKey, email);
  const existingRoutes = (existing?.attributes[BREVO_ATTRIBUTE_NAMES.WATCH_ROUTE] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const attributes: Record<string, string> = {
    [BREVO_ATTRIBUTE_NAMES.WATCH_AIRPORT]: airport.slug,
    [BREVO_ATTRIBUTE_NAMES.WATCH_DESTINATION]: destination.slug,
    [BREVO_ATTRIBUTE_NAMES.WATCH_REGION]: destination.region,
  };
  if (matchedRoute) {
    const merged = [...existingRoutes.filter((r) => r !== matchedRoute.slug), matchedRoute.slug].slice(
      -MAX_WATCHED_ROUTES
    );
    attributes[BREVO_ATTRIBUTE_NAMES.WATCH_ROUTE] = merged.join(',');
  }
  if (intent) attributes[BREVO_ATTRIBUTE_NAMES.WATCH_INTENT] = intent;

  const result = await upsertBrevoContact({ apiKey, listId, email, attributes });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true, routeSlug: matchedRoute?.slug ?? null });
}
