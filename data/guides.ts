export interface Guide {
  slug: string;
  title: string;
  /** One-sentence hook used on index cards and as the meta description. */
  summary: string;
  /** Body paragraphs, in order. */
  paragraphs: string[];
}

/**
 * Editorial guides. Each guide gets its own indexable page at /guides/[slug],
 * one guide per URL so each can rank for its own long-tail query, rather
 * than all sharing a single page.
 *
 * Content rules are the same as everywhere else on JetStash: practical,
 * verifiable, no invented statistics. Two earlier guides covering the same
 * Eid/Diwali-vs-school-holidays ground were merged into one.
 */
export const guides: Guide[] = [
  {
    slug: 'visa-processing-booking-date',
    title: 'How visa processing time should shape your booking date',
    summary: 'For Pakistan, India and Saudi Arabia, visa processing is often the real constraint on how late you can book, not flight pricing.',
    paragraphs: [
      'For Pakistan, India and Saudi Arabia, visa processing is often the real constraint on how late you can book, not flight pricing. e-Visas for India and Pakistan are typically processed within 4 to 7 days, but delays happen, particularly during high-demand periods. Build at least 2 to 3 weeks of buffer before your travel date if you haven\'t applied yet, and treat "fastest possible visa turnaround" as a worst case, not a plan.',
      'The order of operations matters as much as the timing. The expensive mistake is booking a non-refundable fare first and applying for the visa second, because if the application is delayed past your departure date, the fare is lost. If your dates depend on a visa you don\'t yet hold, either apply before you commit to the flight, or choose a fare with a change policy you\'ve actually read rather than assumed.',
      'Two document checks catch people out beyond the visa itself. If you travel on a NICOP or OCI card instead of a visa, check its expiry when you start planning rather than at the airport, since renewals routinely take longer than people budget for. And check your passport\'s remaining validity: countries on these routes commonly require six months beyond your travel dates, which turns an "expires next spring" passport into a problem for a winter trip.',
    ],
  },
  {
    slug: 'eid-diwali-vs-school-holiday-pricing',
    title: 'Why Eid and Diwali pricing behaves differently to UK school holidays',
    summary: 'Festival demand shifts each year against the lunar calendars, and when it overlaps a UK school holiday, expect the steepest fares of the year.',
    paragraphs: [
      'UK school holiday pricing follows a predictable pattern most travel sites are built around. Eid and Diwali don\'t follow the same calendar logic. They shift each year against the Islamic and Hindu lunar calendars, creating demand spikes that aren\'t tied to half-term dates. If your travel is tied to a festival, treat the festival date as your primary planning anchor, then check the UK school holiday overlap separately.',
      'The years to watch are the ones where the two calendars collide. When Eid or Diwali falls inside a UK school holiday window, both demand spikes hit the same dates at once and fares are the steepest of the year, so book earlier than either pattern alone would suggest. In years where the festival sits in normal term time, families tied to school dates and families tied to the festival are competing for different weeks, and pricing is noticeably kinder.',
      'Don\'t forget the return leg follows its own festival logic. Outbound demand peaks in the days before the festival, and return demand peaks in the days immediately after it, when everyone who travelled out wants to come home in the same narrow window. If your dates have any flexibility at all, shifting the return even a few days past the post-festival rush is one of the more reliable ways to bring the total fare down.',
    ],
  },
  {
    slug: 'direct-vs-gulf-connecting-fares',
    title: 'Comparing direct versus Gulf-connecting fares properly',
    summary: 'A one-stop fare via Dubai or Doha is sometimes cheaper than flying direct, but only if you compare the whole journey rather than the headline price.',
    paragraphs: [
      'A one-stop fare via Dubai, Doha or Abu Dhabi is sometimes cheaper than a direct flight to Pakistan or India, but the comparison needs to include total journey time, connection risk, and whether checked luggage transfers automatically. For trips with young children or elderly relatives, a direct flight is often worth a moderate price premium.',
      'Compare like with like: total door-to-door time, not flight time. A connection adds the layover itself plus the slack you should build around it. A tight connection saves an hour on paper and costs a day when it goes wrong. Check whether both legs sit on a single ticket. One booking means the airline owns the problem if you misconnect and your bags are checked through; two separate cheap tickets stitched together means you own the problem, and that risk is rarely priced into the "saving".',
      'The connecting option earns its place in specific situations: when your dates are flexible enough to catch the better one-stop pricing, when the layover is long enough to be genuinely restful rather than stressful, or when you\'re comparing cabins. A one-stop business class fare via the Gulf sometimes prices below what you\'d expect against a direct fare in the same cabin. The mistake is treating the headline price as the whole comparison.',
    ],
  },
  {
    slug: 'what-umrah-package-actually-includes',
    title: 'What "package" actually means for Umrah trips',
    summary: 'Two Umrah packages at similar prices can offer very different hotels, transport and proximity to the Haram, so it pays to check before booking.',
    paragraphs: [
      'Umrah packages bundle flights, hotels and transport, but the proportion of nights in Makkah versus Madinah, and the distance of each hotel from the Haram, varies enormously between operators advertising similar prices. Ask for the specific hotel names before booking, not just the star rating.',
      'A short checklist separates comparable quotes from incomparable ones: the named hotel in each city, its real distance from the Haram (walking distance or shuttle, and if shuttle, how often it runs), the exact split of nights between Makkah and Madinah, whether transfers between cities are private or shared, and whether visa handling is included in the price or charged on top. Two packages that look £100 apart can be hundreds apart once these are levelled.',
      'Before paying, confirm the operator is ATOL-protected for flight-inclusive packages booked in the UK, since that\'s what protects your money if the operator fails. And be realistic about Ramadan. It\'s the highest-demand period of the year, prices rise accordingly, and the walking-distance hotels sell out first. If Ramadan is the point of the trip, book early and fix the hotel details in writing; if it isn\'t, travelling either side of it buys noticeably more package for the same money.',
    ],
  },
  {
    slug: 'when-business-class-sales-happen',
    title: 'When business class sales actually happen',
    summary: 'Long-haul business fares don\'t follow the "book 6 weeks ahead" logic of economy; airline sales and corporate demand matter more.',
    paragraphs: [
      'Long-haul business class fares to the Gulf and South Asia don\'t follow the same "book 6 weeks ahead" logic as economy. Airline-specific sales and shifts in corporate travel demand matter more than your booking window, so it\'s worth checking fares periodically rather than assuming an early booking guarantees the best price.',
      'The practical tactic is to watch a route rather than snapshot it. Check the same route and rough dates every week or two and you\'ll quickly learn what "normal" looks like for that pairing, which is the only way to recognise a genuine sale fare when one appears. Widen the comparison too. The same cabin from a different UK airport, or via a Gulf hub instead of direct, can price very differently for the same trip.',
      'Business class earns its premium most clearly on long, single-sector flights, where a flat bed changes what you can do on arrival, and least on itineraries where the long leg is short or the cabin is only marginally better than premium economy. Mixed-cabin bookings, where the short leg is economy and the long-haul leg is business, are worth pricing before you assume all-business is the only way to fly it.',
    ],
  },
  {
    slug: 'esim-vs-local-sim',
    title: 'An eSIM is usually cheaper and easier than a local SIM on these routes',
    summary: 'For Pakistan, India and the Gulf, an eSIM bought before departure avoids the airport SIM queue and unregistered-number problems.',
    paragraphs: [
      'For Pakistan, India and the Gulf, an eSIM bought before departure avoids the airport SIM-shop queue and the risk of an unregistered number being blocked after a few days, a known issue with some Pakistani networks for foreign-registered SIMs. Compare a dedicated travel eSIM provider such as Airalo or Holafly against your UK provider\'s roaming add-on. For trips longer than a week, a local eSIM is almost always the cheaper option, but check your phone supports eSIM before relying on it as your only option.',
      'Set it up before you leave, not after you land. Install the eSIM at home on your own Wi-Fi, confirm it appears as a second line, and read how activation works, since some plans start the clock at install and others at first connection. Keep your UK SIM active but with data roaming off. Your WhatsApp number stays your UK number regardless of which SIM provides the data, which is exactly what you want for staying reachable to family on both ends of the trip.',
      'If you\'re arranging travel for parents or older relatives, do the eSIM installation on their phone before departure and test it. An airport arrivals hall with no working connection is the worst possible place to troubleshoot a QR code. And note most travel eSIMs are data only, fine for WhatsApp calls, but if a trip genuinely needs a local phone number for local calls, that\'s the one case where the local SIM shop still wins.',
    ],
  },
  {
    slug: 'travel-insurance-family-visit-trips',
    title: 'Travel insurance for family-visit trips needs checking more carefully',
    summary: 'Many policies treat "visiting friends and relatives" differently from holidays, and some exclude pilgrimage travel by default.',
    paragraphs: [
      'Many standard travel insurance policies treat "visiting friends and relatives" trips differently from holidays, and some exclude claims if you\'re staying with family rather than in a hotel. Always check the policy wording rather than assuming a generic annual policy covers this trip type. For Umrah specifically, confirm the policy explicitly covers pilgrimage travel, as some standard policies exclude it by default.',
      'Three wording checks matter most on these routes. First, trip length: extended family stays often run past the per-trip day limit buried in annual policies. Second, pre-existing conditions: cover for older travellers is only valid if conditions were declared, and an undeclared condition is the most common reason a large medical claim fails. Third, valuables: wedding and gift jewellery routinely exceeds the per-item limit on a standard policy, so check the cap before assuming it\'s covered in your luggage.',
      'Buy the policy when you book the trip, not when you fly. Cancellation cover starts from the purchase date, and insurance bought the week before departure has spent months not protecting the money you\'d already committed. It\'s a detail that costs nothing to get right and is the difference between a refunded trip and a lost one if plans change.',
    ],
  },
  {
    slug: 'checked-baggage-allowances',
    title: 'Checked baggage allowances vary more than people expect on these routes',
    summary: 'PIA, Air India and Saudia all set different allowances, and family-visit travellers routinely exceed whichever one applies.',
    paragraphs: [
      'PIA, Air India and Saudia all have different standard checked baggage allowances to British Airways or Emirates on the same general route, and family-visit travellers carrying gifts or shopping routinely exceed whichever allowance applies. Check your specific airline\'s allowance at the time of booking rather than assuming "international flight" means a standard 23kg, and pre-purchase extra baggage online rather than paying the airport rate.',
      'Allowances also vary within a single airline, by fare type, cabin and sometimes by route, so check the allowance printed on your actual booking, not a figure remembered from a previous trip. Weigh bags at home before leaving for the airport. The check-in desk is the most expensive place in the journey to discover you\'re three kilos over. And don\'t ignore hand baggage: weight limits on it are enforced far more strictly at some overseas airports than they typically are in the UK.',
      'The leg that catches people out is the return. The flight out is usually packed with intention; the flight home carries everything accumulated across weeks of family visits, shopping and gifts. If you know from experience the return always runs heavy, pre-buying extra allowance for the return leg only, at the online rate, before you fly home, is consistently cheaper than negotiating at an airport desk on departure day.',
    ],
  },
  {
    slug: 'comparing-airlines-same-route',
    title: 'Comparing airlines on the same route is worth the extra five minutes',
    summary: 'On routes served by multiple carriers, service, baggage and pricing differ meaningfully, so it pays not to default to whichever appears first.',
    paragraphs: [
      'On routes served by more than one carrier, Heathrow to Delhi for example, where British Airways, Virgin Atlantic and Air India all operate directly, service standards, baggage allowances and typical pricing all differ meaningfully. Don\'t default to whichever airline appears first in a search. Compare at least two before booking, particularly for a long-haul family trip.',
      'Price is the visible difference; the others surface mid-journey. Baggage allowance can vary by an entire suitcase between carriers on the same route. Departure and arrival times matter more than they look. An overnight flight landing in the morning and a daytime flight landing at midnight are very different propositions with children or an onward journey. Meal service, seat configuration and how the airline handles disruption all differ too, and none of it shows in a headline fare comparison.',
      'Five minutes covers it. Pick the two or three carriers on your route, check each one\'s baggage allowance and arrival time against your plans, then compare fares on equal terms. The route guides on this site list which airlines fly each pairing and what the fare has looked like when we\'ve checked it, useful context for judging whether the price in front of you is normal for the route or genuinely worth moving on.',
    ],
  },
];

export function getGuideBySlug(slug: string) {
  return guides.find((g) => g.slug === slug);
}

export function getRelatedGuides(slug: string, count = 3) {
  // Rotate from the current guide's position so every page surfaces a
  // different trio, not the same first three guides site-wide.
  const idx = guides.findIndex((g) => g.slug === slug);
  if (idx === -1) return guides.slice(0, count);
  return Array.from(
    { length: Math.min(count, guides.length - 1) },
    (_, i) => guides[(idx + 1 + i) % guides.length]
  );
}
