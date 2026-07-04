export type RegionGroup = 'pakistan' | 'india' | 'gulf' | 'mediterranean' | 'north-africa';

export interface FamilyVisitContent {
  /** What genuinely matters when this trip is a family/heritage visit rather than a holiday. */
  travelPattern: string;
  documentNote: string;
  packingNote: string;
  peakPeriodIds: string[]; // references data/peak-periods.ts
}

export interface Destination {
  slug: string;
  city: string;
  country: string;
  /** IATA code of the destination's primary airport — used to build partner deep links. */
  iataCode: string;
  region: RegionGroup;
  tagline: string;
  description: string;
  heroImageQuery: string;
  bestFor: string[];
  flightTimeFromUK: string;
  ukAirports: string[]; // airport slugs
  visaNote: string;
  /** Present only for destinations where "visiting family" is a primary, distinct travel pattern. */
  familyVisitContent?: FamilyVisitContent;
}

export const destinations: Destination[] = [
  // Pakistan
  {
    slug: 'lahore',
    iataCode: 'LHE',
    city: 'Lahore',
    country: 'Pakistan',
    region: 'pakistan',
    tagline: 'Mughal heritage and Punjab\'s cultural capital',
    description:
      'Lahore pairs centuries of Mughal architecture — the Badshahi Mosque, Lahore Fort, Shalimar Gardens — with one of South Asia\'s great food cities. For UK families with Punjabi roots, it remains the most-travelled route on JetStash.',
    heroImageQuery: 'lahore badshahi mosque pakistan architecture',
    bestFor: ['Family visits', 'Heritage travel', 'Food'],
    flightTimeFromUK: '8h direct from Manchester',
    ukAirports: ['manchester', 'birmingham', 'london-heathrow'],
    visaNote: 'e-Visa required for UK passport holders, typically processed within 7 days.',
    familyVisitContent: {
      travelPattern:
        'Most Lahore-bound UK travellers are visiting relatives rather than holidaying — trip lengths run longer (2–4 weeks is common), bookings cluster around Eid and weddings, and most stays are with family rather than hotels.',
      documentNote:
        'NICOP holders (Pakistan-origin UK nationals with a National Identity Card for Overseas Pakistanis) typically do not need a separate visa. Confirm current requirements with NADRA or your nearest Pakistani consulate before booking, as this is not guaranteed and policy specifics change.',
      packingNote:
        'Excess baggage is the single most underestimated cost on this route — gifts and shopping for the return leg routinely exceed standard allowances. Pre-purchasing extra baggage online at the time of booking is consistently cheaper than paying at the airport.',
      peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'wedding-season', 'uk-summer-holidays'],
    },
  },
  {
    slug: 'islamabad',
    iataCode: 'ISB',
    city: 'Islamabad',
    country: 'Pakistan',
    region: 'pakistan',
    tagline: 'A modern capital framed by the Margalla Hills',
    description:
      'Islamabad is the green, planned counterpoint to Pakistan\'s older cities — a useful base for visiting family across Punjab and Khyber Pakhtunkhwa, with easy onward travel to the north.',
    heroImageQuery: 'islamabad pakistan margalla hills mosque',
    bestFor: ['Family visits', 'Gateway to northern Pakistan'],
    flightTimeFromUK: '7h 45m direct from Manchester',
    ukAirports: ['manchester', 'birmingham'],
    visaNote: 'e-Visa required for UK passport holders, typically processed within 7 days.',
    familyVisitContent: {
      travelPattern:
        'Islamabad is frequently the arrival point for families with onward journeys into Khyber Pakhtunkhwa or northern Punjab — the airport transfer logistics for the final leg matter as much as the flight itself.',
      documentNote:
        'NICOP holders typically do not require a separate visa. Always confirm current requirements directly with NADRA or your nearest consulate, as policy specifics change and shouldn\'t be assumed from prior trips.',
      packingNote:
        'If continuing on to northern areas, factor road travel time honestly — onward journeys can add a full day, which affects how tight a return flight booking should be.',
      peakPeriodIds: ['eid-al-fitr', 'eid-al-adha', 'uk-summer-holidays'],
    },
  },
  {
    slug: 'karachi',
    iataCode: 'KHI',
    city: 'Karachi',
    country: 'Pakistan',
    region: 'pakistan',
    tagline: 'Pakistan\'s coastal commercial capital',
    description:
      'A sprawling port city on the Arabian Sea, Karachi is the economic heart of Pakistan and a major arrival point for UK travellers connecting onward across Sindh and southern Punjab.',
    heroImageQuery: 'karachi pakistan skyline coast',
    bestFor: ['Business travel', 'Family visits'],
    flightTimeFromUK: '8h 30m direct from London Heathrow',
    ukAirports: ['london-heathrow', 'manchester'],
    visaNote: 'e-Visa required for UK passport holders, typically processed within 7 days.',
    familyVisitContent: {
      travelPattern:
        'Karachi sees a mix of family-visit and business travel — unlike Lahore or Islamabad, a meaningful share of UK travellers here are visiting for commercial rather than purely family reasons, which shifts typical trip length shorter.',
      documentNote:
        'NICOP holders typically do not require a separate visa. Confirm directly with NADRA or your nearest consulate, as requirements can change.',
      packingNote:
        'Karachi\'s longer flight time from most UK airports (often via a connection) makes layover comfort and luggage transfer reliability worth factoring into the airline choice, not just the headline fare.',
      peakPeriodIds: ['eid-al-fitr', 'eid-al-adha'],
    },
  },
  // India
  {
    slug: 'delhi',
    iataCode: 'DEL',
    city: 'Delhi',
    country: 'India',
    region: 'india',
    tagline: 'Mughal monuments and modern India side by side',
    description:
      'From the Red Fort to Chandni Chowk\'s street food, Delhi is the practical gateway to North India — and the connecting point for travellers heading on to Punjab, Rajasthan or the hills.',
    heroImageQuery: 'delhi india red fort architecture',
    bestFor: ['Heritage travel', 'Family visits', 'Onward travel'],
    flightTimeFromUK: '8h 45m direct from London Heathrow or Manchester',
    ukAirports: ['london-heathrow', 'birmingham', 'manchester'],
    visaNote: 'e-Visa required for UK passport holders, apply at least 4 days before travel.',
    familyVisitContent: {
      travelPattern:
        'Delhi is most often a connecting point for UK family travel rather than the final destination — onward trains or domestic flights to Punjab, Uttar Pradesh or Rajasthan are common, and should be priced and booked separately rather than assumed to be simple.',
      documentNote:
        'OCI (Overseas Citizen of India) cardholders do not require a separate visa. Standard e-Tourist or e-Business visas apply to other UK passport holders — apply at least 4 days ahead, though earlier is sensible during Diwali or December.',
      packingNote:
        'If your onward journey involves a domestic Indian flight, check the (often stricter) domestic baggage allowance separately from your international one — the two are frequently different and this catches travellers out.',
      peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    },
  },
  {
    slug: 'mumbai',
    iataCode: 'BOM',
    city: 'Mumbai',
    country: 'India',
    region: 'india',
    tagline: 'India\'s coastal commercial and cultural capital',
    description:
      'Mumbai moves at its own pace — Bollywood, the Gateway of India, and a financial district that never quite sleeps. A common stopover for travellers connecting south or onward to the Gulf, and now directly reachable from Manchester as well as London.',
    heroImageQuery: 'mumbai india gateway of india',
    bestFor: ['Business travel', 'City breaks', 'Family visits'],
    flightTimeFromUK: '9h direct from London Heathrow or Manchester',
    ukAirports: ['london-heathrow', 'manchester'],
    visaNote: 'e-Visa required for UK passport holders, apply at least 4 days before travel.',
    familyVisitContent: {
      travelPattern:
        'Mumbai is increasingly a direct family-visit destination for North West-based travellers, not just a business or stopover city — IndiGo\'s Manchester service was launched explicitly to serve the large Indian diaspora in the region, alongside its business and tourism case.',
      documentNote:
        'OCI (Overseas Citizen of India) cardholders do not require a separate visa. Standard e-Tourist or e-Business visas apply to other UK passport holders — apply at least 4 days ahead, though earlier is sensible during Diwali or December.',
      packingNote:
        'If flying the Manchester direct service, check the current baggage allowance directly with the airline rather than assuming it matches a full-service carrier\'s standard — allowances and any extra-baggage charges can differ from the Heathrow route\'s operators.',
      peakPeriodIds: ['diwali', 'christmas-new-year', 'uk-summer-holidays'],
    },
  },
  {
    slug: 'amritsar',
    iataCode: 'ATQ',
    city: 'Amritsar',
    country: 'India',
    region: 'india',
    tagline: 'Home of the Golden Temple',
    description:
      'Amritsar centres on the Harmandir Sahib — the Golden Temple — one of the most significant sites in Sikhism. It\'s the most direct route for UK travellers with Punjabi heritage on either side of the border.',
    heroImageQuery: 'amritsar golden temple india',
    bestFor: ['Pilgrimage', 'Family visits', 'Heritage travel'],
    flightTimeFromUK: '9h direct from Birmingham',
    ukAirports: ['birmingham', 'london-gatwick', 'manchester'],
    visaNote: 'e-Visa required for UK passport holders, apply at least 4 days before travel.',
    familyVisitContent: {
      travelPattern:
        'Amritsar is the most direct route for the UK\'s Punjabi diaspora visiting family or attending religious occasions — trips often combine a family stay with a Golden Temple visit, and timing around Baisakhi or Diwali is common.',
      documentNote:
        'OCI cardholders do not require a separate visa; other UK passport holders need the standard e-Visa, applied for at least 4 days ahead.',
      packingNote:
        'Air India\'s direct Amritsar services run at reduced midweek frequency rather than daily — confirm specific flight days before assuming a non-stop option exists on your preferred date.',
      peakPeriodIds: ['baisakhi', 'diwali', 'uk-summer-holidays'],
    },
  },
  {
    slug: 'ahmedabad',
    iataCode: 'AMD',
    city: 'Ahmedabad',
    country: 'India',
    region: 'india',
    tagline: 'Gujarat\'s commercial capital, on the Sabarmati',
    description:
      'Ahmedabad pairs Gandhi\'s Sabarmati Ashram with a fast-growing business and textile hub, and is the most direct route from the UK for Gujarati heritage travellers — Air India\'s non-stop Gatwick service makes this a genuine alternative to a Mumbai or Delhi connection.',
    heroImageQuery: 'ahmedabad gujarat sabarmati ashram india',
    bestFor: ['Family visits', 'Heritage travel', 'Business travel'],
    flightTimeFromUK: '9h 40m direct from London Gatwick',
    ukAirports: ['london-gatwick', 'manchester', 'birmingham'],
    visaNote: 'e-Visa required for UK passport holders, apply at least 4 days before travel.',
    familyVisitContent: {
      travelPattern:
        'Most UK Gujarati family travel to Ahmedabad is timed around Navratri and Diwali, both major nine-night and multi-day festival periods specific to Gujarati and wider Hindu communities — trip lengths often extend to cover both the festival and an extended family stay.',
      documentNote:
        'OCI cardholders do not require a separate visa. Other UK passport holders need the standard e-Visa, applied for at least 4 days ahead — book this alongside flights rather than leaving it until closer to departure.',
      packingNote:
        'Air India\'s direct Gatwick service runs 3 times a week, not daily — confirm your specific travel dates align with an active flight day before booking, and price a Mumbai or Delhi-connecting fallback for off-schedule dates.',
      peakPeriodIds: ['navratri', 'diwali', 'uk-summer-holidays'],
    },
  },
  // Gulf
  {
    slug: 'dubai',
    iataCode: 'DXB',
    city: 'Dubai',
    country: 'United Arab Emirates',
    region: 'gulf',
    tagline: 'Skylines, souks and a stopover that became a destination',
    description:
      'Dubai works as a standalone holiday, a family stopover en route to South Asia, or a long weekend of beach club and old-town contrast. Year-round flights from almost every major UK airport make it the most accessible Gulf city.',
    heroImageQuery: 'dubai skyline burj khalifa uae',
    bestFor: ['Family holidays', 'Stopovers', 'Shopping', 'Beach'],
    flightTimeFromUK: '7h direct from most UK airports',
    ukAirports: ['manchester', 'glasgow', 'edinburgh', 'newcastle', 'london-heathrow', 'birmingham', 'london-gatwick'],
    visaNote: 'Visa on arrival for UK passport holders, free for stays up to 30 days.',
  },
  {
    slug: 'doha',
    iataCode: 'DOH',
    city: 'Doha',
    country: 'Qatar',
    region: 'gulf',
    tagline: 'The Gulf\'s cultural capital, built for stopovers',
    description:
      'Doha\'s Museum of Islamic Art, the Souq Waqif and a coastline of new public beaches make it more than a connection point — Qatar Airways\' hub status means most UK travellers will pass through at some stage.',
    heroImageQuery: 'doha qatar skyline corniche',
    bestFor: ['Stopovers', 'Culture', 'Family holidays'],
    flightTimeFromUK: '6h 30m direct from London Heathrow',
    ukAirports: ['london-heathrow', 'manchester', 'birmingham'],
    visaNote: 'Visa on arrival for UK passport holders, free for stays up to 30 days.',
  },
  {
    slug: 'jeddah',
    iataCode: 'JED',
    city: 'Jeddah',
    country: 'Saudi Arabia',
    region: 'gulf',
    tagline: 'The gateway to Makkah',
    description:
      'Jeddah is the principal arrival point for pilgrims travelling to Makkah for Umrah and Hajj, and increasingly a city break destination in its own right with the restored Al-Balad old town.',
    heroImageQuery: 'jeddah saudi arabia al balad old town',
    bestFor: ['Umrah', 'Pilgrimage', 'Heritage travel'],
    flightTimeFromUK: '6h direct from London Heathrow',
    ukAirports: ['london-heathrow', 'manchester', 'birmingham'],
    visaNote: 'Umrah visa required — apply through an authorised UK travel provider or the Nusuk platform.',
  },
  {
    slug: 'madinah',
    iataCode: 'MED',
    city: 'Madinah',
    country: 'Saudi Arabia',
    region: 'gulf',
    tagline: 'The second holiest city in Islam',
    description:
      'Madinah is most often the second stop on an Umrah itinerary, home to the Prophet\'s Mosque (Al-Masjid an-Nabawi) and a calmer pace than Makkah for pilgrims completing their visit.',
    heroImageQuery: 'madinah prophets mosque saudi arabia',
    bestFor: ['Umrah', 'Pilgrimage'],
    flightTimeFromUK: '6h 15m direct from London Heathrow',
    ukAirports: ['london-heathrow', 'manchester'],
    visaNote: 'Umrah visa required — apply through an authorised UK travel provider or the Nusuk platform.',
  },
  // Secondary — Mediterranean & North Africa
  {
    slug: 'istanbul',
    iataCode: 'IST',
    city: 'Istanbul',
    country: 'Turkey',
    region: 'mediterranean',
    tagline: 'Two continents, one city break',
    description:
      'Istanbul\'s Hagia Sophia, Grand Bazaar and Bosphorus crossings make it one of the most rewarding short-haul city breaks from the UK, with year-round direct flights from most regional airports.',
    heroImageQuery: 'istanbul hagia sophia bosphorus turkey',
    bestFor: ['City breaks', 'Heritage travel'],
    flightTimeFromUK: '4h direct from Manchester',
    ukAirports: ['manchester', 'birmingham', 'london-gatwick', 'leeds-bradford'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
  {
    slug: 'antalya',
    iataCode: 'AYT',
    city: 'Antalya',
    country: 'Turkey',
    region: 'mediterranean',
    tagline: 'Turkey\'s all-inclusive coastline',
    description:
      'Antalya anchors the Turquoise Coast — the UK\'s most popular all-inclusive resort region outside Spain, with a long season and direct charter flights from almost every regional UK airport.',
    heroImageQuery: 'antalya turkey turquoise coast beach',
    bestFor: ['Family holidays', 'All-inclusive', 'Beach'],
    flightTimeFromUK: '4h 15m direct from Manchester',
    ukAirports: ['manchester', 'birmingham', 'leeds-bradford', 'glasgow', 'bristol', 'london-gatwick'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
  {
    slug: 'marrakech',
    iataCode: 'RAK',
    city: 'Marrakech',
    country: 'Morocco',
    region: 'north-africa',
    tagline: 'Souks, riads and the edge of the Atlas Mountains',
    description:
      'A short flight delivers an entirely different world — the Jemaa el-Fnaa, the Jardin Majorelle and a medina built for getting pleasantly lost in, with the High Atlas an hour away.',
    heroImageQuery: 'marrakech morocco medina jemaa el fnaa',
    bestFor: ['City breaks', 'Culture'],
    flightTimeFromUK: '3h 30m direct from London Gatwick',
    ukAirports: ['london-gatwick', 'manchester', 'bristol'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
  {
    slug: 'barcelona',
    iataCode: 'BCN',
    city: 'Barcelona',
    country: 'Spain',
    region: 'mediterranean',
    tagline: 'Gaudí, the Mediterranean and Catalan food',
    description:
      'Barcelona remains the UK\'s most popular year-round European city break — Gaudí\'s unfinished cathedral, the Gothic Quarter and a beach within walking distance of the centre.',
    heroImageQuery: 'barcelona spain sagrada familia gothic quarter',
    bestFor: ['City breaks', 'Family holidays'],
    flightTimeFromUK: '2h 15m direct from Manchester',
    ukAirports: ['manchester', 'birmingham', 'london-gatwick', 'bristol', 'leeds-bradford'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
  {
    slug: 'faro',
    iataCode: 'FAO',
    city: 'Faro',
    country: 'Portugal',
    region: 'mediterranean',
    tagline: 'Gateway to the Algarve coastline',
    description:
      'Faro is the entry point for the Algarve\'s beaches and golf resorts — a reliably mild, family-friendly stretch of coast that runs a long flight season from regional UK airports.',
    heroImageQuery: 'algarve portugal coastline cliffs beach',
    bestFor: ['Family holidays', 'Golf', 'Beach'],
    flightTimeFromUK: '2h 45m direct from Bristol',
    ukAirports: ['bristol', 'manchester', 'birmingham', 'leeds-bradford', 'london-gatwick'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
  {
    slug: 'athens',
    iataCode: 'ATH',
    city: 'Athens',
    country: 'Greece',
    region: 'mediterranean',
    tagline: 'The Acropolis and the islands beyond',
    description:
      'Athens works as a city break on its own or as the launch point for the Saronic and Cycladic islands — a flight under four hours puts the Acropolis within reach of most of the UK.',
    heroImageQuery: 'athens greece acropolis parthenon',
    bestFor: ['City breaks', 'Island hopping'],
    flightTimeFromUK: '3h 40m direct from Manchester',
    ukAirports: ['manchester', 'birmingham', 'london-gatwick', 'glasgow'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
  {
    slug: 'rome',
    iataCode: 'FCO',
    city: 'Rome',
    country: 'Italy',
    region: 'mediterranean',
    tagline: 'The Colosseum, the Vatican and three millennia of layers',
    description:
      'Rome rewards even a short city break — the Colosseum and Roman Forum in the morning, Vatican City in the afternoon, and a trattoria within walking distance of wherever you end up.',
    heroImageQuery: 'rome italy colosseum architecture',
    bestFor: ['City breaks', 'Heritage travel'],
    flightTimeFromUK: '2h 35m direct from Manchester',
    ukAirports: ['manchester', 'birmingham', 'london-gatwick', 'bristol'],
    visaNote: 'No visa required for UK passport holders for stays up to 90 days.',
  },
];

export function getDestinationBySlug(slug: string) {
  return destinations.find((d) => d.slug === slug);
}

export function getDestinationsByRegion(region: RegionGroup) {
  return destinations.filter((d) => d.region === region);
}

export function getDestinationsWithFamilyContent() {
  return destinations.filter((d) => d.familyVisitContent);
}
