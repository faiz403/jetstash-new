export interface GscPeriodMetrics {
  clicks: number;
  impressions: number;
  ctrPercent: number;
  averagePosition: number | null;
}

export interface GscRoutePerformance {
  slug: string;
  last28: GscPeriodMetrics;
  prior28: GscPeriodMetrics;
  last90: GscPeriodMetrics;
}

export const gscRoutePerformanceSettledDate = '2026-09-29';
export const gscRoutePerformancePeriods = {
  last28: ['2026-09-02', '2026-09-29'],
  prior28: ['2026-08-05', '2026-09-01'],
  last90: ['2026-07-02', '2026-09-29'],
} as const;

const m = (clicks: number, impressions: number, ctrPercent: number, averagePosition: number | null): GscPeriodMetrics => ({ clicks, impressions, ctrPercent, averagePosition });

/**
 * Read-only GSC Wizard export collected 4 October 2026. Search Console marked
 * 30 September onward incomplete, so the settled end date remains 29
 * September. Routes absent here had no row in any of the three exported
 * periods; the portfolio audit records them explicitly as zero/absent.
 */
export const gscRoutePerformance: GscRoutePerformance[] = [
  { slug: 'birmingham-athens', last28: m(2, 32, 6.25, 8.25), prior28: m(0, 18, 0, 13.944444), last90: m(2, 50, 4, 10.3) },
  { slug: 'birmingham-bodrum', last28: m(0, 47, 0, 9.914894), prior28: m(0, 0, 0, null), last90: m(0, 47, 0, 9.914894) },
  { slug: 'glasgow-bodrum', last28: m(0, 11, 0, 9.727273), prior28: m(0, 9, 0, 10.111111), last90: m(0, 20, 0, 9.9) },
  { slug: 'glasgow-dubai', last28: m(0, 2, 0, 9.5), prior28: m(0, 0, 0, null), last90: m(0, 2, 0, 9.5) },
  { slug: 'leeds-bradford-amritsar', last28: m(0, 9, 0, 12), prior28: m(0, 0, 0, null), last90: m(0, 9, 0, 12) },
  { slug: 'leeds-bradford-barcelona', last28: m(0, 4, 0, 9.25), prior28: m(0, 4, 0, 36), last90: m(0, 8, 0, 22.625) },
  { slug: 'leeds-bradford-bodrum', last28: m(0, 8, 0, 8.5), prior28: m(0, 0, 0, null), last90: m(0, 8, 0, 8.5) },
  { slug: 'london-gatwick-ahmedabad', last28: m(0, 17, 0, 8.470588), prior28: m(0, 16, 0, 8), last90: m(0, 48, 0, 8.020833) },
  { slug: 'london-gatwick-dubai', last28: m(0, 52, 0, 16.096154), prior28: m(0, 0, 0, null), last90: m(0, 52, 0, 16.096154) },
  { slug: 'london-gatwick-rome', last28: m(0, 25, 0, 22.88), prior28: m(0, 0, 0, null), last90: m(0, 25, 0, 22.88) },
  { slug: 'london-heathrow-delhi', last28: m(0, 5, 0, 15.2), prior28: m(0, 0, 0, null), last90: m(0, 5, 0, 15.2) },
  { slug: 'london-heathrow-dhaka', last28: m(0, 0, 0, null), prior28: m(0, 1, 0, 31), last90: m(0, 1, 0, 31) },
  { slug: 'london-heathrow-dubai', last28: m(0, 46, 0, 14.847826), prior28: m(0, 0, 0, null), last90: m(0, 46, 0, 14.847826) },
  { slug: 'london-heathrow-jeddah', last28: m(0, 7, 0, 12.285714), prior28: m(0, 5, 0, 28.6), last90: m(0, 299, 0, 44.327759) },
  { slug: 'london-heathrow-mumbai', last28: m(0, 5, 0, 10.2), prior28: m(0, 2, 0, 19.5), last90: m(0, 21, 0, 35.52381) },
  { slug: 'manchester-agadir', last28: m(0, 95, 0, 24.178947), prior28: m(0, 0, 0, null), last90: m(0, 95, 0, 24.178947) },
  { slug: 'manchester-dalaman', last28: m(0, 23, 0, 9.652174), prior28: m(0, 1, 0, 11), last90: m(0, 24, 0, 9.708333) },
  { slug: 'manchester-doha', last28: m(0, 24, 0, 9.375), prior28: m(0, 28, 0, 11.464286), last90: m(0, 61, 0, 9.721311) },
  { slug: 'manchester-dubai', last28: m(0, 459, 0, 43.411765), prior28: m(0, 120, 0, 52.308333), last90: m(0, 579, 0, 45.255613) },
  { slug: 'manchester-islamabad', last28: m(0, 299, 0, 39.384615), prior28: m(2, 226, 0.884956, 42.477876), last90: m(2, 525, 0.380952, 40.71619) },
  { slug: 'manchester-izmir', last28: m(0, 96, 0, 26.166667), prior28: m(0, 0, 0, null), last90: m(0, 96, 0, 26.166667) },
  { slug: 'manchester-lahore', last28: m(0, 163, 0, 21.368098), prior28: m(0, 0, 0, null), last90: m(0, 163, 0, 21.368098) },
  { slug: 'manchester-mumbai', last28: m(0, 287, 0, 37.425087), prior28: m(1, 235, 0.425532, 36.353191), last90: m(1, 522, 0.191571, 36.942529) },
  { slug: 'manchester-sylhet', last28: m(0, 7, 0, 8.857143), prior28: m(0, 1, 0, 7), last90: m(0, 8, 0, 8.625) },
  { slug: 'newcastle-dubai', last28: m(0, 1, 0, 4), prior28: m(0, 3, 0, 5.666667), last90: m(0, 9, 0, 4.222222) },
];
