# JetStash commercial completeness review — 2026-10-04

## Outcome

- 89 public routes audited from current main.
- 81 routes have a publishable current fare; 8 remain held back.
- 59 routes have a safe monetised handoff; 30 use a safe non-monetised fallback.
- Traffic readiness: 53 TRAFFIC_READY, 24 TRAFFIC_READY_BUT_NON_MONETISED, 0 FARE_GAP, 10 EVIDENCE_GAP, 2 HOLD.
- GSC is settled through 2026-09-29. It returned route rows for 25 routes; 64 are recorded as zero/absent, not silently omitted.

## Fare rescues completed

- manchester-mumbai: £522 Etihad connecting fare, checked 4 October 2026, exact MAN–BOM, one stop via AUH, no self-transfer warning shown.
- manchester-delhi: £634 Etihad connecting fare, checked 4 October 2026, exact MAN–DEL, one stop via AUH, no self-transfer warning shown.
- Both direct services remain explicitly ended. The new observations describe connecting journeys only and preserve every older archive record.

## Routes still without a fare

| Route | Rescue category | Reason | 28d impressions | Position |
|---|---|---|---:|---:|
| london-heathrow-jeddah | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 7 | 12.285714 |
| london-heathrow-dhaka | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 0 | — |
| manchester-sylhet | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 7 | 8.857143 |
| london-heathrow-sylhet | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 0 | — |
| london-gatwick-ahmedabad | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 17 | 8.470588 |
| london-gatwick-athens | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 0 | — |
| manchester-rome | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 0 | — |
| birmingham-ahmedabad | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 0 | — |

No remaining blank-fare route is ready for an isolated fare append. Three require route refresh first and five retain contradictory/unsafe route evidence. No poor self-transfer fare was revived.

## Non-monetised handoff migration order

All entries remain NOT_GENERATED. The unchanged LHR–JED expiry experiment on 6 and 8 October is the release gate.

| Priority | Route | Pair | Fare state | 28d impressions | Position |
|---:|---|---|---|---:|---:|
| 1 | manchester-izmir | MAN–ADB | £198 | 96 | 26.166667 |
| 2 | london-gatwick-dubai | LGW–DXB | £369 | 52 | 16.096154 |
| 3 | london-heathrow-dubai | LHR–DXB | £389 | 46 | 14.847826 |
| 4 | london-gatwick-rome | LGW–FCO | £70 | 25 | 22.88 |
| 5 | london-gatwick-ahmedabad | LGW–AMD | held back | 17 | 8.470588 |
| 6 | london-heathrow-delhi | LHR–DEL | £455 | 5 | 15.2 |
| 7 | london-heathrow-mumbai | LHR–BOM | £424 | 5 | 10.2 |
| 8 | london-heathrow-jeddah | LHR–JED | held back | 7 | 12.285714 |
| 9 | birmingham-rome | BHX–FCO | £160 | 0 | — |
| 10 | bristol-rome | BRS–FCO | £176 | 0 | — |
| 11 | london-gatwick-agadir | LGW–AGA | £138 | 0 | — |
| 12 | london-gatwick-amritsar | LGW–ATQ | £1220 | 0 | — |
| 13 | london-gatwick-antalya | LGW–AYT | £111 | 0 | — |
| 14 | london-gatwick-athens | LGW–ATH | held back | 0 | — |
| 15 | london-gatwick-barcelona | LGW–BCN | £32 | 0 | — |
| 16 | london-gatwick-bodrum | LGW–BJV | £179 | 0 | — |
| 17 | london-gatwick-dalaman | LGW–DLM | £58 | 0 | — |
| 18 | london-gatwick-doha | LGW–DOH | £388 | 0 | — |
| 19 | london-gatwick-faro | LGW–FAO | £49 | 0 | — |
| 20 | london-gatwick-istanbul | LGW–IST | £143 | 0 | — |
| 21 | london-gatwick-izmir | LGW–ADB | £223 | 0 | — |
| 22 | london-gatwick-marrakech | LGW–RAK | £57 | 0 | — |
| 23 | london-gatwick-tangier | LGW–TNG | £162 | 0 | — |
| 24 | london-heathrow-bengaluru | LHR–BLR | £423 | 0 | — |
| 25 | london-heathrow-casablanca | LHR–CMN | £177 | 0 | — |
| 26 | london-heathrow-dhaka | LHR–DAC | held back | 0 | — |
| 27 | london-heathrow-doha | LHR–DOH | £408 | 0 | — |
| 28 | london-heathrow-lahore | LHR–LHE | £564 | 0 | — |
| 29 | london-heathrow-sylhet | LHR–ZYL | held back | 0 | — |
| 30 | manchester-rome | MAN–FCO | held back | 0 | — |

The full structured Custom Link manifest, including metadata fields, route-specific trip_sub3 convention, CTA wording, and refresh gate, is embedded in the companion JSON audit.

## Top 20 organic opportunities after readiness weighting

The score is deliberately transparent: last-28-day impressions × ranking-band weight × commercial-readiness weight. It is a prioritisation aid, not an SEO claim.

| Rank | Route | Score | Impressions | Position | Fare | Handoff | Class |
|---:|---|---:|---:|---:|---|---|---|
| 1 | manchester-islamabad | 598 | 299 | 39.384615 | ready | monetised | TRAFFIC_READY |
| 2 | manchester-dubai | 459 | 459 | 43.411765 | ready | monetised | TRAFFIC_READY |
| 3 | manchester-lahore | 326 | 163 | 21.368098 | ready | monetised | TRAFFIC_READY |
| 4 | manchester-agadir | 190 | 95 | 24.178947 | ready | monetised | TRAFFIC_READY |
| 5 | birmingham-bodrum | 188 | 47 | 9.914894 | ready | monetised | TRAFFIC_READY |
| 6 | manchester-izmir | 153.6 | 96 | 26.166667 | ready | fallback | TRAFFIC_READY_NON_MONETISED |
| 7 | birmingham-athens | 128 | 32 | 8.25 | ready | monetised | TRAFFIC_READY |
| 8 | london-gatwick-dubai | 124.8 | 52 | 16.096154 | ready | fallback | TRAFFIC_READY_NON_MONETISED |
| 9 | london-heathrow-dubai | 110.4 | 46 | 14.847826 | ready | fallback | TRAFFIC_READY_NON_MONETISED |
| 10 | manchester-doha | 96 | 24 | 9.375 | ready | monetised | TRAFFIC_READY |
| 11 | manchester-dalaman | 92 | 23 | 9.652174 | ready | monetised | TRAFFIC_READY |
| 12 | manchester-mumbai | 57.4 | 287 | 37.425087 | ready | monetised | HOLD |
| 13 | glasgow-bodrum | 44 | 11 | 9.727273 | ready | monetised | TRAFFIC_READY |
| 14 | london-gatwick-rome | 40 | 25 | 22.88 | ready | fallback | TRAFFIC_READY_NON_MONETISED |
| 15 | leeds-bradford-bodrum | 32 | 8 | 8.5 | ready | monetised | TRAFFIC_READY |
| 16 | leeds-bradford-amritsar | 27 | 9 | 12 | ready | monetised | TRAFFIC_READY |
| 17 | london-gatwick-ahmedabad | 17 | 17 | 8.470588 | gap | fallback | EVIDENCE_GAP |
| 18 | leeds-bradford-barcelona | 16 | 4 | 9.25 | ready | monetised | TRAFFIC_READY |
| 19 | london-heathrow-delhi | 12 | 5 | 15.2 | ready | fallback | TRAFFIC_READY_NON_MONETISED |
| 20 | london-heathrow-mumbai | 12 | 5 | 10.2 | ready | fallback | TRAFFIC_READY_NON_MONETISED |

## Internal discovery findings

- Every route remains reachable through the exhaustive /routes catalogue.
- Airport pages derive their route grids from the same route dataset.
- Destination and regional hub surfaces derive route links from the same route records where relevant.
- Route pages provide factual “Other UK airports” links for genuine alternatives.
- No orphaned high-demand route or simple site-wide internal-linking defect was found. No keyword-heavy link or UI change is proposed.

## Blockers

- Custom Links: generation/publication blocked until the same untouched LHR–JED test link is checked after 6 October and after 8 October.
- Eight remaining fare gaps: blocked by overdue, contradictory, or otherwise insufficient route evidence; route truth must be repaired before another fare can publish.
- GSC: only 25 route URLs have returned data in the settled 90-day export. The other 64 are zero/absent, not assumed to have demand.
