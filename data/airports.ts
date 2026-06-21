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
}

export const airports: Airport[] = [
  {
    slug: 'manchester',
    name: 'Manchester Airport',
    code: 'MAN',
    city: 'Manchester',
    region: 'North West England',
    description:
      'The largest airport outside London and the busiest direct gateway in the North of England to Pakistan, the Gulf and South Asia, alongside year-round European routes.',
    longHaulRoutes: ['Islamabad', 'Lahore', 'Dubai', 'Doha', 'Abu Dhabi', 'Karachi'],
    shortHaulHighlights: ['Istanbul', 'Antalya', 'Marrakech', 'Barcelona'],
    whyThisAirport:
      'Manchester is the only airport in the North of England with genuine daily-frequency direct services to Pakistan — a fact that shapes travel patterns for the large Pakistani-heritage communities across Greater Manchester, Lancashire, and West Yorkshire. For most of this audience, Manchester beats connecting via London on both price and journey time, even after accounting for the drive to the airport.',
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
      'A major leisure and long-haul airport south of London with strong seasonal and scheduled links to the Gulf and the Mediterranean.',
    longHaulRoutes: ['Dubai', 'Doha'],
    shortHaulHighlights: ['Barcelona', 'Rome', 'Malaga', 'Antalya'],
    whyThisAirport:
      'Gatwick works well as a Gulf gateway and Mediterranean leisure airport, and is a sensible alternative to Heathrow for South London, Surrey and Sussex-based travellers — though its long-haul South Asia coverage is far thinner than Heathrow\'s, so it\'s rarely the first choice for direct Pakistan or India travel.',
    practicalNotes: [
      { title: 'South Terminal handles the long-haul Gulf routes', body: 'Emirates and Qatar Airways operate from the South Terminal — confirm this rather than defaulting to North Terminal, which is mostly short-haul and charter.' },
      { title: 'The Gatwick Express from Victoria is the fastest non-car option', body: 'A reliable 30-minute journey that avoids the variability of the M23 during peak travel periods.' },
    ],
    servesCommunities: ['South London', 'Croydon', 'Surrey', 'Sussex'],
    hasDirectLongHaul: false,
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
  },
  {
    slug: 'leeds-bradford',
    name: 'Leeds Bradford Airport',
    code: 'LBA',
    city: 'Leeds',
    region: 'Yorkshire',
    description:
      'Yorkshire\'s main airport, popular for direct and one-stop connections to Pakistan and the Gulf serving Bradford\'s large Pakistani-heritage community.',
    longHaulRoutes: ['Islamabad (seasonal)', 'Dubai (via connection)'],
    shortHaulHighlights: ['Antalya', 'Palma', 'Alicante'],
    whyThisAirport:
      'Bradford has one of the highest concentrations of Pakistani-heritage residents of any UK city, and Leeds Bradford\'s seasonal direct Islamabad service exists specifically to serve that demand. Outside the seasonal window, Manchester (roughly an hour\'s drive) is consistently the better-connected alternative for this audience.',
    practicalNotes: [
      { title: 'Seasonal direct service means availability varies by month', body: 'The direct Islamabad route does not run year-round on a fixed schedule — always confirm whether your specific travel dates fall within the active seasonal window before assuming a direct option exists.' },
      { title: 'Manchester is the standard fallback for off-season long-haul', body: 'When the seasonal direct service isn\'t running, most Bradford and Leeds-based travellers compare against the drive to Manchester rather than connecting through London.' },
    ],
    servesCommunities: ['Bradford', 'Leeds', 'Huddersfield', 'Dewsbury'],
    hasDirectLongHaul: true,
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
  },
];

export function getAirportBySlug(slug: string) {
  return airports.find((a) => a.slug === slug);
}

export function getAirportsWithDirectLongHaul() {
  return airports.filter((a) => a.hasDirectLongHaul);
}
