import { NextRequest, NextResponse } from 'next/server';
import { computePakistanJourney } from '@/lib/arrive-by-pakistan/journey';
import { PAKISTAN_AIRPORT_CODES } from '@/lib/arrive-by-pakistan/airports';
import type { PakistanAirportCode, PakistanJourneyInput, PakistanPickupMode } from '@/lib/arrive-by-pakistan/types';

export const dynamic = 'force-dynamic';

/** Same founder-gate model as the existing /founder surface: 404s in production unless explicitly enabled. */
function founderEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

const PICKUP_MODES: readonly PakistanPickupMode[] = ['family', 'pre-booked', 'arrange-after-landing', 'other'];

function cleanInput(value: unknown): PakistanJourneyInput {
  if (!value || typeof value !== 'object') throw new Error('Enter the journey details.');
  const body = value as Record<string, unknown>;

  const airportCode = typeof body.airportCode === 'string' ? (body.airportCode as PakistanAirportCode) : undefined;
  if (!airportCode || !PAKISTAN_AIRPORT_CODES.includes(airportCode)) throw new Error('Choose a supported arrival airport.');

  const landingAt = typeof body.landingAt === 'string' ? body.landingAt : '';
  if (!landingAt) throw new Error('Enter your flight landing date and time.');

  const airportExitBufferMinutes = Number(body.airportExitBufferMinutes);
  if (!Number.isSafeInteger(airportExitBufferMinutes) || airportExitBufferMinutes < 0 || airportExitBufferMinutes > 480) {
    throw new Error('Enter a realistic airport-exit time in minutes (0 to 480).');
  }

  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  if (destination.length < 2 || destination.length > 180) throw new Error('Enter a final destination.');

  const pickupMode = typeof body.pickupMode === 'string' ? (body.pickupMode as PakistanPickupMode) : undefined;
  if (!pickupMode || !PICKUP_MODES.includes(pickupMode)) throw new Error('Choose how you are leaving the airport.');

  const pickupWaitRaw = body.pickupWaitMinutes;
  const pickupWaitMinutes = pickupWaitRaw === undefined || pickupWaitRaw === '' ? undefined : Number(pickupWaitRaw);
  if (pickupWaitMinutes !== undefined && (!Number.isSafeInteger(pickupWaitMinutes) || pickupWaitMinutes < 0 || pickupWaitMinutes > 480)) {
    throw new Error('Enter a realistic pickup wait in minutes (0 to 480).');
  }

  const deadlineRaw = body.deadline;
  const deadline = typeof deadlineRaw === 'string' && deadlineRaw ? deadlineRaw : undefined;
  const deadlineReasonRaw = body.deadlineReason;
  const deadlineReason = typeof deadlineReasonRaw === 'string' ? deadlineReasonRaw.trim().slice(0, 140) || undefined : undefined;

  const readinessRaw = body.destinationReadinessBufferMinutes;
  const destinationReadinessBufferMinutes = readinessRaw === undefined || readinessRaw === '' ? undefined : Number(readinessRaw);
  if (
    destinationReadinessBufferMinutes !== undefined &&
    (!Number.isSafeInteger(destinationReadinessBufferMinutes) || destinationReadinessBufferMinutes < 0 || destinationReadinessBufferMinutes > 480)
  ) {
    throw new Error('Enter a realistic readiness buffer in minutes (0 to 480).');
  }

  if (deadline && landingAt) {
    // A deadline before landing is never something Arrive By should try to
    // silently reconcile — fail clearly instead.
    if (Date.parse(`${deadline}:00`) <= Date.parse(`${landingAt}:00`)) {
      throw new Error('The deadline must be after your flight lands.');
    }
  }

  return {
    airportCode,
    landingAt,
    airportExitBufferMinutes,
    destination,
    pickupMode,
    pickupWaitMinutes,
    deadline,
    deadlineReason,
    destinationReadinessBufferMinutes,
  };
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
