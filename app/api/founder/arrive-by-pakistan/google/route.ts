import { NextRequest, NextResponse } from 'next/server';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { cleanInput } from '@/lib/arrive-by-pakistan/clean-input';

export const dynamic = 'force-dynamic';

/** Same founder-gate model as the existing /founder surface: 404s in production unless explicitly enabled. */
function founderEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

export async function POST(request: NextRequest) {
  if (!founderEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
