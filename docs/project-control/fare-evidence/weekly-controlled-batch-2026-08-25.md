# Controlled weekly fare observation batch — 25 August 2026

**Collection date:** 25 August 2026  
**Profile:** one adult, return Economy, GBP, exact named airport endpoints, 14-night stay, fixed
eight-week horizon 20 October–3 November 2026.  
**Source:** Google Flights only, manual visible-page checks. No scraping, polling, API harvesting or
retrospective backfill was used.  
**Baggage treatment:** every selected Cheapest-tab itinerary displayed that overhead-bin access was
not included (except the Riyadh Air result, which showed only the standard optional-bag warning).
No allowance was inferred; the archive records `not stated`.

Both outbound and return legs were opened for every route. The exact search URLs are retained in the
corresponding `FareObservation` records in `data/fare-observations.ts`. No screenshot image was
persisted to the repository; the evidence below is a contemporaneous transcription of the visible
Google Flights result and return-leg pages.

| Route / profile | Fare and source | Outbound evidence | Return evidence | Ticketing / baggage |
|---|---:|---|---|---|
| MAN→ISB / `manchester-islamabad-economy-1adult-23kg-v1` | £460, Riyadh Air | MAN–RUH–ISB, 1 stop, 13h45m, 2h50m Riyadh layover | ISB–RUH–MAN, 1 stop, 14h25m, 2h10m Riyadh layover | No self-transfer notice; baggage not stated, optional charges may apply |
| MAN→LHE / `manchester-lahore-economy-1adult-23kg-v1` | £538, self-transfer | MAN–MXP–CAI–RUH–LHE, Ryanair/Air Cairo/flyadeal/Fly Jinnah, 3 stops, 27h15m | LHE–KHI–SAW–CRL–MAN, Pakistan International Airlines/Pegasus/Ryanair, 3 stops, 31h55m | Self-transfer; no overhead-bin access; baggage not stated |
| MAN→DXB / `manchester-dubai-economy-1adult-baseline-v1` | £314, self-transfer | MAN–CGN–SAW–SHJ, Ryanair UK/Pegasus, 2 stops, 18h10m | SHJ–SAW–CPH–MAN, Pegasus/Ryanair (Malta Air operation), 2 stops, 15h40m | Self-transfer; no overhead-bin access; baggage not stated |
| LHR→JED / `london-heathrow-jeddah-economy-1adult-23kg-v1` | £361, self-transfer | LHR–IST–JED, Turkish Airlines/flyadeal, 1 stop, 13h10m | JED–BUD–MXP–BIO–LHR, Wizz Air/Vueling, 3 stops, 25h30m | Self-transfer; no overhead-bin access; baggage not stated |
| LHR→DOH / `london-heathrow-doha-economy-1adult-23kg-v1` | £425, self-transfer | LHR–BCN–SAW–DOH, Vueling/Pegasus, 2 stops, 25h55m | DOH–AUH–LHR, Etihad, 1 stop, 10h20m | Self-transfer; no overhead-bin access; baggage not stated |
| BHX→ATQ / `birmingham-amritsar-economy-1adult-23kg-v1` | £589, self-transfer | BHX–DUB–FRA–DEL–ATQ, Ryanair/Lufthansa/Air India, 3 stops, 26h45m | ATQ–DEL–SHJ–BGY–BHX, IndiGo/Air Arabia/Ryanair, 3 stops, 26h15m | Self-transfer; no overhead-bin access; baggage not stated |
| LGW→ATQ / `london-gatwick-amritsar-economy-1adult-23kg-v1` | £582, self-transfer | LGW–DUB–AUH–BOM–ATQ, Ryanair/Etihad/IndiGo, 3 stops, 29h35m | ATQ–DEL–DXB–LGW, Air India/Emirates, 2 stops, 20h10m | Self-transfer; no overhead-bin access; baggage not stated |

## Method and safety checks

- The three Flagships were included: MAN→ISB, MAN→LHE and MAN→DXB.
- Core selection was limited to LHR→JED, BHX→ATQ, LHR→DOH and LGW→ATQ. MAN→KHI,
  BHX→LHE and BHX→ISB were skipped because they are in the unresolved Truth Watch set. The other
  Core candidates were left for rotation because their current evidence was newer or their
  incremental customer value was lower this week.
- The new records are date-complete and use each route/cabin's established `profileId` exactly;
  no historical profile token was interpreted as baggage evidence.
- `fareDirectness` is `connecting` for all seven records because each selected result showed at
  least one confirmed stop. No route-level directness claim was inferred from the fare.
- No existing observation was edited or deleted. No route truth, affiliate destination/parameter,
  Fare Signal logic, Book-By logic, Business-cabin handling, or Journey Choice contract changed.
- `isPubliclyPublishable()` is true for all seven new records. Fare Watcher was run after append;
  it detected four internal candidates (three standout candidates and one notable drop). All four
  remain `detected` with founder verification required; nothing was auto-published.
