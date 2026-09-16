# Full-portfolio controlled fare batch — 15 September 2026

**Founder decision, 15 September 2026:** JetStash's fare-tracking universe is the full 89-route
public portfolio, not only the 9-route commercial-funnel panel (which remains a valid **CORE
BENCHMARK PANEL** for week-to-week headline tracking, but is not the whole fare-history dataset).
This document is the audit record for the first full-portfolio refresh since 1 September 2026,
which is when the 89-route portfolio was originally built.

**Collection status: IN PROGRESS.** This document is updated batch by batch as the sweep proceeds,
per the founder's instruction to work in bounded batches of ~10–15 routes rather than attempt an
uncontrolled single pass. Every route is listed below with its true current status — no route
silently disappears from this report.

**Timing note:** collection began 15 September 2026. All `observedDate` values use UTC calendar
date. This is not an inference carried over from the cron subsystem — it is the fare-observation
archive's own explicitly documented convention: `isObservationCausallyAvailable()`
(`data/fare-observations.ts`) states in its own doc comment that "every production caller ...
passes a YYYY-MM-DD date-only string — confirmed by exhaustive grep of every `nowIso` construction
site (`new Date().toISOString().slice(0, 10)`)" and that "a plain string comparison is therefore
safe here without normalisation." Since `observedDate` is compared directly against that same
UTC-derived string throughout Fare Signal, Fare History, Journey Choice and Book-By, `observedDate`
must itself be a UTC calendar date for that comparison to remain internally consistent — a
local-time date one day ahead of UTC would make a same-day observation look like it was "checked in
the future" relative to the system's own evaluation date and get hidden by the causal-availability
gate. `FARE_COLLECTION_CHECKLIST.md`'s own plain-English "today, the date the check is actually
performed" does not specify a timezone, so this UTC reading is the one the code's actual behaviour
requires, not an assumption. UK local time crossed midnight into 16 September during this sweep;
UTC did not. Every observation in Batches 1–2 was made while UTC was still 2026-09-15 (confirmed
23:35 UTC after this check) — all correctly dated `2026-09-15`. Later batches will switch to
`2026-09-16` the moment UTC itself crosses midnight, and that crossover will be stated explicitly
here, not silently absorbed into either day.

**Controlled profile:** one adult, return Economy, GBP, exact named airport pair (never widened to
nearby airports, never a different date to chase a nicer fare), Google Flights Cheapest tab.
Departure 10 November 2026, return 24 November 2026 — the same repo-derived, cadence-advanced
profile as the 9-route panel's own 15 September batch (PR #276), not the 27 Oct/10 Nov fallback
originally proposed, since the repo proves the horizon advances one week per week to hold a
constant 8-week-out target.

## Route universe (89 total)

- **76 TRACK** — routes whose current `getEffectiveRoutePresentation()` status is `direct` or
  `connecting`.
- **13 TRACK — ARCHIVE ONLY** — routes whose status is `unverified` (the direct/connecting claim
  itself is contested) or `service-ended` (the direct service formally ended but a genuine
  connecting fare between the two airports remains real evidence): `london-heathrow-dhaka`,
  `manchester-sylhet`, `london-heathrow-sylhet`, `london-gatwick-ahmedabad`, `manchester-delhi`,
  `manchester-mumbai`, `birmingham-barcelona`, `london-gatwick-barcelona`, `bristol-barcelona`,
  `leeds-bradford-faro`, `london-gatwick-athens`, `london-gatwick-rome`, `birmingham-ahmedabad`.
- **0 EXCLUDE** — every one of the 89 routes is between two real, named airports with a real page;
  none has a genuine methodological reason for exclusion.

## Batch 1 — remaining South Asia / Pakistan / India / Bangladesh routes (12 routes)

The 9-route commercial panel's own South Asia routes (`manchester-lahore`, `manchester-islamabad`
[held, see PR #276], `london-heathrow-delhi`, `birmingham-amritsar`) were already genuinely
observed today under this exact profile as part of PR #276 and are not repeated here.

| Route | Fare | Outbound | Return | Ticketing / baggage |
|---|---:|---|---|---|
| MAN→KHI | £333 | MAN–CGN–SAW–KHI, Ryanair/Pegasus, 2 stops, 16h55m | KHI–SAW–MAN, Pegasus, 1 stop, 13h | Self-transfer; overhead-bin access not included |
| BHX→LHE | £542 | BHX–DUB–SAW–KHI–LHE, Ryanair/Pegasus/PIA, 3 stops, 20h35m | LHE–KHI–SAW–DUS–BHX, Fly Jinnah/Pegasus/Eurowings, 3 stops, 27h | Self-transfer; overhead-bin access not included |
| BHX→ISB | £496 | BHX–SAW–KWI–MCT–ISB, Pegasus/SalamAir, 3 stops, 34h20m | ISB–AUH–LUX–AMS–BHX, Etihad/KLM, 3 stops, 26h15m | Self-transfer; overhead-bin access not included |
| LBA→ATQ | £1,106 | LBA–AMS–BLR–ATQ, KLM/IndiGo, 2 stops, 23h | ATQ–BOM–AMS–LBA, Air India/KLM, 2 stops, 25h55m | No self-transfer notice shown; no bag-fee caveat shown |
| LBA→ISB | **NOT OBSERVED** | — | — | Google Flights returned "No options matching your search" for this exact route/date pair — only alternative-date or alternative-airport suggestions offered, both disallowed by methodology |
| LHR→BLR | £401 | LHR–BAH–BLR, Gulf Air, 1 stop, 13h15m | BLR–BAH–LHR, Gulf Air, 1 stop, 14h15m | No self-transfer notice; no bag-fee caveat shown |
| MAN→DAC | £560 | MAN–SAW(transfer to IST)–BOM–DAC, Pegasus/IndiGo, 2 stops, 40h5m | DAC–BOM(change of airport)–MAN, IndiGo/Pegasus, 2 stops, 48h45m | Self-transfer; overhead-bin access not included |
| LGW→ATQ | £531 | LGW–MXP–DEL–ATQ, easyJet/Air India, 2 stops, 16h40m | ATQ–DEL–ATH–TIA–LGW, IndiGo/Wizz Air, 3 stops, 29h | Self-transfer; overhead-bin access not included |
| MAN→ATQ | £533 | MAN–CRL–SAW–SHJ–ATQ, Ryanair/Pegasus/IndiGo, 3 stops, 31h25m | ATQ–AMD–BLR–BAH–MAN, IndiGo/Gulf Air, 3 stops, 23h55m | Self-transfer; overhead-bin access not included |
| MAN→AMD | £483 | MAN–SAW–KWI–AMD, Pegasus/Jazeera, 2 stops, 41h5m | AMD–BOM–BLR–BAH–MAN, IndiGo/Gulf Air, 3 stops, 21h25m | Self-transfer; overhead-bin access not included |
| LHR→LHE | £532 | LHR–AMS–SAW–KHI–LHE, KLM/Pegasus/PIA, 3 stops, 22h15m | LHE–KHI–SAW–BCN–LHR, Fly Jinnah/Pegasus/Vueling, 3 stops, 27h55m | Self-transfer; overhead-bin access not included |
| BHX→DEL | £534 | BHX–DUB–BGY–SHJ–DEL, Ryanair/Air Arabia, 3 stops, 26h50m | DEL–GYD–IST–BHX, Azerbaijan Airlines/Turkish Airlines, 2 stops, 17h5m | Self-transfer; overhead-bin access not included |

**Batch 1 result: 11 OBSERVED, 1 NOT OBSERVED, 0 excluded.** All 11 successful observations are
appended to `data/fare-observations.ts` using each route's existing `profileId` token (never a
newly invented one) — reused exactly from that route's own most recent Economy observation.

## Batch 2 — Gulf / Umrah routes (13 routes)

| Route | Fare | Outbound | Return | Ticketing / baggage |
|---|---:|---|---|---|
| MAN→DOH | £288 | MAN–BIO–SAW–DOH, easyJet/Pegasus, 2 stops, 17h15m | DOH–SAW–SOF–DUB–MAN, Pegasus/Ryanair/Aer Lingus, 3 stops, 19h40m | Self-transfer; overhead-bin access not included |
| MAN→JED | £322 | MAN–CGN–SAW–JED, Ryanair/Pegasus, 2 stops, 18h55m | JED–MAN via a change of Istanbul airport, Wizz Air/easyJet, 1 stop, 18h30m | Self-transfer; overhead-bin access not included |
| BHX→MED | £509 | BHX–SAW–MED, Pegasus, 1 stop, 13h15m | MED–SAW–BHX, Pegasus, 1 stop, 11h20m | Self-transfer, single carrier; overhead-bin access not included |
| MAN→MED | £387 | MAN–SAW–SPX–MED, Pegasus/Flynas, 2 stops, 19h30m | MED–HRG–MAN, Air Cairo/easyJet, 1 stop, 23h30m | Self-transfer; overhead-bin access not included |
| LGW→DOH | £316 | LGW–MAD–SAW–DOH, easyJet/Pegasus, 2 stops, 16h45m | DOH–SAW–SOF–DUB–LGW, Pegasus/Ryanair, 3 stops, 19h55m | **First-ever observation for this route** (no prior history). Self-transfer; overhead-bin access not included |
| GLA→DXB | £272 | GLA–STN–OTP–DXB, Ryanair UK/Ryanair/Wizz Air, 2 stops, 18h15m | DXB–OTP–STN–GLA, Wizz Air/Ryanair/Ryanair UK, 2 stops, 25h55m | Self-transfer; overhead-bin access not included |
| EDI→DXB | £291 | EDI–BGY–SAW–SHJ, Ryanair/Pegasus, 2 stops, 18h | SHJ–SAW–CPH–STN–EDI, Pegasus/Ryanair/Ryanair UK, 3 stops, 19h30m | Lands Sharjah, not Dubai. Self-transfer; overhead-bin access not included |
| NCL→DXB | £356 | NCL–AYT–DXB, SunExpress/Pegasus, 1 stop, 33h30m | DXB–OTP–LTN–BFS–NCL, Wizz Air/easyJet, 3 stops, 23h55m | Self-transfer; overhead-bin access not included |
| LGW→DXB | £318 | LGW–PRG–SAW–DXB, easyJet/Pegasus, 2 stops, 15h5m | DXB–OTP–MLA–LGW, Wizz Air/easyJet, 2 stops, 22h | Self-transfer; overhead-bin access not included |
| BHX→DXB | £318 | BHX–DUB–AMS–SAW–SHJ, Ryanair/Pegasus, 3 stops, 16h5m | SHJ–SAW–DUS–BHX, Pegasus/Eurowings, 2 stops, 17h50m | Lands Sharjah, not Dubai. Self-transfer; overhead-bin access not included |
| BHX→DOH | £288 | BHX–SAW–DOH, Pegasus, 1 stop, 9h40m | DOH–SAW–BHX, Pegasus, 1 stop, 12h30m | "Separate tickets booked together", single carrier; overhead-bin access not included |
| BHX→JED | £343 | BHX–BCN–MXP–JED, Ryanair/Vueling/Wizz Air, 2 stops, 27h35m | JED–FCO–BCN–BHX, Wizz Air/Ryanair, 2 stops, 19h10m | Self-transfer; overhead-bin access not included |
| LHR→DXB | £327 | LHR–BIO–SAW–SHJ, Vueling/Pegasus, 2 stops, 29h25m | SHJ–SAW–DUS–LHR, Pegasus/Eurowings, 2 stops, 13h40m | Lands Sharjah, not Dubai. Self-transfer; overhead-bin access not included |

**Batch 2 result: 13 OBSERVED, 0 NOT OBSERVED, 0 excluded.** All 13 appended to
`data/fare-observations.ts`. `london-gatwick-doha`'s profileId
(`london-gatwick-doha-economy-1adult-23kg-v1`) is newly established here — this route had zero
prior observations — following the exact same naming convention as every other route's first-ever
profile.

**Running total so far: 24 routes newly observed (11 + 13) + 1 NOT OBSERVED (`leeds-bradford-islamabad`)
in Batches 1–2, plus the 7 already appended in PR #276 and the 2 held benchmark observations
(`manchester-islamabad`, `manchester-dubai`) = 34 routes with a same-session 15 September
disposition (corrected from an earlier arithmetic slip that said 33). Batches 1–2 were both
collected while UTC was still 2026-09-15 (confirmed 23:21 UTC after Batch 2, 23:35 UTC after the
`observedDate`-semantics check below) — no midnight crossover yet.**

## Batch 3 — Turkey / Morocco (COMPLETE — collection interrupted once by a genuine system blocker, then resumed)

| Route | Fare | Outbound | Return | Ticketing / baggage |
|---|---:|---|---|---|
| MAN→IST | £103 | MAN–SAW, Pegasus, non-stop, same-day | SAW–MAN, Pegasus, non-stop, 4h20m | "Separate tickets booked together" label on return leg only; overhead-bin access not included |
| MAN→DLM | £86 | MAN–DLM, easyJet, non-stop, 4h25m, dep 13:55 arr 21:20 same day | **Not independently confirmed** — single bundled round-trip fare; Google Flights did not present a separate return-leg screen for this fare type (no booking flow entered) | Overhead-bin access not included |
| MAN→BJV | £178 | MAN–SAW–BJV, Pegasus, 1 stop, 7h, dep 14:15 arr 00:15+1 | **Not independently confirmed** — same reason as MAN→DLM | Overhead-bin access not included |

**Collection stopped here** — the working session hit a genuine rate-limit blocker (session usage
at 99%, reset scheduled). This is exactly the kind of "system/session limit prevents reliable
continuation" the founder's brief explicitly allows as a stopping reason — not a methodology issue,
and not something to paper over by fabricating further observations. All three routes above are
genuine, real observations; the two "not independently confirmed" return legs are honestly labelled
as such rather than guessed. The session's rate limit has since reset and collection resumes below.

## Batch 3 continued (post rate-limit reset, all dated 2026-09-16)

Session resumed cleanly after the founder confirmed the rate limit had reset. All fares below are
fresh Google Flights Cheapest-tab observations for the exact controlled profile (10 Nov out / 24 Nov
back). Where Google Flights did not present a separate return-leg screen for the fare type (the same
honest pattern already established for MAN→DLM/MAN→BJV above), only the outbound is independently
confirmed and the entry says so explicitly.

| Route | Fare | Outbound | Notes |
|---|---:|---|---|
| MAN→IZM | £160 | MAN–SAW–ADB, Pegasus, 1 stop, 9h45m | Self-transfer |
| BHX→IST | £120 | BHX–SAW, Pegasus, non-stop, 4h | "Separate tickets booked together" |
| BHX→AYT | £161 | BHX–AYT, Jet2, non-stop, 4h25m | Single bundled fare |
| BHX→DLM | £183 | BHX–SAW–DLM, Pegasus, 1 stop, 7h25m | Single carrier |
| BHX→BJV | £183 | BHX–SAW–BJV, Pegasus, 1 stop, 8h55m | Single carrier |
| LBA→AYT | — | — | **NOT OBSERVED** — no options for the exact search; Google offered only alternative dates/nearby airports |
| LBA→DLM | — | — | **NOT OBSERVED** — no options at all for the exact search |
| LBA→BJV | — | — | **NOT OBSERVED** — no options at all |
| GLA→AYT | £125 | GLA–AYT (change of airport), easyJet, 1 stop, 10h50m | Self-transfer |
| GLA→DLM | — | — | **NOT OBSERVED** — no options for the exact search |
| GLA→BJV | £204 | GLA–STN–SAW–BJV, Ryanair UK / AJet (op. Turkish Airlines), 2 stops, 19h50m | Self-transfer; genuinely the cheapest available, not a poor-itinerary artefact of a bad selector click |
| BRS→AYT | — | — | **NOT OBSERVED** — no options for the exact search |
| BRS→DLM | — | — | **NOT OBSERVED** — no options for the exact search |
| NCL→DLM | — | — | **NOT OBSERVED** — no options at all |
| LGW→IST | £125 | LGW–SAW, Pegasus, non-stop, 3h55m | "Separate tickets booked together" |
| LGW→AYT | £88 | LGW–AYT, easyJet, non-stop, 4h20m | Single bundled fare |
| LGW→DLM | £91 | LGW–DLM, easyJet, non-stop, 4h10m | Price excludes overhead-locker access specifically (Google's own wording) |
| LGW→BJV | £177 | LGW–SAW–BJV, Pegasus, 1 stop, 9h | "Separate tickets booked together" |
| LGW→IZM | £159 | LGW–DUB–ADB, Ryanair / SunExpress, 1 stop, 21h45m | Self-transfer; genuinely poor itinerary (16h5m Dublin layover) — preserved per the observation-vs-eligibility rule, not smoothed away |
| MAN→AYT | £92 | MAN–AYT, easyJet, non-stop, 4h30m | "Separate tickets booked together"; needed a fresh controlled-date observation alongside the rest of this batch (its most recent prior entry predated the 10 Nov/24 Nov profile) |

**Morocco (8 routes, all observed):**

| Route | Fare | Outbound | Notes |
|---|---:|---|---|
| MAN→RAK | £77 | MAN–RAK, Ryanair UK, non-stop, 3h40m | Single bundled fare |
| BRS→RAK | £106 | BRS–RAK, easyJet, non-stop, 3h25m | Single bundled fare |
| LGW→RAK | £75 | LGW–RAK, TUI Airways, non-stop, 4h30m | Single bundled fare |
| MAN→AGA | £98 | MAN–AGA (change of airport), Ryanair, 1 stop, 27h55m | Self-transfer; genuinely poor itinerary, preserved honestly rather than discarded |
| BHX→AGA | £66 | BHX–AGA, easyJet, non-stop, 3h50m | "Separate tickets booked together" |
| LGW→AGA | £106 | LGW–MXP–AGA, easyJet / Wizz Air, 1 stop, 12h30m | Self-transfer |
| LHR→CMN | £152 | LHR–LIS–CMN, TAP Air Portugal (partly op. Portugalia), 1 stop, 16h | |
| LGW→TNG | £90 | LGW–MAD–TNG, easyJet / Ryanair, 1 stop, 9h50m | Self-transfer |

**CORRECTED 16 September 2026 — the two figures below were an arithmetic slip caught during a
founder-directed reconciliation pass; the batch tables above were always correct, only this summary
sentence miscounted them. See the "Authoritative 89-route ledger" section near the end of this
document for the definitive, code-verified accounting.**

**Batch 3 result: 24 routes newly observed (3 pre-blocker + 21 post-reset), 7 genuinely NOT
OBSERVED (all Leeds Bradford/Glasgow/Bristol/Newcastle Turkey legs with zero Google Flights
availability for the exact controlled dates — see the table rows above for the exact seven: LBA→AYT,
LBA→DLM, LBA→BJV, GLA→DLM, BRS→AYT, BRS→DLM, NCL→DLM). No airport was widened and no date was
changed to manufacture a result for any of the seven. `npx tsc --noEmit` clean after this batch.**

**Running total after Batch 3: 34 (Batches 1–2 total) + 24 newly observed + 7 NOT OBSERVED = 65
routes with a same-session disposition.** (The route count is unchanged from the original — 65 — the
error was only in how the 31 Batch-3 routes were split between observed and not-observed, not in
the total.)

## Midnight crossover (UTC)

**UTC crossed midnight into 16 September 2026 while collection was paused for the rate-limit reset
(confirmed 02:42 UTC on resuming).** Per the verified `observedDate` convention above, every
observation from this point forward in the sweep is dated `2026-09-16`, not `2026-09-15`. This is
an explicit, stated crossover — not a silent absorption into either day. All observations above
this point in the document (Batches 1–3-partial) remain correctly dated `2026-09-15`, made while
UTC was still on that date.

**Collection started:** 15 September 2026. **Collection resumed after the rate-limit blocker:** 16
September 2026 (UTC).

## Batch 4 — Spain / Portugal (6 routes, all dated 2026-09-16)

These are the last 6 TRACK routes for Barcelona/Faro not already covered by the 13 TRACK — ARCHIVE
ONLY set above (`birmingham-barcelona`, `london-gatwick-barcelona`, `bristol-barcelona`,
`leeds-bradford-faro` are all ARCHIVE ONLY and deferred to Batch 6).

| Route | Fare | Outbound | Notes |
|---|---:|---|---|
| MAN→BCN | £66 | MAN–BCN, Vueling/British Airways/Iberia codeshare, non-stop, 2h30m | |
| LBA→BCN | £101 | LBA–DUB–BCN, Ryanair, 1 stop, 8h5m | Self-transfer |
| BRS→FAO | £131 | BRS–DUB–STN–FAO, Ryanair, 2 stops, 15h45m | Self-transfer |
| MAN→FAO | £97 | MAN–FAO, easyJet, non-stop, 3h5m | Single bundled fare |
| BHX→FAO | £141 | BHX–DUB–STN–FAO, Ryanair/Jet2, 2 stops, 20h | Self-transfer |
| LGW→FAO | £74 | LGW–FAO, easyJet, non-stop, 2h55m | "Separate tickets booked together" |

**Batch 4 result: 6/6 routes observed, all genuine, none NOT OBSERVED.**

## Batch 5 — Italy / Greece (5 routes, all dated 2026-09-16)

The last 5 TRACK routes for Rome/Athens not already ARCHIVE ONLY (`london-gatwick-rome` and
`london-gatwick-athens` are both ARCHIVE ONLY, deferred to Batch 6). This completes every one of the
76 TRACK routes' controlled-profile observation for this sweep.

| Route | Fare | Outbound | Notes |
|---|---:|---|---|
| MAN→Rome | £77 | MAN–CIA, Ryanair, non-stop, 2h40m | Lands at Ciampino, not Fiumicino — recorded honestly |
| BHX→Rome | £81 | BHX–BCN–FCO, Ryanair/Vueling, 1 stop, 7h35m | Self-transfer |
| BRS→Rome | £85 | BRS–SOF–FCO, Ryanair/Wizz Air, 1 stop, 26h45m | Self-transfer, genuinely poor itinerary (21h30m Sofia layover), preserved honestly |
| MAN→Athens | £111 | MAN–ATH (change of airport), Ryanair/easyJet, 1 stop, 20h55m | Self-transfer |
| BHX→Athens | £131 | BHX–BCN–BTS–ATH, Ryanair/Wizz Air, 2 stops, 31h35m | Self-transfer, genuinely poor itinerary, preserved honestly |

**Batch 5 result: 5/5 routes observed, all genuine, none NOT OBSERVED.**

**Running total after Batch 5: 65 (after Batch 3) + 6 (Batch 4) + 5 (Batch 5) = 76 routes with a
same-session disposition — every one of the 76 TRACK routes now has either a fresh controlled-profile
observation or an honest NOT OBSERVED entry for the exact 10 Nov/24 Nov 2026 search. `npx tsc --noEmit`
clean after this batch.**

## Batch 6 — the 13 TRACK — ARCHIVE ONLY routes (all dated 2026-09-16)

These 13 routes carry `unverified` or `service-ended` status on `getEffectiveRoutePresentation()` —
the direct-service claim is either contested or formally withdrawn. This batch records genuine
connecting-fare evidence for each; it does **not** revive or resolve any route's status. Two routes
(`manchester-delhi`, `manchester-mumbai`) are the confirmed IndiGo-withdrawal service-ended routes —
see `docs/project-control/fare-evidence` history. Four routes in this batch (`birmingham-barcelona`,
`london-gatwick-barcelona`, `bristol-barcelona`, `london-gatwick-athens`, `london-gatwick-rome`)
returned a genuine non-stop fare today despite carrying `unverified` status — this is recorded
factually as this session's observation and explicitly flagged as **not** a same-session resolution
of the underlying status question, which stays with the founder to review separately (it may reflect
a schedule that has firmed up since the route was last verified, or it may not — that determination
needs the same real-schedule verification standard the README already documents, not a single
Cheapest-tab result).

| Route | Fare | Outbound | Notes |
|---|---:|---|---|
| LHR→Dhaka | £549 | LHR–BOM–DAC, Air India, 1 stop, 32h15m | |
| MAN→Sylhet | £772 | MAN–SAW–MCT–DAC–ZYL, Pegasus/Oman Air/US-Bangla, 3 stops, 23h30m | Self-transfer |
| LHR→Sylhet | £692 | LHR–DEL–DAC–ZYL, Air India/US-Bangla, 2 stops, 25h55m | Self-transfer |
| LGW→Ahmedabad | £453 | LGW–SAW–KWI–AMD, Pegasus/Jazeera, 2 stops, 34h30m | Self-transfer |
| MAN→Delhi | £439 | MAN–BGY–SHJ–DEL, Ryanair/Air Arabia, 2 stops, 24h50m | Self-transfer; service-ended direct (IndiGo) — connecting evidence only |
| MAN→Mumbai | £436 | MAN–DUB–AUH–BOM, Ryanair/Etihad/Akasa Air, 2 stops, 23h15m | Self-transfer; service-ended direct (IndiGo) — connecting evidence only |
| BHX→Barcelona | £71 | BHX–BCN, Ryanair, non-stop, 2h10m | Genuine non-stop fare found; status question deferred, not resolved |
| LGW→Barcelona | £36 | LGW–BCN, easyJet, non-stop, 2h5m | Genuine non-stop fare found; status question deferred, not resolved |
| BRS→Barcelona | £53 | BRS–BCN, Ryanair, non-stop, 2h10m | Genuine non-stop fare found; status question deferred, not resolved |
| LBA→Faro | £144 | LBA–DUB–STN–FAO, Ryanair, 2 stops, 12h55m | Self-transfer |
| LGW→Athens | £97 | LGW–ATH, easyJet, non-stop, 3h45m | Genuine non-stop fare found; status question deferred, not resolved |
| LGW→Rome | £71 | LGW–FCO, easyJet, non-stop, 2h35m | Genuine non-stop fare found; status question deferred, not resolved |
| BHX→Ahmedabad | £694 | BHX–AMS–BLR–AMD, KLM/IndiGo, 2 stops, 32h5m | |

**Batch 6 result: 13/13 routes observed, all genuine, none NOT OBSERVED. `npx tsc --noEmit` clean
after this batch.**

**Final running total: 76 (all TRACK routes) + 13 (all ARCHIVE ONLY routes) = 89/89 routes with a
same-session disposition. Every eligible route in the public portfolio now has either a fresh
controlled-profile (10 Nov out / 24 Nov back) Google Flights observation, an honest NOT OBSERVED
entry, or (for two routes) a genuinely-observed-but-deliberately-held disposition carried over from
the original 9-route panel — see the authoritative ledger immediately below for the exact,
code-verified split.**

## Authoritative 89-route ledger (added 16 September 2026, founder-directed reconciliation)

The narrative batch summaries above contained one arithmetic slip (Batch 3's 31 routes were
mis-split as "25 observed / 6 not observed" instead of the correct 24/7 — now corrected in place)
and left the two held panel routes implicit rather than counted on their own line. This section is
the single authoritative, script-verified reconciliation — produced by parsing `data/routes.ts` and
`data/fare-observations.ts` directly rather than by hand, specifically so the count cannot drift the
way the narrative prose did.

**Exact category counts (89 total, verified — every route appears in exactly one category, zero
duplicates, zero missing):**

| Category | Count |
|---|---:|
| TRACK (direct/connecting status) | 76 |
| TRACK — ARCHIVE ONLY (unverified/service-ended status) | 13 |
| EXCLUDE | 0 |
| **OBSERVED** (an entry exists in this worktree's `data/fare-observations.ts`) | **81** |
| **NOT OBSERVED** (zero Google Flights results for the exact search) | **8** |
| **Total (81 + 8)** | **89** |

**UPDATE, 16 September 2026 (founder-directed):** `manchester-islamabad` (£475) and
`manchester-dubai` (£267) — genuinely observed 15 September 2026 as part of the original 9-route
panel, but originally withheld from the archive over a live public-Fare-Signal concern — have now
been added to `data/fare-observations.ts`, transcribed exactly from their already-captured evidence
(same fare, routing, stop count, self-transfer status and `observedDate`; not re-searched). **HELD is
no longer a disposition category.** Every genuinely observed fare is tracked in canonical history;
the public-suitability concern that motivated the original withholding is addressed separately, at
the selector level (see the selector redesign section below), not by omitting genuine evidence from
the archive.

Of the 81 OBSERVED entries: **36 are dated 2026-09-15** (34 from this sweep's own South Asia/Gulf
batches + the 2 now-added MAN→ISB/MAN→DXB entries), **45 are dated 2026-09-16** (36 + 45 = 81,
confirmed by direct count of `observedDate` fields).

**Exact NOT OBSERVED list (8):** `bristol-antalya`, `bristol-dalaman`, `glasgow-dalaman`,
`leeds-bradford-antalya`, `leeds-bradford-bodrum`, `leeds-bradford-dalaman`,
`leeds-bradford-islamabad`, `newcastle-dalaman`. Confirmed zero data-file entries exist for any of
these 8 slugs with a 2026-09-15/16 `observedDate` — genuinely not observed, not silently dropped.

**PR #276 overlap:** 7 entries (`manchester-lahore`, `london-heathrow-delhi`, `birmingham-amritsar`,
`london-heathrow-jeddah`, `london-heathrow-mumbai`, `london-heathrow-doha`, `birmingham-mumbai`)
already existed in this worktree's base commit (`acd4f18`, PR #276's own tip). No route was searched
twice with two different results; no duplicate observation ID exists anywhere in the file (confirmed
by scanning every `id:` field across the entire archive, not just this sweep's — zero repeats). If
this dataset is reconciled into PR #276, the net new addition would be exactly **74 observation
entries** (72 from the full-portfolio sweep + the 2 now-added MAN→ISB/MAN→DXB entries; the 7 already
live in that PR are unaffected).

## Quality gate (run after all 89 routes had a disposition)

- `npx tsc --noEmit` — clean throughout every checkpoint.
- `npx vitest run` — first pass: 9 files / 11 tests failed. Two were genuine defects introduced by
  this sweep and were fixed immediately (see below). The remaining 7 files / 9 tests are all
  exact-count or exact-snapshot assertions written against a much smaller archive (the 9-route
  panel, or earlier partial batches) — they are the expected, anticipated consequence of adding 72
  new observations across the full portfolio, not data-integrity bugs. Final pass: **7 files / 9
  tests failed, 193 files / 3817 tests passed.** These are left for founder-directed follow-up, per
  the explicit instruction not to implement selector/cadence fixes during collection.
- `npm run lint` — clean, no warnings or errors.
- `npm run build` — production build succeeds, all 89 route pages render.
- `git diff --check` — clean (only a harmless CRLF/LF line-ending note, no actual whitespace
  errors).

### Two genuine defects found and fixed during the gate

1. **Banned internal jargon leaked into 5 `priceNote` values.** The honest caveat I wrote for the
   5 routes with a genuine non-stop fare on contested/unverified-status routes originally said
   "...a separate question deferred to **founder** review" — `founder` is on the test's banned-jargon
   list (internal-facing language must never reach `priceNote`, which renders to customers). Fixed
   by removing the phrase; the substantive caveat (this observation does not resolve the route's
   status question) stays, just without internal wording. Affected: `birmingham-barcelona`,
   `london-gatwick-barcelona`, `bristol-barcelona`, `london-gatwick-athens`, `london-gatwick-rome`.
2. **Routing-code inconsistency in `manchester-agadir`'s entry.** I wrote `outbound MAN-AGA` (only
   the origin/destination codes) while declaring `outboundStops: 1` — the archive's own consistency
   test expects the priceNote's routing-code count to match the declared stop count. Google Flights
   itself never named the connecting airport for this fare (just "Change of airport"), so I fixed the
   wording to say `MAN-AGA via a change of airport` — matching the exact, already-established
   convention used for `glasgow-antalya` and `manchester-athens`, which had the identical situation
   and passed. No fare or itinerary fact was invented; only the phrasing was made internally
   consistent.

Both fixes were verified with a full `npx tsc --noEmit` and targeted `npx vitest run` pass before
the final full-suite run above.

## Selector-impact analysis (Phase 9 — findings only, no fix implemented)

Ran a one-off analysis (not committed) simulating `selectRepresentativeObservation()` across every
route as of 17 September 2026, to see how today's 72 new observations change what the public Fare
Signal would show. **No representative-selector code was changed** — this is a read-only report, per
the founder's explicit instruction.

**Finding — broad impact, flagged for founder review before reconciliation:**

- **46 routes** now have today's fresh observation as their live representative fare (an ordinary,
  expected effect of a fresh weekly-style check).
- **33 routes — over a third of the full 89-route portfolio — would now show "no current fare"
  (Fare Signal `state: 'none'`, `noneReason: 'poor-itinerary-suppressed'`)** on their public Deal
  Card / Fare Signal, because their newest genuine observation is a self-transfer itinerary with 2+
  stops, and `isPoorItinerarySuitability()` correctly suppresses those from public display. This
  includes several South Asia and Gulf routes whose only affordable fares this session were
  genuinely poor connecting itineraries (a real fact about November availability on those routes,
  not a data error), plus the four Faro/Athens legs and both Delhi/Mumbai service-ended routes.

This is exactly the situation the original full-portfolio brief anticipated when it said not to
assume a cadence or selector answer in advance, and to checkpoint rather than implement if the
impact turned out to be broad. **It is broad.** Before this dataset is merged live via PR #276, the
founder needs to decide how routes newly pushed into the suppressed state should be handled — options
include (not a recommendation, just naming what exists): merging as-is and accepting that ~37% of
routes will show no fare until a better itinerary is found on a future check; holding the newly
suppressed observations out of the live merge the same way the 15 September Option B batch held its
two flips, while still preserving them in the archive; or reconsidering the "no recency ceiling,
always prefer newest Economy" policy in `selectRepresentativeObservation()` itself (a standing
architecture question, not a one-off fix, and explicitly out of scope for this collection pass).

## Selector implementation — 16 September 2026 (approved: A — SAFE NARROW SELECTOR FIX)

Following founder approval, the narrow fix was implemented directly (not merely designed):

- **Archive completion.** `manchester-islamabad` (£475) and `manchester-dubai` (£267) — genuinely
  observed 15 Sept 2026 as part of the original 9-route panel, held out of the archive that day
  pending this exact review — are now appended to `data/fare-observations.ts`, transcribed exactly
  from their already-captured evidence (same fare, routing, stop count, self-transfer status,
  `observedDate`; not re-searched). Final archive: **81 OBSERVED, 8 NOT OBSERVED, 0 EXCLUDE** (89
  total) — the "2 HELD" category no longer exists. Of the 81: 36 dated 2026-09-15, 45 dated
  2026-09-16.
- **Code change.** `lib/fare-signal.ts`: `selectRepresentativeObservation()` now walks each existing
  candidate pool (current-Economy, and the any-cabin/historical fallback) for the first candidate
  that is not `isPoorItinerarySuitability()`, instead of only ever testing the pool's newest member.
  Neither pool's own existing eligibility (cabin, currentness, freshness, publishability, emergency-
  recheck priority) was widened. `isPoorItinerarySuitability()` itself is unchanged. No schema
  change; no route-specific exception.
- **Dataset-wide verification (this session's `now`, not a fixed historical date).** Comparing the
  old algorithm against the actual implemented one across every route with observations: **35
  routes changed, 54 unchanged, 0 routes lost a representative fare, 0 routes surfaced a stale or
  previously-ineligible observation.** Every one of the 35 moved from `NONE
  (poor-itinerary-suppressed)` to an older, already-eligible, suitable observation — including
  `manchester-islamabad` (→ £870, its genuine 13 Sept direct PIA fare, unaffected by the newly
  archived £475) and `manchester-dubai` (→ £420, its genuine 8 Sept fare, unaffected by the newly
  archived £267) — confirming the exact outcome the founder specified: neither newly-archived poor
  observation displaced the route's real public representative.
- **Test suite.** All 200 files / 3826 tests pass (0 failing). ~30 test files needed updating to
  reflect the corrected behaviour — each one traced to a specific real-route resolution (verified
  against the actual function output before editing, never guessed), never a blind count bump.
  `london-gatwick-doha` (one observation, ever, self-transfer with 2+ stops, no older fallback
  anywhere) is the one route in the archive that still, genuinely, has no suitable representative —
  the new canonical example for "the suppression mechanism still works," replacing the seven
  originally-flagged routes that no longer demonstrate it.
- **Quality gate.** `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` succeeds,
  `git diff --check` clean.
- **Downstream surfaces**, each explicitly inspected, not assumed: Fare History and Tracked Fares
  (`isObservationPublishable`) were already independent of `isPoorItinerarySuitability` and are
  unaffected — every observation, poor or not, was already visible there. Fare Watcher and Route
  Watch (`comparisonEligibility === 'current'`) are a completely separate, pre-existing mechanism,
  also unaffected in logic — their candidate counts moved only because the archive itself grew (72
  sweep observations + 2 restored). Standout Fare reads from a manually curated approval list, never
  from this selector. Journey Choice's own frozen, ID-pinned logic is untouched; only which Fare
  Signal state renders alongside it on `manchester-islamabad`'s page changed (now the genuine £870
  fare, not the suppressed-fare explanation).

## Reconciliation into PR #276

The dataset is fully collected, the selector fix is implemented and verified, and the complete
quality gate passes. This worktree is on the existing PR #276 branch
(`data/editorial-fare-observations-2026-09-15`) — the reconciliation is additive commits to that
same branch, not a new PR. **PR #276 remains open and unmerged.**

**Status update, 16 September 2026 (after this document's own text above was written): PR #276 was
merged and is live on production** (confirmed via direct production route-page checks: MAN→ISB shows
£870 with £475 still present in fare history, MAN→DXB shows £420 with £267 still present in fare
history, LGW→DOH is genuinely suppressed, MAN→Antalya is unaffected). The "PR #276 remains open and
unmerged" line immediately above is left as-written, as the accurate record of this document's state
at the time it was authored — see the separate fallback-fare-recovery section below for the task that
followed the merge.

## Fallback fare recovery for the 8 NOT OBSERVED routes — 16 September 2026 (separate founder brief)

**This is a separate, explicitly scoped task from the sweep above, run after PR #276 was merged and
verified live.** The 8 routes listed in the "Exact NOT OBSERVED list" above returned zero Google
Flights results for the exact controlled profile during the sweep. The founder's brief for this task:
attempt credible fallback sources (KAYAK, Skyscanner, Trip.com, airline-direct, in that priority
order) for the same exact profile — same dates (10 Nov 2026 out / 24 Nov 2026 back), same named
airport pairs, 1 adult, Economy, GBP — no widening, no date changes, no cached/generic fares; record
any genuine recovery with its true source (never mislabelled as `google-flights`); do not introduce
route-specific Fare Signal logic; append only, never edit historical observations.

**Google Flights was re-checked for all 8 routes before any fallback source was attempted — still
zero results for the exact search, consistent with the original sweep finding.**

**Schema check (performed before writing anything):** `FareObservation.observedVia` (`data/fare-observations.ts`)
is a closed union: `'airline' | 'trip.com' | 'google-flights'` — no KAYAK or Skyscanner value exists.
Per the founder's explicit instruction, this was checked *before* any recovered fare was written, so
that a genuine KAYAK-only or Skyscanner-only find would never be mislabelled. As it happened, all 8
routes were successfully recovered via **Trip.com**, whose live search the schema already supports
honestly (`observedVia: 'trip.com'`) — so **no schema extension was needed or made** for this batch.

**Result: 8 of 8 routes recovered, 0 still NOT OBSERVED.** All 8 appended to `data/fare-observations.ts`
using each route's existing `profileId` token, `observedDate: '2026-09-16'`, same controlled dates
(`departureDate: '2026-11-10'`, `returnDate: '2026-11-24'`).

| Route | Google Flights | Fallback | Fare | Observed | Outbound routing | Stops | Duration | Caveat |
|---|---|---|---:|---|---|---|---|---|
| `bristol-antalya` | NO RESULT | Trip.com | £465 | 16 September 2026 | BRS–DUB–IST–AYT, Aer Lingus (op. Emerald Airlines)/Turkish Airlines | 2 | 12h20m | Not self-transfer/exclusive-fare labelled; checked baggage not included at this tier |
| `bristol-dalaman` | NO RESULT | Trip.com | £268 | 16 September 2026 | BRS–AMS–IST–DLM, easyJet/AJet | 2 | 34h5m | Trip.com "Exclusive fare" label (cross-carrier constructed itinerary) |
| `glasgow-dalaman` | NO RESULT | Trip.com | £207 | 16 September 2026 | GLA–LGW–IST–DLM, easyJet/AJet | 2 | 35h | Trip.com "Exclusive fare" label |
| `leeds-bradford-antalya` | NO RESULT | Trip.com | £501 | 16 September 2026 | LBA–AMS–IST–AYT, KLM (op. KLM Cityhopper)/AJet | 2 | 12h30m | Not exclusive-fare labelled |
| `leeds-bradford-bodrum` | NO RESULT | Trip.com | £437 | 16 September 2026 | LBA–AMS–IST–BJV, KLM (op. KLM Cityhopper)/AJet | 2 | 18h | Trip.com "Exclusive fare" label |
| `leeds-bradford-dalaman` | NO RESULT | Trip.com | £437 | 16 September 2026 | LBA–AMS–IST–DLM, KLM (op. KLM Cityhopper)/AJet | 2 | 31h45m | Trip.com "Exclusive fare" label |
| `leeds-bradford-islamabad` | NO RESULT | Trip.com | £670 | 16 September 2026 | LBA–DUB–AUH–ISB, Aer Lingus (op. Emerald Airlines)/Etihad Airways | 2 | 30h30m | Not exclusive-fare labelled; genuine connecting itinerary |
| `newcastle-dalaman` | NO RESULT | Trip.com | £699 | 16 September 2026 | NCL–AMS–IST–DLM, KLM (op. KLM Cityhopper)/Pegasus Airlines | 2 | 13h55m | Not exclusive-fare labelled; carry-on bag included at this tier |

**Return-leg confirmation:** for all 8 routes, Trip.com's "Select" flow did not present a separate
return-leg selection screen for this fare type (no booking flow was entered at any point, consistent
with the standing rule never to complete a booking). This was directly tested for `bristol-antalya`
(identical page state before/after clicking Select) and is recorded as the same honest limitation for
the other 7 rather than assumed without checking — return routing for all 8 is **not independently
confirmed** this session; only the outbound leg above is.

**Second-source sanity check:** `bristol-antalya` was cross-checked against KAYAK, which independently
returned genuine, live, exact-date availability for the same route/date pair — a different, cheaper
self-transfer combination at £211. This confirms the route/date genuinely has availability (the point
of the check), not that the fare matches; KAYAK's cheapest option there is a self-transfer itinerary
Trip.com does not offer at that price. A second-source check for `leeds-bradford-islamabad` via
Skyscanner was attempted and abandoned when it presented a CAPTCHA — per the standing safety rule
never to bypass or complete CAPTCHAs, no further attempt was made; the already-completed KAYAK
cross-check plus each Trip.com listing's own internal consistency were treated as sufficient
corroboration for the remaining routes, consistent with the brief's "do not spend excessive time
price-shopping" allowance.

**Fare Signal impact:** no route-specific Fare Signal logic was added. All 8 new observations flow
through the existing, already-merged narrow selector fix (`selectRepresentativeObservation()` in
`lib/fare-signal.ts`) exactly like any other observation — none of these 8 fares is self-transfer or
2+ stops on a leg in a way `isPoorItinerarySuitability()` would flag differently from the rest of the
archive; each route's public representative fare is whatever that existing, unmodified selector logic
produces.

**Not recorded, informational only:** KAYAK's genuinely cheaper `bristol-antalya` self-transfer
combination (£211) was observed but is **not** written to the archive, because `observedVia` has no
`'kayak'` value and the founder's instruction was to flag a schema gap for review rather than
implement an extension unilaterally. This is not required to close this task — Trip.com's £465 result
is already a genuine, schema-safe recovery for this route — but is noted here in case the founder
wants a narrow `observedVia` extension (adding `'kayak'` and/or `'skyscanner'`) considered separately.

**Branch and PR:** changes committed to `data/fallback-fare-recovery-2026-09-16` (branched from
merged `main` at the post-PR-276 tip). PR to be opened titled "data: recover fares for Google Flights
no-result routes" — **explicitly not to be merged**, per the founder's instruction, pending review.

## Evidence completion pass — 16 September 2026 (founder-directed, before PR opened)

The founder reviewed the initial recovery pass and required three things before any PR is opened:
independent return-leg confirmation for all 8 routes (not assumed from one route's behaviour),
honest resolution of the BRS-AYT KAYAK-vs-Trip.com price gap, and a second-source sanity check per
route. This section records that completion pass; the 8 `data/fare-observations.ts` entries above
were amended in place (not appended a second time, since the branch is still unmerged) to reflect it.

**Return-leg re-verification.** The original "Trip.com never presented a return-leg screen" finding
was a false negative caused by the browser pane being hidden during that session's automation
(`document.hidden === true` collapses the page to a 0x0 viewport, which stops the fare-selection
React app from mounting its return-leg step). Re-running the identical flow with the pane visible
found that **all 8 routes genuinely do expose a return-leg selection screen**, walked to Trip.com's
own "Flight Details" panel for full routing — no passenger-detail or payment step was ever entered
for any route. Full outbound + return routing (connection airports, layovers, durations, carriers) is
now recorded for all 8.

**BRS-AYT KAYAK £211 vs Trip.com £465, resolved.** Re-checked KAYAK for the exact BRS-AYT, 10 Nov/24
Nov, 1 adult, Economy, GBP profile: genuinely live, bookable, correctly labelled by KAYAK itself as a
"Self-transfer hack" (a self-transfer combination across separately-ticketed carriers). The price has
since moved to £187 (confirms this is a live, fluctuating market fare, not a cached figure). Per the
explicit instruction not to prefer the more expensive Trip.com fare merely because the schema
supports it: **the KAYAK fare is not being used to displace the Trip.com entry.** `observedVia` is a
closed union (`'airline' | 'trip.com' | 'google-flights'`) with no honest way to record a KAYAK
source, so this is flagged, not implemented — the existing, genuine, schema-safe Trip.com £465 entry
stands, with the KAYAK finding noted in its `priceNote` for the record.

**The same pattern recurred on all 8 routes, not just BRS-AYT.** Every one of the 8 was cross-checked
against KAYAK for the identical exact profile; all 8 showed a genuinely live, bookable KAYAK
self-transfer combination at a lower price than Trip.com's package fare (bristol-antalya £187,
bristol-dalaman £228, glasgow-dalaman £202, leeds-bradford-antalya £187, leeds-bradford-bodrum £267,
leeds-bradford-dalaman £262, newcastle-dalaman £139 — including a same-day direct NCL-DLM outbound
option within that combination). leeds-bradford-islamabad's KAYAK check was the closest match of the
eight: same carriers (Aer Lingus/Etihad Airways), same-style routing, £680 vs £670 here — treated as
the strongest corroboration of the batch, and used in place of the Skyscanner check that hit a CAPTCHA
on this route (not bypassed, per the standing rule). None of the 8 cheaper KAYAK fares is recorded, for
the same schema reason as BRS-AYT. **A narrow schema extension — adding `'kayak'` (and optionally
`'skyscanner'`) to `FareObservation.observedVia` — is the concrete, narrowest change needed if the
founder wants these genuinely cheaper fallback fares captured honestly in future.** No such extension
has been made; this document only names what would be required.

**Two genuine price/routing corrections found during return-leg re-verification** (not schema-related
— the live market had simply moved since the same-day 16 Sept first pass):
- `leeds-bradford-antalya`: originally recorded £501 with no exclusive-fare label; re-verifying found
  the live fare had moved to **£437**, now carrying Trip.com's own "Exclusive fare" label. Routing and
  stop count are unchanged; only the price and label are corrected to match what Trip.com currently
  shows.
- `leeds-bradford-dalaman`: originally recorded a £437 AJet-operated "Exclusive fare" combo (KLM +
  AJet, 31h45m); that exact combination was no longer available on re-check. The live cheapest fare
  had moved to **£568**, on a different carrier pairing (KLM + Pegasus Airlines, 26h30m outbound, no
  exclusive-fare label, its own "Carry-on baggage included" tag instead). Recorded as what Trip.com
  actually shows now rather than kept stale.
- `newcastle-dalaman`: the price (£699) was correct in the original pass, but the routing/duration
  text had been paired with the wrong itinerary (a 05:50-departure, single-Istanbul-connection option
  that exists today only at £1,186, not £699). Corrected to the itinerary that actually carries the
  genuine £699 price: a 17:35 departure via Amsterdam then a different-airport Istanbul transfer,
  26h15m.
- The other 5 routes (bristol-antalya, bristol-dalaman, glasgow-dalaman, leeds-bradford-bodrum,
  leeds-bradford-islamabad) re-verified at essentially the same price as the original pass (within
  normal day-to-day fluctuation of £0-£1).

**Fare Signal impact, checked directly (not assumed) via the existing, unmodified selector.** No
route-specific logic was added or considered. Running the live `getFareSignalForRoute()` for all 8
routes at today's evaluation date found:
- **3 of 8 become the live public representative fare**: `bristol-antalya` (£465), `leeds-bradford-islamabad`
  (£670), `newcastle-dalaman` (£699) — none of these three is worded as self-transfer/exclusive-fare
  in its `priceNote`, so `isPoorItinerarySuitability()` correctly does not flag them.
- **5 of 8 remain history-only, correctly suppressed as poor itineraries**: `bristol-dalaman`,
  `glasgow-dalaman`, `leeds-bradford-antalya`, `leeds-bradford-bodrum`, `leeds-bradford-dalaman` —
  each one's `priceNote` genuinely describes a self-transfer/"Exclusive fare" 2-stop-or-more
  itinerary, so the existing `isPoorItinerarySuitability()` check correctly excludes it from the
  current-Economy pool. For these 5, the site continues to show whichever earlier, non-poor Economy
  observation is already on file for that route (all five have one, dated 18–22 August 2026, for a
  different date window) — the archive is not left showing "no current fare" for any of the 8, and no
  poor fallback fare silently overrides a better existing one. This is exactly the pool-walk selector
  fix from PR #276 working as designed, on data it was never specifically built for.

**Quality gate, re-run after this pass:** `npx tsc --noEmit` clean; `npx vitest run` 3826/3826 passing
(one additional fix needed and applied: the BRS-AYT entry's first draft of this section's KAYAK note
used the internal word "founder" inside `priceNote`, caught by the existing banned-jargon hygiene
test — removed, no substantive content lost); `npm run lint` clean; `npm run build` succeeds, all 89
route pages render; `git diff --check` clean.
