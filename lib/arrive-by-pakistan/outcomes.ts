import { formatMinutesHuman } from './format';
import type { DestinationConfidence, PakistanOutcome, PakistanPickupMode } from './types';

/**
 * Below this many minutes of spare time, a positive result is framed as
 * tight rather than comfortable.
 *
 * PROVISIONAL — a founder-beta product assumption, not a figure Google
 * supplies and not yet validated against real traveller behaviour. It was
 * picked as a reasonable-sounding number during implementation, nothing
 * more. Do not treat 20 as settled, and do not let it reach a public
 * surface without a deliberate review once real founder usage exists.
 */
export const PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES = 20;

export function classifyOutcome(params: {
  destinationConfidence: DestinationConfidence;
  routeAvailable: boolean;
  hasDeadline: boolean;
  marginMinutes?: number;
}): PakistanOutcome {
  if (params.destinationConfidence === 'NEEDS_CONFIRMATION') return 'DESTINATION_NEEDS_CONFIRMATION';
  if (params.destinationConfidence === 'NEEDS_SELECTION') return 'DESTINATION_NEEDS_SELECTION';
  if (params.destinationConfidence === 'NEEDS_CLARIFICATION') return 'DESTINATION_NEEDS_CLARIFICATION';
  if (params.destinationConfidence === 'UNRESOLVED') return 'ROUTE_UNAVAILABLE';
  if (!params.routeAvailable) return 'ROUTE_UNAVAILABLE';
  if (!params.hasDeadline) return 'ETA_ONLY';

  const margin = params.marginMinutes ?? 0;
  if (margin < 0) return 'AFTER_DEADLINE';
  if (margin <= PROVISIONAL_TIGHT_MARGIN_THRESHOLD_MINUTES) return 'TIGHT_MARGIN';
  return 'BEFORE_DEADLINE';
}

export function outcomeVerdict(params: {
  outcome: PakistanOutcome;
  destination: string;
  arrivalClock?: string;
  deadlineClock?: string;
  marginMinutes?: number;
}): string {
  const { outcome, destination, arrivalClock, deadlineClock, marginMinutes } = params;
  switch (outcome) {
    case 'ETA_ONLY':
      return `Based on the traffic-aware driving estimate, you should reach ${destination} at around ${arrivalClock}.`;
    case 'BEFORE_DEADLINE':
      return `Based on the current estimate, you should reach ${destination} before ${deadlineClock}, with about ${formatMinutesHuman(marginMinutes ?? 0)} spare.`;
    case 'TIGHT_MARGIN':
      return `You may reach ${destination} in time, but there is only about ${formatMinutesHuman(marginMinutes ?? 0)} spare.`;
    case 'AFTER_DEADLINE':
      return `The current estimate gets you to ${destination} after the time you need to be there.`;
    case 'DESTINATION_NEEDS_CONFIRMATION':
      return `We found a place that might match ${destination}. Please confirm it's the right one before we calculate the journey.`;
    case 'DESTINATION_NEEDS_SELECTION':
      return `We found a few possible places for ${destination}. Please choose the one you mean.`;
    case 'DESTINATION_NEEDS_CLARIFICATION':
      return `We couldn't confidently match ${destination} to a single specific place. Try adding the nearest larger town or city name.`;
    case 'ROUTE_UNAVAILABLE':
      return "Journey not confirmed. We couldn't get a reliable driving route for this destination.";
    default:
      return 'Journey not confirmed.';
  }
}

export const ESTIMATE_DISCLAIMER =
  'This is an estimate, not a guarantee. Traffic, airport exit time and pickup/waiting time can change your actual arrival.';

/** Every pickup mode uses the identical road-routing calculation — they differ only in the assumption shown to the traveller. */
export const PICKUP_MODE_CAVEATS: Record<PakistanPickupMode, string> = {
  family: 'Your estimate assumes your pickup can leave after the waiting time you entered.',
  'pre-booked': 'Your estimate does not guarantee the driver will be ready at that exact time.',
  'arrange-after-landing': 'Vehicle availability and pickup time are not guaranteed.',
  other: 'Vehicle availability and pickup time are not guaranteed.',
};
