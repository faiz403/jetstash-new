# Controlled weekly fare observation batch — 15 September 2026

**Collection date:** 15 September 2026
**Profile:** one adult, return Economy, GBP, exact named airport endpoints, 14-night stay, fixed
eight-week horizon 10–24 November 2026 (advanced one week from the 8 September batch's 3 Nov/17 Nov
window).
**Source:** Google Flights only, manual visible-page checks via the Cheapest tab. No scraping,
polling, API harvesting or retrospective backfill was used. No historical (1/8/13 September) fare
was reused for any of these nine entries — every price, routing and duration below was read fresh
this session.
**Baggage treatment:** recorded only when the source displayed an explicit caveat ("This price does
not include overhead bin access") on that exact itinerary — never inferred from carrier or fare
class. Where no such caveat appeared, the archive records `not stated`, not `included`.

All nine currently-tracked routes were genuinely checked today. **Seven were appended to
`data/fare-observations.ts` in this batch; two were deliberately held out — founder decision, 15
September 2026 — because the current representative-fare selector has no recency ceiling, so
appending either would have immediately become that route's live public Fare Signal and tripped
`isPoorItinerarySuitability()` (self-transfer AND 2+ stops on a leg), silently reverting a
deliberate recent state. Both held observations are genuine, complete evidence, not rejected and
not replaced with an older fare — see "OBSERVED TODAY BUT NOT APPENDED" below.**

## APPENDED TO FARE ARCHIVE

| Route / profile | Fare and source | Outbound evidence | Return evidence | Ticketing / baggage |
|---|---:|---|---|---|
| MAN→LHE / `manchester-lahore-economy-1adult-23kg-v1` | £449, self-transfer | MAN–CGN–SAW–KHI–LHE, Ryanair/Pegasus/Pakistan International Airlines, 3 stops, 22h30m | LHE–KHI–SAW–CRL–MAN, Fly Jinnah/Pegasus/Ryanair, 3 stops, 27h30m | Self-transfer; overhead-bin access not included |
| LHR→DEL / `london-heathrow-delhi-economy-1adult-23kg-v1` | £454, no self-transfer notice | LHR–BLR–DEL, Air India/Air India Express, 1 stop, 21h50m | DEL–LHR, Air India, non-stop, 11h10m | Single interline booking; no bag-fee caveat shown |
| BHX→ATQ / `birmingham-amritsar-economy-1adult-23kg-v1` | £611, self-transfer | BHX–KRK–AUH–BOM–ATQ, Ryanair/Wizz Air/IndiGo, 3 stops, 32h45m | ATQ–DXN–HYD–AMS–BHX, IndiGo/KLM, 3 stops, 30h20m | Self-transfer; overhead-bin access not included |
| LHR→JED / `london-heathrow-jeddah-economy-1adult-23kg-v1` | £379, self-transfer | LHR–IST–JED, Turkish Airlines/flyadeal, 1 stop, 16h5m | JED–LHR via Istanbul (change of airport), flyadeal/Turkish Airlines, 1 stop, 15h25m | Self-transfer; no bag-fee caveat shown on either leg |
| LHR→BOM / `london-heathrow-mumbai-economy-1adult-23kg-v1` | £427, no self-transfer notice | LHR–AUH–BOM, Etihad/Akasa Air, 1 stop, 17h15m | BOM–AUH–LHR, Akasa Air/Etihad, 1 stop, 18h20m | Single interline booking; no bag-fee caveat shown |
| LHR→DOH / `london-heathrow-doha-economy-1adult-23kg-v1` | £354, self-transfer | LHR–ARN–SAW–DOH, Scandinavian Airlines/Pegasus (operated by SAS Connect), 2 stops, 17h30m | DOH–SAW–ARN–LHR, Pegasus/Scandinavian Airlines, 2 stops, 17h55m | Self-transfer; overhead-bin access not included |
| BHX→BOM / `birmingham-mumbai-economy-1adult-23kg-v1` | £602, "Separate tickets booked together" | BHX–DOH–BOM, Qatar Airways, 1 stop, 13h5m | BOM–AMS–BHX, KLM (operated by KLM Cityhopper), 1 stop, 15h50m | Separate-tickets label (same practical caveat as self-transfer: no protected connection); overhead-bin access not included |

## OBSERVED TODAY BUT NOT APPENDED

**MAN→ISB — £475**
- Genuinely observed today (15 Sept 2026), Google Flights Cheapest tab, exact 8-week profile.
- Routing: outbound MAN–CGN–SAW–KHI–ISB, Ryanair/Pegasus/Fly Jinnah, self-transfer, 3 stops, 21h50m; return ISB–KHI–SAW–MAN, Fly Jinnah/Pegasus, 2 stops, 18h10m. Price does not include overhead-bin access.
- Held because: `manchester-islamabad`'s current representative Fare Signal is the 13 September £870 direct-PIA observation (`obs-man-isb-economy-20260913-pia-direct-v1`). The selector (`selectRepresentativeObservation()`, `lib/fare-signal.ts`) always prefers the most recently logged Economy observation with no recency ceiling — appending this would have made today's self-transfer, 3-stop £475 fare the new representative, which `isPoorItinerarySuitability()` (`lib/itinerary-suitability.ts`) would then suppress outright, reverting the route's live Fare Signal from a genuine £870 direct fare to "no current fare." That is a substantive public-facing product decision, not something this routine data-collection PR should make silently.
- Not rejected as false evidence. Not replaced with an older fare. Founder review required before this observation (or the underlying selector behaviour) is addressed.

**MAN→DXB (lands Sharjah) — £267**
- Genuinely observed today (15 Sept 2026), Google Flights Cheapest tab, exact 8-week profile.
- Routing: outbound MAN–CGN–SAW–SHJ, Ryanair/Pegasus, self-transfer, 2 stops, 18h; return SHJ–SAW–MAN, Pegasus, 1 stop, 11h50m. Price does not include overhead-bin access. As in prior weekly checks, this route's cheapest itinerary lands at Sharjah, not Dubai airport itself.
- Held because: `manchester-dubai`'s Fare Signal was deliberately un-suppressed on 1 September 2026 after its newest evidence dropped to fewer than 2 stops per leg. Appending today's £267 self-transfer, 2-stop itinerary would make it the new representative observation and immediately re-trigger `isPoorItinerarySuitability()`, undoing that specific, named 1 September fix inside a routine data PR.
- Not rejected as false evidence. Not replaced with an older fare. Founder review required.

## Method and safety checks

- All nine currently-tracked routes were checked this session — the original seven-route rotation
  plus `london-heathrow-delhi` and `birmingham-mumbai`, both added in later weekly batches. No route
  was skipped.
- Every appended `id`/`profileId` reuses the exact existing token for its route — no new profile was
  created, no historical profile token was reinterpreted as baggage evidence.
- No existing observation was edited or deleted. No route truth, affiliate destination/parameter,
  Fare Signal/itinerary-suitability logic, Book-By logic, Business-cabin handling, or Journey Choice
  contract changed. `manchester-islamabad`'s frozen Journey Choice pilot
  (`JOURNEY_CHOICE_FROZEN_OBSERVATION_IDS`, `lib/journey-choice-route-adapter.ts`) is pinned to three
  specific August observation IDs and is completely unaffected by anything in this batch, appended
  or held.
- No manual Fare Watcher run was performed as part of this task; the founder's brief scoped this
  strictly to append-only observation collection, quality gate, and a single PR.

## Follow-up (explicitly not addressed in this PR)

The founder has flagged a genuine, separate product-maintenance question raised by this week's
collection: whether the archive needs a narrow mechanism to let an observation be "observed and
archived" without automatically becoming "eligible to become the public representative Fare
Signal" — so a genuinely poor itinerary can be recorded honestly without a recency-only selector
ever surfacing it live. That is deliberately out of scope here and will be examined separately.
