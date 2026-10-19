import { describe, it, expect } from 'vitest';
import { routes, getRouteBySlug, getDisplayDirectness, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { fareObservations, getPublishableObservationsByRoute, isMethodologyExcluded, isObservationPublishable } from '@/data/fare-observations';
import { buildPortfolioAudit } from '@/lib/portfolio-data-quality';
import { getFareSignalForRoute } from '@/lib/fare-signal';
import { getDestinationBySlug } from '@/data/destinations';
import { buildAtlasAirports } from '@/lib/atlas-network-data';
import { getDestinationFlightGuideEntries } from '@/lib/destination-flight-guides';
import { routeStatusLabel } from '@/components/destination/destination-flight-guides';

/**
 * B1 route re-verification, Batch 2 (19 October 2026): the 22 routes whose
 * route records had expired. Evidence lives outside the repository
 * (b1-batch2-route-report-2026-10-19.md and the SunExpress winter 2026/27
 * timetable addendum). Route evidence, seasonal schedules and bookable fares
 * are kept separate: no record here is re-dated, because re-dating would
 * immediately republish fare observations whose return legs are unverified.
 */

const NOW = '2026-10-19';

// [verifiedDate, reviewDueDate, status] exactly as on Production 682dbb1.
const BASELINE: Record<string, [string, string, string]> = {
  'manchester-izmir': ['2026-09-07', '2026-10-07', 'verified'],
  'manchester-dalaman': ['2026-09-07', '2026-10-07', 'verified'],
  'london-gatwick-ahmedabad': ['2026-09-04', '2026-09-18', 'unverified'],
  'leeds-bradford-bodrum': ['2026-09-08', '2026-10-08', 'verified'],
  'manchester-sylhet': ['2026-09-04', '2026-09-18', 'unverified'],
  'leeds-bradford-barcelona': ['2026-09-14', '2026-10-14', 'verified'],
  'london-heathrow-sylhet': ['2026-09-04', '2026-09-18', 'unverified'],
  'birmingham-ahmedabad': ['2026-09-04', '2026-09-18', 'unverified'],
  'london-gatwick-istanbul': ['2026-09-04', '2026-10-04', 'verified'],
  'manchester-bodrum': ['2026-09-07', '2026-10-07', 'verified'],
  'manchester-antalya': ['2026-09-07', '2026-10-07', 'verified'],
  'london-gatwick-dalaman': ['2026-09-07', '2026-10-07', 'verified'],
  'london-gatwick-bodrum': ['2026-09-07', '2026-10-07', 'verified'],
  'london-gatwick-izmir': ['2026-09-07', '2026-10-07', 'verified'],
  'london-heathrow-casablanca': ['2026-09-07', '2026-10-07', 'verified'],
  'london-gatwick-doha': ['2026-09-07', '2026-10-07', 'verified'],
  'leeds-bradford-antalya': ['2026-09-08', '2026-10-08', 'verified'],
  'leeds-bradford-dalaman': ['2026-09-08', '2026-10-08', 'verified'],
  'london-gatwick-marrakech': ['2026-09-08', '2026-10-08', 'verified'],
  'london-gatwick-agadir': ['2026-09-08', '2026-10-08', 'verified'],
  'manchester-faro': ['2026-09-14', '2026-10-14', 'verified'],
  'london-gatwick-amritsar': ['2026-09-17', '2026-10-17', 'verified'],
};
const SLUGS = Object.keys(BASELINE);

// Every fare observation for the 22 routes exactly as on Production 682dbb1:
// [id, routeSlug, price, observedDate]. The archive is append-only, so this
// change must neither delete nor alter any of them.
const ARCHIVE_BASELINE: [string, string, number, string][] = [
['obs-lgw-amd-economy-1', 'london-gatwick-ahmedabad', 412, '2026-06-17'],
  ['obs-lgw-amd-business-1', 'london-gatwick-ahmedabad', 1620, '2026-06-17'],
  ['obs-lgw-amd-economy-20260806-8w-v1', 'london-gatwick-ahmedabad', 535, '2026-08-06'],
  ['obs-lgw-atq-economy-20260806-8w-v1', 'london-gatwick-amritsar', 952, '2026-08-06'],
  ['obs-man-ayt-economy-20260813-8w-v1', 'manchester-antalya', 231, '2026-08-13'],
  ['obs-man-dlm-economy-20260813-8w-v1', 'manchester-dalaman', 201, '2026-08-13'],
  ['obs-man-bod-economy-20260813-8w-v1', 'manchester-bodrum', 351, '2026-08-13'],
  ['obs-man-izm-economy-20260813-8w-v1', 'manchester-izmir', 248, '2026-08-13'],
  ['obs-lba-ayt-economy-20260813-8w-v1', 'leeds-bradford-antalya', 285, '2026-08-13'],
  ['obs-lba-dlm-economy-20260813-8w-v1', 'leeds-bradford-dalaman', 232, '2026-08-13'],
  ['obs-bhx-amd-economy-20260813-8w-v1', 'birmingham-ahmedabad', 565, '2026-08-13'],
  ['obs-man-fao-economy-20260813-8w-v1', 'manchester-faro', 85, '2026-08-13'],
  ['obs-lgw-bod-economy-20260814-8w-v1', 'london-gatwick-bodrum', 179, '2026-08-14'],
  ['obs-lba-bcn-economy-20260814-8w-v1', 'leeds-bradford-barcelona', 229, '2026-08-14'],
  ['obs-lgw-dlm-economy-20260814-8w-v1', 'london-gatwick-dalaman', 137, '2026-08-14'],
  ['obs-lgw-ist-economy-20260814-8w-v1', 'london-gatwick-istanbul', 149, '2026-08-14'],
  ['obs-lgw-rak-economy-20260814-8w-v1', 'london-gatwick-marrakech', 80, '2026-08-14'],
  ['obs-lhr-cmn-economy-20260814-8w-v1', 'london-heathrow-casablanca', 220, '2026-08-14'],
  ['obs-lgw-adb-economy-20260814-8w-v1', 'london-gatwick-izmir', 258, '2026-08-14'],
  ['obs-lgw-aga-economy-20260814-8w-v1', 'london-gatwick-agadir', 187, '2026-08-14'],
  ['obs-lgw-saw-economy-20260814-8w-v1', 'london-gatwick-istanbul', 149, '2026-08-14'],
  ['obs-bhx-amd-economy-20260818-8w-v1', 'birmingham-ahmedabad', 516, '2026-08-18'],
  ['obs-lba-ayt-economy-20260818-8w-v1', 'leeds-bradford-antalya', 206, '2026-08-18'],
  ['obs-lba-bcn-economy-20260818-8w-v1', 'leeds-bradford-barcelona', 121, '2026-08-18'],
  ['obs-lba-dlm-economy-20260818-8w-v1', 'leeds-bradford-dalaman', 231, '2026-08-18'],
  ['obs-lgw-aga-economy-20260818-8w-v1', 'london-gatwick-agadir', 133, '2026-08-18'],
  ['obs-lgw-amd-economy-20260818-8w-v1', 'london-gatwick-ahmedabad', 525, '2026-08-18'],
  ['obs-lgw-atq-economy-20260818-8w-v1', 'london-gatwick-amritsar', 650, '2026-08-18'],
  ['obs-lgw-bjv-economy-20260818-8w-v1', 'london-gatwick-bodrum', 215, '2026-08-18'],
  ['obs-lgw-dlm-economy-20260818-8w-v1', 'london-gatwick-dalaman', 172, '2026-08-18'],
  ['obs-lgw-ist-economy-20260818-8w-v1', 'london-gatwick-istanbul', 162, '2026-08-18'],
  ['obs-lgw-adb-economy-20260818-8w-v1', 'london-gatwick-izmir', 170, '2026-08-18'],
  ['obs-lgw-rak-economy-20260818-8w-v1', 'london-gatwick-marrakech', 120, '2026-08-18'],
  ['obs-lhr-cmn-economy-20260818-8w-v1', 'london-heathrow-casablanca', 218, '2026-08-18'],
  ['obs-lhr-zyl-economy-20260818-8w-v1', 'london-heathrow-sylhet', 696, '2026-08-18'],
  ['obs-man-ayt-economy-20260818-8w-v1', 'manchester-antalya', 197, '2026-08-18'],
  ['obs-man-bjv-economy-20260818-8w-v1', 'manchester-bodrum', 181, '2026-08-18'],
  ['obs-man-dlm-economy-20260818-8w-v1', 'manchester-dalaman', 206, '2026-08-18'],
  ['obs-man-fao-economy-20260818-8w-v1', 'manchester-faro', 58, '2026-08-18'],
  ['obs-man-adb-economy-20260818-8w-v1', 'manchester-izmir', 182, '2026-08-18'],
  ['obs-man-zyl-economy-20260818-8w-v1', 'manchester-sylhet', 688, '2026-08-18'],
  ['obs-lba-bjv-economy-20260822-8w-v1', 'leeds-bradford-bodrum', 614, '2026-08-22'],
  ['obs-lgw-atq-economy-20260825-8w-v1', 'london-gatwick-amritsar', 582, '2026-08-25'],
  ['obs-lgw-atq-economy-20260901-8w-v1', 'london-gatwick-amritsar', 595, '2026-09-01'],
  ['obs-bhx-amd-economy-20260901-8w-v1', 'birmingham-ahmedabad', 465, '2026-09-01'],
  ['obs-lba-bcn-economy-20260901-8w-v1', 'leeds-bradford-barcelona', 86, '2026-09-01'],
  ['obs-lgw-aga-economy-20260901-8w-v1', 'london-gatwick-agadir', 121, '2026-09-01'],
  ['obs-lgw-amd-economy-20260901-8w-v1', 'london-gatwick-ahmedabad', 495, '2026-09-01'],
  ['obs-lgw-bjv-economy-20260901-8w-v1', 'london-gatwick-bodrum', 149, '2026-09-01'],
  ['obs-lgw-dlm-economy-20260901-8w-v1', 'london-gatwick-dalaman', 139, '2026-09-01'],
  ['obs-lgw-ist-economy-20260901-8w-v1', 'london-gatwick-istanbul', 128, '2026-09-01'],
  ['obs-lgw-adb-economy-20260901-8w-v1', 'london-gatwick-izmir', 133, '2026-09-01'],
  ['obs-lgw-rak-economy-20260901-8w-v1', 'london-gatwick-marrakech', 97, '2026-09-01'],
  ['obs-lhr-cmn-economy-20260901-8w-v1', 'london-heathrow-casablanca', 151, '2026-09-01'],
  ['obs-lhr-zyl-economy-20260901-8w-v1', 'london-heathrow-sylhet', 646, '2026-09-01'],
  ['obs-man-ayt-economy-20260901-8w-v1', 'manchester-antalya', 153, '2026-09-01'],
  ['obs-man-bjv-economy-20260901-8w-v1', 'manchester-bodrum', 162, '2026-09-01'],
  ['obs-man-dlm-economy-20260901-8w-v1', 'manchester-dalaman', 118, '2026-09-01'],
  ['obs-man-fao-economy-20260901-8w-v1', 'manchester-faro', 73, '2026-09-01'],
  ['obs-man-adb-economy-20260901-8w-v1', 'manchester-izmir', 161, '2026-09-01'],
  ['obs-man-zyl-economy-20260901-8w-v1', 'manchester-sylhet', 593, '2026-09-01'],
  ['obs-lgw-atq-economy-20260915-8w-v1', 'london-gatwick-amritsar', 531, '2026-09-15'],
  ['obs-lgw-doh-economy-20260915-8w-v1', 'london-gatwick-doha', 316, '2026-09-15'],
  ['obs-man-dlm-economy-20260915-8w-v1', 'manchester-dalaman', 86, '2026-09-15'],
  ['obs-man-bjv-economy-20260915-8w-v1', 'manchester-bodrum', 178, '2026-09-15'],
  ['obs-man-izm-economy-20260916-8w-v1', 'manchester-izmir', 160, '2026-09-16'],
  ['obs-lgw-ist-economy-20260916-8w-v1', 'london-gatwick-istanbul', 125, '2026-09-16'],
  ['obs-lgw-dlm-economy-20260916-8w-v1', 'london-gatwick-dalaman', 91, '2026-09-16'],
  ['obs-lgw-bjv-economy-20260916-8w-v1', 'london-gatwick-bodrum', 177, '2026-09-16'],
  ['obs-lgw-izm-economy-20260916-8w-v1', 'london-gatwick-izmir', 159, '2026-09-16'],
  ['obs-man-ayt-economy-20260916-8w-v1', 'manchester-antalya', 92, '2026-09-16'],
  ['obs-lgw-rak-economy-20260916-8w-v1', 'london-gatwick-marrakech', 75, '2026-09-16'],
  ['obs-lgw-aga-economy-20260916-8w-v1', 'london-gatwick-agadir', 106, '2026-09-16'],
  ['obs-lhr-cmn-economy-20260916-8w-v1', 'london-heathrow-casablanca', 152, '2026-09-16'],
  ['obs-lba-bcn-economy-20260916-8w-v1', 'leeds-bradford-barcelona', 101, '2026-09-16'],
  ['obs-man-fao-economy-20260916-8w-v1', 'manchester-faro', 97, '2026-09-16'],
  ['obs-man-zyl-economy-20260916-8w-v1', 'manchester-sylhet', 772, '2026-09-16'],
  ['obs-lhr-zyl-economy-20260916-8w-v1', 'london-heathrow-sylhet', 692, '2026-09-16'],
  ['obs-lgw-amd-economy-20260916-8w-v1', 'london-gatwick-ahmedabad', 453, '2026-09-16'],
  ['obs-bhx-amd-economy-20260916-8w-v1', 'birmingham-ahmedabad', 694, '2026-09-16'],
  ['obs-lba-ayt-economy-20260916-kayak-v1', 'leeds-bradford-antalya', 204, '2026-09-16'],
  ['obs-lba-bjv-economy-20260916-kayak-v1', 'leeds-bradford-bodrum', 255, '2026-09-16'],
  ['obs-lba-dlm-economy-20260916-kayak-v1', 'leeds-bradford-dalaman', 263, '2026-09-16'],
  ['obs-man-dlm-economy-20260922-v1', 'manchester-dalaman', 66, '2026-09-22'],
  ['obs-man-bjv-economy-20260922-v1', 'manchester-bodrum', 234, '2026-09-22'],
  ['obs-man-ayt-economy-20260922-v1', 'manchester-antalya', 126, '2026-09-22'],
  ['obs-man-adb-economy-20260922-v1', 'manchester-izmir', 198, '2026-09-22'],
  ['obs-lba-ayt-economy-20260922-kayak-v1', 'leeds-bradford-antalya', 178, '2026-09-22'],
  ['obs-lba-dlm-economy-20260922-kayak-v1', 'leeds-bradford-dalaman', 326, '2026-09-22'],
  ['obs-lba-bjv-economy-20260922-kayak-v1', 'leeds-bradford-bodrum', 327, '2026-09-22'],
  ['obs-lgw-ist-economy-20260922-v1', 'london-gatwick-istanbul', 160, '2026-09-22'],
  ['obs-lgw-dlm-economy-20260922-v1', 'london-gatwick-dalaman', 82, '2026-09-22'],
  ['obs-lgw-bjv-economy-20260922-v1', 'london-gatwick-bodrum', 223, '2026-09-22'],
  ['obs-lgw-adb-economy-20260922-v1', 'london-gatwick-izmir', 223, '2026-09-22'],
  ['obs-lgw-rak-economy-20260922-v1', 'london-gatwick-marrakech', 63, '2026-09-22'],
  ['obs-lgw-aga-economy-20260922-v1', 'london-gatwick-agadir', 138, '2026-09-22'],
  ['obs-lhr-cmn-economy-20260922-v1', 'london-heathrow-casablanca', 177, '2026-09-22'],
  ['obs-man-zyl-economy-20260922-v1', 'manchester-sylhet', 863, '2026-09-22'],
  ['obs-lhr-zyl-economy-20260922-v1', 'london-heathrow-sylhet', 836, '2026-09-22'],
  ['obs-lgw-amd-economy-20260922-v1', 'london-gatwick-ahmedabad', 601, '2026-09-22'],
  ['obs-lgw-atq-economy-20260922-v1', 'london-gatwick-amritsar', 1173, '2026-09-22'],
  ['obs-lgw-doh-economy-20260922-v1', 'london-gatwick-doha', 388, '2026-09-22'],
  ['obs-lba-bcn-economy-20260922-v1', 'leeds-bradford-barcelona', 179, '2026-09-22'],
  ['obs-man-fao-economy-20260922-v1', 'manchester-faro', 183, '2026-09-22'],
  ['obs-bhx-amd-economy-20260922-v1', 'birmingham-ahmedabad', 927, '2026-09-22'],
  ['obs-man-dlm-economy-20260929-v1', 'manchester-dalaman', 52, '2026-09-29'],
  ['obs-man-bjv-economy-20260929-v1', 'manchester-bodrum', 192, '2026-09-29'],
  ['obs-man-ayt-economy-20260929-v1', 'manchester-antalya', 129, '2026-09-29'],
  ['obs-man-adb-economy-20260929-v1', 'manchester-izmir', 174, '2026-09-29'],
  ['obs-lba-ayt-economy-20260929-v1', 'leeds-bradford-antalya', 309, '2026-09-29'],
  ['obs-lba-dlm-economy-20260929-v1', 'leeds-bradford-dalaman', 437, '2026-09-29'],
  ['obs-lba-bjv-economy-20260929-v1', 'leeds-bradford-bodrum', 421, '2026-09-29'],
  ['obs-lgw-ist-economy-20260929-v1', 'london-gatwick-istanbul', 143, '2026-09-29'],
  ['obs-lgw-dlm-economy-20260929-v1', 'london-gatwick-dalaman', 55, '2026-09-29'],
  ['obs-lgw-bjv-economy-20260929-v1', 'london-gatwick-bodrum', 179, '2026-09-29'],
  ['obs-lgw-adb-economy-20260929-v1', 'london-gatwick-izmir', 204, '2026-09-29'],
  ['obs-lgw-rak-economy-20260929-v1', 'london-gatwick-marrakech', 57, '2026-09-29'],
  ['obs-lgw-aga-economy-20260929-v1', 'london-gatwick-agadir', 109, '2026-09-29'],
  ['obs-lhr-cmn-economy-20260929-v1', 'london-heathrow-casablanca', 177, '2026-09-29'],
  ['obs-man-zyl-economy-20260929-v1', 'manchester-sylhet', 666, '2026-09-29'],
  ['obs-lhr-zyl-economy-20260929-v1', 'london-heathrow-sylhet', 674, '2026-09-29'],
  ['obs-lgw-amd-economy-20260929-v1', 'london-gatwick-ahmedabad', 501, '2026-09-29'],
  ['obs-lgw-atq-economy-20260929-v1', 'london-gatwick-amritsar', 1220, '2026-09-29'],
  ['obs-lgw-doh-economy-20260929-v1', 'london-gatwick-doha', 290, '2026-09-29'],
  ['obs-lba-bcn-economy-20260929-v1', 'leeds-bradford-barcelona', 123, '2026-09-29'],
  ['obs-man-fao-economy-20260929-v1', 'manchester-faro', 117, '2026-09-29'],
  ['obs-bhx-amd-economy-20260929-v1', 'birmingham-ahmedabad', 533, '2026-09-29'],
  ['obs-lgw-dlm-economy-20260929-final-recheck-v1', 'london-gatwick-dalaman', 58, '2026-09-29'],
  ['obs-man-bjv-economy-20261006-selftransfer-v1', 'manchester-bodrum', 182, '2026-10-06'],
  ['obs-man-bjv-economy-20261006-v1', 'manchester-bodrum', 188, '2026-10-06'],
  ['obs-man-ayt-economy-20261006-v1', 'manchester-antalya', 136, '2026-10-06'],
  ['obs-man-adb-economy-20261006-selftransfer-v1', 'manchester-izmir', 174, '2026-10-06'],
  ['obs-man-adb-economy-20261006-v1', 'manchester-izmir', 190, '2026-10-06'],
  ['obs-lgw-ist-economy-20261006-selftransfer-v1', 'london-gatwick-istanbul', 134, '2026-10-06'],
  ['obs-lgw-ist-economy-20261006-v1', 'london-gatwick-istanbul', 185, '2026-10-06'],
  ['obs-lgw-bjv-economy-20261006-v1', 'london-gatwick-bodrum', 170, '2026-10-06'],
  ['obs-lgw-adb-economy-20261006-selftransfer-v1', 'london-gatwick-izmir', 163, '2026-10-06'],
  ['obs-lgw-adb-economy-20261006-v1', 'london-gatwick-izmir', 171, '2026-10-06'],
  ['obs-lgw-aga-economy-20261006-selftransfer-v1', 'london-gatwick-agadir', 94, '2026-10-06'],
  ['obs-lgw-aga-economy-20261006-v1', 'london-gatwick-agadir', 187, '2026-10-06'],
  ['obs-lhr-cmn-economy-20261006-v1', 'london-heathrow-casablanca', 175, '2026-10-06'],
  ['obs-man-zyl-economy-20261006-selftransfer-v1', 'manchester-sylhet', 654, '2026-10-06'],
  ['obs-man-zyl-economy-20261006-v1', 'manchester-sylhet', 786, '2026-10-06'],
  ['obs-lhr-zyl-economy-20261006-selftransfer-v1', 'london-heathrow-sylhet', 726, '2026-10-06'],
  ['obs-lhr-zyl-economy-20261006-v1', 'london-heathrow-sylhet', 793, '2026-10-06'],
  ['obs-lgw-amd-economy-20261006-selftransfer-v1', 'london-gatwick-ahmedabad', 507, '2026-10-06'],
  ['obs-lgw-amd-economy-20261006-v1', 'london-gatwick-ahmedabad', 615, '2026-10-06'],
  ['obs-lgw-atq-economy-20261006-selftransfer-v1', 'london-gatwick-amritsar', 483, '2026-10-06'],
  ['obs-lgw-atq-economy-20261006-v1', 'london-gatwick-amritsar', 758, '2026-10-06'],
  ['obs-lgw-doh-economy-20261006-selftransfer-v1', 'london-gatwick-doha', 269, '2026-10-06'],
  ['obs-lgw-doh-economy-20261006-v1', 'london-gatwick-doha', 416, '2026-10-06'],
  ['obs-lba-bcn-economy-20261006-selftransfer-v1', 'leeds-bradford-barcelona', 122, '2026-10-06'],
  ['obs-lba-bcn-economy-20261006-v1', 'leeds-bradford-barcelona', 191, '2026-10-06'],
  ['obs-man-fao-economy-20261006-selftransfer-v1', 'manchester-faro', 109, '2026-10-06'],
  ['obs-man-fao-economy-20261006-v1', 'manchester-faro', 176, '2026-10-06'],
  ['obs-bhx-amd-economy-20261006-selftransfer-v1', 'birmingham-ahmedabad', 537, '2026-10-06'],
  ['obs-bhx-amd-economy-20261006-v1', 'birmingham-ahmedabad', 844, '2026-10-06'],
  ['obs-lgw-dlm-economy-20261007-offer-level-reverification-v1', 'london-gatwick-dalaman', 55, '2026-10-07'],
];

function route(slug: string): Route {
  const found = getRouteBySlug(slug);
  if (!found) throw new Error(`missing route ${slug}`);
  return found;
}
function publicText(r: Route): string {
  return [r.flightTime, r.frequency, r.intro, r.bookingWindowNote].join(' ');
}

describe('all 22 expired routes stay fail-closed: pending, not re-dated, no fare published', () => {
  it('covers exactly 22 routes', () => {
    expect(SLUGS).toHaveLength(22);
  });

  for (const slug of SLUGS) {
    it(`${slug}: verification dates and status unchanged; presentation pending; no publishable fare or Fare Signal`, () => {
      const r = route(slug);
      const [verifiedDate, reviewDueDate, status] = BASELINE[slug];
      expect(r.verification?.verifiedDate).toBe(verifiedDate);
      expect(r.verification?.reviewDueDate).toBe(reviewDueDate);
      expect(r.verification?.status).toBe(status);
      for (const v of r.airlineVerifications ?? []) expect(v.reviewDueDate < NOW, `${slug} ${v.airlineSlug}`).toBe(true);
      expect(getEffectiveRoutePresentation(r, routeStatusEvents, NOW).status).toBe('unverified');
      expect(getPublishableObservationsByRoute(slug, NOW)).toHaveLength(0);
      expect(getFareSignalForRoute(slug, NOW).state).toBe('none');
    });
  }

  it('every fare observation for the 22 routes is unchanged from Production (none deleted, added, moved or repriced)', () => {
    const current = fareObservations
      .filter((o) => SLUGS.includes(o.routeSlug))
      .map((o): [string, string, number, string] => [o.id, o.routeSlug, o.price, o.observedDate]);
    expect(ARCHIVE_BASELINE.length).toBeGreaterThan(100);
    expect(current).toEqual(ARCHIVE_BASELINE);
  });
});

describe('Birmingham to Ahmedabad: direct model removed, still fail-closed', () => {
  it('is no longer modelled as direct, but is pending rather than a verified connecting route', () => {
    const r = route('birmingham-ahmedabad');
    expect(r.isDirect).toBe(false);
    expect(r.serviceShape).toBe('unspecified');
    expect(r.verification?.status).toBe('unverified');
    expect(getDisplayDirectness(r, NOW)).toBe('unverified');
    expect(r.connectingAlternative).toBeUndefined();
  });

  it('the internal portfolio audit reports it as unspecified and pending, never connecting or direct', () => {
    const row = buildPortfolioAudit(NOW).find((x) => x.slug === 'birmingham-ahmedabad')!;
    expect(row.declaredDirectness).toBe('unspecified');
    expect(row.publicStatus).toBe('unverified');
    expect(row.verificationStatus).toBe('unverified');
    expect(row.verifiedDate).toBe('2026-09-04');
    expect(row.farePublishable).toBe(false);
  });

  it('public text claims no direct flight and names no connecting hub', () => {
    const text = publicText(route('birmingham-ahmedabad'));
    expect(text).toContain('There is no evidenced direct Birmingham to Ahmedabad service');
    expect(text).not.toMatch(/via (Delhi|Mumbai|Dubai|Doha)/);
    expect(text).not.toMatch(/12 hours 55 minutes/);
  });
});

describe('SunExpress Turkey routes follow the official schedules without overclaiming', () => {
  it('Manchester to Antalya records the winter Thursday/Sunday listing without claiming nonstop or exact-date availability', () => {
    const text = publicText(route('manchester-antalya'));
    expect(text).toContain('Thursdays and Sundays');
    expect(text).toContain('subject to change');
    expect(text.toLowerCase()).not.toContain('nonstop');
    expect(text).not.toMatch(/\bXQ\s?\d{2,4}\b/);
    expect(text.toLowerCase()).not.toContain('december');
  });

  it('Dalaman and Izmir from Manchester and Gatwick are dated as summer-only for SunExpress', () => {
    for (const slug of ['manchester-dalaman', 'manchester-izmir', 'london-gatwick-dalaman', 'london-gatwick-izmir']) {
      const r = route(slug);
      expect(r.frequency, slug).toMatch(/no winter 2026\/27/);
      expect(r.frequency, slug).toContain('Summer 2027');
      expect(r.airlineSlugs, slug).toContain('sunexpress');
    }
  });

  it('Bodrum from Manchester and Gatwick no longer names SunExpress as a current operator, but keeps the dated history', () => {
    for (const slug of ['manchester-bodrum', 'london-gatwick-bodrum']) {
      const r = route(slug);
      expect(r.airlineSlugs, slug).not.toContain('sunexpress');
      expect((r.airlineVerifications ?? []).map((v) => v.airlineSlug), slug).not.toContain('sunexpress');
      expect(r.frequency, slug).toContain('SunExpress flew twice weekly in summer 2026');
      expect(r.verification?.note, slug).toContain('B1 route re-verification Batch 2 (19 October 2026)');
    }
  });

  it('Leeds Bradford to Antalya drops SunExpress (no Leeds Bradford service in its own schedules) but keeps TUI', () => {
    const r = route('leeds-bradford-antalya');
    expect(r.airlineSlugs).toEqual(['jet2', 'tui']);
    expect((r.airlineVerifications ?? []).map((v) => v.airlineSlug)).toEqual(['jet2', 'tui']);
    expect(r.verification?.note).toContain('previously named from the airport page');
  });

  it('newly observed operators are recorded but never shown as verified airlines (Dalaman and Antalya)', () => {
    const dalaman = route('manchester-dalaman');
    expect(dalaman.airlineSlugs).toEqual(['sunexpress', 'easyjet', 'jet2']);
    expect(getEffectiveRoutePresentation(dalaman, routeStatusEvents, NOW).airlineSlugs).toEqual([]);
    const antalya = route('manchester-antalya');
    expect(antalya.airlineSlugs).toEqual(['sunexpress', 'jet2', 'corendon', 'easyjet']);
    expect((antalya.airlineVerifications ?? []).map((v) => v.airlineSlug)).not.toContain('easyjet');
    expect(getEffectiveRoutePresentation(antalya, routeStatusEvents, NOW).airlineSlugs).not.toContain('easyjet');
  });
});

describe('Sylhet routes: outdated wording replaced, tracked October flights not presented as a December schedule', () => {
  for (const slug of ['manchester-sylhet', 'london-heathrow-sylhet']) {
    it(`${slug} no longer says the destination is not served, claims no December schedule, and stays unverified`, () => {
      const r = route(slug);
      const text = publicText(r);
      expect(text).not.toMatch(/not currently served|not flying to this location|no confirmed Sylhet-specific service/i);
      expect(text).toContain('October 2026');
      // Every mention of a December schedule must be explicitly negated.
      const decemberMentions = text.match(/[^.;]*December schedule[^.;]*/g) ?? [];
      expect(decemberMentions.length).toBeGreaterThan(0);
      for (const m of decemberMentions) expect(m, slug).toMatch(/\bno\b|\bnot\b/i);
      expect(text).not.toMatch(/operates in December|December timetable is confirmed/i);
      expect(r.verification?.status).toBe('unverified');
    });
  }

  it('manchester-sylhet distinguishes the one operated flight from flights only scheduled, and claims no operating pattern', () => {
    const text = publicText(route('manchester-sylhet'));
    expect(text).toContain('tracked operating on 13 October 2026');
    expect(text).toContain('scheduled for 20 and 24 October 2026');
    expect(text).not.toMatch(/Tuesday and Saturday pattern/i);
  });
});

describe('Gatwick routes with conflicting or unresolved evidence stay unresolved', () => {
  it('Gatwick to Ahmedabad keeps the Air India conflict visible and is not marked verified', () => {
    const r = route('london-gatwick-ahmedabad');
    expect(r.verification?.status).toBe('unverified');
    expect(r.intro).toMatch(/conflict/);
    expect(r.verification?.note).toContain('Direct flight from London to Ahmedabad: 0');
    expect(r.verification?.note).toContain('AI160');
  });

  it('Gatwick to Amritsar is not labelled ended: no ledger event, public wording unchanged', () => {
    const r = route('london-gatwick-amritsar');
    expect(routeStatusEvents.filter((e) => e.routeSlug === 'london-gatwick-amritsar')).toHaveLength(0);
    expect(r.flightTime).toBe('Direct; check the live schedule for duration');
    expect(r.verification?.note).toContain('NOT labelled ended');
  });

  it('Gatwick to Istanbul keeps its airport identity and operator unchanged, with the IST/SAW question recorded', () => {
    const r = route('london-gatwick-istanbul');
    expect(r.slug).toBe('london-gatwick-istanbul');
    expect(r.destinationSlug).toBe('istanbul');
    expect(getDestinationBySlug('istanbul')?.iataCode).toBe('IST');
    expect(r.airlineSlugs).toEqual(['pegasus']);
    expect(r.verification?.note).toContain('AIRPORT IDENTITY UNRESOLVED');
  });

  // Founder ruling (19 Oct 2026): this route is LGW -> IST. Sabiha Gokcen
  // (SAW) fares can never verify or price it. The only guard against a SAW
  // observation is the manual methodology-exclusion list; one SAW-profile
  // observation is not on it. Until that is separately corrected the route
  // must stay pending, which keeps every observation unpublishable.
  it('no Sabiha Gokcen (SAW) observation can publish on the IST route: each is excluded, or the route stays pending', () => {
    const r = route('london-gatwick-istanbul');
    const sawObs = fareObservations.filter((o) => o.routeSlug === 'london-gatwick-istanbul' && /SAW|Sabiha/i.test(`${o.profileId ?? ''} ${o.priceNote} ${o.sourceUrl ?? ''}`));
    expect(sawObs.length).toBeGreaterThan(0);
    const unexcluded = sawObs.filter((o) => !isMethodologyExcluded(o.id)).map((o) => o.id);
    // Known gap, reported for a separate correction: update this list only
    // when that correction is made, never to make the test pass.
    expect(unexcluded).toEqual(['obs-lgw-ist-economy-20260818-8w-v1']);
    if (unexcluded.length > 0) {
      expect(getEffectiveRoutePresentation(r, routeStatusEvents, NOW).status).toBe('unverified');
      for (const o of sawObs) expect(isObservationPublishable(o, r, NOW), o.id).toBe(false);
    }
  });
});

describe('public labels for these routes stay pending', () => {
  const points = buildAtlasAirports(NOW).flatMap((a) => a.countries.flatMap((c) => c.destinations));

  it('the homepage atlas shows the neutral re-check verdict for each of the 22 routes it lists (and it lists most of them)', () => {
    const listed = SLUGS.filter((slug) => points.some((point) => point.routeHref === `/routes/${slug}`));
    expect(listed.length).toBeGreaterThanOrEqual(15);
    for (const slug of listed) {
      const p = points.find((point) => point.routeHref === `/routes/${slug}`)!;
      expect(p.verdict, slug).toMatch(/being re-checked/);
      expect(p.detail, slug).toBeNull();
    }
  });

  it('destination pages list every one of the 22 routes and label each as verification pending', () => {
    for (const slug of SLUGS) {
      const r = route(slug);
      const entry = getDestinationFlightGuideEntries(getDestinationBySlug(r.destinationSlug)!, NOW).find((e) => e.routeSlug === slug);
      expect(entry, slug).toBeDefined();
      expect(routeStatusLabel(entry!), slug).toBe('Route verification pending');
    }
  });

  it('no route anywhere in the portfolio is newly publishing fares while pending', () => {
    for (const r of routes) {
      if (getEffectiveRoutePresentation(r, routeStatusEvents, NOW).status !== 'unverified') continue;
      expect(getPublishableObservationsByRoute(r.slug, NOW), r.slug).toHaveLength(0);
    }
  });
});
