import { NextRequest, NextResponse } from 'next/server';
import { isBetaInteraction, recordBetaInteraction, scheduleBetaMetric } from '@/lib/arrive-by-journey/beta-metrics';
import { checkPublicJourneyInteractionRateLimit } from '@/lib/arrive-by-shared/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1024;

/** Count-only, allowlisted Arrive By UI events. No journey fields are read or stored. */
export async function POST(request: NextRequest) {
  const rate = await checkPublicJourneyInteractionRateLimit(request);
  if (rate.unavailable) return NextResponse.json({ error: 'Interaction measurement is unavailable.' }, { status: 503 });
  if (rate.limited) return NextResponse.json({ error: 'Please wait before sending another interaction.' }, { status: 429 });

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'That request is too large.' }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid interaction.' }, { status: 400 });
  }
  if (!isBetaInteraction(body)) return NextResponse.json({ error: 'Invalid interaction.' }, { status: 400 });

  scheduleBetaMetric(() => recordBetaInteraction(body));
  return new NextResponse(null, { status: 204 });
}
