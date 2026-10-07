# Chrome weekly fare sweep, 6 October 2026: evidence record and hold

Status: PR #314, founder hold applied the same day; updated 7 Oct 2026 (held-12 verification and offer-level exposure audit: 132 observations / 73 routes now ingested, 18 held). This file preserves the evidence behind what was ingested, what was held and why. The full raw extractor output also lives outside the repo in C:/Users/faiz2/jetstash-fare-sweep-2026-10-06/ (chrome-observations.jsonl, fare-sweep-chrome-2026-10-06.json, chrome-diagnostic-2026-10-06.md, held-entries.json).

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

## Ingested with fareDirectness "unknown" (10 observations; was 11 before obs-lgw-rak was held on 7 Oct)
A clean fare whose outbound is non-stop is not recorded as "direct": direct requires both legs evidenced non-stop and the return leg was not opened. These carry outboundDirectness "direct", outboundStops 0 and fareDirectness "unknown", so they are not clean-usable for Fare Signal until a both-legs check exists (fail-closed).

- `obs-man-ist-economy-20261006-v1` - manchester-istanbul £186 Turkish Airlines (outbound non-stop; return leg not opened)
- `obs-man-ayt-economy-20261006-v1` - manchester-antalya £136 easyJet (outbound non-stop; return leg not opened)
- `obs-gla-ayt-economy-20261006-v1` - glasgow-antalya £163 Jet2 (outbound non-stop; return leg not opened)
- `obs-man-rak-economy-20261006-v1` - manchester-marrakech £75 Ryanair UK (outbound non-stop; return leg not opened)
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

## Offer-level exposure audit and six further holds (7 October 2026, 03:35-04:17 BST)

Founder ruling (approved 7 Oct 2026): cleanliness is a property of the individual bookable offer, not of the Google Flights result row. If the same flights are GBP 48 through BudgetAir with "Separate tickets booked together" and GBP 49 directly with easyJet without that label, GBP 49 is the clean fare and GBP 48 is separate-ticket evidence only. The frozen clean definition (protected, non-self-transfer, at most one stop) is unchanged but is applied to the booking option. Nothing was released from the original 12.

What the 6 Oct data could and could not show: only the single cheapest rejected row and the chosen clean primary were stored per search, with a flagged / not-flagged boolean (not the exact badge). The historical clean OFFER price cannot be reconstructed, so the audit used today's booking pages as a proxy for how each itinerary is sold, and held where historical exposure could not be ruled out.

Audit, across the 78 routes ingested at the time:
- Moved to held (4, already agreed): london-gatwick-antalya GBP 181, bristol-marrakech GBP 212, london-gatwick-marrakech GBP 75, london-gatwick-athens GBP 184. Each had a cheaper non-stop easyJet pair rejected on its row label, and the easyJet-direct offer for such a pair is unlabelled (AYT GBP 112, BRS-RAK GBP 88, ATH GBP 96 on 7 Oct; LGW-RAK not priced direct).
- Moved to held (2, found by the audit): both birmingham-dubai observations (primary GBP 480 and secondary GBP 392). The cheaper rejected row was a Pegasus single-carrier one-stop itinerary that could have an unlabelled offer; it is not reproducible on 7 Oct, so the historical clean price cannot be established. The secondary note refers to the clean fare for the same search, so both are held. This revives the 29 Sep birmingham-dubai fare (GBP 326, three stops, self-transfer shown) as a Route Watch notable-drop lead.
- 12 further routes had a cheaper single-airline-outbound flagged row stored. Ten (birmingham-dalaman, manchester-marrakech, manchester-agadir, manchester-barcelona, leeds-bradford-barcelona, bristol-faro, birmingham-faro, leeds-bradford-faro, manchester-rome, birmingham-jeddah) carry the "Self transfer" badge. For each, the booking options of the cheapest such row were opened (eSky, Kiwi.com, Gotogate, Mytrip, Flightnetwork) and every option inspected was labelled "Self transfer": no unlabelled offer was found in the inspected offers, so the primary stands on that evidence. manchester-faro: the cheaper TAP row (GBP 169, BudgetAir "Separate tickets") also has unlabelled offers at GBP 182 (Trip.com) and GBP 192 (Booking.com) and TAP direct at GBP 202; the cheapest unlabelled offer, GBP 182, is above the stored clean GBP 176, so the primary stands. birmingham-dubai: see above.
- 48 routes where the cheapest rejected 6 Oct row was a multi-airline combination were scanned live for any row labelled "Separate tickets booked together" priced below the stored clean primary, and the booking options of the cheapest such row were opened. Five routes had one (manchester-dubai Pegasus GBP 383; london-gatwick-agadir Norwegian GBP 182; manchester-jeddah Royal Air Maroc GBP 469, Qatar GBP 490 and a third GBP 493; manchester-madinah Pegasus GBP 456; london-gatwick-dubai Pegasus GBP 357). Every booking option inspected for those carried a "Separate tickets booked together" label (Kiwi.com, BudgetAir, Expedia, Booking.com, ly.com): no unlabelled offer was found in the inspected offers, so those primaries stand on that evidence. The multi-airline rows carrying the "Self transfer" badge (the cheapest rejected row on these routes on 6 Oct) were NOT opened: their booking options were not inspected, so for them the evidence is the row badge alone. This audit does not assume that different airlines cannot be sold on one protected ticket (interline or codeshare tickets can be); it makes no claim beyond the offers inspected.
- 14 further routes: the cheapest 6 Oct row was itself clean, so no cheaper rejected row existed.

Limits of this audit: for a labelled candidate only the cheapest one was opened (manchester-jeddah: the cheapest three). Prices are 7 Oct, not 6 Oct. A route can still carry an intermediate labelled row that this audit did not open; the new collection rule (record the exact badge and booking options at collection) removes that gap prospectively. The booking options of multi-airline "Self transfer" rows on the 48 multi-airline routes were not opened, so a single-ticket offer on those itineraries is not ruled out.

Wording correction: the 59 ingested secondary notes previously said Google "labels this fare 'Separate tickets booked together'". The 6 Oct extractor only stored a flagged boolean, and multi-airline combinations show the "Self transfer" badge, so the notes now say "separate tickets or self-transfer (the exact badge text shown on the row was not recorded on the day)". Self-transfer detection (isSelfTransferItinerary) is unchanged and still matches.

### Route Watch side effect (documented 7 Oct 2026)
Holding the newer 6 Oct primaries makes the older 29 Sep observation the current one for those routes, so Route Watch now lists five candidates: manchester-dalaman, london-gatwick-dalaman, london-gatwick-faro, london-gatwick-athens and birmingham-dubai. These are older self-transfer observations resurfacing because newer clean primaries were held. They are verification leads only: they are not validated Standout Fares, must not be automatically published or sent (Route Watch derivation has no send path; the founder snapshot only lists them), and must not be read as evidence that the self-transfer issue is solved. Fare Watcher is not changed in this PR; the existing follow-up to make Fare Watcher self-transfer aware remains open.

Final counts, recomputed from data/fare-observations.ts: 132 observations dated 6 Oct ingested across 73 routes (73 clean, 59 secondary). Held: 18 observations (original 12 plus 6 above). 10 clean fares carry fareDirectness "unknown". Route Watch now has 5 candidates, all derived from older 29 Sep fares of held routes (manchester-dalaman, london-gatwick-dalaman, london-gatwick-faro, london-gatwick-athens, birmingham-dubai), each a lead for founder verification only; the Fare Watcher self-transfer-awareness gap is tracked separately.
