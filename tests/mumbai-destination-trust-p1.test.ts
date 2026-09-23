import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getObservationsByRoute } from '@/data/fare-observations';
import { routeStatusEvents } from '@/data/route-status-events';
import { getRouteBySlug, getRouteStatus } from '@/data/routes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';

const NOW_ISO = '2026-09-07';
const ROUTE_SLUG = 'manchester-mumbai';

function destinationCopy(destination: NonNullable<ReturnType<typeof getDestinationBySlug>>): string[] {
  return [
    destination.tagline,
    destination.description,
    destination.flightTimeFromUK,
    destination.visaNote,
    destination.familyVisitContent?.travelPattern ?? '',
    destination.familyVisitContent?.documentNote ?? '',
    destination.familyVisitContent?.packingNote ?? '',
  ];
}

describe('Mumbai destination P1 trust fix', () => {
  const destination = getDestinationBySlug('mumbai')!;
  const route = getRouteBySlug(ROUTE_SLUG)!;

  it('derives the current MAN→BOM state through the canonical effective presentation', () => {
    expect(getRouteStatus(route, routeStatusEvents, NOW_ISO)?.status).toBe('service-ended');

    const presentation = getEffectiveRoutePresentation(route, routeStatusEvents, NOW_ISO);
    expect(presentation.status).toBe('service-ended');
    expect(presentation.statusLabel).toBe('Direct service ended');
    expect(presentation.flightTime).toBeNull();
    expect(presentation.frequency).toBeNull();
    expect(presentation.airlineSlugs).toEqual([]);
  });

  it('keeps the North West family-travel context without implying a current Manchester non-stop', () => {
    expect(destination.familyVisitContent?.travelPattern).toBe(
      "Mumbai is an important family-visit destination for North West-based travellers, not just a business or stopover city. IndiGo launched a Manchester–Mumbai service in July 2025 with the region's large Indian diaspora among the intended audiences.",
    );

    for (const sentence of destinationCopy(destination).flatMap((value) => value.split(/(?<=[.!?])\s+/))) {
      if (/manchester/i.test(sentence)) {
        expect(sentence).not.toMatch(/\b(current(?:ly)?|still|now|increasingly)\b.{0,100}\b(direct|non-?stop)\b/i);
        expect(sentence).not.toMatch(/\b(direct|non-?stop)\b.{0,100}\b(current(?:ly)?|still|now|increasingly)\b/i);
      }
    }
  });

  it('retains only clearly historical Manchester service context in the destination copy', () => {
    const travelPattern = destination.familyVisitContent?.travelPattern ?? '';
    expect(travelPattern).toMatch(/launched a Manchester–Mumbai service in July 2025/i);
    expect(travelPattern).not.toMatch(/\boperates?|\bruns?|\bflies?|\bavailable\b/i);
  });

  it('does not make the destination record a second owner of the Manchester route lifecycle', () => {
    const copy = destinationCopy(destination).join(' ');
    expect(copy).not.toMatch(/\bservice (?:has )?ended\b|\bwithdraw(?:al|n)?\b|\bpaus(?:e|ed)\b|\bresum(?:e|ed|ption)\b/i);
    expect(destination.familyVisitContent?.packingNote).toMatch(/baggage allowance/i);
  });

  it('leaves MAN→BOM route, verification, status-event and fare evidence unchanged', () => {
    expect(route).toMatchObject({
      slug: ROUTE_SLUG,
      airportSlug: 'manchester',
      destinationSlug: 'mumbai',
      flightTime: '9h 45m direct (currently)',
      frequency: '4x weekly direct (Mon/Tue/Sat/Sun ex-Manchester, per Feb 2026 schedule)',
      airlineSlugs: ['indigo'],
      isDirect: true,
      verification: {
        status: 'verified',
        verifiedDate: '2026-07-23',
        reviewDueDate: '2026-08-31',
      },
    });

    expect(
      routeStatusEvents
        .filter((event) => event.routeSlug === ROUTE_SLUG)
        .map((event) => ({
          id: event.id,
          type: event.type,
          effectiveFrom: 'effectiveFrom' in event ? event.effectiveFrom : null,
          currentClaimValidBefore: 'currentClaimValidBefore' in event ? event.currentClaimValidBefore : null,
        })),
    ).toEqual([
      {
        id: 'man-bom-indigo-withdrawal-2026-06',
        type: 'withdrawal-announced',
        effectiveFrom: '2026-08-31',
        currentClaimValidBefore: '2026-08-31',
      },
      {
        id: 'man-bom-indigo-service-ended-2026-09',
        type: 'service-ended',
        effectiveFrom: '2026-08-31',
        currentClaimValidBefore: '2027-03-02',
      },
    ]);

    expect(
      getObservationsByRoute(ROUTE_SLUG).map((observation) => ({
        id: observation.id,
        price: observation.price,
        observedDate: observation.observedDate,
        fareDirectness: observation.fareDirectness,
      })),
    ).toEqual([
      {
        id: 'obs-man-bom-economy-20260806-8w-v1',
        price: 461,
        observedDate: '2026-08-06',
        fareDirectness: 'unknown',
      },
      {
        id: 'obs-man-bom-economy-20260818-8w-v1',
        price: 445,
        observedDate: '2026-08-18',
        fareDirectness: 'connecting',
      },
      {
        id: 'obs-man-bom-economy-20260901-8w-v1',
        price: 395,
        observedDate: '2026-09-01',
        fareDirectness: 'connecting',
      },
      // 16 September 2026: the full-portfolio controlled sweep's Batch 6
      // (TRACK - ARCHIVE ONLY routes) appended a further genuine,
      // append-only connecting-evidence observation for this
      // service-ended-direct route — see docs/project-control/fare-evidence/
      // full-portfolio-controlled-batch-2026-09-15.md.
      {
        id: 'obs-man-bom-economy-20260916-8w-v1',
        price: 436,
        observedDate: '2026-09-16',
        fareDirectness: 'connecting',
      },
      // 22 September 2026 weekly sweep — again append-only connecting
      // evidence on a service-ended-direct route; nothing about the route
      // record, its verification or its status events changed.
      {
        id: 'obs-man-bom-economy-20260922-v1',
        price: 473,
        observedDate: '2026-09-22',
        fareDirectness: 'connecting',
      },
    ]);
  });

  it('does not change any destination record outside Mumbai', () => {
    // Digest recomputed for this integration: Doha's ukAirports/visaNote and
    // Dubai's visaNote legitimately changed via the separately-approved
    // a771262 (LGW-DOH) and 8b60ddf (UAE/Qatar) fixes, both present here.
    const otherDestinations = destinations.filter((item) => item.slug !== 'mumbai');
    const digest = createHash('sha256').update(JSON.stringify(otherDestinations)).digest('hex');
    expect(digest).toBe('182555ea2b10a86ab7d3ee3c0a0ff3ccb588cb901ecfdccfe68c65be90b4bafb');
  });
});
