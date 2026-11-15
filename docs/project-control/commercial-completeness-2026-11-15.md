# JetStash commercial and maintenance review: 2026-11-15

## Evidence from this checkout

* 89 routes evaluated as of 2026-11-15.
* 25 have a publishable fare; 64 have none under the current rules.
* 0 have a configured monetised flight handoff; 89 use a non-monetised fallback.
* Trip.com affiliate pause in this run: **ON**. This is the local process configuration, not an inspection of Vercel Production.
* 53 route-level reviews are overdue; 2 are due within 14 days.
* Readiness: 0 TRAFFIC_READY, 25 TRAFFIC_READY_NON_MONETISED, 0 FARE_GAP, 62 EVIDENCE_GAP, 2 HOLD.

A configured handoff is not a booking, commission or proven income. This report makes no revenue or conversion forecast.

## Manual source-review queue

These rows identify work; generating the report does not re-verify any source or extend a review date. Review each source and record only the facts it actually supports.

| Route | Review due | Last check | Source to review |
| --- | --- | --- | --- |
| manchester-delhi | 2026-08-31 | 2026-07-23 | https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html |
| manchester-mumbai | 2026-08-31 | 2026-07-23 | https://www.goindigo.in/press-releases/indigo-adjusts-wide-body-network-to-enhance-operational-resilience-and-schedule-reliability.html |
| birmingham-ahmedabad | 2026-09-18 | 2026-09-04 | https://www.airindia.com/en/book-flights/birmingham-to-ahmedabad-flights |
| london-gatwick-ahmedabad | 2026-09-18 | 2026-09-04 | https://www.airindia.com/en-in/book-flights/ahmedabad-to-london-flights |
| london-heathrow-sylhet | 2026-09-18 | 2026-09-04 | https://www.heathrow.com/departures/terminal-4/flight-details/BG202 |
| manchester-sylhet | 2026-09-18 | 2026-09-04 | https://www.manchesterairport.co.uk/destinations-and-guides/sylhet/ |
| manchester-dhaka | 2026-10-02 | 2026-08-18 | https://biman-airlines.com/ |
| london-gatwick-istanbul | 2026-10-04 | 2026-09-04 | https://www.mediacentre.gatwickairport.com/news/new-daily-flights-to-istanbul-from-london-gatwick-launch-with-pegasus-airlines-this-summer-2c983-40f32.html |
| birmingham-islamabad | 2026-10-05 | 2026-08-21 | https://book-pia.crane.aero/ibe/availability?tripType=ROUND_TRIP&depPort=BHX&arrPort=ISB |
| birmingham-lahore | 2026-10-05 | 2026-08-21 | https://book-pia.crane.aero/ibe/availability?tripType=ROUND_TRIP&depPort=BHX&arrPort=LHE |
| manchester-karachi | 2026-10-05 | 2026-08-21 | https://book-pia.crane.aero/ibe/availability?tripType=ROUND_TRIP&depPort=MAN&arrPort=KHI |
| london-gatwick-bodrum | 2026-10-07 | 2026-09-07 | https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-expands-uk-route-network-for-summer-2026-with-launch-of-services-from-east-midlands/ |
| london-gatwick-dalaman | 2026-10-07 | 2026-09-07 | https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-named-official-airline-partner-of-crystal-palace-football-club/ |
| london-gatwick-doha | 2026-10-07 | 2026-09-07 | https://www.qatarairways.com/en-gb/destinations/flights-to-doha/from-london-gatwick.html |
| london-gatwick-izmir | 2026-10-07 | 2026-09-07 | https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf |
| london-heathrow-casablanca | 2026-10-07 | 2026-09-07 | https://www.royalairmaroc.com/en_gb/flights-from-london-to-casablanca |
| manchester-antalya | 2026-10-07 | 2026-09-07 | https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf |
| manchester-bodrum | 2026-10-07 | 2026-09-07 | https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-expands-uk-route-network-for-summer-2026-with-launch-of-services-from-east-midlands/ |
| manchester-dalaman | 2026-10-07 | 2026-09-07 | https://www.sunexpress.com/en-gb/company/media-center/press-releases/sunexpress-launches-convenient-night-flights-from-manchester-to-dalaman/ |
| manchester-izmir | 2026-10-07 | 2026-09-07 | https://static.sunexpress.com/media/wn1lmfyn/sxs-flightplan-s26-27nov_0126.pdf |
| leeds-bradford-antalya | 2026-10-08 | 2026-09-08 | https://www.leedsbradfordairport.co.uk/flights/departures |
| leeds-bradford-bodrum | 2026-10-08 | 2026-09-08 | https://www.leedsbradfordairport.co.uk/flights/departures |
| leeds-bradford-dalaman | 2026-10-08 | 2026-09-08 | https://www.leedsbradfordairport.co.uk/flights/departures |
| london-gatwick-agadir | 2026-10-08 | 2026-09-08 | https://stafftravel.easyjet.com/en/cheap-flights/London-Gatwick/Agadir |
| london-gatwick-marrakech | 2026-10-08 | 2026-09-08 | https://www.gatwickairport.com/flights?destination=D |
| leeds-bradford-barcelona | 2026-10-14 | 2026-09-14 | https://www.leedsbradfordairport.co.uk/direct-destinations |
| manchester-faro | 2026-10-14 | 2026-09-14 | https://www.manchesterairport.co.uk/destinations-and-guides/faro/ |
| london-gatwick-amritsar | 2026-10-17 | 2026-09-17 | https://www.airindia.com/en-in/book-flights/london-to-amritsar-flights |
| birmingham-madinah | 2026-10-18 | 2026-10-04 | not recorded |
| leeds-bradford-amritsar | 2026-10-18 | 2026-10-04 | not recorded |
| leeds-bradford-islamabad | 2026-10-18 | 2026-10-04 | not recorded |
| manchester-ahmedabad | 2026-10-18 | 2026-10-04 | not recorded |
| manchester-amritsar | 2026-10-18 | 2026-10-04 | not recorded |
| manchester-jeddah | 2026-10-18 | 2026-10-04 | not recorded |
| manchester-madinah | 2026-10-18 | 2026-10-04 | not recorded |
| leeds-bradford-faro | 2026-10-20 | 2026-09-20 | https://www.leedsbradfordairport.co.uk/destinations/portugal/faro-algarve |
| london-gatwick-barcelona | 2026-11-02 | 2026-10-03 | https://www.easyjet.com/en/cheap-flights/london-gatwick/barcelona |
| london-gatwick-rome | 2026-11-02 | 2026-10-03 | https://www.easyjet.com/en/cheap-flights/london-gatwick/rome-fiumicino |
| london-heathrow-doha | 2026-11-03 | 2026-10-04 | https://www.qatarairways.com/en-gb/destinations/flights-to-doha/from-london.html/ |
| london-heathrow-lahore | 2026-11-03 | 2026-10-04 | https://www.piac.com.pk/help-contact/lhr-operation |
| manchester-agadir | 2026-11-03 | 2026-10-04 | https://www.manchesterairport.co.uk/destinations-and-guides/morocco-video/ |
| manchester-athens | 2026-11-03 | 2026-10-04 | https://www.manchesterairport.co.uk/flight-operators/aegean-airlines/ |
| birmingham-agadir | 2026-11-04 | 2026-10-05 | https://airport.birminghamairport.co.uk/destinations/where-we-fly/agadir/ |
| birmingham-antalya | 2026-11-04 | 2026-10-05 | https://airport.birminghamairport.co.uk/destinations/where-we-fly/antalya/ |
| birmingham-bodrum | 2026-11-04 | 2026-10-05 | https://airport.birminghamairport.co.uk/destinations/where-we-fly/bodrum/ |
| bristol-dalaman | 2026-11-04 | 2026-10-05 | https://www.bristolairport.co.uk/where-can-i-fly/destinations/europe/turkey/dalaman/ |
| glasgow-bodrum | 2026-11-04 | 2026-10-05 | https://www.glasgowairport.com/destinations/bodrum/ |
| london-gatwick-antalya | 2026-11-04 | 2026-10-05 | https://www.gatwickairport.com/flights?destination=A |
| london-gatwick-athens | 2026-11-04 | 2026-10-05 | https://www.gatwickairport.com/flights?destination=A |
| london-heathrow-dhaka | 2026-11-04 | 2026-10-05 | https://www.heathrow.com/departures/terminal-4/flight-details/BG202 |
| manchester-barcelona | 2026-11-04 | 2026-10-05 | https://www.manchesterairport.co.uk/destinations-and-guides/barcelona/ |
| manchester-rome | 2026-11-04 | 2026-10-05 | https://www.manchesterairport.co.uk/destinations-and-guides/rome/ |
| newcastle-dalaman | 2026-11-04 | 2026-10-05 | https://www.newcastleairport.com/our-destinations/our-airlines/ |
| london-heathrow-bengaluru | 2026-11-27 | 2026-08-29 | https://www.virginatlantic.com/where-we-fly/asia/india/bengaluru |
| london-heathrow-delhi | 2026-11-27 | 2026-08-29 | https://www.britishairways.com/content/flights/india/delhi |

## Routes without a publishable fare

| Route | Recovery category | Current reason | Historical checks |
| --- | --- | --- | ---: |
| manchester-dalaman | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 6 |
| manchester-bodrum | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 8 |
| manchester-antalya | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 7 |
| manchester-izmir | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 8 |
| birmingham-antalya | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| birmingham-bodrum | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 7 |
| leeds-bradford-antalya | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 5 |
| leeds-bradford-dalaman | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 5 |
| leeds-bradford-bodrum | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 4 |
| glasgow-antalya | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| glasgow-dalaman | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 5 |
| glasgow-bodrum | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 6 |
| bristol-antalya | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 5 |
| bristol-dalaman | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 5 |
| newcastle-dalaman | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 6 |
| london-gatwick-istanbul | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 9 |
| london-gatwick-antalya | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 6 |
| london-gatwick-dalaman | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-gatwick-bodrum | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 7 |
| london-gatwick-izmir | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 8 |
| manchester-marrakech | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| london-gatwick-marrakech | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 6 |
| manchester-agadir | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| birmingham-agadir | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 7 |
| london-gatwick-agadir | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-heathrow-casablanca | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 7 |
| london-gatwick-tangier | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 6 |
| birmingham-amritsar | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 18 |
| london-heathrow-doha | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 14 |
| leeds-bradford-amritsar | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 7 |
| leeds-bradford-islamabad | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 6 |
| london-heathrow-dhaka | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 7 |
| manchester-sylhet | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 7 |
| london-heathrow-sylhet | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 7 |
| manchester-doha | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 10 |
| manchester-jeddah | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 8 |
| glasgow-dubai | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| edinburgh-dubai | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| newcastle-dubai | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| london-gatwick-ahmedabad | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 10 |
| london-gatwick-amritsar | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 9 |
| london-gatwick-doha | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 5 |
| manchester-delhi | C_SERVICE_ENDED_CONNECTING_ONLY | The direct service has ended and no suitable current connecting fare is publishable. | 9 |
| manchester-mumbai | C_SERVICE_ENDED_CONNECTING_ONLY | The direct service has ended and no suitable current connecting fare is publishable. | 9 |
| manchester-amritsar | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| manchester-ahmedabad | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| manchester-madinah | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 11 |
| manchester-barcelona | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-gatwick-barcelona | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 7 |
| bristol-barcelona | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 7 |
| leeds-bradford-barcelona | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| bristol-faro | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| manchester-faro | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| birmingham-faro | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| leeds-bradford-faro | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-gatwick-faro | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 6 |
| manchester-athens | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-gatwick-athens | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 6 |
| manchester-rome | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-gatwick-rome | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 7 |
| london-heathrow-lahore | B_REFRESH_ROUTE_FIRST | Route verification/status is not strong enough to support a current public fare. | 8 |
| london-gatwick-dubai | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| birmingham-jeddah | E_STALE_CLEAN_HISTORY | No current publishable fare observation exists. | 8 |
| birmingham-ahmedabad | D_CONTRADICTORY_OR_UNSAFE | Route verification/status is not strong enough to support a current public fare. | 8 |

Re-check route truth before collecting a fare for a route with insufficient evidence. Fares remain append-only and require an actual dated observation; automation must not invent, re-date or scrape them.

## Flight handoffs without a monetised path

| Route | Exact pair | Public service state | Fare available | Current action |
| --- | --- | --- | --- | --- |
| manchester-istanbul | MAN to IST | direct | yes | Search flights on Google Flights |
| manchester-dalaman | MAN to DLM | unverified | no | Search flights on Google Flights |
| manchester-bodrum | MAN to BJV | unverified | no | Search flights on Google Flights |
| manchester-antalya | MAN to AYT | unverified | no | Search flights on Google Flights |
| manchester-izmir | MAN to ADB | unverified | no | Search flights on Google Flights |
| birmingham-istanbul | BHX to IST | direct | yes | Search flights on Google Flights |
| birmingham-antalya | BHX to AYT | unverified | no | Search flights on Google Flights |
| birmingham-dalaman | BHX to DLM | direct | yes | Search flights on Google Flights |
| birmingham-bodrum | BHX to BJV | unverified | no | Search flights on Google Flights |
| leeds-bradford-antalya | LBA to AYT | unverified | no | Search flights on Google Flights |
| leeds-bradford-dalaman | LBA to DLM | unverified | no | Search flights on Google Flights |
| leeds-bradford-bodrum | LBA to BJV | unverified | no | Search flights on Google Flights |
| glasgow-antalya | GLA to AYT | direct | no | Search flights on Google Flights |
| glasgow-dalaman | GLA to DLM | direct | no | Search flights on Google Flights |
| glasgow-bodrum | GLA to BJV | unverified | no | Search flights on Google Flights |
| bristol-antalya | BRS to AYT | direct | no | Search flights on Google Flights |
| bristol-dalaman | BRS to DLM | unverified | no | Search flights on Google Flights |
| newcastle-dalaman | NCL to DLM | unverified | no | Search flights on Google Flights |
| london-gatwick-istanbul | LGW to IST | unverified | no | Search flights on Google Flights |
| london-gatwick-antalya | LGW to AYT | unverified | no | Search flights on Google Flights |
| london-gatwick-dalaman | LGW to DLM | unverified | no | Search flights on Google Flights |
| london-gatwick-bodrum | LGW to BJV | unverified | no | Search flights on Google Flights |
| london-gatwick-izmir | LGW to ADB | unverified | no | Search flights on Google Flights |
| manchester-marrakech | MAN to RAK | direct | no | Search flights on Google Flights |
| bristol-marrakech | BRS to RAK | direct | yes | Search flights on Google Flights |
| london-gatwick-marrakech | LGW to RAK | unverified | no | Search flights on Google Flights |
| manchester-agadir | MAN to AGA | unverified | no | Search flights on Google Flights |
| birmingham-agadir | BHX to AGA | unverified | no | Search flights on Google Flights |
| london-gatwick-agadir | LGW to AGA | unverified | no | Search flights on Google Flights |
| london-heathrow-casablanca | LHR to CMN | unverified | no | Search flights on Google Flights |
| london-gatwick-tangier | LGW to TNG | direct | no | Search flights on Google Flights |
| manchester-lahore | MAN to LHE | direct | yes | Search flights on Google Flights |
| manchester-islamabad | MAN to ISB | direct | yes | Search flights on Google Flights |
| london-heathrow-delhi | LHR to DEL | direct | yes | Search flights on Google Flights |
| birmingham-amritsar | BHX to ATQ | direct | no | Search flights on Google Flights |
| manchester-dubai | MAN to DXB | direct | yes | Search flights on Google Flights |
| london-heathrow-doha | LHR to DOH | unverified | no | Search flights on Google Flights |
| london-heathrow-jeddah | LHR to JED | direct | yes | Search flights on Google Flights |
| manchester-karachi | MAN to KHI | connecting | yes | Search flights on Google Flights |
| birmingham-lahore | BHX to LHE | connecting | yes | Search flights on Google Flights |
| birmingham-islamabad | BHX to ISB | connecting | yes | Search flights on Google Flights |
| leeds-bradford-amritsar | LBA to ATQ | connecting | no | Search flights on Google Flights |
| leeds-bradford-islamabad | LBA to ISB | connecting | no | Search flights on Google Flights |
| london-heathrow-mumbai | LHR to BOM | direct | yes | Search flights on Google Flights |
| london-heathrow-bengaluru | LHR to BLR | direct | yes | Search flights on Google Flights |
| london-heathrow-dhaka | LHR to DAC | unverified | no | Search flights on Google Flights |
| manchester-dhaka | MAN to DAC | connecting | yes | Search flights on Google Flights |
| manchester-sylhet | MAN to ZYL | unverified | no | Search flights on Google Flights |
| london-heathrow-sylhet | LHR to ZYL | unverified | no | Search flights on Google Flights |
| manchester-doha | MAN to DOH | direct | no | Search flights on Google Flights |
| manchester-jeddah | MAN to JED | unverified | no | Search flights on Google Flights |
| birmingham-madinah | BHX to MED | connecting | yes | Search flights on Google Flights |
| birmingham-mumbai | BHX to BOM | connecting | yes | Search flights on Google Flights |
| glasgow-dubai | GLA to DXB | direct | no | Search flights on Google Flights |
| edinburgh-dubai | EDI to DXB | direct | no | Search flights on Google Flights |
| newcastle-dubai | NCL to DXB | direct | no | Search flights on Google Flights |
| london-gatwick-ahmedabad | LGW to AMD | unverified | no | Search flights on Google Flights |
| london-gatwick-amritsar | LGW to ATQ | unverified | no | Search flights on Google Flights |
| london-gatwick-doha | LGW to DOH | unverified | no | Search flights on Google Flights |
| manchester-delhi | MAN to DEL | service-ended | no | Search flights on Google Flights |
| manchester-mumbai | MAN to BOM | service-ended | no | Search flights on Google Flights |
| manchester-amritsar | MAN to ATQ | connecting | no | Search flights on Google Flights |
| manchester-ahmedabad | MAN to AMD | connecting | no | Search flights on Google Flights |
| manchester-madinah | MAN to MED | connecting | no | Search flights on Google Flights |
| manchester-barcelona | MAN to BCN | unverified | no | Search flights on Google Flights |
| birmingham-barcelona | BHX to BCN | direct | yes | Search flights on Google Flights |
| london-gatwick-barcelona | LGW to BCN | unverified | no | Search flights on Google Flights |
| bristol-barcelona | BRS to BCN | direct | no | Search flights on Google Flights |
| leeds-bradford-barcelona | LBA to BCN | unverified | no | Search flights on Google Flights |
| bristol-faro | BRS to FAO | direct | no | Search flights on Google Flights |
| manchester-faro | MAN to FAO | unverified | no | Search flights on Google Flights |
| birmingham-faro | BHX to FAO | direct | no | Search flights on Google Flights |
| leeds-bradford-faro | LBA to FAO | unverified | no | Search flights on Google Flights |
| london-gatwick-faro | LGW to FAO | direct | no | Search flights on Google Flights |
| manchester-athens | MAN to ATH | unverified | no | Search flights on Google Flights |
| birmingham-athens | BHX to ATH | direct | yes | Search flights on Google Flights |
| london-gatwick-athens | LGW to ATH | unverified | no | Search flights on Google Flights |
| manchester-rome | MAN to FCO | unverified | no | Search flights on Google Flights |
| birmingham-rome | BHX to FCO | direct | yes | Search flights on Google Flights |
| london-gatwick-rome | LGW to FCO | unverified | no | Search flights on Google Flights |
| bristol-rome | BRS to FCO | direct | yes | Search flights on Google Flights |
| london-heathrow-lahore | LHR to LHE | unverified | no | Search flights on Google Flights |
| london-gatwick-dubai | LGW to DXB | direct | no | Search flights on Google Flights |
| birmingham-dubai | BHX to DXB | direct | yes | Search flights on Google Flights |
| birmingham-doha | BHX to DOH | direct | yes | Search flights on Google Flights |
| birmingham-jeddah | BHX to JED | direct | no | Search flights on Google Flights |
| london-heathrow-dubai | LHR to DXB | direct | yes | Search flights on Google Flights |
| birmingham-delhi | BHX to DEL | connecting | yes | Search flights on Google Flights |
| birmingham-ahmedabad | BHX to AMD | unverified | no | Search flights on Google Flights |

The pause is a programme/account dependency. It is not evidence that an old link needs recreating. Resolve the account terms or use a separately approved and verified provider.

## Historical search evidence only

The bundled Search Console export is settled through **2026-09-29**. Its original periods are recorded in the companion JSON. It is not a current traffic report. Rows were returned for 25 routes; 64 routes are absent from that export. Absence is not proof of zero searches or zero customer demand.

The following ordering uses that historical export and this run's readiness weights. Refresh the source evidence before treating it as today's acquisition priority.

| Route | Historical impressions | Historical position | Readiness | Score |
| --- | ---: | ---: | --- | ---: |
| manchester-islamabad | 299 | 39.384615 | TRAFFIC_READY_NON_MONETISED | 478.4 |
| manchester-dubai | 459 | 43.411765 | TRAFFIC_READY_NON_MONETISED | 367.2 |
| manchester-lahore | 163 | 21.368098 | TRAFFIC_READY_NON_MONETISED | 260.8 |
| london-heathrow-dubai | 46 | 14.847826 | TRAFFIC_READY_NON_MONETISED | 110.4 |
| birmingham-athens | 32 | 8.25 | TRAFFIC_READY_NON_MONETISED | 102.4 |
| manchester-mumbai | 287 | 37.425087 | HOLD | 57.4 |
| manchester-izmir | 96 | 26.166667 | EVIDENCE_GAP | 48 |
| manchester-agadir | 95 | 24.178947 | EVIDENCE_GAP | 47.5 |
| birmingham-bodrum | 47 | 9.914894 | EVIDENCE_GAP | 47 |
| london-gatwick-dubai | 52 | 16.096154 | EVIDENCE_GAP | 39 |
| manchester-doha | 24 | 9.375 | EVIDENCE_GAP | 24 |
| manchester-dalaman | 23 | 9.652174 | EVIDENCE_GAP | 23 |
| london-gatwick-ahmedabad | 17 | 8.470588 | EVIDENCE_GAP | 17 |
| london-heathrow-jeddah | 7 | 12.285714 | TRAFFIC_READY_NON_MONETISED | 16.8 |
| london-gatwick-rome | 25 | 22.88 | EVIDENCE_GAP | 12.5 |
| london-heathrow-delhi | 5 | 15.2 | TRAFFIC_READY_NON_MONETISED | 12 |
| london-heathrow-mumbai | 5 | 10.2 | TRAFFIC_READY_NON_MONETISED | 12 |
| glasgow-bodrum | 11 | 9.727273 | EVIDENCE_GAP | 11 |
| leeds-bradford-bodrum | 8 | 8.5 | EVIDENCE_GAP | 8 |
| manchester-sylhet | 7 | 8.857143 | EVIDENCE_GAP | 7 |

## Verification boundary

This is an offline derivation from repository records and the declared process configuration. It does not fetch source pages, submit forms, follow affiliate links, query analytics accounts, check provider reports or make paid routing calls. Public wording, live booking availability, customer outcomes and actual income require separate evidence.
