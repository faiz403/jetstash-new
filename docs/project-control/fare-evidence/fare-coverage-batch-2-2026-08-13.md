# Fare Coverage Programme — Batch 2

**Observation date:** 13 August 2026
**Profile:** one adult, return Economy, GBP at source, 8–22 October 2026 (14 nights), named airport and exact destination
**Method:** manual Google Flights checks; both selected legs opened; observations append-only; `observationReason: routine-weekly`

Batch 2 captured fourteen observations under the locked profile: twelve now render as current Fare Signals, while Birmingham -> Delhi and Birmingham -> Ahmedabad remain recorded but excluded because their route records are Verification Pending. Together with the 35-route baseline, route-level Fare Signal coverage is 47 of 88. Trip.com handoff availability and curated Deal-card membership remain separate from fare evidence; no Deal records were created.

| Route | Fare | Source | Directness | Journey evidence | Baggage |
|---|---:|---|---|---|---|
| Birmingham → Delhi | £658 | Lufthansa and Air India | Connecting | BHX–FRA–DEL 14h20; DEL–FRA–BHX 19h05 | Not stated |
| Birmingham → Ahmedabad | £565 | Air India | Connecting | BHX–DEL–AMD 16h20; AMD–DEL–BHX 23h45 | Not stated |
| Birmingham → Dubai | £407 | Pegasus | Connecting | via SAW; 11h25 out, 10h40 return | Overhead-bin access not included; checked baggage not stated |
| Birmingham → Doha | £393 | Pegasus | Connecting | via SAW; 9h55 out, 12h15 return | Overhead-bin access not included; checked baggage not stated |
| Birmingham → Jeddah | £398 | Pegasus | Connecting | via SAW; 13h45 out, 11h35 return | Overhead-bin access not included; checked baggage not stated |
| Glasgow → Dubai | £740 | Aer Lingus and Qatar Airways | Connecting | two stops each way; via DUB/DOH out and DOH/LHR return | Not stated |
| Edinburgh → Dubai | £611 | Pegasus | Connecting | via SAW; 10h40 out, 11h return | Overhead-bin access not included; checked baggage not stated |
| Newcastle → Dubai | £741 | Emirates | Direct | 7h15 out; 7h40 return | Not stated |
| Bristol → Faro | £67 | easyJet | Direct | 2h40 each way | Overhead-bin access not included; checked baggage not stated |
| Manchester → Faro | £85 | easyJet and Ryanair | Direct | 3h each way; separate tickets shown | Overhead-bin access not included; checked baggage not stated |
| Birmingham → Faro | £77 | Ryanair | Direct | 2h50 out; 2h55 return | Overhead-bin access not included; checked baggage not stated |
| Leeds Bradford → Faro | £52 | Ryanair | Direct | 3h each way; separate tickets shown | Overhead-bin access not included; checked baggage not stated |

| Bristol -> Dalaman | £253 | easyJet | Direct | BRS-DLM 4h10; DLM-BRS 4h30 | Overhead-bin access not included; checked baggage not stated |
| Glasgow -> Antalya | £608 | British Airways | Connecting | GLA-LCY/LGW-AYT 9h25; AYT-LGW/LCY-GLA 12h55; airport changes in London | Not stated |

The Birmingham -> Delhi (£658) and Birmingham -> Ahmedabad (£565) observations remain append-only archive records but are not publicly publishable: both route records are Verification Pending because current authoritative route evidence conflicts. They do not count toward the 47/88 public coverage total.

All fourteen source URLs are recorded on their corresponding `FareObservation` entries. No directness, baggage allowance or fare component was inferred beyond the displayed itinerary evidence.

## Fare Watcher

The rerun returned one internal `new-recent-low` result for Manchester -> Lahore at £574; it did not qualify as a `standout-candidate`, and no public Standout Fare was created.

The existing Phase 1 engine was rerun against the enlarged archive. Its locked rules remain unchanged: at least three comparable observations, at least £25 and 10% below the comparable median, founder verification, and no automatic publication. No Standout Fare candidate was created in this batch.
