export interface Guide {
  slug: string;
  title: string;
  /** One-sentence hook used on index cards and as the meta description. */
  summary: string;
  /** Body paragraphs, in order. */
  paragraphs: string[];
}

/**
 * Editorial guides. Each guide gets its own indexable page at /guides/[slug]
 * — one guide per URL so each can rank for its own long-tail query, rather
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
    summary: 'For Pakistan, India and Saudi Arabia, visa processing — not flight pricing — is often the real constraint on how late you can book.',
    paragraphs: [
      'For Pakistan, India and Saudi Arabia, visa processing — not flight pricing — is often the real constraint on how late you can book. e-Visas for India and Pakistan are typically processed within 4–7 days, but delays happen, particularly during high-demand periods. Build at least 2–3 weeks of buffer before your travel date if you haven\'t applied yet, and treat "fastest possible visa turnaround" as a worst case, not a plan.',
    ],
  },
  {
    slug: 'eid-diwali-vs-school-holiday-pricing',
    title: 'Why Eid and Diwali pricing behaves differently to UK school holidays',
    summary: 'Festival demand shifts each year against the lunar calendars — and when it overlaps a UK school holiday, expect the steepest fares of the year.',
    paragraphs: [
      'UK school holiday pricing follows a predictable pattern most travel sites are built around. Eid and Diwali don\'t follow the same calendar logic — they shift each year and create demand spikes that aren\'t tied to half-term dates. If your travel is tied to a festival, treat the festival date as your primary planning anchor, then check UK school holiday overlap separately.',
      'School holiday dates are fixed by term calendars; Eid and Diwali shift each year against the Islamic and Hindu lunar calendars. In years where a festival falls inside a UK school holiday window, expect the steepest fares of the year — both demand spikes hit the same dates at once. Check both calendars separately before assuming "half-term" and "Eid" mean the same pricing pattern every year.',
    ],
  },
  {
    slug: 'direct-vs-gulf-connecting-fares',
    title: 'Comparing direct versus Gulf-connecting fares properly',
    summary: 'A one-stop fare via Dubai or Doha is sometimes cheaper than flying direct — but only if you compare the whole journey, not the headline price.',
    paragraphs: [
      'A one-stop fare via Dubai, Doha or Abu Dhabi is sometimes cheaper than a direct flight to Pakistan or India — but the comparison needs to include total journey time, connection risk, and whether checked luggage transfers automatically. For trips with young children or elderly relatives, a direct flight is often worth a moderate price premium.',
    ],
  },
  {
    slug: 'what-umrah-package-actually-includes',
    title: 'What "package" actually means for Umrah trips',
    summary: 'Two Umrah packages at similar prices can offer very different hotels, transport and proximity to the Haram — here\'s what to check before booking.',
    paragraphs: [
      'Umrah packages bundle flights, hotels and transport, but the proportion of nights in Makkah versus Madinah — and the distance of each hotel from the Haram — varies enormously between operators advertising similar prices. Ask for the specific hotel names before booking, not just the star rating.',
    ],
  },
  {
    slug: 'when-business-class-sales-happen',
    title: 'When business class sales actually happen',
    summary: 'Long-haul business fares don\'t follow the "book 6 weeks ahead" logic of economy — airline sales and corporate demand matter more.',
    paragraphs: [
      'Long-haul business class fares to the Gulf and South Asia don\'t follow the same "book 6 weeks ahead" logic as economy. Airline-specific sales and shifts in corporate travel demand matter more than your booking window — it\'s worth checking fares periodically rather than assuming an early booking guarantees the best price.',
    ],
  },
  {
    slug: 'esim-vs-local-sim',
    title: 'An eSIM is usually cheaper and easier than a local SIM on these routes',
    summary: 'For Pakistan, India and the Gulf, an eSIM bought before departure avoids the airport SIM queue and unregistered-number problems.',
    paragraphs: [
      'For Pakistan, India and the Gulf, an eSIM bought before departure avoids the airport SIM-shop queue and the risk of an unregistered number being blocked after a few days — a known issue with some Pakistani networks for foreign-registered SIMs. Compare a dedicated travel eSIM provider (such as Airalo or Holafly) against your UK provider\'s roaming add-on; for trips longer than a week, a local eSIM is almost always the cheaper option, but check your phone supports eSIM before relying on it as your only option.',
    ],
  },
  {
    slug: 'travel-insurance-family-visit-trips',
    title: 'Travel insurance for family-visit trips needs checking more carefully',
    summary: 'Many policies treat "visiting friends and relatives" differently from holidays — and some exclude pilgrimage travel by default.',
    paragraphs: [
      'Many standard travel insurance policies treat "visiting friends and relatives" trips differently from holidays, and some exclude claims if you\'re staying with family rather than in a hotel — always check the policy wording rather than assuming a generic annual policy covers this trip type. For Umrah specifically, confirm the policy explicitly covers pilgrimage travel, as some standard policies exclude it by default.',
    ],
  },
  {
    slug: 'checked-baggage-allowances',
    title: 'Checked baggage allowances vary more than people expect on these routes',
    summary: 'PIA, Air India and Saudia all set different allowances — and family-visit travellers routinely exceed whichever one applies.',
    paragraphs: [
      'PIA, Air India and Saudia all have different standard checked baggage allowances to British Airways or Emirates on the same general route — and family-visit travellers carrying gifts or shopping routinely exceed whichever allowance applies. Check your specific airline\'s allowance at the time of booking rather than assuming "international flight" means a standard 23kg, and pre-purchase extra baggage online rather than paying the airport rate.',
    ],
  },
  {
    slug: 'comparing-airlines-same-route',
    title: 'Comparing airlines on the same route is worth the extra five minutes',
    summary: 'On routes served by multiple carriers, service, baggage and pricing differ meaningfully — don\'t default to whichever appears first.',
    paragraphs: [
      'On routes served by more than one carrier — Heathrow to Delhi, for example, where British Airways, Virgin Atlantic and Air India all operate directly — service standards, baggage allowances and typical pricing all differ meaningfully. Don\'t default to whichever airline appears first in a search; compare at least two before booking, particularly for a long-haul family trip.',
    ],
  },
];

export function getGuideBySlug(slug: string) {
  return guides.find((g) => g.slug === slug);
}

export function getRelatedGuides(slug: string, count = 3) {
  return guides.filter((g) => g.slug !== slug).slice(0, count);
}
