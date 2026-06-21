export interface Airport {
  slug: string;
  name: string;
  code: string;
  city: string;
  region: string;
  description: string;
  longHaulRoutes: string[];
  shortHaulHighlights: string[];
  /** Why this specific airport matters for South Asia / Gulf travellers — community-specific framing, not generic airport copy. */
  whyThisAirport: string;
  /** Practical, hub-specific advice — parking, terminal quirks, check-in timing for long-haul. */
  practicalNotes: { title: string; body: string }[];
  /** Nearest major communities this airport meaningfully serves — used for internal linking and on-page relevance signals. */
  servesCommunities: string[];
  hasDirectLongHaul: boolean;
  /** Set only for airports with no curated route on JetStash — points to the nearest airport(s) genuinely worth comparing against, matching what whyThisAirport already says. Plural because some airports (e.g. East Midlands, Bristol) name more than one realistic alternative. */
  compareAirportSlugs?: string[];
}

export const airports: Airport[] = [
  {
    slug: 'manchester',
    name: 'Manchester Airport',
    code: 'MAN',
    city: 'Manchester',
    region: 'North West England',
    description:
      'The largest airport outside London and the busiest direct gateway in the North of England to Pakistan, India, the Gulf and South Asia, alongside year-round European routes.',
    longHaulRoutes: ['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi', 'Karachi', 'Delhi', 'Mumbai'],
    shortHaulHighlights: ['Istanbul', 'Antalya', 'Marrakech', 'Barcelona'],
    whyThisAirport:
      'Manchester is the only airport in the North of England with genuine daily-frequency direct services to Pakistan — a fact that shapes travel patterns for the large Pakistani-heritage communities across Greater Manchester, Lancashire, and West Yorkshire. For most of this audience, Manchester beats connecting via London on both price and journey time, even after accounting for the drive to the airport. Manchester is also currently the only Northern UK airport with direct flights to both Delhi and Mumbai, run by IndiGo since 2025 — though this direct India service has an announced end date of 1 September 2026, so check the relevant route guide for current status and the realistic one-stop alternative before booking, particularly for travel after that date.',
    practicalNotes: [
      { title: 'Terminal 2 handles most long-haul South Asia and Gulf routes', body: 'PIA, Emirates and Qatar Airways operate primarily from Terminal 2. Confirm your terminal at booking — Terminal 1 and 3 serve different carriers and a wrong assumption costs real time on departure day.' },
      { title: 'Allow 3 hours for PIA departures specifically', body: 'PIA check-in for Lahore and Islamabad routes is consistently busier than scheduled-carrier norms, particularly around Eid and wedding season. Arriving at the standard 2.5-hour mark has caused missed flights during peak weeks.' },
      { title: 'The Metrolink tram link removes the parking cost entirely', body: 'For Manchester, Salford, Bury, Rochdale and Altrincham-based travellers, the direct tram connection to the airport is often cheaper and less stressful than even pre-booked parking, particularly for trips longer than a week.' },
    ],
    servesCommunities: ['Manchester', 'Bolton', 'Rochdale', 'Oldham', 'Blackburn', 'Bradford (via M62 corridor)'],
    hasDirectLongHaul: true,
  },
  {
    slug: 'birmingham',
    name: 'Birmingham Airport',
    code: 'BHX',
    city: 'Birmingham',
    region: 'West Midlands',
    description:
      'A key Midlands departure point with strong connections to the Gulf, Pakistan, and India, serving one of the UK\'s largest South Asian communities.',
    longHaulRoutes: ['Islamabad', 'Dubai', 'Sharjah', 'Doha'],
    shortHaulHighlights: ['Malaga', 'Faro', 'Alicante', 'Antalya'],
    whyThisAirport:
      'Birmingham sits at the centre of the UK\'s largest concentration of British-Pakistani and British-Indian communities outside London, and its route network reflects that — strong Gulf-connecting options to both India and Pakistan, plus seasonal direct services that rotate by demand. For Midlands-based families, it consistently beats the calculation of driving to Heathrow once parking and travel time are factored in.',
    practicalNotes: [
      { title: 'Most South Asia routes connect via the Gulf, not direct', body: 'Unlike Manchester, Birmingham\'s India and Pakistan routes are predominantly one-stop via Dubai, Doha or Sharjah. Factor the connection time into family travel plans, particularly with young children or elderly relatives.' },
      { title: 'The airport\'s own train station cuts journey time from central Birmingham to under 15 minutes', body: 'Birmingham International station sits directly at the terminal — for travellers coming from the city centre this is consistently faster and cheaper than driving and parking.' },
    ],
    servesCommunities: ['Birmingham', 'Wolverhampton', 'Coventry', 'Walsall', 'Smethwick'],
    hasDirectLongHaul: true,
  },
  {
    slug: 'london-heathrow',
    name: 'London Heathrow',
    code: 'LHR',
    city: 'London',
    region: 'Greater London',
    description:
      'The UK\'s primary long-haul hub, with the widest choice of direct flights to India, Pakistan, the Gulf and beyond on full-service carriers.',
    longHaulRoutes: ['Delhi', 'Mumbai', 'Lahore', 'Karachi', 'Dubai', 'Doha', 'Jeddah', 'Madinah'],
    shortHaulHighlights: ['Rome', 'Lisbon', 'Athens'],
    whyThisAirport:
      'Heathrow is the only UK airport with direct, daily, multi-carrier competition on the India and Pakistan corridors — which matters for price, because genuine airline competition (rather than a single operator with a route monopoly) is what keeps fares honest. It\'s also the principal UK gateway for Umrah travel to Jeddah and Madinah.',
    practicalNotes: [
      { title: 'Terminal assignment varies by airline — always confirm', body: 'British Airways, Virgin Atlantic and Air India each operate from different terminals at Heathrow. A terminal mix-up here costs considerably more time than at a smaller regional airport given Heathrow\'s scale.' },
      { title: 'Allow extra time for Terminal 4, where most Gulf and Indian carriers operate', body: 'Terminal 4 has historically had longer security queues during peak summer and Diwali-season travel than Heathrow\'s other terminals.' },
      { title: 'Heathrow Express and the Elizabeth line both connect from central London in under 20 minutes', body: 'For travellers without a car, this consistently beats taxi cost and traffic-dependent journey times, especially during rush hour.' },
    ],
    servesCommunities: ['Greater London', 'Slough', 'Southall', 'Hounslow', 'Wembley'],
    hasDirectLongHaul: true,
  },
  {
    slug: 'london-gatwick',
    name: 'London Gatwick',
    code: 'LGW',
    city: 'London',
    region: 'Greater London',
    description:
      'A major leisure and long-haul airport south of London, with direct Gulf links and the UK\'s only non-stop service to Ahmedabad — a genuine gateway for Gujarat alongside its established Amritsar and Mediterranean network.',
    longHaulRoutes: ['Dubai', 'Doha', 'Ahmedabad', 'Amritsar'],
    shortHaulHighlights: ['Barcelona', 'Rome', 'Malaga', 'Antalya'],
    whyThisAirport:
      'Gatwick works well as a Gulf gateway and Mediterranean leisure airport, and is also the only UK airport with a direct, non-stop service to Ahmedabad — making it the genuine first choice for Gujarati heritage travellers, alongside a direct Amritsar service shared with Birmingham. For Pakistan and Delhi/Mumbai-bound India travel specifically, Heathrow still has the wider network.',
    practicalNotes: [
      { title: 'South Terminal handles the long-haul Gulf and India routes', body: 'Emirates, Qatar Airways and Air India all operate from the South Terminal — confirm this rather than defaulting to North Terminal, which is mostly short-haul and charter.' },
      { title: 'The Ahmedabad and Amritsar services run 3 times a week, not daily', body: 'Unlike the daily Gulf routes, both Air India South Asia services from Gatwick run on a reduced weekly schedule — confirm your travel dates align with an active flight day before booking.' },
      { title: 'The Gatwick Express from Victoria is the fastest non-car option', body: 'A reliable 30-minute journey that avoids the variability of the M23 during peak travel periods.' },
    ],
    servesCommunities: ['South London', 'Croydon', 'Surrey', 'Sussex'],
    hasDirectLongHaul: true,
  },
  {
    slug: 'birmingham-east-midlands',
    name: 'East Midlands Airport',
    code: 'EMA',
    city: 'Nottingham',
    region: 'East Midlands',
    description:
      'A growing regional gateway serving the East Midlands with a focus on charter and seasonal Mediterranean and Gulf-connecting routes.',
    longHaulRoutes: ['Dubai (via connection)'],
    shortHaulHighlights: ['Alicante', 'Palma', 'Antalya'],
    whyThisAirport:
      'East Midlands Airport has no direct long-haul South Asia or Gulf service of its own — for Nottingham, Derby and Leicester-based travellers heading to Pakistan, India or the Gulf, it\'s almost always more practical to compare against driving to Birmingham or Manchester rather than connecting through here.',
    practicalNotes: [
      { title: 'Best treated as a short-haul and charter airport for this audience', body: 'Its real value for South Asia / Gulf-focused travellers is Mediterranean leisure travel, not the long-haul routes — always price-compare Birmingham and Manchester before booking a connecting itinerary from here.' },
    ],
    servesCommunities: ['Nottingham', 'Derby', 'Leicester'],
    hasDirectLongHaul: false,
    compareAirportSlugs: ['birmingham', 'manchester'],
  },
  {
    slug: 'leeds-bradford',
    name: 'Leeds Bradford Airport',
    code: 'LBA',
    city: 'Leeds',
    region: 'Yorkshire',
    description:
      'Yorkshire\'s main airport, serving Bradford\'s large Pakistani-heritage community — though claims of a stable direct Pakistan service have not held up over time, and connecting via Manchester or the Gulf is currently the more reliable option.',
    longHaulRoutes: ['Dubai (via connection)', 'Islamabad (via connection)'],
    shortHaulHighlights: ['Antalya', 'Palma', 'Alicante'],
    whyThisAirport:
      'Bradford has one of the highest concentrations of Pakistani-heritage residents of any UK city, and a direct Leeds Bradford–Islamabad service has been announced more than once — but none has proven stable: a 2025 PIA announcement and an earlier start-up airline both failed to establish an ongoing schedule, the latter collapsing under a CAA investigation after cancelling booked passengers. Treat any "direct from Leeds Bradford" claim with caution and verify current availability before booking; Manchester, roughly an hour\'s drive away, remains the consistently reliable option.',
    practicalNotes: [
      { title: 'Verify any direct service claim before booking — don\'t assume one exists', body: 'Direct Leeds Bradford to Pakistan services have been announced and then failed to materialise more than once. Confirm directly with the airline\'s own booking system that a specific flight number and date genuinely exists before committing.' },
      { title: 'Manchester is the consistently reliable alternative for direct long-haul', body: 'Most Bradford and Leeds-based travellers compare against the roughly hour-long drive to Manchester rather than relying on an unconfirmed direct service from Leeds Bradford itself.' },
    ],
    servesCommunities: ['Bradford', 'Leeds', 'Huddersfield', 'Dewsbury'],
    hasDirectLongHaul: false,
    compareAirportSlugs: ['manchester'],
  },
  {
    slug: 'glasgow',
    name: 'Glasgow Airport',
    code: 'GLA',
    city: 'Glasgow',
    region: 'Scotland',
    description:
      'Scotland\'s primary international gateway with growing Gulf connectivity and well-established Mediterranean charter routes.',
    longHaulRoutes: ['Dubai'],
    shortHaulHighlights: ['Antalya', 'Faro', 'Palma'],
    whyThisAirport:
      'Glasgow\'s direct Dubai service makes it the practical Gulf gateway for Scotland, removing the need to travel south for that specific route. Scotland\'s South Asian communities heading to Pakistan or India still typically connect via Heathrow or via the Gulf, as no direct India/Pakistan service currently operates from Scotland.',
    practicalNotes: [
      { title: 'Emirates\' direct Dubai service is the headline long-haul route', body: 'For onward South Asia travel, this Dubai connection is often the most practical option available without travelling south first.' },
    ],
    servesCommunities: ['Glasgow', 'Edinburgh (via M8)', 'Paisley'],
    hasDirectLongHaul: true,
  },
  {
    slug: 'bristol',
    name: 'Bristol Airport',
    code: 'BRS',
    city: 'Bristol',
    region: 'South West England',
    description:
      'The South West\'s main airport, with dense low-cost European links and growing one-stop access to Gulf and South Asian destinations.',
    longHaulRoutes: ['Dubai (via connection)'],
    shortHaulHighlights: ['Faro', 'Malaga', 'Marrakech'],
    whyThisAirport:
      'Bristol has no direct long-haul South Asia or Gulf service — for the South West\'s South Asian communities, this airport is primarily useful for European travel, with long-haul journeys typically routed via Heathrow or Gatwick instead.',
    practicalNotes: [
      { title: 'Compare against Heathrow for any South Asia or Gulf trip', body: 'The journey time difference between Bristol-with-a-connection and a direct drive to Heathrow is often smaller than expected once total journey time is calculated honestly.' },
    ],
    servesCommunities: ['Bristol', 'Bath', 'Gloucester'],
    hasDirectLongHaul: false,
    compareAirportSlugs: ['london-heathrow', 'london-gatwick'],
  },
  {
    slug: 'liverpool',
    name: 'Liverpool John Lennon Airport',
    code: 'LPL',
    city: 'Liverpool',
    region: 'North West England',
    description:
      'A growing regional airport serving Merseyside and North Wales, with no direct long-haul service of its own but a genuine catchment of South Asian and Gulf-bound travellers who compare it against Manchester.',
    longHaulRoutes: ['Dubai (via connection)', 'Islamabad (via connection)'],
    shortHaulHighlights: ['Antalya', 'Faro', 'Alicante'],
    whyThisAirport:
      'Liverpool has no direct long-haul flights, but for Merseyside and North Wales-based travellers it remains worth pricing against Manchester before defaulting south — parking and access can be quicker even when the headline fare is similar, and one-stop Gulf-connecting options are routinely available through the same booking channels as Manchester.',
    practicalNotes: [
      { title: 'Always price-compare against Manchester before booking a connection here', body: 'Manchester is roughly 35–45 minutes away and has direct Pakistan and Gulf services. For long-haul, run both searches before assuming Liverpool is the cheaper or easier option.' },
      { title: 'A strong choice for short-haul Mediterranean breaks', body: 'Ryanair and easyJet both operate dense seasonal schedules from Liverpool, often undercutting Manchester on price for the same European routes.' },
    ],
    servesCommunities: ['Liverpool', 'Wirral', 'St Helens', 'North Wales'],
    hasDirectLongHaul: false,
    compareAirportSlugs: ['manchester'],
  },
  {
    slug: 'newcastle',
    name: 'Newcastle International Airport',
    code: 'NCL',
    city: 'Newcastle',
    region: 'North East England',
    description:
      'The principal gateway for the North East, with a daily direct Emirates service to Dubai and a meaningful Pakistani and Bangladeshi community in the region — though no direct Pakistan or India service of its own.',
    longHaulRoutes: ['Dubai'],
    shortHaulHighlights: ['Antalya', 'Alicante', 'Palma'],
    whyThisAirport:
      'Emirates operates a daily direct service from Newcastle to Dubai, making this a genuine long-haul gateway in its own right for Gulf travel — useful both as a destination and as a connecting point onward to South Asia. For direct Pakistan or India travel specifically, most of the region\\'s Pakistani and Bangladeshi communities still drive to Manchester (around 2 hours) rather than connecting through Newcastle, as no direct South Asia service operates from here.',
    practicalNotes: [
      { title: 'The direct Dubai service is a real Gulf gateway, not just a connection', body: 'Emirates\\' daily Newcastle–Dubai flight runs in Economy, Premium Economy and Business Class — worth booking as a destination in its own right, not only as a stopover en route elsewhere.' },
      { title: 'For direct Pakistan or India travel, compare against driving to Manchester', body: 'A one-stop Gulf-connecting itinerary departing Newcastle is sometimes cheaper overall than the fuel, parking and time cost of driving to Manchester for a direct flight — run both numbers before deciding.' },
      { title: 'Strong, well-established package holiday routes to the Mediterranean', body: 'TUI and Jet2 both run a wide seasonal programme from Newcastle, making it a genuinely competitive option for family package holidays.' },
    ],
    servesCommunities: ['Newcastle', 'Sunderland', 'Middlesbrough', 'Durham'],
    hasDirectLongHaul: true,
  },
  {
    slug: 'edinburgh',
    name: 'Edinburgh Airport',
    code: 'EDI',
    city: 'Edinburgh',
    region: 'Scotland',
    description:
      'Scotland\'s busiest airport, with a daily direct Emirates service to Dubai alongside the country\'s widest European network — though no direct Pakistan or India service of its own.',
    longHaulRoutes: ['Dubai'],
    shortHaulHighlights: ['Barcelona', 'Antalya', 'Faro'],
    whyThisAirport:
      'Emirates resumed a daily direct Edinburgh–Dubai service, giving Scotland\\'s capital a genuine long-haul gateway independent of Glasgow. For South Asia specifically, Scottish travellers still typically connect via Heathrow or via the Gulf, as no direct India/Pakistan service operates from Scotland — but for Dubai and onward Gulf connections, Edinburgh now stands on its own rather than requiring the journey to Glasgow.',
    practicalNotes: [
      { title: 'The daily Dubai service runs across all cabins', body: 'Emirates flies Economy, Premium Economy, Business and First Class on this route — a genuine alternative to travelling via Glasgow for Gulf travel specifically.' },
      { title: 'Glasgow remains worth comparing for schedule flexibility', body: 'Both Edinburgh and Glasgow now run daily Emirates Dubai services — comparing departure times and connection options across both before booking is worth the extra few minutes, particularly around Eid or school holidays.' },
      { title: 'Strong direct European network for short breaks', body: 'Edinburgh\\'s European route map is denser than Glasgow\\'s, making it the better choice for Mediterranean city breaks specifically.' },
    ],
    servesCommunities: ['Edinburgh', 'Fife', 'Scottish Borders'],
    hasDirectLongHaul: true,
  },
];

export function getAirportBySlug(slug: string) {
  return airports.find((a) => a.slug === slug);
}

export function getAirportsWithDirectLongHaul() {
  return airports.filter((a) => a.hasDirectLongHaul);
}
