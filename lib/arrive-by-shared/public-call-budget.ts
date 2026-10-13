import { GoogleCallLedger, JOURNEY_CALL_CEILING, type BudgetDenial } from '@/lib/arrive-by-journey/call-budget';
import { createJourneyCallGuard } from '@/lib/arrive-by-journey/internal-access';

export class PublicCallBudgetUnavailable extends Error {
  constructor(public readonly reason: BudgetDenial | 'CALL_CEILING_REACHED') {
    super("Arrive By can't run live checks right now. Please try again later.");
    this.name = 'PublicCallBudgetUnavailable';
  }
}

/**
 * Legacy arrival-only calculations share the canonical journey's monthly
 * reservation and per-request ledger. One reservation covers every provider
 * request; each is charged before fetch, and unused capacity is returned even
 * when an engine fails or stops for destination confirmation.
 */
export async function runPublicGoogleCalculation<T>(
  calculate: (meteredFetch: typeof fetch) => Promise<T>,
  env: Record<string, string | undefined> = process.env,
): Promise<T> {
  const { guard } = createJourneyCallGuard(env, {
    onAlert: (alert) => console.warn(`[arrive-by] monthly Google call allowance at ${alert.level}%: ${alert.used}/${alert.limit} (${alert.month})`),
  });
  const reservation = await guard.reserve(JOURNEY_CALL_CEILING);
  if (!reservation.granted) throw new PublicCallBudgetUnavailable(reservation.reason);
  const ledger = new GoogleCallLedger(JOURNEY_CALL_CEILING);
  try {
    const result = await calculate(ledger.fetch);
    // Engines turn fetch errors into unavailable routes. Never accept a
    // partial result after the ledger refused an over-ceiling provider call.
    if (ledger.exhausted) throw new PublicCallBudgetUnavailable('CALL_CEILING_REACHED');
    return result;
  } finally {
    await guard.settle(reservation, ledger.used);
  }
}
