import { NextRequest, NextResponse } from 'next/server';
import { getAirportBySlug } from '@/data/airports';
import { getDestinationBySlug } from '@/data/destinations';
import { getRouteByAirportAndDestination } from '@/data/routes';
import { isValidEmail, upsertBrevoContact, getBrevoContact } from '@/lib/email';
import { isRouteWatchIntent } from '@/lib/route-watch-options';
import { BREVO_ATTRIBUTE_NAMES } from '@/lib/brevo-attributes';

/**
 * Route Watch signup endpoint — the subscription surface for the Travel
 * Intelligence Engine (JETSTASH_PRINCIPLES.md §14.2). Same provider as
 * /api/subscribe — Brevo, reusing BREVO_API_KEY and BREVO_LIST_ID.
 *
 * One subscription can cover more than one route: WATCH_ROUTE holds a
 * small comma-delimited list (capped at MAX_WATCHED_ROUTES) rather than a
 * single value. This is deliberately NOT a new Brevo attribute — adding
 * one without a working provisioning path would silently reproduce the
 * exact attribute-drift bug already fixed once this year (see
 * lib/brevo-attributes.json, CLAUDE.md). Repurposing the existing,
 * already-provisioned field needs no new setup.
 *
 * Requires the same seven Brevo custom contact attributes as
 * /api/subscribe — run `npm run brevo:setup` (lib/brevo-attributes.json)
 * if they're not yet created. Brevo silently drops attributes it doesn't
 * recognise.
 */

const MAX_WATCHED_ROUTES = 3;

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

  // Merge the new route into any routes this contact already watches,
  // rather than overwriting — the multi-route model from
  // JETSTASH_PRINCIPLES.md §14.2. A lookup failure (new contact, or a
  // transient Brevo read error) is treated as "nothing to merge with".
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
