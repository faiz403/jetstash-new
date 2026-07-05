export interface AirportPracticalNote {
  id: string;
  airportSlug: string;
  title: string;
  body: string;
  /** ISO date, set only when a note is genuinely dated (e.g. tied to a schedule change) — omit for standing practical advice with no real authored date. */
  addedDate?: string;
}

/**
 * Practical, hub-specific advice, migrated out of Airport.practicalNotes so
 * it can accumulate independently of the Airport record and be reused
 * outside the airport page. Append new notes here over time rather than
 * editing/removing old ones once they stop being current — mark superseded
 * advice by adding a newer note rather than deleting the old one.
 */
export const airportNotes: AirportPracticalNote[] = [
  { id: 'man-terminal-2', airportSlug: 'manchester', title: 'Terminal 2 handles most long-haul South Asia and Gulf routes', body: 'PIA, Emirates and Qatar Airways operate primarily from Terminal 2. Confirm your terminal at booking, since Terminal 1 and 3 serve different carriers and a wrong assumption costs real time on departure day.' },
  { id: 'man-pia-checkin', airportSlug: 'manchester', title: 'Allow 3 hours for PIA departures specifically', body: 'PIA check-in for Lahore and Islamabad routes is consistently busier than scheduled-carrier norms, particularly around Eid and wedding season. Arriving at the standard 2.5-hour mark has caused missed flights during peak weeks.' },
  { id: 'man-metrolink', airportSlug: 'manchester', title: 'The Metrolink tram link removes the parking cost entirely', body: 'For Manchester, Salford, Bury, Rochdale and Altrincham-based travellers, the direct tram connection to the airport is often cheaper and less stressful than even pre-booked parking, particularly for trips longer than a week.' },
  { id: 'bhx-gulf-connections', airportSlug: 'birmingham', title: 'Most South Asia routes connect via the Gulf, not direct', body: "Unlike Manchester, Birmingham's India and Pakistan routes are predominantly one-stop via Dubai, Doha or Sharjah. Factor the connection time into family travel plans, particularly with young children or elderly relatives." },
  { id: 'bhx-train-station', airportSlug: 'birmingham', title: "The airport's own train station cuts journey time from central Birmingham to under 15 minutes", body: 'Birmingham International station sits directly at the terminal. For travellers coming from the city centre this is consistently faster and cheaper than driving and parking.' },
  { id: 'lhr-terminal-confirm', airportSlug: 'london-heathrow', title: 'Terminal assignment varies by airline, so always confirm', body: 'British Airways, Virgin Atlantic and Air India each operate from different terminals at Heathrow. A terminal mix-up here costs considerably more time than at a smaller regional airport, given Heathrow\'s scale.' },
  { id: 'lhr-terminal-4', airportSlug: 'london-heathrow', title: 'Allow extra time for Terminal 4, where most Gulf and Indian carriers operate', body: 'Terminal 4 has historically had longer security queues during peak summer and Diwali-season travel than Heathrow\'s other terminals.' },
  { id: 'lhr-rail-links', airportSlug: 'london-heathrow', title: 'Heathrow Express and the Elizabeth line both connect from central London in under 20 minutes', body: 'For travellers without a car, this consistently beats taxi cost and traffic-dependent journey times, especially during rush hour.' },
  { id: 'lgw-south-terminal', airportSlug: 'london-gatwick', title: 'South Terminal handles the long-haul Gulf and India routes', body: 'Emirates, Qatar Airways and Air India all operate from the South Terminal. Confirm this rather than defaulting to North Terminal, which is mostly short-haul and charter.' },
  { id: 'lgw-reduced-frequency', airportSlug: 'london-gatwick', title: 'The Ahmedabad and Amritsar services run 3 times a week, not daily', body: 'Unlike the daily Gulf routes, both Air India South Asia services from Gatwick run on a reduced weekly schedule. Confirm your travel dates align with an active flight day before booking.' },
  { id: 'lgw-express', airportSlug: 'london-gatwick', title: 'The Gatwick Express from Victoria is the fastest non-car option', body: 'A reliable 30-minute journey that avoids the variability of the M23 during peak travel periods.' },
  { id: 'ema-short-haul-only', airportSlug: 'birmingham-east-midlands', title: 'Best treated as a short-haul and charter airport for this audience', body: 'Its real value for South Asia and Gulf-focused travellers is Mediterranean leisure travel, not the long-haul routes. Always price-compare Birmingham and Manchester before booking a connecting itinerary from here.' },
  { id: 'lba-verify-direct-claims', airportSlug: 'leeds-bradford', title: "Verify any direct service claim before booking, and don't assume one exists", body: 'Direct Leeds Bradford to Pakistan services have been announced and then failed to materialise more than once. Confirm directly with the airline\'s own booking system that a specific flight number and date genuinely exists before committing.' },
  { id: 'lba-manchester-alternative', airportSlug: 'leeds-bradford', title: 'Manchester is the consistently reliable alternative for direct long-haul', body: 'Most Bradford and Leeds-based travellers compare against the roughly hour-long drive to Manchester rather than relying on an unconfirmed direct service from Leeds Bradford itself.' },
  { id: 'gla-dubai-headline', airportSlug: 'glasgow', title: "Emirates' direct Dubai service is the headline long-haul route", body: 'For onward South Asia travel, this Dubai connection is often the most practical option available without travelling south first.' },
  { id: 'brs-compare-heathrow', airportSlug: 'bristol', title: 'Compare against Heathrow for any South Asia or Gulf trip', body: 'The journey time difference between Bristol-with-a-connection and a direct drive to Heathrow is often smaller than expected once total journey time is calculated honestly.' },
  { id: 'lpl-compare-manchester', airportSlug: 'liverpool', title: 'Always price-compare against Manchester before booking a connection here', body: 'Manchester is roughly 35 to 45 minutes away and has direct Pakistan and Gulf services. For long-haul, run both searches before assuming Liverpool is the cheaper or easier option.' },
  { id: 'lpl-mediterranean-strength', airportSlug: 'liverpool', title: 'A strong choice for short-haul Mediterranean breaks', body: 'Ryanair and easyJet both operate dense seasonal schedules from Liverpool, often undercutting Manchester on price for the same European routes.' },
  { id: 'ncl-dubai-gateway', airportSlug: 'newcastle', title: 'The direct Dubai service is a real Gulf gateway, not just a connection', body: "Emirates' daily Newcastle to Dubai flight runs in Economy, Premium Economy and Business Class. It's worth booking as a destination in its own right, not only as a stopover en route elsewhere." },
  { id: 'ncl-compare-manchester', airportSlug: 'newcastle', title: 'For direct Pakistan or India travel, compare against driving to Manchester', body: 'A one-stop Gulf-connecting itinerary departing Newcastle is sometimes cheaper overall than the fuel, parking and time cost of driving to Manchester for a direct flight. Run both numbers before deciding.' },
  { id: 'ncl-package-holidays', airportSlug: 'newcastle', title: 'Strong, well-established package holiday routes to the Mediterranean', body: 'TUI and Jet2 both run a wide seasonal programme from Newcastle, making it a genuinely competitive option for family package holidays.' },
  { id: 'edi-dubai-cabins', airportSlug: 'edinburgh', title: 'The daily Dubai service runs across all cabins', body: 'Emirates flies Economy, Premium Economy, Business and First Class on this route, a genuine alternative to travelling via Glasgow for Gulf travel specifically.' },
  { id: 'edi-compare-glasgow', airportSlug: 'edinburgh', title: 'Glasgow remains worth comparing for schedule flexibility', body: 'Both Edinburgh and Glasgow now run daily Emirates Dubai services. Comparing departure times and connection options across both before booking is worth the extra few minutes, particularly around Eid or school holidays.' },
  { id: 'edi-european-network', airportSlug: 'edinburgh', title: 'Strong direct European network for short breaks', body: "Edinburgh's European route map is denser than Glasgow's, making it the better choice for Mediterranean city breaks specifically." },
];

const notesByAirportSlug = new Map<string, AirportPracticalNote[]>();
for (const note of airportNotes) {
  const existing = notesByAirportSlug.get(note.airportSlug);
  if (existing) existing.push(note);
  else notesByAirportSlug.set(note.airportSlug, [note]);
}

export function getNotesByAirport(airportSlug: string) {
  return notesByAirportSlug.get(airportSlug) ?? [];
}
