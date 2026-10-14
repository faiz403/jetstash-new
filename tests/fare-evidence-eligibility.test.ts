import { describe, expect, it } from 'vitest';
import { fareObservations } from '@/data/fare-observations';
import { hasPositiveNonSelfTransferEvidence, isCleanFareEvidence } from '@/lib/fare-evidence-eligibility';

describe('fare evidence must positively establish a single itinerary before it is treated as clean', () => {
  it('accepts an explicit single-booking record with known routing', () => {
    const observation = fareObservations.find((fare) => fare.id === 'obs-lba-bjv-economy-20260822-8w-v1')!;
    expect(hasPositiveNonSelfTransferEvidence(observation)).toBe(true);
    expect(isCleanFareEvidence(observation)).toBe(true);
  });

  it('does not treat absence of a self-transfer warning as positive evidence, while retaining existing publication eligibility', () => {
    const observation = fareObservations.find((fare) => fare.id === 'obs-man-dxb-economy-20260806-8w-v1')!;
    expect(observation.priceNote).not.toMatch(/single\s+(?:ticket|itinerary|booking)/i);
    expect(hasPositiveNonSelfTransferEvidence(observation)).toBe(false);
    expect(isCleanFareEvidence(observation)).toBe(true);
  });

  it('does not treat an explicitly flagged separate-ticket itinerary as clean', () => {
    const observation = fareObservations.find((fare) => fare.id === 'obs-bhx-bcn-economy-20261006-selftransfer-v1')!;
    expect(hasPositiveNonSelfTransferEvidence(observation)).toBe(false);
    expect(isCleanFareEvidence(observation)).toBe(false);
  });
});
