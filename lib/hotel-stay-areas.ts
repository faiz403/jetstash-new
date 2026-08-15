/**
 * Per-destination "where should I actually stay" area intelligence —
 * the stay-area layer that sits above individual property examples in the
 * generalized Holiday Intelligence system (lib/holiday-intelligence.ts,
 * components/destination/holiday-intelligence.tsx).
 *
 * This module answers "which area suits this trip and what are the
 * trade-offs" — general, durable destination geography (which areas exist
 * and what each is broadly known for), not property-specific claims. It
 * intentionally does not carry citations the way data/hotel-evidence*.ts
 * does: nothing here is a specific, disputable factual claim about a named
 * property (an address, a distance, a facility) — it is the same order of
 * general geographic description already used uncited in
 * data/destinations.ts's `description` field. Anything more specific
 * (an exact address, an airport distance, a facility) belongs in a hotel
 * evidence record instead, sourced there.
 *
 * Explicitly NOT a ranking: copy is written as trade-offs ("X suits Y,
 * Z suits W"), never "best area" or "top choice".
 */

export interface StayAreaEntry {
  /** Short area/neighbourhood name, e.g. "Dubai Marina / JBR". */
  name: string;
  /** One or two factual sentences on what the area suits and its trade-offs. */
  context: string;
}

export interface DestinationStayAreaCopy {
  destinationSlug: string;
  /** e.g. "Where to stay in Dubai" */
  heading: string;
  /** Intro paragraph explaining the area-choice framing for this destination. */
  intro: string;
  areas: readonly StayAreaEntry[];
  /** Set for gateway-style airports (e.g. Dalaman) where the destination itself is not one place to stay. */
  gatewayNote?: string;
}

export const destinationStayAreaCopy: readonly DestinationStayAreaCopy[] = [
  {
    // Antalya pilot (pre-dates this expansion programme) — deliberately
    // `areas: []`. The shared component only renders the "Areas to
    // consider" block when areas.length > 0, so this entry supplies
    // Antalya's existing heading/intro copy (verbatim, unchanged) without
    // adding a section the live page never had. Do not add area entries
    // here without a founder decision — that would be new public copy,
    // not a refactor.
    destinationSlug: 'antalya',
    heading: 'Where to stay in Antalya',
    intro:
      'Antalya is a collection of resort areas rather than one single holiday setting. These checked examples show how the location and the stay context can differ.',
    areas: [],
  },
  {
    destinationSlug: 'dubai',
    heading: 'Where to stay in Dubai',
    intro:
      'Dubai spreads its beaches, older trading districts and skyline attractions across distinct areas rather than one centre. The right area depends on whether the trip is built around the beach, sightseeing, or a stopover with limited time.',
    areas: [
      { name: 'Dubai Marina / JBR', context: 'A beachfront high-rise district with a walkable promenade (JBR – Jumeirah Beach Residence) directly on the sea, and the Marina\'s own waterfront strip a short distance inland.' },
      { name: 'Downtown Dubai', context: 'Built around Burj Khalifa and Dubai Mall, with the Dubai Fountain shows on its doorstep. Not on the beach; suits sightseeing-led stays over beach-led ones.' },
      { name: 'Palm Jumeirah', context: 'A man-made island of beachfront resort properties, physically separate from Downtown and the older city districts, connected by road/monorail.' },
      { name: 'Deira / Bur Dubai', context: 'The older trading side of the city either side of Dubai Creek, with the historic souks and abra crossings — a different, more heritage-led character than the newer beach and skyline districts.' },
    ],
  },
  {
    destinationSlug: 'istanbul',
    heading: 'Where to stay in Istanbul',
    intro:
      'Istanbul spans two continents across the Bosphorus, and the historic sights, nightlife and transport links are not all in the same district. Where to stay depends heavily on whether the trip is heritage-led, nightlife-led, or based around the Bosphorus itself.',
    areas: [
      { name: 'Sultanahmet', context: 'The historic peninsula, home to Hagia Sophia, the Blue Mosque and Topkapı Palace — the most walkable base for heritage sightseeing, on the European side.' },
      { name: 'Taksim', context: 'A central European-side district built around İstiklal Avenue, with a different, more contemporary nightlife-and-shopping character than Sultanahmet.' },
      { name: 'Karaköy / Galata', context: 'A waterfront European-side district by the Galata Tower and the Golden Horn, positioned between the historic peninsula and Taksim.' },
      { name: 'Kadıköy (Asian side)', context: 'Across the Bosphorus from the European districts above, with its own market and waterfront character — a different, less tourist-dense base reached by ferry.' },
    ],
  },
  {
    destinationSlug: 'marrakech',
    heading: 'Where to stay in Marrakech',
    intro:
      'Marrakech offers a genuinely different holiday depending on area: the historic walled Medina, the resort-style modern districts, and the palm-grove Palmeraie all suit a different kind of stay.',
    areas: [
      { name: 'Medina', context: 'The historic walled old city around Jemaa el-Fnaa and the souks — the most atmospheric, densely packed base, typically in a riad rather than a conventional hotel.' },
      { name: 'Hivernage', context: 'A modern district close to the Medina with contemporary resort-style hotels, positioned between the old city and the newer parts of town.' },
      { name: 'Palmeraie', context: 'A palm-grove district outside the city centre with larger resort properties and more space — a quieter, more resort-style stay than the Medina, with a longer journey into the old city.' },
    ],
  },
  {
    destinationSlug: 'dalaman',
    heading: 'Where to stay near Dalaman',
    gatewayNote:
      'Dalaman Airport is a gateway to the western Turquoise Coast, not one resort area in itself — the towns and resorts it serves are spread across a wide stretch of coastline with different transfer times from the airport.',
    intro:
      'Dalaman Airport serves several genuinely different holiday areas along Turkey\'s western coast. A hotel description that only says "near Dalaman" does not tell you which of these areas it is actually in.',
    areas: [
      { name: 'Fethiye', context: 'A working harbour town with a marina, on the coast south of Dalaman Airport — a mix of town-based stays and nearby resort hotels.' },
      { name: 'Ölüdeniz', context: 'A lagoon beach resort area south of Fethiye, known for its Blue Lagoon and paragliding from nearby Babadağ — a beach-and-scenery-led stay distinct from Fethiye town.' },
      { name: 'Marmaris', context: 'A separate resort town and marina further along the coast from Fethiye, with its own more nightlife-oriented character.' },
    ],
  },
  {
    destinationSlug: 'bodrum',
    heading: 'Where to stay on the Bodrum peninsula',
    intro:
      'The Bodrum peninsula spans a working harbour town and a ring of distinct resort villages, each with a different pace and character.',
    areas: [
      { name: 'Bodrum town', context: 'The peninsula\'s harbour town, built around Bodrum Castle and a working marina — the most town-based base, with nightlife and restaurants concentrated here.' },
      { name: 'Gümbet', context: 'A beach resort area close to Bodrum town, known for a livelier, younger nightlife scene than the town centre itself.' },
      { name: 'Yalıkavak', context: 'A marina village on the northern side of the peninsula, positioned as a more upscale, marina-led resort area, a longer drive from Bodrum town.' },
    ],
  },
  {
    destinationSlug: 'agadir',
    heading: 'Where to stay in Agadir',
    intro:
      'Agadir\'s own beachfront tourist zone is the established winter-sun base, with Taghazout Bay to the north offering a distinct, more recently developed alternative.',
    areas: [
      { name: 'Agadir beachfront', context: 'The city\'s long crescent beach and main hotel strip, with the rebuilt modern city centre immediately behind it.' },
      { name: 'Taghazout Bay', context: 'A newer, purpose-built resort development north of Agadir city, positioned separately from the city beachfront rather than within walking distance of it.' },
    ],
  },
  {
    destinationSlug: 'barcelona',
    heading: 'Where to stay in Barcelona',
    intro:
      'Barcelona\'s sightseeing, beach and quieter residential character sit in different districts, so the right area depends on what the trip is built around.',
    areas: [
      { name: 'Eixample', context: 'The grid-planned district containing Gaudí\'s Sagrada Família and Casa Batlló — a central, sightseeing-convenient base, not on the beach.' },
      { name: 'Gothic Quarter (Barri Gòtic)', context: 'The old-town core with narrow medieval streets, adjoining the Gothic Cathedral — the most historic, walkable base for the old city.' },
      { name: 'Barceloneta', context: 'The beachfront district by the old port, positioned for direct beach access rather than the inland sightseeing districts above.' },
    ],
  },
  {
    destinationSlug: 'faro',
    heading: 'Where to stay in the Algarve',
    gatewayNote:
      'Faro Airport is the entry point for the whole Algarve coastline, not a single resort area — most travellers landing at Faro are heading elsewhere along the coast rather than staying in Faro itself.',
    intro:
      'Faro Airport serves a wide stretch of the Algarve, and the resort towns it connects to differ significantly in character and distance from the airport.',
    areas: [
      { name: 'Faro city', context: 'The airport\'s own city, with an old town core — a smaller, less resort-focused base than the towns further along the coast.' },
      { name: 'Albufeira', context: 'A major Algarve resort town west of Faro, with a large concentration of hotels and a well-established tourist strip.' },
      { name: 'Vilamoura', context: 'A purpose-built marina resort area between Faro and Albufeira, known for its marina, beaches and golf resorts.' },
      { name: 'Lagos', context: 'A historic town further west along the coast, with its own beaches and old-town character, a longer transfer from Faro Airport than Albufeira or Vilamoura.' },
    ],
  },
  {
    destinationSlug: 'madinah',
    heading: 'Where to stay in Madinah',
    gatewayNote:
      'The main decision for a Madinah stay is not which resort to choose — it is where a property sits relative to Al-Masjid an-Nabawi and which gate it is practical to use. JetStash does not rank properties by quality or make a religious recommendation; only the property\'s own stated distance/gate claims are shown, and only when the property itself made a clear statement.',
    intro:
      'Central Zone hotels around the Prophet\'s Mosque are typically described by their own operators as adjacent to the mosque, but by different named gates — the practical difference for a stay is which gate and which side of the mosque that puts you closest to, not a resort-style area choice.',
    areas: [
      { name: "Northern side / Ladies' Prayer Entrance", context: 'Properties on this side describe themselves as closest to the Ladies\' Prayer Entrance specifically, which matters if that is the entrance your party will actually use.' },
      { name: 'North Zone / Al Salam Gate', context: 'Properties here describe themselves as adjacent to the mosque via Al Salam Gate, with some also running a shuttle specifically to the Ladies\' Gate for guests using that entrance.' },
    ],
  },
];

export function getStayAreaCopyForDestination(destinationSlug: string): DestinationStayAreaCopy | null {
  return destinationStayAreaCopy.find((entry) => entry.destinationSlug === destinationSlug) ?? null;
}
