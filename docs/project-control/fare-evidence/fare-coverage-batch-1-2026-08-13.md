# Fare Coverage Programme — Batch 1 (13 August 2026)

## Controlled profile

Manual Google Flights checks were made on 13 August 2026 for one adult, return Economy,
GBP configured at source, named UK departure airport, exact destination airport, outbound
8 October 2026 and return 22 October 2026 (14 nights). The first ranked bookable result was
recorded. Both legs were opened for directness and routing. No screenshot was persisted in the
repository; the results were inspected live in the browser and recorded contemporaneously.

| Route | Fare | Source | Routing | Baggage |
| --- | ---: | --- | --- | --- |
| Manchester → Istanbul | £179 | Lufthansa City Airlines / Lufthansa | Connecting via Munich; 6h10 outbound, 8h05 return | Not stated; optional charges may apply |
| Manchester → Antalya | £231 | SunExpress | Direct; 4h30 outbound, 5h return | Not stated; optional charges may apply |
| Manchester → Dalaman | £201 | SunExpress | Direct; 4h15 outbound, 4h40 return | Not stated; optional charges may apply |
| Manchester → Bodrum | £351 | Pegasus | Connecting via Istanbul Sabiha Gökçen; 7h35 outbound, 14h25 return | Not stated; overhead-bin access not included in quoted fare |
| Manchester → Izmir | £248 | Pegasus | Connecting via Istanbul Sabiha Gökçen; 8h10 outbound, 6h50 return | Not stated; overhead-bin access not included in quoted fare |
| Manchester → Marrakech | £89 | easyJet | Direct; 3h45 outbound, 3h55 return | Not stated; overhead-bin access not included in quoted fare |
| Manchester → Agadir | £96 | Jet2 / Ryanair UK | Direct on both legs; separate tickets on return | Not stated; overhead-bin access not included in quoted fare |
| Birmingham → Istanbul | £194 | Pegasus | Direct; 3h50 outbound, 4h10 return | Not stated; overhead-bin access not included in quoted fare |
| Birmingham → Antalya | £201 | SunExpress | Direct; 4h25 outbound, 4h50 return | Not stated; optional charges may apply |
| Birmingham → Dalaman | £231 | SunExpress | Direct; 4h20 outbound, 4h40 return | Not stated; optional charges may apply |
| Birmingham → Bodrum | £259 | Pegasus | Connecting via Istanbul Sabiha Gökçen; 6h40 outbound, 10h45 return | Not stated; overhead-bin access not included in quoted fare |
| Leeds Bradford → Antalya | £285 | Jet2 | Direct; 4h30 outbound, 4h40 return | Not stated; optional charges may apply |
| Leeds Bradford → Dalaman | £232 | Jet2 | Direct; 4h20 outbound, 4h31 return | Not stated; optional charges may apply |

The requested twelve-route target was exceeded by one route because Manchester → Izmir was
also captured during the controlled session. It is retained rather than deleted: the archive is
append-only. All thirteen records use `observationReason: routine-weekly` and remain separate
from Trip.com booking handoffs. No Fare Watcher candidate was promoted automatically.

Source URLs are the exact date-and-airport Google Flights searches retained in each observation
record in `data/fare-observations.ts`.
