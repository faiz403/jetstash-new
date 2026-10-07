# Chrome weekly fare sweep, 6 October 2026: evidence record and hold

Status: PR #314, founder hold applied the same day. This file preserves the evidence behind what was ingested, what was held and why. The full raw extractor output also lives outside the repo in C:/Users/faiz2/jetstash-fare-sweep-2026-10-06/ (chrome-observations.jsonl, fare-sweep-chrome-2026-10-06.json, chrome-diagnostic-2026-10-06.md, held-entries.json).

## Collection
- Google Flights in Chrome, Cheapest tab, 1 adult, economy, GBP, outbound 17 Nov 2026, return 1 Dec 2026, exact-airport pair (the row's airport pair was checked on every row read).
- Diagnostic about 12:55 BST: MAN-DXB 119 rows (30 separate-tickets rows), MAN-LHE 145 rows (65), LBA-AYT Google error page. Sweep 13:04-13:38 BST: 8-291 rows per route, most routes carrying separate-tickets rows.
- Rows flagged STILL-FETCHING were re-read once settled.

## Reproducibility finding (important)
When the held observations were rechecked later the same day (about 16:30-17:00 BST, new Chrome window, fresh tab), Google returned a much narrower result set for the same searches: MAN-DXB 13 rows with 2 separate-tickets rows (lowest £361, clean) against 119-125 rows with 30-37 separate-tickets rows (lowest £357) at 13:0x; MAN-DLM 9 rows with 2 flagged (lowest £65, clean easyJet non-stop) against 72 rows with 71 flagged (lowest £63). In those later reads the tab reported document.visibilityState = "hidden". The cause is NOT established. Unconfirmed hypotheses: Google loads its extended / separate-tickets results progressively and stalls when the tab is hidden (which would also explain the built-in-browser result set and KAYAK stalling at 75%), or search-volume throttling after roughly 200 searches. Consequence: the 13:0x row sets cannot be re-evidenced today, so any classification that depended on the return leg or the exact row could not be re-verified. A sweep must record result-set breadth at collection time and be repeated from a visible foreground tab before it is treated as archive-grade. UPDATE 7 Oct 2026: see "Verification of the 12 held observations" below; the broad result set was reproduced.

## What the sweep itself verified for every ingested row
Exact airport pair (parsed from the row), dates (17 Nov / 1 Dec in the page inputs, no DATES-NOT-CONFIRMED flag), Cheapest tab selected, 1 adult economy (search URL / page header), GBP. It did NOT open return legs, so every observation is outbound-evidence only.

## Held, not ingested (12 observations)
Basis: the founder instruction to hold anything whose classification or comparison remains uncertain. No 3x price cutoff is used; a large gap alone is not grounds for a hold.

| Observation id | Route | Price | Carrier | Outbound | Google label | Read at (BST) |
|---|---|---|---|---|---|---|
| `obs-man-dlm-economy-20261006-selftransfer-v1` | manchester-dalaman | £63 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:05:08 |
| `obs-man-dlm-economy-20261006-v1` | manchester-dalaman | £2756 | Brussels Airlines and Turkish Airlines | 2 stop(s) | no separate-tickets notice | 13:05:08 |
| `obs-lgw-ayt-economy-20261006-selftransfer-v1` | london-gatwick-antalya | £114 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:10:03 |
| `obs-lgw-dlm-economy-20261006-selftransfer-v1` | london-gatwick-dalaman | £55 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:10:10 |
| `obs-lgw-dlm-economy-20261006-v1` | london-gatwick-dalaman | £393 | Pegasus | 1 stop(s) | no separate-tickets notice | 13:10:10 |
| `obs-brs-rak-economy-20261006-selftransfer-v1` | bristol-marrakech | £85 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:11:46 |
| `obs-lgw-rak-economy-20261006-selftransfer-v1` | london-gatwick-marrakech | £58 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:11:54 |
| `obs-lgw-tng-economy-20261006-selftransfer-v1` | london-gatwick-tangier | £94 | easyJet and Ryanair | 1 stop(s) | flagged "Separate tickets booked together" | 13:13:32 |
| `obs-lgw-tng-economy-20261006-v1` | london-gatwick-tangier | £361 | British Airways and Iberia | 2 stop(s) | no separate-tickets notice | 13:13:32 |
| `obs-lgw-fao-economy-20261006-selftransfer-v1` | london-gatwick-faro | £47 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:29:18 |
| `obs-lgw-fao-economy-20261006-v1` | london-gatwick-faro | £335 | Tap Air Portugal | 1 stop(s) | no separate-tickets notice | 13:29:18 |
| `obs-lgw-ath-economy-20261006-selftransfer-v1` | london-gatwick-athens | £87 | easyJet | non-stop | flagged "Separate tickets booked together" | 13:29:42 |

- 7 secondaries are non-stop outbounds labelled "Separate tickets booked together". Whether the return is also non-stop (separate tickets with no connection) or involves a connection could not be determined, so they are held rather than labelled "Self-transfer itinerary".
- The other 5 belong to four flagged price pairs: manchester-dalaman (clean £2,756 vs £63), london-gatwick-dalaman (£393 vs £55), london-gatwick-faro (£335 vs £47) and london-gatwick-tangier (£361 vs £94, both held). Matching airports, dates, cabin and passenger profile were confirmed from the sweep read, but the return journey and the comparison could not be re-verified later (see Reproducibility finding).

Raw extractor lines for the held routes:

```json
{"s":"manchester-dalaman","src":"chrome-google-flights","at":"13:05:08","rows":72,"ex":72,"st":71,"r":{"p":63,"al":"easyJet","s":0,"dur":"4 hr 25 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":2756,"al":"Brussels Airlines and Turkish Airlines","s":2,"dur":"11 hr 5 min","lay":"3 hr Brussels+1h50m Istanbul","self":false}}
{"s":"london-gatwick-antalya","src":"chrome-google-flights","at":"13:10:03","rows":85,"ex":85,"st":72,"r":{"p":114,"al":"easyJet","s":0,"dur":"4 hr 20 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":181,"al":"Pegasus","s":1,"dur":"7 hr 10 min","lay":"2h5m Sabiha Gökçen","self":false,"bag":"This price does not include overhead bin access."}}
{"s":"london-gatwick-dalaman","src":"chrome-google-flights","at":"13:10:10","rows":48,"ex":48,"st":39,"r":{"p":55,"al":"easyJet","s":0,"dur":"4 hr 10 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":393,"al":"Pegasus","s":1,"dur":"23 hr 50 min","lay":"18h40m Sabiha Gökçen","self":false,"bag":"This price does not include overhead bin access."}}
{"s":"bristol-marrakech","src":"chrome-google-flights","at":"13:11:46","rows":90,"ex":90,"st":74,"r":{"p":85,"al":"easyJet","s":0,"dur":"3 hr 25 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":212,"al":"KLM and Air France","s":2,"dur":"15 hr 20 min","lay":"4h10m Amsterdam+5h10m Paris CDG","self":false}}
{"s":"london-gatwick-marrakech","src":"chrome-google-flights","at":"13:11:54","rows":116,"ex":116,"st":82,"r":{"p":58,"al":"easyJet","s":0,"dur":"3 hr 45 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":75,"al":"TUI Airways","s":0,"dur":"3 hr 30 min","self":false}}
{"s":"london-gatwick-tangier","src":"chrome-google-flights","at":"13:13:32","rows":57,"ex":57,"st":37,"r":{"p":94,"al":"easyJet and Ryanair","s":1,"dur":"9 hr 50 min","lay":"5h40m Madrid","self":true},"nonSelf":{"p":361,"al":"British Airways and Iberia","s":2,"dur":"27 hr 50 min","lay":"12 hr Madrid","self":false,"warn":"Change of airport"}}
{"s":"london-gatwick-faro","src":"chrome-google-flights","at":"13:29:18","rows":59,"ex":59,"st":49,"r":{"p":47,"al":"easyJet","s":0,"dur":"2 hr 55 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":335,"al":"Tap Air Portugal","s":1,"dur":"29 hr","lay":"25h30m Lisbon","self":false}}
{"s":"london-gatwick-athens","src":"chrome-google-flights","at":"13:29:42","rows":116,"ex":116,"st":72,"r":{"p":87,"al":"easyJet","s":0,"dur":"3 hr 45 min","self":true,"bag":"This price does not include overhead bin access."},"nonSelf":{"p":184,"al":"SWISS","s":1,"dur":"6 hr 10 min","lay":"1h45m Zurich","self":false}}
```

## Ingested with fareDirectness "unknown" (11 observations)
A clean fare whose outbound is non-stop is not recorded as "direct": direct requires both legs evidenced non-stop and the return leg was not opened. These carry outboundDirectness "direct", outboundStops 0 and fareDirectness "unknown", so they are not clean-usable for Fare Signal until a both-legs check exists (fail-closed).

- `obs-man-ist-economy-20261006-v1` - manchester-istanbul £186 Turkish Airlines (outbound non-stop; return leg not opened)
- `obs-man-ayt-economy-20261006-v1` - manchester-antalya £136 easyJet (outbound non-stop; return leg not opened)
- `obs-gla-ayt-economy-20261006-v1` - glasgow-antalya £163 Jet2 (outbound non-stop; return leg not opened)
- `obs-man-rak-economy-20261006-v1` - manchester-marrakech £75 Ryanair UK (outbound non-stop; return leg not opened)
- `obs-lgw-rak-economy-20261006-v1` - london-gatwick-marrakech £75 TUI Airways (outbound non-stop; return leg not opened)
- `obs-bhx-aga-economy-20261006-v1` - birmingham-agadir £62 easyJet (outbound non-stop; return leg not opened)
- `obs-man-bcn-economy-20261006-v1` - manchester-barcelona £130 Vueling (outbound non-stop; return leg not opened)
- `obs-lgw-bcn-economy-20261006-v1` - london-gatwick-barcelona £50 easyJet (outbound non-stop; return leg not opened)
- `obs-brs-bcn-economy-20261006-v1` - bristol-barcelona £71 Ryanair (outbound non-stop; return leg not opened)
- `obs-lgw-fco-economy-20261006-v1` - london-gatwick-rome £75 easyJet (outbound non-stop; return leg not opened)
- `obs-bhx-doh-economy-20261006-v1` - birmingham-doha £490 Qatar Airways (outbound non-stop; return leg not opened)

## Not ingested: incomplete KAYAK results (7 routes)
leeds-bradford-antalya, leeds-bradford-dalaman, leeds-bradford-bodrum, glasgow-dalaman, bristol-antalya, bristol-dalaman, newcastle-dalaman. Google Flights returned its error page in both browsers; KAYAK pages never reached completion in background tabs.

## Tracked separately
Fare Watcher has no self-transfer awareness and tie-breaks same-date observations by lower price, so it can evaluate a self-transfer fare as a candidate. It must not silently promote self-transfer observations as suitable deals. Not changed here.

## Verification of the 12 held observations (7 October 2026, 03:09-03:22 BST)

Method: Chrome, Google Flights, the exact 6 Oct sweep searches (outbound Tue 17 Nov 2026, return Tue 1 Dec 2026, 1 adult, economy, GBP), Cheapest tab, "View more flights" expanded, tab reporting visibilityState visible on every read. For each: find the itinerary, Select flight, read the returning flights, select the cheapest return, read the booking page (both legs, labels, booking options).

Methodological conclusion (preserved as ruled): the broad Google Flights result state is reproducible when Chrome is visible and the full results are expanded. Visibility and the expansion were changed together, so visibility alone is NOT proven to be the cause. Reproduction check at 02:28-02:30: MAN-DXB 121 rows (13:0x: 125), MAN-DLM 71 rows (72).

| # | Held observation | Rows (flagged) | Read | What is there now | Outcome |
|---|---|---|---|---|---|
| 1 | man-dlm £63 easyJet (separate tickets) | 71 (71) | 03:09 | MAN-DLM Tue 17 Nov 13:55-21:20 easyJet non-stop; return DLM-MAN Tue 1 Dec 22:10-23:45 easyJet non-stop. Total £62 (BudgetAir, "Separate tickets booked together"); easyJet direct £65, Trip.com £68 | Both legs non-stop, but £63 not reproduced (£62). EXCLUDED |
| 2 | man-dlm £2,756 clean (Brussels Airlines + Turkish) | 71 (71) | 03:11 | No Brussels Airlines/Turkish itinerary at all. The only Brussels row is Ryanair + Pegasus via CRL/SAW at £140 (self transfer). Highest fare on the page £1,876 | Could not be reverified. EXCLUDED |
| 3 | lgw-ayt £114 easyJet (separate tickets) | 91 (76) | 03:12 | LGW-AYT 17 Nov 13:00-20:20 non-stop; return AYT-LGW 1 Dec 21:10-22:50 non-stop. Total £107 (BudgetAir, separate tickets); easyJet direct £112 | £114 not reproduced. EXCLUDED |
| 4 | lgw-dlm £55 easyJet (separate tickets) | 51 (43) | 03:13 | LGW-DLM 17 Nov 08:10-15:20 non-stop; return DLM-LGW 1 Dec 16:15-17:40 non-stop. Total £57, NO separate-tickets label (BudgetAir £57, easyJet direct £60) | £55 not reproduced and the label no longer applies. EXCLUDED |
| 5 | lgw-dlm £393 clean (Pegasus) | 51 (43) | 03:14 | EXACT £393 reproduced. Outbound Pegasus 17 Nov 12:15 -> 18 Nov 15:05, 1 stop SAW (18h40 layover). Return Pegasus DLM-LGW 1 Dec, 1 stop SAW: 06:20-11:10 (2h10 layover) and 20:35-11:10+1 (11h55), both £393. Booking option MakeMyTrip £393, no label. Both legs connecting | Verified, but the claim "cheapest clean" is NOT supported: the easyJet non-stop pair at £57 (no label) is cheaper today. EXCLUDED |
| 6 | brs-rak £85 easyJet (separate tickets) | 83 (67) | 03:15 | BRS-RAK 17 Nov 07:25-10:50 non-stop; return RAK-BRS 1 Dec 11:40-15:15 non-stop. Total £84 (BudgetAir, separate tickets); easyJet direct £88 | £85 not reproduced. EXCLUDED |
| 7 | lgw-rak £58 easyJet (separate tickets) | 121 (81) | 03:16 | No £58 fare. easyJet non-stop 3h45 outbounds are £81 (14:40-18:25) and £89 (07:40-11:25), neither labelled | Could not be reverified. EXCLUDED |
| 8 | lgw-tng £94 easyJet + Ryanair (separate tickets) | 49 (32) | 03:17 | Outbound LGW-TNG 17 Nov 07:25-17:15, 1 stop MAD (5h40), self transfer, £86; cheapest return pairing Vueling + easyJet TNG-LGW 1 Dec 08:15-21:10 via BCN (8h40), self transfer | £94 not reproduced; return leg differs. EXCLUDED |
| 9 | lgw-tng £361 clean (British Airways + Iberia) | 49 (32) | 03:20 | No British Airways itinerary. Nearest: Vueling + Iberia 2 stops £359 (16h20) and Vueling + Iberia 1 stop £362 (34h40). Cheapest unlabelled row today is £171 (Iberia, 1 stop, 24h10) | Could not be reverified. EXCLUDED |
| 10 | lgw-fao £47 easyJet (separate tickets) | 56 (46) | 03:18 | LGW-FAO 17 Nov 06:20-09:15 non-stop; return FAO-LGW 1 Dec 10:10-13:00 non-stop. Total £48 (BudgetAir, separate tickets); easyJet direct £49 | £47 not reproduced. EXCLUDED |
| 11 | lgw-fao £335 clean (Tap Air Portugal) | 56 (46) | 03:21 | EXACT £335 reproduced, no label. Outbound LGW-FAO 17 Nov 10:40 -> 18 Nov 15:40, 1 stop LIS (25h30 layover, 29h). Return FAO-LGW 1 Dec 06:05-15:45, 1 stop LIS (6h05); another £335 return 16:30 -> 2 Dec 09:50 via LIS (13h40). Booking page: Tap direct £335, lowest listed total £328; free carry-on, first bag £47. Both legs connecting | Verified by the label rule, but NOT released: see finding below. HELD BACK for founder ruling |
| 12 | lgw-ath £87 easyJet (separate tickets) | 122 (77) | 03:19 | LGW-ATH 17 Nov 08:05-13:50 non-stop; return ATH-LGW 1 Dec 14:40-16:45 non-stop. Total £90 (BudgetAir, separate tickets); easyJet direct £96, Trip.com £94 | £87 not reproduced. EXCLUDED |

Airports and dates were exact both ways on every itinerary that exists (Tue 17 Nov out, Tue 1 Dec back).

### Finding: what "Separate tickets booked together" is attached to
On the six non-stop easyJet pairs checked (MAN-DLM, LGW-AYT, BRS-RAK, LGW-FAO, LGW-ATH, and LGW-DLM at the time), the label sits on the cheapest booking option (BudgetAir), not on the flights. The same two non-stop easyJet flights can also be booked from easyJet directly, at £1-6 more, with no label. So a row flagged "Separate tickets booked together" does not mean no single-ticket booking exists, and "cheapest clean = cheapest row with no label" understates the cheapest single-ticket fare on those routes. The labels also move during the day (LGW-DLM: separate tickets at 13:0x, unlabelled at 03:13).
Consequences recorded, nothing changed here: (a) the held clean primaries on these routes (MAN-DLM £2,756, LGW-DLM £393, LGW-FAO £335) are not the cheapest single-ticket fare; (b) four already-ingested clean primaries are in the same position: london-gatwick-antalya £181 (easyJet direct £112 today), bristol-marrakech £212 (£88), london-gatwick-marrakech £75, london-gatwick-athens £184 (£96); (c) the extent beyond non-stop easyJet rows, for example 1-stop single-carrier rows carrying the label, was not measured in this sweep; (d) Day 1-4 calibration data is not altered: nothing here proves those classifications were wrong at the time.

### Outcome
Released: 0. Excluded: 12 (10 could not be reproduced at the recorded price or at all; 2 reproduced exactly, #5 and #11, but the cheapest-clean claim is not supported or is unsafe to publish). Ingested observations remain 138 across 78 routes.
