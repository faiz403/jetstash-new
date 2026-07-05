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
    shortHaulHighlights: ['Istanbul', 'Antalya', 'Dalaman', 'Marrakech', 'Barcelona'],
    whyThisAirport:
      'Manchester is the only airport in the North of England with genuine daily-frequency direct services to Pakistan — a fact that shapes travel patterns for the large Pakistani-heritage communities across Greater Manchester, Lancashire, and West Yorkshire. For most of this audience, Manchester beats connecting via London on both price and journey time, even after accounting for the drive to the airport. Manchester is also currently the only Northern UK airport with direct flights to both Delhi and Mumbai, run by IndiGo since 2025 — though this direct India service has an announced end date of 1 September 2026, so check the relevant route guide for current status and the realistic one-stop alternative before booking, particularly for travel after that date.',
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
    shortHaulHighlights: ['Malaga', 'Faro', 'Alicante', 'Antalya', 'Bodrum'],
    whyThisAirport:
      'Birmingham sits at the centre of the UK\'s largest concentration of British-Pakistani and British-Indian communities outside London, and its route network reflects that — strong Gulf-connecting options to both India and Pakistan, plus seasonal direct services that rotate by demand. For Midlands-based families, it consistently beats the calculation of driving to Heathrow once parking and travel time are factored in.',
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
    shortHaulHighlights: ['Barcelona', 'Rome', 'Malaga', 'Antalya', 'Agadir', 'Tangier'],
    whyThisAirport:
      'Gatwick works well as a Gulf gateway and Mediterranean leisure airport, and is also the only UK airport with a direct, non-stop service to Ahmedabad — making it the genuine first choice for Gujarati heritage travellers, alongside a direct Amritsar service shared with Birmingham. For Pakistan and Delhi/Mumbai-bound India travel specifically, Heathrow still has the wider network.',
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
      'Emirates operates a daily direct service from Newcastle to Dubai, making this a genuine long-haul gateway in its own right for Gulf travel — useful both as a destination and as a connecting point onward to South Asia. For direct Pakistan or India travel specifically, most of the region\'s Pakistani and Bangladeshi communities still drive to Manchester (around 2 hours) rather than connecting through Newcastle, as no direct South Asia service operates from here.',
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
      'Emirates resumed a daily direct Edinburgh–Dubai service, giving Scotland\'s capital a genuine long-haul gateway independent of Glasgow. For South Asia specifically, Scottish travellers still typically connect via Heathrow or via the Gulf, as no direct India/Pakistan service operates from Scotland — but for Dubai and onward Gulf connections, Edinburgh now stands on its own rather than requiring the journey to Glasgow.',
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
