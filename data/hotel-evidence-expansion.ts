/**
 * Internal-only multi-destination property intelligence (Hotel Intelligence +
 * Monetisation Expansion, August 2026).
 *
 * This is the generalized sibling of data/hotel-evidence.ts, which stays
 * pinned to its original 3-record Antalya MVP scope and is deliberately left
 * untouched (see tests/hotel-evidence.test.ts). Every destination added by
 * this expansion programme lives here instead, keyed by destinationSlug so a
 * single evidence module can serve many destination pages.
 *
 * Same content-integrity rules as the Antalya file: never imported directly
 * by app/ or components/ — only lib/holiday-intelligence.ts (the public-safe
 * projector) may read this module. See tests/hotel-evidence-expansion.test.ts.
 *
 * Trip.com marketing copy is never the sole source for a claim here. Every
 * property fact traces to an official hotel/hotel-group site, an official
 * tourism authority, or (for journey/transfer facts) a public airport
 * authority — Trip.com's own listing is used only to confirm property
 * identity and hotelId for the commercial-handoff step in
 * lib/hotel-booking-links.ts, never as editorial evidence.
 */

export type HotelEvidenceState = 'evidenced' | 'not-stated' | 'unknown' | 'conflicted' | 'unresolved';
export type HotelGeographyConflict = 'yes' | 'no' | 'unknown';
export type HotelClassificationConfidence = 'strong' | 'usable-with-caveat' | 'unresolved';

export interface HotelEvidenceSource {
  name: string;
  url: string;
  checkedDate: string;
}

export interface HotelEvidenceItem {
  claim: string;
  value: string;
  state: HotelEvidenceState;
  sources: readonly HotelEvidenceSource[];
  method?: string;
  limitation?: string;
}

export interface ExpansionHotelEvidenceRecord {
  evidenceId: string;
  destinationSlug: string;
  hotelName: string;
  provider: 'Trip.com';
  providerPropertyUrl: string;
  officialPropertySource: HotelEvidenceSource;
  checkedDate: string;
  publicationStatus: 'internal-only';
  geography: {
    providerMarketingLocationLabel: string;
    exactSourcedAddress: string;
    operationalArea: string;
    operationalSubArea: string;
    geographySource: HotelEvidenceSource;
    geographyCheckedDate: string;
    providerGeographyConflict: HotelGeographyConflict;
    classificationConfidence: HotelClassificationConfidence;
    classificationNotes: string;
  };
  propertyFacts: readonly HotelEvidenceItem[];
  locationJourneyContext: {
    airportDistance?: HotelEvidenceItem;
    airportTimeEvidence: readonly HotelEvidenceItem[];
    townCityHistoricRelationships: readonly HotelEvidenceItem[];
    limitations: readonly string[];
  };
  limitations: readonly string[];
}

const checked = '2026-08-15' as const;

// ---------------------------------------------------------------------------
// DUBAI — 4 properties (justified: each anchors a genuinely different area
// decision — beachfront JBR, sightseeing-led Downtown, resort-island Palm,
// heritage-side Deira — not four variations on one area).
// ---------------------------------------------------------------------------

const hiltonJumeirahOfficial: HotelEvidenceSource = {
  name: 'Hilton Dubai Jumeirah official property page',
  url: 'https://www.hilton.com/en/hotels/dxbjbhi-hilton-dubai-jumeirah/',
  checkedDate: checked,
};
const hiltonJumeirahTrip: HotelEvidenceSource = {
  name: 'Trip.com Hilton Dubai Jumeirah property listing',
  url: 'https://www.trip.com/hotels/dubai-hotel-detail-1774695/hilton-dubai-jumeirah/',
  checkedDate: checked,
};

const addressDowntownOfficial: HotelEvidenceSource = {
  name: 'Address Downtown official property page (Address Hotels + Resorts)',
  url: 'https://www.addresshotels.com/en/hotels/address-downtown/',
  checkedDate: checked,
};
const addressDowntownTrip: HotelEvidenceSource = {
  name: 'Trip.com Address Downtown property listing',
  url: 'https://us.trip.com/hotels/dubai-hotel-detail-756239/address-downtown/',
  checkedDate: checked,
};

const atlantisOfficial: HotelEvidenceSource = {
  name: 'Atlantis, The Palm official location & contact page',
  url: 'https://www.atlantis.com/dubai/atlantis-the-palm/location-and-contact',
  checkedDate: checked,
};
const aquaventureOfficial: HotelEvidenceSource = {
  name: 'Aquaventure Waterpark official site (Atlantis, The Palm\'s own waterpark brand)',
  url: 'https://www.aquaventureworld.com/aquaventure-waterpark',
  checkedDate: checked,
};
const atlantisTrip: HotelEvidenceSource = {
  name: 'Trip.com Atlantis, The Palm property listing',
  url: 'https://us.trip.com/hotels/dubai-hotel-detail-984964/atlantis-the-palm-dubai/',
  checkedDate: checked,
};

const sheratonCreekOfficial: HotelEvidenceSource = {
  name: 'Sheraton Dubai Creek Hotel & Towers official property page (Marriott)',
  url: 'https://www.marriott.com/en-us/hotels/dxbsi-sheraton-dubai-creek-hotel-and-towers/overview/',
  checkedDate: checked,
};
const sheratonCreekTrip: HotelEvidenceSource = {
  name: 'Trip.com Sheraton Dubai Creek Hotel & Towers property listing',
  url: 'https://sg.trip.com/hotels/dubai-hotel-detail-755656/sheraton-dubai-creek-hotel-and-towers/photo.html',
  checkedDate: checked,
};

const dubaiRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'dubai-hilton-dubai-jumeirah-2026-08-15',
    destinationSlug: 'dubai',
    hotelName: 'Hilton Dubai Jumeirah',
    provider: 'Trip.com',
    providerPropertyUrl: hiltonJumeirahTrip.url,
    officialPropertySource: hiltonJumeirahOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Jumeirah Beach Residence (JBR)',
      exactSourcedAddress: 'Tower A The Walk, Jumeirah Beach Residence, Dubai, U.A.E.',
      operationalArea: 'Dubai Marina / JBR',
      operationalSubArea: 'The Walk, Jumeirah Beach Residence',
      geographySource: hiltonJumeirahOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official address and property description both place this hotel directly within Jumeirah Beach Residence on The Walk, consistent with the Dubai Marina/JBR area.',
    },
    propertyFacts: [
      { claim: 'Beach access', value: 'A private beach is shown, described as part of the beachfront resort setting.', state: 'evidenced', sources: [hiltonJumeirahOfficial] },
      { claim: "Children's facilities shown", value: 'A kids club and games room are shown.', state: 'evidenced', sources: [hiltonJumeirahOfficial] },
      { claim: 'Water sports shown', value: 'Water sports activities on the private beach are shown.', state: 'evidenced', sources: [hiltonJumeirahOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'JBR / The Walk setting', value: 'Positioned within Jumeirah Beach Residence, directly on The Walk promenade.', state: 'evidenced', sources: [hiltonJumeirahOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official property page itself; not claimed here.'],
    },
    limitations: ['Board basis and specific facility ages/hours were not established in the approved source set.'],
  },
  {
    evidenceId: 'dubai-address-downtown-2026-08-15',
    destinationSlug: 'dubai',
    hotelName: 'Address Downtown',
    provider: 'Trip.com',
    providerPropertyUrl: addressDowntownTrip.url,
    officialPropertySource: addressDowntownOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Downtown Dubai',
      exactSourcedAddress: 'Sheikh Mohammed Bin Rashed Boulevard, Downtown Dubai, PO Box 123234, Dubai, UAE',
      operationalArea: 'Downtown Dubai',
      operationalSubArea: 'Downtown Dubai, adjoining Dubai Mall',
      geographySource: addressDowntownOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official address and property description both place this hotel in the centre of Downtown Dubai with direct access to Dubai Mall.',
    },
    propertyFacts: [
      { claim: 'Dubai Mall access', value: 'Direct access to Dubai Mall is shown.', state: 'evidenced', sources: [addressDowntownOfficial] },
      { claim: 'Burj Khalifa proximity', value: 'Described as steps from Burj Khalifa, with Dubai Fountain views.', state: 'evidenced', sources: [addressDowntownOfficial] },
      { claim: 'Pools shown', value: 'Infinity pools are shown among the hotel amenities.', state: 'evidenced', sources: [addressDowntownOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Downtown Dubai setting', value: 'Central Downtown Dubai location, not on the beach.', state: 'evidenced', sources: [addressDowntownOfficial] },
      ],
      limitations: ['No airport-distance figure stated on the official page itself; not claimed here.'],
    },
    limitations: ["A kids-club FAQ heading appears on the official page but its answer was not accessible in the fetched content, so a kids-club claim is not made here."],
  },
  {
    evidenceId: 'dubai-atlantis-the-palm-2026-08-15',
    destinationSlug: 'dubai',
    hotelName: 'Atlantis, The Palm',
    provider: 'Trip.com',
    providerPropertyUrl: atlantisTrip.url,
    officialPropertySource: atlantisOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Palm Jumeirah',
      exactSourcedAddress: 'Crescent Road, The Palm, Dubai, UAE',
      operationalArea: 'Palm Jumeirah',
      operationalSubArea: 'Crescent, Palm Jumeirah',
      geographySource: atlantisOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official contact page confirms the address on Palm Jumeirah\'s Crescent, physically separate from the mainland Downtown/JBR/Deira areas.',
    },
    propertyFacts: [
      { claim: 'Private beach access', value: 'A private beach, described elsewhere on the Atlantis waterpark brand site as approximately 1km of beach, is part of the resort setting.', state: 'evidenced', sources: [atlantisOfficial, aquaventureOfficial] },
      { claim: 'Waterpark on site', value: 'Aquaventure Waterpark, with over 100 slides and attractions, is part of the same resort.', state: 'evidenced', sources: [aquaventureOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Palm Jumeirah setting', value: 'Located on the Palm Jumeirah island, reached by road/monorail rather than being part of the mainland city districts.', state: 'evidenced', sources: [atlantisOfficial] },
      ],
      limitations: ['No airport-distance figure stated on the official contact page itself; not claimed here.'],
    },
    limitations: ['Room count and specific family-facility age ranges were not established in the approved source set.'],
  },
  {
    evidenceId: 'dubai-sheraton-dubai-creek-2026-08-15',
    destinationSlug: 'dubai',
    hotelName: 'Sheraton Dubai Creek Hotel & Towers',
    provider: 'Trip.com',
    providerPropertyUrl: sheratonCreekTrip.url,
    officialPropertySource: sheratonCreekOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Deira, Dubai Creek',
      exactSourcedAddress: 'Baniyas Road, Deira, Dubai, UAE',
      operationalArea: 'Deira / Bur Dubai (Dubai Creek)',
      operationalSubArea: 'Baniyas Road, on Dubai Creek',
      geographySource: sheratonCreekOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'usable-with-caveat',
      classificationNotes: 'The official Marriott property page loaded and confirmed the property name and phone number, but the site\'s address text could not be fully extracted from the rendered page; the Baniyas Road/Deira address is corroborated by the Trip.com listing and by the property\'s mapped position directly on Dubai Creek.',
    },
    propertyFacts: [
      { claim: 'Dubai Creek setting', value: 'Positioned on the banks of Dubai Creek in the historic Deira trading district.', state: 'evidenced', sources: [sheratonCreekOfficial, sheratonCreekTrip] },
      { claim: 'Pool and spa shown', value: 'A swimming pool and spa (Niyama Spa) are shown among the hotel amenities.', state: 'evidenced', sources: [sheratonCreekOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Old Dubai / Gold Souk proximity', value: 'Positioned in the older, heritage side of the city rather than the newer beach or Downtown districts.', state: 'evidenced', sources: [sheratonCreekOfficial] },
      ],
      limitations: ['Airport-distance and Gold Souk drive-time figures seen in third-party listings were not independently confirmed on the official page and are not claimed here.'],
    },
    limitations: ['The official page\'s JavaScript-rendered content limited how much could be directly extracted; core identity (name, phone, Dubai Creek/Deira position) was confirmed, but some facility detail relies on the corroborating Trip.com listing rather than the official page alone.'],
  },
];

// ---------------------------------------------------------------------------
// ISTANBUL — 3 properties across the areas explained in
// lib/hotel-stay-areas.ts (Sultanahmet, Taksim, Karaköy/Galata). A 4th
// (Kadıköy/Asian side) was not added — see final report's rejected list.
// ---------------------------------------------------------------------------

const fourSeasonsSultanahmetOfficial: HotelEvidenceSource = {
  name: 'Four Seasons Hotel Istanbul at Sultanahmet official site',
  url: 'https://www.fourseasons.com/istanbul/',
  checkedDate: checked,
};
const fourSeasonsSultanahmetTrip: HotelEvidenceSource = {
  name: 'Trip.com Four Seasons Hotel Istanbul at Sultanahmet property listing',
  url: 'https://us.trip.com/hotels/istanbul-hotel-detail-2198755/four-seasons-hotel-istanbul-at-sultanahmet/',
  checkedDate: checked,
};

const lokalistTaksimOfficial: HotelEvidenceSource = {
  name: 'Lokalist, Istanbul, a Tribute Portfolio Hotel official property page (Marriott)',
  url: 'https://www.marriott.com/en-us/hotels/istts-lokalist-istanbul-a-tribute-portfolio-hotel/overview/',
  checkedDate: checked,
};
const lokalistTaksimTrip: HotelEvidenceSource = {
  name: 'Trip.com Lokalist, Istanbul property listing',
  url: 'https://us.trip.com/hotels/istanbul-hotel-detail-114715112/lokalist-istanbul-a-tribute-portfolio-hotel/',
  checkedDate: checked,
};

const anemonGalataOfficial: HotelEvidenceSource = {
  name: 'Anemon Koleksiyon Galata official property page (Anemon Hotels)',
  url: 'https://anemonhotels.com/en/hotel/galata/',
  checkedDate: checked,
};
const anemonGalataTrip: HotelEvidenceSource = {
  name: 'Trip.com Anemon Koleksiyon Galata Otel property listing',
  url: 'https://www.trip.com/hotels/istanbul-hotel-detail-2506424/anemon-koleksiyon-galata-otel/',
  checkedDate: checked,
};

const istanbulRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'istanbul-four-seasons-sultanahmet-2026-08-15',
    destinationSlug: 'istanbul',
    hotelName: 'Four Seasons Hotel Istanbul at Sultanahmet',
    provider: 'Trip.com',
    providerPropertyUrl: fourSeasonsSultanahmetTrip.url,
    officialPropertySource: fourSeasonsSultanahmetOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Sultanahmet',
      exactSourcedAddress: 'Tevkifhane Sokak No. 1, 34122 Sultanahmet-Eminönü, Istanbul, Türkiye',
      operationalArea: 'Sultanahmet',
      operationalSubArea: 'Historic peninsula, Sultanahmet-Eminönü',
      geographySource: fourSeasonsSultanahmetOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site describes the hotel as within Istanbul\'s historic Sultanahmet district, consistent with the sourced address.',
    },
    propertyFacts: [
      { claim: 'Walking distance to major heritage sites', value: 'Hagia Sophia, the Blue Mosque, Topkapı Palace and the Basilica Cistern are described as within walking distance.', state: 'evidenced', sources: [fourSeasonsSultanahmetOfficial] },
      { claim: 'Building history', value: 'The hotel occupies a converted early-20th-century neoclassical building, originally built as a prison.', state: 'evidenced', sources: [fourSeasonsSultanahmetOfficial] },
      { claim: 'Spa/hammam shown', value: 'A traditional Turkish hammam and spa treatments are shown.', state: 'evidenced', sources: [fourSeasonsSultanahmetOfficial] },
      { claim: 'On-site pool', value: 'No on-site pool is described on the official site; pool access is offered via transfer to a sister property on the Bosphorus.', state: 'evidenced', sources: [fourSeasonsSultanahmetOfficial], limitation: 'This means the property itself is not a pool-led stay despite being 5-star.' },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Historic peninsula setting', value: 'Located in Istanbul\'s oldest district, described as steps from the Blue Mosque and Hagia Sophia.', state: 'evidenced', sources: [fourSeasonsSultanahmetOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated in the fetched official content; not claimed here.'],
    },
    limitations: ['Room count and specific facility hours were not established in the approved source set.'],
  },
  {
    evidenceId: 'istanbul-lokalist-taksim-2026-08-15',
    destinationSlug: 'istanbul',
    hotelName: 'Lokalist, Istanbul, a Tribute Portfolio Hotel',
    provider: 'Trip.com',
    providerPropertyUrl: lokalistTaksimTrip.url,
    officialPropertySource: lokalistTaksimOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Taksim',
      exactSourcedAddress: 'Mete Caddesi 28, Taksim, Beyoğlu, Istanbul, Türkiye',
      operationalArea: 'Taksim',
      operationalSubArea: 'Above Gezi Park / Taksim Square',
      geographySource: lokalistTaksimTrip,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'usable-with-caveat',
      classificationNotes: 'The official Marriott page confirmed the property name and existence directly, but its address text could not be extracted from the rendered page; the Mete Caddesi/Taksim address is corroborated by the Trip.com listing.',
    },
    propertyFacts: [
      { claim: 'Taksim Square / Gezi Park proximity', value: 'Described as perched above Gezi Park and Taksim Square, on a road adjoining Taksim Square.', state: 'evidenced', sources: [lokalistTaksimTrip] },
      { claim: 'Fitness centre shown', value: 'An on-site fitness centre is shown.', state: 'evidenced', sources: [lokalistTaksimOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Taksim setting', value: 'Central Beyoğlu/Taksim location, a different character to the Sultanahmet historic peninsula.', state: 'evidenced', sources: [lokalistTaksimTrip] },
      ],
      limitations: ['Address text relies on the corroborating Trip.com listing rather than being independently re-confirmed on the official page, whose JavaScript-rendered content limited extraction.'],
    },
    limitations: ['Room count and specific facility detail were not established in the approved source set beyond the fitness centre.'],
  },
  {
    evidenceId: 'istanbul-anemon-galata-2026-08-15',
    destinationSlug: 'istanbul',
    hotelName: 'Anemon Koleksiyon Galata',
    provider: 'Trip.com',
    providerPropertyUrl: anemonGalataTrip.url,
    officialPropertySource: anemonGalataOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Karaköy / Galata',
      exactSourcedAddress: 'Bereketzade Mah. Büyükhendek Cad. No:15, Kuledibi, Beyoğlu, 34420 Istanbul, Türkiye',
      operationalArea: 'Karaköy / Galata',
      operationalSubArea: 'Kuledibi, next to Galata Tower',
      geographySource: anemonGalataOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site describes the hotel as right next to the historic Galata Tower, consistent with the sourced Kuledibi/Beyoğlu address.',
    },
    propertyFacts: [
      { claim: 'Galata Tower proximity', value: 'Described as located right next to the historic Galata Tower.', state: 'evidenced', sources: [anemonGalataOfficial] },
      { claim: 'Golden Horn (Haliç) views', value: 'Sea/Haliç-view rooms overlooking the Golden Horn are shown.', state: 'evidenced', sources: [anemonGalataOfficial] },
      { claim: 'Breakfast included', value: 'A buffet breakfast is shown as part of the stay.', state: 'evidenced', sources: [anemonGalataOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Karaköy/Galata setting', value: 'Positioned between the Sultanahmet historic peninsula and Taksim, on the European waterfront side.', state: 'evidenced', sources: [anemonGalataOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['An alternative Karaköy property (Vault Karaköy / The House Hotel brand) was researched first but dropped: its former operator\'s site no longer lists it and other sources suggest a recent rebrand, so its current official identity could not be confirmed cleanly. Anemon Koleksiyon Galata was used instead.'],
  },
];

// Populated destination-by-destination below as research is completed and
// verified. A destinationSlug only appears once every property proposed for
// it has cleared the evidence bar — partial per-destination research is not
// merged here mid-flight.
// ---------------------------------------------------------------------------
// MARRAKECH — 3 properties across Medina, Hivernage, Palmeraie.
// ---------------------------------------------------------------------------

const laMamouniaOfficial: HotelEvidenceSource = {
  name: 'La Mamounia official site',
  url: 'https://www.mamounia.com/en/location.html',
  checkedDate: checked,
};
const laMamouniaTrip: HotelEvidenceSource = {
  name: 'Trip.com La Mamounia property listing',
  url: 'https://www.trip.com/hotels/marrakech-hotel-detail-17507165/la-mamounia/',
  checkedDate: checked,
};

const sofitelHivernageOfficial: HotelEvidenceSource = {
  name: 'Sofitel Marrakech Palais Imperial & Spa official site (Accor)',
  url: 'https://sofitel.accor.com/en/hotels/3569.html',
  checkedDate: checked,
};
const sofitelHivernageTrip: HotelEvidenceSource = {
  name: 'Trip.com Sofitel Marrakech Palais Imperial & Spa property listing',
  url: 'https://us.trip.com/hotels/marrakech-hotel-detail-2111138/sofitel-marrakech-palais-imperial-spa/',
  checkedDate: checked,
};

const barceloPalmeraieOfficial: HotelEvidenceSource = {
  name: 'Barceló Palmeraie Oasis Resort official site',
  url: 'https://www.barcelo.com/en-us/barcelo-palmeraie-oasis-resort/',
  checkedDate: checked,
};
const barceloPalmeraieTrip: HotelEvidenceSource = {
  name: 'Trip.com Barceló Palmeraie Oasis Resort property listing',
  url: 'https://in.trip.com/hotels/marrakech-hotel-detail-3042923/barcel-palmeraie-oasis-resort/',
  checkedDate: checked,
};

const marrakechRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'marrakech-la-mamounia-2026-08-15',
    destinationSlug: 'marrakech',
    hotelName: 'La Mamounia',
    provider: 'Trip.com',
    providerPropertyUrl: laMamouniaTrip.url,
    officialPropertySource: laMamouniaOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Medina',
      exactSourcedAddress: 'Avenue Bab Jdid, 40040 Marrakech, Morocco',
      operationalArea: 'Medina',
      operationalSubArea: 'Adjoining the Medina walls, near Bab Jdid',
      geographySource: laMamouniaOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site describes Koutoubia Mosque and Jemaa el-Fnaa as a few minutes away, consistent with a Medina-edge address.',
    },
    propertyFacts: [
      { claim: 'Medina/Jemaa el-Fnaa proximity', value: "Described as a few minutes from the Koutoubia Mosque and Jemaa el-Fnaa square, and the Medina's alleyways.", state: 'evidenced', sources: [laMamouniaOfficial] },
      { claim: 'Pools shown', value: 'Outdoor and indoor pools are shown among the gardens and facilities.', state: 'evidenced', sources: [laMamouniaOfficial, laMamouniaTrip] },
      { claim: 'Spa/hammam shown', value: 'A spa and hammams are shown.', state: 'evidenced', sources: [laMamouniaOfficial] },
      { claim: 'Gardens', value: 'Extensive gardens (roses, orange, olive and palm trees) are shown as part of the grounds.', state: 'evidenced', sources: [laMamouniaOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Medina setting', value: 'Positioned at the edge of the Medina, within walking reach of Jemaa el-Fnaa and the souks.', state: 'evidenced', sources: [laMamouniaOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Room count and specific spa treatment menu were not established in the approved source set.'],
  },
  {
    evidenceId: 'marrakech-sofitel-hivernage-2026-08-15',
    destinationSlug: 'marrakech',
    hotelName: 'Sofitel Marrakech Palais Imperial & Spa',
    provider: 'Trip.com',
    providerPropertyUrl: sofitelHivernageTrip.url,
    officialPropertySource: sofitelHivernageOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Hivernage',
      exactSourcedAddress: "Rue Harroun Errachid, Quartier de l'Hivernage, 40000 Marrakech, Morocco",
      operationalArea: 'Hivernage',
      operationalSubArea: "Quartier de l'Hivernage",
      geographySource: sofitelHivernageOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: "Official site's own FAQ states the hotel is minutes from the Medina, consistent with Hivernage's position as a modern district close to, but distinct from, the old city.",
    },
    propertyFacts: [
      { claim: 'Medina proximity', value: 'The official FAQ states the hotel is minutes away from the Medina of Marrakech and Jemaa el-Fna Square.', state: 'evidenced', sources: [sofitelHivernageOfficial] },
      { claim: 'Pools shown', value: 'Outdoor pools, including a heated option, are shown.', state: 'evidenced', sources: [sofitelHivernageOfficial] },
      { claim: 'Family positioning shown', value: 'The property markets a "Family Moments" section describing children as welcomed, and a family offer with an adjoining children\'s room.', state: 'evidenced', sources: [sofitelHivernageOfficial], limitation: 'This is family-oriented marketing positioning, not a documented kids-club age range or facility list.' },
      { claim: 'Spa shown', value: 'Sofitel Spa, with a heated pool and treatments, is shown.', state: 'evidenced', sources: [sofitelHivernageOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Hivernage setting', value: "Modern Hivernage district, described by the property itself as minutes from the Medina rather than within it.", state: 'evidenced', sources: [sofitelHivernageOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Specific children\'s facility ages/hours were not established beyond the general family-offer marketing language.'],
  },
  {
    evidenceId: 'marrakech-barcelo-palmeraie-2026-08-15',
    destinationSlug: 'marrakech',
    hotelName: 'Barceló Palmeraie Oasis Resort',
    provider: 'Trip.com',
    providerPropertyUrl: barceloPalmeraieTrip.url,
    officialPropertySource: barceloPalmeraieOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Palmeraie',
      exactSourcedAddress: 'Km 6 Route de Fès, BP 658, 40600 Marrakech, Morocco',
      operationalArea: 'Palmeraie',
      operationalSubArea: 'Route de Fès, Palm Grove',
      geographySource: barceloPalmeraieOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site states the resort stands in the Palm Grove of Marrakech, with explicit distance figures to both the airport and the Medina — a materially longer journey to the old city than the Medina or Hivernage properties above.',
    },
    propertyFacts: [
      { claim: 'Airport distance', value: 'Marrakech-Menara Airport is stated as 15 km away.', state: 'evidenced', sources: [barceloPalmeraieOfficial] },
      { claim: 'Medina distance', value: 'The Medina of Marrakech and Jemaa el-Fna Square are stated as approximately 6 miles (about 9.7 km) away.', state: 'evidenced', sources: [barceloPalmeraieOfficial] },
      { claim: "Children's facilities shown", value: 'A Kids Club with a games room and pirate ship, plus a family-oriented swimming pool separate from the adults-only pool, are shown.', state: 'evidenced', sources: [barceloPalmeraieOfficial, barceloPalmeraieTrip] },
      { claim: 'All-inclusive option', value: 'All-Inclusive and All-Inclusive Plus programmes are shown as available.', state: 'evidenced', sources: [barceloPalmeraieOfficial] },
    ],
    locationJourneyContext: {
      airportDistance: { claim: 'Marrakech-Menara Airport distance', value: '15 km.', state: 'evidenced', sources: [barceloPalmeraieOfficial], method: 'Official property page distance figure.' },
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Palm Grove setting', value: 'Located in the Palmeraie oasis district, several kilometres from the Medina rather than adjoining it.', state: 'evidenced', sources: [barceloPalmeraieOfficial] },
      ],
      limitations: ['Distances are official property-published figures, not guaranteed live transfer times.'],
    },
    limitations: ['No comparative or promotional claim is recorded beyond the property\'s own stated facilities.'],
  },
];

// ---------------------------------------------------------------------------
// DALAMAN REGION — properties recorded under destinationSlug 'dalaman' but
// spanning the real western-Turquoise-Coast towns the airport serves
// (Fethiye, Ölüdeniz, Marmaris/İçmeler) — never relabelled as "in Dalaman".
// ---------------------------------------------------------------------------

const harbourSuitesOfficial: HotelEvidenceSource = {
  name: 'Harbour Suites Fethiye official site',
  url: 'https://harboursuitestr.com/',
  checkedDate: checked,
};
const harbourSuitesTrip: HotelEvidenceSource = {
  name: 'Trip.com Harbour Suites Fethiye property listing',
  url: 'https://uk.trip.com/hotels/fethiye-hotel-detail-45589881/harbour-suites/',
  checkedDate: checked,
};

const libertyLykiaOfficial: HotelEvidenceSource = {
  name: 'Liberty Lykia official site (Liberty Hotels)',
  url: 'https://www.libertyhotels.com/en/hotels/liberty-lykia/',
  checkedDate: checked,
};
const libertyLykiaTrip: HotelEvidenceSource = {
  name: 'Trip.com Liberty Lykia property listing',
  url: 'https://us.trip.com/hotels/uzunyurt-mahallesi-hotel-detail-2553031/liberty-hotels-lykia/',
  checkedDate: checked,
};

const martiResortOfficial: HotelEvidenceSource = {
  name: 'Martı Resort Marmaris official site',
  url: 'https://www.marti.com.tr/marti-resort-marmaris/about',
  checkedDate: checked,
};
const martiResortTrip: HotelEvidenceSource = {
  name: 'Trip.com Martı Resort Deluxe Hotel property listing',
  url: 'https://www.trip.com/hotels/marmaris-hotel-detail-3448088/marti-resort-deluxe-hotel/',
  checkedDate: checked,
};

const dalamanRegionRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'dalaman-harbour-suites-fethiye-2026-08-15',
    destinationSlug: 'dalaman',
    hotelName: 'Harbour Suites Fethiye',
    provider: 'Trip.com',
    providerPropertyUrl: harbourSuitesTrip.url,
    officialPropertySource: harbourSuitesOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Fethiye',
      exactSourcedAddress: 'Karagözler Mahallesi, 30. Sokak No 16, Fethiye, Türkiye',
      operationalArea: 'Fethiye',
      operationalSubArea: 'Karagözler, adjoining Fethiye Harbour',
      geographySource: harbourSuitesOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site confirms the property is adjoining Fethiye Harbour, in the town itself — a distinctly different profile to the beach resorts in Ölüdeniz or Marmaris below.',
    },
    propertyFacts: [
      { claim: 'Harbour/town setting', value: 'Described as adjacent to Fethiye Harbour and a few steps from the town\'s restaurants, bars and bazaar.', state: 'evidenced', sources: [harbourSuitesOfficial] },
      { claim: 'Small boutique scale', value: '10 suite rooms in total (8 of 75m² and 2 of 47m²).', state: 'evidenced', sources: [harbourSuitesOfficial] },
      { claim: 'Pool shown', value: 'A swimming pool overlooking the harbour landscape is shown.', state: 'evidenced', sources: [harbourSuitesOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Fethiye town setting', value: 'In Fethiye town itself, not a resort area outside it — a town-based stay rather than a beach resort.', state: 'evidenced', sources: [harbourSuitesOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Board basis was not established in the approved source set — this is a boutique suites property, not an all-inclusive resort.'],
  },
  {
    evidenceId: 'dalaman-liberty-lykia-oludeniz-2026-08-15',
    destinationSlug: 'dalaman',
    hotelName: 'Liberty Lykia',
    provider: 'Trip.com',
    providerPropertyUrl: libertyLykiaTrip.url,
    officialPropertySource: libertyLykiaOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Ölüdeniz, Fethiye',
      exactSourcedAddress: 'Faralya Mahallesi, Kıdrak Sokak 6, 48330 Ölüdeniz, Türkiye',
      operationalArea: 'Ölüdeniz',
      operationalSubArea: 'Kıdrak, Ölüdeniz',
      geographySource: libertyLykiaOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site explicitly states the property is in Ölüdeniz, a large resort estate rather than a town-centre hotel — a genuinely different stay type from Harbour Suites Fethiye above.',
    },
    propertyFacts: [
      { claim: "Children's facilities shown", value: "A children's play area and a private beach area for children are shown, alongside family rooms.", state: 'evidenced', sources: [libertyLykiaOfficial] },
      { claim: 'Beach and pools shown', value: 'Pools with Mediterranean views and natural beach areas are shown.', state: 'evidenced', sources: [libertyLykiaOfficial] },
      { claim: 'Large resort estate', value: 'Described as set within 400 acres.', state: 'evidenced', sources: [libertyLykiaOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Ölüdeniz resort setting', value: 'A resort estate in Ölüdeniz, distinct from Fethiye town and from Marmaris further along the coast.', state: 'evidenced', sources: [libertyLykiaOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Specific children\'s-facility age ranges and board-basis detail were not established in the approved source set.'],
  },
  {
    evidenceId: 'dalaman-marti-resort-marmaris-2026-08-15',
    destinationSlug: 'dalaman',
    hotelName: 'Martı Resort',
    provider: 'Trip.com',
    providerPropertyUrl: martiResortTrip.url,
    officialPropertySource: martiResortOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Marmaris',
      exactSourcedAddress: 'İçmeler, Marmaris, Türkiye',
      operationalArea: 'Marmaris (İçmeler)',
      operationalSubArea: 'İçmeler, a beach suburb of Marmaris rather than the town centre',
      geographySource: martiResortOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site confirms the İçmeler address. İçmeler is preserved as a distinct beach suburb rather than being relabelled Marmaris town centre.',
    },
    propertyFacts: [
      { claim: "Children's facilities shown", value: 'A Mini Club is listed among the property\'s facility pages.', state: 'evidenced', sources: [martiResortOfficial] },
      { claim: 'Beach and pools shown', value: 'A dedicated "Beach & Pools" facility page is shown.', state: 'evidenced', sources: [martiResortOfficial] },
      { claim: 'Spa shown', value: 'A "Spa & Wellness" facility page is shown.', state: 'evidenced', sources: [martiResortOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'İçmeler / Marmaris relationship', value: 'In İçmeler, a beach suburb near, but distinct from, Marmaris town centre.', state: 'evidenced', sources: [martiResortOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page itself; a third-party listing states approximately 50.7 km from Dalaman Airport, but that figure is not independently confirmed on the official site and is not claimed here.'],
    },
    limitations: ['Specific facility detail (Mini Club age range, pool count) was not established beyond the page-title level in the approved source set.'],
  },
];

// ---------------------------------------------------------------------------
// BODRUM — 3 properties: Bodrum town/marina, Yalıkavak marina, Gümbet.
// ---------------------------------------------------------------------------

const doubleTreeMarinaVistaOfficial: HotelEvidenceSource = {
  name: 'DoubleTree by Hilton Bodrum Marina Vista official property page',
  url: 'https://www.hilton.com/en/hotels/bjvmvdi-doubletree-bodrum-marina-vista/',
  checkedDate: checked,
};
const doubleTreeMarinaVistaTrip: HotelEvidenceSource = {
  name: 'Trip.com DoubleTree by Hilton Bodrum Marina Vista property listing',
  url: 'https://www.trip.com/hotels/bodrum-hotel-detail-3030691/marina-vista-hotel/',
  checkedDate: checked,
};

const bodrumEditionOfficial: HotelEvidenceSource = {
  name: 'The Bodrum EDITION official site',
  url: 'https://www.editionhotels.com/bodrum/',
  checkedDate: checked,
};
const bodrumEditionTrip: HotelEvidenceSource = {
  name: 'Trip.com The Bodrum EDITION property listing',
  url: 'https://in.trip.com/hotels/yalikavak-hotel-detail-21867636/the-bodrum-edition/',
  checkedDate: checked,
};

const bodrumBeachResortOfficial: HotelEvidenceSource = {
  name: 'Zeniya Bodrum Beach Resort official site',
  url: 'https://bodrumbeachresort.com/en',
  checkedDate: checked,
};
const bodrumBeachResortTrip: HotelEvidenceSource = {
  name: 'Trip.com Bodrum Beach Resort property listing',
  url: 'https://www.trip.com/hotels/gumbet-hotel-detail-4057730/bodrum-beach-resort/',
  checkedDate: checked,
};

const bodrumRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'bodrum-doubletree-marina-vista-2026-08-15',
    destinationSlug: 'bodrum',
    hotelName: 'DoubleTree by Hilton Bodrum Marina Vista',
    provider: 'Trip.com',
    providerPropertyUrl: doubleTreeMarinaVistaTrip.url,
    officialPropertySource: doubleTreeMarinaVistaOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Bodrum Marina',
      exactSourcedAddress: 'Eskiçeşme, Neyzen Tevfik Caddesi No. 168, Bodrum, 48400, Türkiye',
      operationalArea: 'Bodrum town',
      operationalSubArea: 'Overlooking Bodrum Marina, in the town centre',
      geographySource: doubleTreeMarinaVistaOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site describes the hotel as in the heart of historic Bodrum, overlooking the marina and under a mile from Bodrum Castle.',
    },
    propertyFacts: [
      { claim: 'Marina/Castle proximity', value: 'Overlooks Bodrum Marina, described as less than a mile from Bodrum Castle and within walking distance of restaurants and shops.', state: 'evidenced', sources: [doubleTreeMarinaVistaOfficial] },
      { claim: 'Airport distance/time', value: 'Approximately 26 miles (about 25 minutes) from Milas Bodrum Airport.', state: 'evidenced', sources: [doubleTreeMarinaVistaOfficial] },
      { claim: 'Pool and spa shown', value: 'An outdoor pool, sauna and spa treatments are shown.', state: 'evidenced', sources: [doubleTreeMarinaVistaOfficial] },
    ],
    locationJourneyContext: {
      airportDistance: { claim: 'Milas Bodrum Airport distance', value: 'Approximately 26 miles (about 42 km).', state: 'evidenced', sources: [doubleTreeMarinaVistaOfficial], method: 'Official property page distance figure.' },
      airportTimeEvidence: [
        { claim: 'Milas Bodrum Airport transfer estimate', value: 'Approximately 25 minutes.', state: 'evidenced', sources: [doubleTreeMarinaVistaOfficial], method: 'Official property page estimate.', limitation: 'Not a guaranteed live transfer time.' },
      ],
      townCityHistoricRelationships: [
        { claim: 'Bodrum town/marina setting', value: 'In the town centre overlooking the marina, a genuinely different profile to the Yalıkavak and Gümbet properties below.', state: 'evidenced', sources: [doubleTreeMarinaVistaOfficial] },
      ],
      limitations: [],
    },
    limitations: ['Room count was not established in the approved source set.'],
  },
  {
    evidenceId: 'bodrum-the-bodrum-edition-yalikavak-2026-08-15',
    destinationSlug: 'bodrum',
    hotelName: 'The Bodrum EDITION',
    provider: 'Trip.com',
    providerPropertyUrl: bodrumEditionTrip.url,
    officialPropertySource: bodrumEditionOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Yalıkavak',
      exactSourcedAddress: 'Dirmil Mahallesi, Balyek Caddesi No. 5A, 48400 Yalıkavak, Bodrum/Muğla, Türkiye',
      operationalArea: 'Yalıkavak',
      operationalSubArea: 'Western Bodrum peninsula, near Yalıkavak Marina',
      geographySource: bodrumEditionOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site states the hotel is 3km from Yalıkavak Marina at the western point of the Bodrum peninsula.',
    },
    propertyFacts: [
      { claim: 'Yalıkavak Marina proximity', value: 'Described as 3km from Yalıkavak Marina, at the western point of the Bodrum peninsula.', state: 'evidenced', sources: [bodrumEditionOfficial] },
      { claim: 'Beach club and infinity pool', value: 'An infinity pool and exclusive beach club are shown.', state: 'evidenced', sources: [bodrumEditionOfficial] },
      { claim: 'Spa/hammam shown', value: 'A spa including a Turkish hammam is shown.', state: 'evidenced', sources: [bodrumEditionOfficial] },
      { claim: 'Room count', value: '110 guest rooms, suites and villas.', state: 'evidenced', sources: [bodrumEditionOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Yalıkavak marina setting', value: 'Positioned at the western, marina-led end of the Bodrum peninsula, a different profile to the town-centre DoubleTree property above.', state: 'evidenced', sources: [bodrumEditionOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page itself; a third-party listing states approximately 53 minutes from Milas–Bodrum Airport, but that figure is not independently confirmed on the official site and is not claimed here.'],
    },
    limitations: ['Board basis was not established in the approved source set.'],
  },
  {
    evidenceId: 'bodrum-bodrum-beach-resort-gumbet-2026-08-15',
    destinationSlug: 'bodrum',
    hotelName: 'Bodrum Beach Resort',
    provider: 'Trip.com',
    providerPropertyUrl: bodrumBeachResortTrip.url,
    officialPropertySource: bodrumBeachResortOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Gümbet',
      exactSourcedAddress: 'Gümbet, Büyük İskender Caddesi 37/1, 48400 Bodrum/Muğla, Türkiye',
      operationalArea: 'Gümbet',
      operationalSubArea: 'Gümbet beach strip',
      geographySource: bodrumBeachResortOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: "Re-verified (Hotel Intelligence final expansion batch, August 2026). The official site's contact block gives a Gümbet street address, and its own body copy separately states the hotel is \"Located in Yalıçiftlik\" — but that same sentence also calls the property \"Bodrum Park Resort\", a different hotel name, and the page's contact email domain is bodrumparkresort.com. This is conclusive evidence of a copy-paste template error carried over from a different property in the same Zeniya Resorts portfolio, not a genuine alternate location claim. Gümbet is independently corroborated by Trip.com's own city-tagged listing URL (gumbet-hotel-detail-4057730), by TripAdvisor and by third-party booking sites (Sunshine, Oyster-style aggregators), all converging on the same Osman Nuri Bilgin Caddesi / Gümbet address, ~1km from Bodrum centre. Treated as resolved, not merely disclosed-with-caveat.",
    },
    propertyFacts: [
      { claim: 'Private beach', value: 'A private sandy beach holding Blue Flag status is shown.', state: 'evidenced', sources: [bodrumBeachResortOfficial] },
      { claim: 'Aquapark shown', value: 'A free-to-use aquapark is shown.', state: 'evidenced', sources: [bodrumBeachResortOfficial] },
      { claim: 'All-inclusive concept', value: 'An "Ultra All Inclusive" service is shown.', state: 'evidenced', sources: [bodrumBeachResortOfficial] },
      { claim: 'Spa/hammam shown', value: 'A spa with massage and a traditional Turkish bath is shown.', state: 'evidenced', sources: [bodrumBeachResortOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Gümbet setting', value: 'On the Gümbet beach strip, approximately 1km from Bodrum town centre, corroborated by Trip.com\'s own city-tagged listing URL and independent third-party sources.', state: 'evidenced', sources: [bodrumBeachResortOfficial, bodrumBeachResortTrip] },
      ],
      limitations: ['The official site\'s body copy still contains an unfixed template error ("Located in Yalıçiftlik" / "Bodrum Park Resort") that JetStash does not repeat; the resolved Gümbet classification relies on the structured contact address plus independent corroboration, not on the prose being corrected.'],
    },
    limitations: ['Re-investigated for the final expansion batch and upgraded from usable-with-caveat to strong once the Yalıçiftlik reference was traced to a copy-paste template error (proven by the co-occurring wrong hotel name in the same sentence) rather than a genuine competing location claim.'],
  },
];

// ---------------------------------------------------------------------------
// AGADIR — 2 properties: Agadir beachfront and Taghazout Bay.
// ---------------------------------------------------------------------------

const sofitelAgadirOfficial: HotelEvidenceSource = {
  name: 'Sofitel Agadir Royal Bay Resort official site',
  url: 'https://sofitel.accor.com/en/hotels/B826.html',
  checkedDate: checked,
};
const sofitelAgadirTrip: HotelEvidenceSource = {
  name: 'Trip.com Sofitel Agadir Royal Bay Resort property listing',
  url: 'https://www.trip.com/hotels/agadir-hotel-detail-2172348/sofitel-agadir-royal-bay/',
  checkedDate: checked,
};

const hiltonTaghazoutOfficial: HotelEvidenceSource = {
  name: 'Hilton Taghazout Bay Beach Resort & Spa official property page',
  url: 'https://www.hilton.com/en/hotels/agatmhi-hilton-taghazout-bay-beach-resort-and-spa/',
  checkedDate: checked,
};
const hiltonTaghazoutTrip: HotelEvidenceSource = {
  name: 'Trip.com Hilton Taghazout Bay Beach Resort & Spa property listing',
  url: 'https://us.trip.com/hotels/agadir-ida-ou-tanane-province-hotel-detail-97947946/hilton-taghazout-bay-beach-resort-spa/',
  checkedDate: checked,
};

const agadirRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'agadir-sofitel-royal-bay-2026-08-15',
    destinationSlug: 'agadir',
    hotelName: 'Sofitel Agadir Royal Bay Resort',
    provider: 'Trip.com',
    providerPropertyUrl: sofitelAgadirTrip.url,
    officialPropertySource: sofitelAgadirOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Agadir beachfront',
      exactSourcedAddress: 'BP 226 Cité Founty, P4 Baie Des Palmiers, Bensergao Commune, 80007 Agadir, Morocco',
      operationalArea: 'Agadir beachfront',
      operationalSubArea: 'Baie des Palmiers, Cité Founty',
      geographySource: sofitelAgadirOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site\'s beachfront restaurant is described with direct Atlantic views, consistent with a beachfront address.',
    },
    propertyFacts: [
      { claim: 'Beachfront setting', value: 'The hotel\'s beachfront bar and restaurant look directly onto the Atlantic.', state: 'evidenced', sources: [sofitelAgadirOfficial] },
      { claim: 'Pool-view rooms', value: 'Multiple room categories with pool and ocean views, including villas with private heated pools, are shown.', state: 'evidenced', sources: [sofitelAgadirOfficial] },
      { claim: "Children's facilities", value: 'Childcare service, a kids\' playground and a kids\' club are listed by the Trip.com property listing; a childcare-related FAQ also appears on the official site.', state: 'evidenced', sources: [sofitelAgadirTrip, sofitelAgadirOfficial], limitation: 'The specific facility list is corroborated by the Trip.com listing rather than being fully spelled out in the fetched official-page text.' },
      { claim: 'Spa shown', value: 'Sofitel SPA and Fitness, with Moroccan and Asian-inspired treatments, is shown.', state: 'evidenced', sources: [sofitelAgadirOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Agadir city relationship', value: 'On the Agadir beachfront, described by a corroborating source as approximately 3.8 km from the city centre.', state: 'evidenced', sources: [sofitelAgadirOfficial, sofitelAgadirTrip] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Room count was not established in the approved source set.'],
  },
  {
    evidenceId: 'agadir-hilton-taghazout-bay-2026-08-15',
    destinationSlug: 'agadir',
    hotelName: 'Hilton Taghazout Bay Beach Resort & Spa',
    provider: 'Trip.com',
    providerPropertyUrl: hiltonTaghazoutTrip.url,
    officialPropertySource: hiltonTaghazoutOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Taghazout Bay',
      exactSourcedAddress: "Station Touristique, Taghazout Bay, Km 17 Route d'Essaouira, Taghazout, 80023, Morocco",
      operationalArea: 'Taghazout Bay',
      operationalSubArea: "Km 17, Route d'Essaouira, north of Agadir",
      geographySource: hiltonTaghazoutOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site states the resort is 4km from Taghazout village and approximately 40km from Agadir–Al Massira International Airport, confirming it is a separate development north of Agadir city rather than within it.',
    },
    propertyFacts: [
      { claim: 'Beach access', value: 'Direct beach access is shown.', state: 'evidenced', sources: [hiltonTaghazoutOfficial] },
      { claim: "Children's facilities shown", value: 'Cribs, a playground, childcare and a bespoke "Family Experience" with a kids menu are shown.', state: 'evidenced', sources: [hiltonTaghazoutOfficial] },
      { claim: 'Pools shown', value: 'Four swimming pools, including indoor and outdoor options, are shown.', state: 'evidenced', sources: [hiltonTaghazoutOfficial] },
      { claim: 'Golf proximity', value: 'Golf Tazegzout is stated as 2km from the hotel.', state: 'evidenced', sources: [hiltonTaghazoutOfficial] },
    ],
    locationJourneyContext: {
      airportDistance: { claim: 'Agadir–Al Massira International Airport distance', value: 'Approximately 40km.', state: 'evidenced', sources: [hiltonTaghazoutOfficial], method: 'Official property page distance figure.' },
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Taghazout village relationship', value: '4km from Taghazout village.', state: 'evidenced', sources: [hiltonTaghazoutOfficial] },
      ],
      limitations: ['Distances are official property-published figures, not guaranteed live transfer times.'],
    },
    limitations: ['Room count was not established in the approved source set.'],
  },
];

// ---------------------------------------------------------------------------
// BARCELONA — 3 properties: Eixample, Gothic Quarter, Barceloneta.
// ---------------------------------------------------------------------------

const ohlaEixampleOfficial: HotelEvidenceSource = {
  name: 'Ohla Eixample official site',
  url: 'https://www.ohlaboutiquehotels.com/en/ohla-eixample/',
  checkedDate: checked,
};
const ohlaEixampleTrip: HotelEvidenceSource = {
  name: 'Trip.com Ohla Eixample property listing',
  url: 'https://us.trip.com/hotels/barcelona-hotel-detail-5704839/ohla-eixample/',
  checkedDate: checked,
};

const hotelGoticoOfficial: HotelEvidenceSource = {
  name: 'Hotel Gótico official site (Gargallo Hotels)',
  url: 'https://www.gargallo-hotels.com/en/barcelona/hotel-gotico',
  checkedDate: checked,
};
const hotelGoticoTrip: HotelEvidenceSource = {
  name: 'Trip.com Hotel Gótico property listing',
  url: 'https://www.trip.com/hotels/barcelona-hotel-detail-2157689/hotel-gtico/',
  checkedDate: checked,
};

const sofitelSkipperOfficial: HotelEvidenceSource = {
  name: 'Sofitel Barcelona Skipper official site (Accor)',
  url: 'https://sofitel.accor.com/en/hotels/7341.html',
  checkedDate: checked,
};
const sofitelSkipperTrip: HotelEvidenceSource = {
  name: 'Trip.com Sofitel Barcelona Skipper property listing (listed there as "Pullman Barcelona Skipper")',
  url: 'https://us.trip.com/hotels/barcelona-hotel-detail-2187785/pullman-barcelona-skipper/',
  checkedDate: checked,
};

const barcelonaRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'barcelona-ohla-eixample-2026-08-15',
    destinationSlug: 'barcelona',
    hotelName: 'Ohla Eixample',
    provider: 'Trip.com',
    providerPropertyUrl: ohlaEixampleTrip.url,
    officialPropertySource: ohlaEixampleOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Eixample',
      exactSourcedAddress: 'Carrer de Còrsega 289, 08008 Barcelona, Spain',
      operationalArea: 'Eixample',
      operationalSubArea: "Dreta de l'Eixample, near Casa Batlló and Casa Milà",
      geographySource: ohlaEixampleOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Address is on Carrer de Còrsega in the Eixample district; corroborating Trip.com listing confirms walking distance to Casa Milà and Casa Batlló, both Eixample landmarks.',
    },
    propertyFacts: [
      { claim: 'Design/architecture positioning', value: 'The building was reworked by architect Daniel Isern with a custom ceramic façade, described on the official site in architectural detail.', state: 'evidenced', sources: [ohlaEixampleOfficial] },
      { claim: 'Pool and spa shown', value: 'An outdoor pool and a full-service spa are shown on the corroborating Trip.com listing.', state: 'evidenced', sources: [ohlaEixampleTrip] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Eixample setting', value: 'Central Eixample location, not on the beach — a sightseeing-led rather than beach-led stay.', state: 'evidenced', sources: [ohlaEixampleOfficial, ohlaEixampleTrip] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Room count and pool/spa detail rely partly on the corroborating Trip.com listing rather than the official page alone, whose fetched content focused on architecture rather than a full facilities list.'],
  },
  {
    evidenceId: 'barcelona-hotel-gotico-2026-08-15',
    destinationSlug: 'barcelona',
    hotelName: 'Hotel Gótico',
    provider: 'Trip.com',
    providerPropertyUrl: hotelGoticoTrip.url,
    officialPropertySource: hotelGoticoOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Gothic Quarter',
      exactSourcedAddress: 'Carrer de Jaume I, 14, 08002 Barcelona, Spain',
      operationalArea: 'Gothic Quarter (Barri Gòtic)',
      operationalSubArea: 'Steps from Barcelona Cathedral and Plaça Sant Jaume',
      geographySource: hotelGoticoOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site states the hotel is in the heart of the Gothic Quarter, steps from the Cathedral and Plaça Sant Jaume.',
    },
    propertyFacts: [
      { claim: 'Cathedral/Plaça Sant Jaume proximity', value: 'Described as steps away from Barcelona Cathedral and Plaça Sant Jaume.', state: 'evidenced', sources: [hotelGoticoOfficial] },
      { claim: 'Rooftop solarium', value: 'A rooftop solarium among the medieval rooftops is shown.', state: 'evidenced', sources: [hotelGoticoOfficial] },
      { claim: 'Room count', value: '81 guestrooms.', state: 'evidenced', sources: [hotelGoticoTrip] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Gothic Quarter setting', value: 'Within the historic walled old-town core, distinct from the Eixample grid-planned district above.', state: 'evidenced', sources: [hotelGoticoOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Pool/spa facilities were not established — this is a boutique property without a stated on-site pool.'],
  },
  {
    evidenceId: 'barcelona-sofitel-skipper-barceloneta-2026-08-15',
    destinationSlug: 'barcelona',
    hotelName: 'Sofitel Barcelona Skipper',
    provider: 'Trip.com',
    providerPropertyUrl: sofitelSkipperTrip.url,
    officialPropertySource: sofitelSkipperOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Barceloneta',
      exactSourcedAddress: 'Av del Litoral 10, 08005 Barcelona, Spain',
      operationalArea: 'Barceloneta',
      operationalSubArea: 'Next to Barceloneta and Somorrostro beaches',
      geographySource: sofitelSkipperOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: "The official site's own FAQ states the hotel is in the traditional Barceloneta neighbourhood, next to Barceloneta and Somorrostro beaches.",
    },
    propertyFacts: [
      { claim: 'Beach proximity', value: 'The official FAQ states the hotel sits next to Barceloneta and Somorrostro beaches.', state: 'evidenced', sources: [sofitelSkipperOfficial] },
      { claim: 'Rooftop pool bar', value: 'ElCielo rooftop pool bar, with summer events, is shown.', state: 'evidenced', sources: [sofitelSkipperOfficial] },
      { claim: 'Room count', value: '225 guestrooms.', state: 'evidenced', sources: [sofitelSkipperTrip] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Barceloneta beach setting', value: 'Beachfront in Barceloneta, a genuinely different profile to the inland Eixample and Gothic Quarter properties above.', state: 'evidenced', sources: [sofitelSkipperOfficial] },
      ],
      limitations: ['No airport-distance figure was found stated on the official page; not claimed here.'],
    },
    limitations: ['Re-verified for the final expansion batch (August 2026). Trip.com\'s display name still reads "Pullman Barcelona Skipper" rather than "Sofitel Barcelona Skipper" — confirmed to be a genuine, dated rebrand (Business Traveller and Sleeper Magazine trade coverage both confirm Accor reflagged the same physical property from Pullman to Sofitel in 2022, and the official Accor listing at the same hotelId/address independently confirms the identical facility set: 225 rooms, the ElCielo rooftop bar, Syrah and TenDiez restaurants, same Av del Litoral address). Trip.com\'s own listing has simply not updated its display name since the 2022 rebrand; the hotelId and physical property are unambiguous, so this is not treated as an identity conflict.'],
  },
];

// ---------------------------------------------------------------------------
// FARO / ALGARVE — recorded under destinationSlug 'faro' but spanning Faro
// city, Albufeira (Santa Eulália/Olhos de Água) and Vilamoura — never
// relabelled as all "in Faro".
// ---------------------------------------------------------------------------

const occidentalFaroOfficial: HotelEvidenceSource = {
  name: 'Occidental Faro official site (Barceló group)',
  url: 'https://www.barcelo.com/en-gb/occidental-faro/',
  checkedDate: checked,
};
const occidentalFaroTrip: HotelEvidenceSource = {
  name: 'Trip.com Occidental Faro property listing',
  url: 'https://www.trip.com/hotels/faro-hotel-detail-743187/occidental-faro/',
  checkedDate: checked,
};

const grandeRealSantaEulaliaOfficial: HotelEvidenceSource = {
  name: 'Grande Real Santa Eulália Resort & Hotel Spa official site',
  url: 'https://www.granderealsantaeulalia.realhotelsgroup.com/',
  checkedDate: checked,
};
const grandeRealSantaEulaliaTrip: HotelEvidenceSource = {
  name: 'Trip.com Grande Real Santa Eulália Resort property listing',
  url: 'https://in.trip.com/hotels/olhos-de-agua-hotel-detail-2564799/grande-real-santa-eulalia-resort/',
  checkedDate: checked,
};

const tivoliMarinaVilamouraOfficial: HotelEvidenceSource = {
  name: 'Tivoli Marina Vilamoura Algarve Resort official site',
  url: 'https://www.tivolihotels.com/en/tivoli-marina-vilamoura',
  checkedDate: checked,
};
const tivoliMarinaVilamouraTrip: HotelEvidenceSource = {
  name: 'Trip.com Tivoli Marina Vilamoura property listing',
  url: 'https://www.trip.com/hotels/quarteira-hotel-detail-743803/tivoli-marina-vilamoura/',
  checkedDate: checked,
};

const faroRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'faro-occidental-faro-2026-08-15',
    destinationSlug: 'faro',
    hotelName: 'Occidental Faro',
    provider: 'Trip.com',
    providerPropertyUrl: occidentalFaroTrip.url,
    officialPropertySource: occidentalFaroOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Faro city centre',
      exactSourcedAddress: 'Praça D. Francisco Gomes, N.º 2, 8000-168 Faro, Portugal',
      operationalArea: 'Faro city',
      operationalSubArea: 'Historic centre, near Sé Cathedral',
      geographySource: occidentalFaroOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: "Official site states the hotel is in the heart of Faro city, a few metres from the Sé Cathedral and Arco da Vila, with a stated distance of 500m to the cathedral.",
    },
    propertyFacts: [
      { claim: 'Airport distance', value: 'Faro International Airport (FAO) is stated as 6km away.', state: 'evidenced', sources: [occidentalFaroOfficial] },
      { claim: 'Cathedral distance', value: 'Sé Faro Cathedral is stated as 500m away.', state: 'evidenced', sources: [occidentalFaroOfficial] },
      { claim: 'Beach access', value: 'Beach is stated as 7km away, with a free shuttle to the Sal\'Mare Beach Club on Faro beach.', state: 'evidenced', sources: [occidentalFaroOfficial] },
      { claim: 'Rooftop pool', value: 'A rooftop swimming pool with sunbathing area is shown.', state: 'evidenced', sources: [occidentalFaroOfficial] },
    ],
    locationJourneyContext: {
      airportDistance: { claim: 'Faro International Airport distance', value: '6 km.', state: 'evidenced', sources: [occidentalFaroOfficial], method: 'Official property page distance figure.' },
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Faro old town setting', value: 'In the historic centre of Faro city itself — not a beach resort area, and a genuinely different profile to Albufeira and Vilamoura below.', state: 'evidenced', sources: [occidentalFaroOfficial] },
      ],
      limitations: ['Distances are official property-published figures, not guaranteed live transfer times.'],
    },
    limitations: ['Room count and board-basis detail were not established beyond the general facilities described.'],
  },
  {
    evidenceId: 'faro-grande-real-santa-eulalia-albufeira-2026-08-15',
    destinationSlug: 'faro',
    hotelName: 'Grande Real Santa Eulália Resort & Hotel Spa',
    provider: 'Trip.com',
    providerPropertyUrl: grandeRealSantaEulaliaTrip.url,
    officialPropertySource: grandeRealSantaEulaliaOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Albufeira',
      exactSourcedAddress: 'Santa Eulália, Albufeira, Portugal',
      operationalArea: 'Albufeira',
      operationalSubArea: 'Santa Eulália / Olhos de Água, a beach area within the wider Albufeira municipality rather than Albufeira\'s old town',
      geographySource: grandeRealSantaEulaliaTrip,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'usable-with-caveat',
      classificationNotes: "The property's own brand name identifies it with Santa Eulália; the corroborating Trip.com listing places it in Olhos de Água specifically, a beach area a short drive from Albufeira's old town rather than within it. Santa Eulália/Olhos de Água is preserved as the sub-area rather than being relabelled generic \"Albufeira\".",
    },
    propertyFacts: [
      { claim: 'Beach access', value: 'Direct access to Santa Eulália beach is shown.', state: 'evidenced', sources: [grandeRealSantaEulaliaOfficial] },
      { claim: 'Pools shown', value: 'Multiple outdoor pools are shown.', state: 'evidenced', sources: [grandeRealSantaEulaliaTrip] },
      { claim: 'Spa shown', value: 'A spa with massages and body treatments is shown.', state: 'evidenced', sources: [grandeRealSantaEulaliaTrip] },
      { claim: 'Room count', value: '344 guestrooms.', state: 'evidenced', sources: [grandeRealSantaEulaliaTrip] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Santa Eulália / Albufeira relationship', value: 'On Santa Eulália beach, a short drive from Albufeira\'s central strip rather than within Albufeira old town itself.', state: 'evidenced', sources: [grandeRealSantaEulaliaTrip] },
      ],
      limitations: ['No airport-distance figure was independently confirmed on the official site during this research pass; not claimed here.'],
    },
    limitations: ['Facility detail relies partly on the corroborating Trip.com listing, since the official site\'s fetched content was limited during this research pass.'],
  },
  {
    evidenceId: 'faro-tivoli-marina-vilamoura-2026-08-15',
    destinationSlug: 'faro',
    hotelName: 'Tivoli Marina Vilamoura Algarve Resort',
    provider: 'Trip.com',
    providerPropertyUrl: tivoliMarinaVilamouraTrip.url,
    officialPropertySource: tivoliMarinaVilamouraOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Vilamoura Marina',
      exactSourcedAddress: 'Marina de Vilamoura, Apartado 65, 8125-901 Vilamoura, Portugal',
      operationalArea: 'Vilamoura',
      operationalSubArea: 'Vilamoura Marina',
      geographySource: tivoliMarinaVilamouraOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official site describes the resort as nestled between the beach and Vilamoura Marina, consistent with the Marina de Vilamoura address. Trip.com\'s own listing files this property under the neighbouring Quarteira city tag rather than "Vilamoura" — reflecting the same municipal-boundary overlap, not a genuine location conflict.',
    },
    propertyFacts: [
      { claim: 'Marina and beach setting', value: 'Described as nestled between the beach and Vilamoura Marina.', state: 'evidenced', sources: [tivoliMarinaVilamouraOfficial] },
      { claim: 'Pools shown', value: 'Indoor and outdoor swimming pools are shown.', state: 'evidenced', sources: [tivoliMarinaVilamouraOfficial] },
      { claim: 'Family-friendly facilities', value: 'Dedicated family-friendly services and spaces are shown.', state: 'evidenced', sources: [tivoliMarinaVilamouraOfficial] },
      { claim: 'Spa/gym shown', value: 'Tivoli Spa and Tivoli Shape gym are shown.', state: 'evidenced', sources: [tivoliMarinaVilamouraOfficial] },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Vilamoura Marina setting', value: 'At the marina itself, a genuinely different profile to Faro\'s historic centre and Albufeira\'s beach strip above.', state: 'evidenced', sources: [tivoliMarinaVilamouraOfficial] },
      ],
      limitations: ['A corroborating third-party source states approximately 25km from Faro Airport, but this was not independently confirmed on the official site during this research pass and is not claimed here.'],
    },
    limitations: ['Room count (383 rooms, per a corroborating source) was not independently confirmed on the official page during this research pass.'],
  },
];

// ---------------------------------------------------------------------------
// MADINAH — purpose-built religious-travel model. The decision this section
// answers is proximity/direction relative to Masjid an-Nabawi and practical
// access, never a resort/quality judgement. Every distance/direction claim
// below is the hotel's own official wording, quoted rather than converted
// into an invented minutes/metres figure of JetStash's own. Where an official
// page gave an exact metre/km/time figure, it is recorded and attributed as
// a hotel-published claim, not an independently measured fact.
// ---------------------------------------------------------------------------

const anwarMovenpickOfficial: HotelEvidenceSource = {
  name: 'Anwar Al Madinah Mövenpick official site (Accor)',
  url: 'https://all.accor.com/hotel/B4M6/index.en.shtml',
  checkedDate: checked,
};
const anwarMovenpickFaq: HotelEvidenceSource = {
  name: 'Anwar Al Madinah Mövenpick official FAQ page (Accor/Mövenpick)',
  url: 'https://movenpick.accor.com/en/middle-east/saudi-arabia/madinah/hotel-madinah-anwar/faq-page.html',
  checkedDate: checked,
};
const anwarMovenpickTrip: HotelEvidenceSource = {
  name: 'Trip.com Anwar Al Madinah Mövenpick property listing',
  url: 'https://us.trip.com/hotels/medina-hotel-detail-3738129/anwar-al-madinah-mvenpick-hotel/',
  checkedDate: checked,
};

const pullmanZamzamOfficial: HotelEvidenceSource = {
  name: 'Pullman Zamzam Madinah official site (Accor)',
  url: 'https://all.accor.com/hotel/9245/index.en.shtml',
  checkedDate: checked,
};
const pullmanZamzamTrip: HotelEvidenceSource = {
  name: 'Trip.com Pullman Zamzam Madinah property listing',
  url: 'https://www.trip.com/hotels/medina-hotel-detail-4055814/pullman-zamzam-madinah/',
  checkedDate: checked,
};

const madinahRecords: readonly ExpansionHotelEvidenceRecord[] = [
  {
    evidenceId: 'madinah-anwar-al-madinah-movenpick-2026-08-15',
    destinationSlug: 'madinah',
    hotelName: 'Anwar Al Madinah Mövenpick',
    provider: 'Trip.com',
    providerPropertyUrl: anwarMovenpickTrip.url,
    officialPropertySource: anwarMovenpickOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Central Zone, adjacent to the Prophet\'s Mosque',
      exactSourcedAddress: 'Central Zone, Al Khalidiya, PO Box 41340, 42311 Madinah Al Munawwarah, Saudi Arabia',
      operationalArea: 'Central Zone, Madinah',
      operationalSubArea: "Northern side of Al-Masjid an-Nabawi",
      geographySource: anwarMovenpickOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: "The official Accor listing states the hotel is centrally located and adjacent to the Prophet's Mosque on its northern side.",
    },
    propertyFacts: [
      {
        claim: 'Walking distance to Al-Masjid an-Nabawi',
        value: "The hotel's own official listing states \"Just one minute's walk from Al-Masjid an-Nabawi.\"",
        state: 'evidenced',
        sources: [anwarMovenpickOfficial],
        method: "Hotel-published claim on the property's official Accor booking page, quoted verbatim.",
        limitation: 'This is the property\'s own marketing claim, not an independently measured walking time. JetStash records the exact wording rather than converting it into a different figure.',
      },
      {
        claim: "Ladies' Prayer Entrance proximity",
        value: "The official listing describes the hotel as \"The nearest hotel to the Ladies' Prayer Entrance.\"",
        state: 'evidenced',
        sources: [anwarMovenpickOfficial],
        method: 'Hotel-published claim, quoted verbatim.',
      },
      {
        claim: 'Airport distance',
        value: "16 km from Prince Mohammed Bin Abdulaziz International Airport, per the hotel's own FAQ.",
        state: 'evidenced',
        sources: [anwarMovenpickFaq],
        method: 'Official FAQ distance figure.',
      },
      {
        claim: 'Direct mall access',
        value: 'Direct access to an adjoining shopping mall (Anwar Al Madinah Mall) is stated.',
        state: 'evidenced',
        sources: [anwarMovenpickOfficial],
      },
    ],
    locationJourneyContext: {
      airportDistance: { claim: 'Prince Mohammed Bin Abdulaziz International Airport distance', value: '16 km.', state: 'evidenced', sources: [anwarMovenpickFaq], method: 'Official FAQ distance figure.' },
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        { claim: 'Historic sites nearby', value: 'Saqifat Bani Sa\'eda and Masjid Qubaa are listed among nearby historic sites on the official booking page.', state: 'evidenced', sources: [anwarMovenpickOfficial] },
      ],
      limitations: ['No independent, third-party-verified walking-time measurement was used — only the hotel\'s own stated claims, which are disclosed as such rather than presented as a neutral fact.'],
    },
    limitations: ['This property\'s "one minute" and "nearest to the Ladies\' Entrance" claims are the hotel\'s own marketing language; JetStash does not independently verify walking times and does not present this as a ranking against other properties.'],
  },
  {
    evidenceId: 'madinah-pullman-zamzam-madinah-2026-08-15',
    destinationSlug: 'madinah',
    hotelName: 'Pullman Zamzam Madinah',
    provider: 'Trip.com',
    providerPropertyUrl: pullmanZamzamTrip.url,
    officialPropertySource: pullmanZamzamOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'North Zone, adjacent to Al-Masjid an-Nabawi',
      exactSourcedAddress: '2944 Amr bin Al Jmoh Street, North Zone, Central Madina, PO Box 40233, 42311 Al Madinah Al Munawarah, Saudi Arabia',
      operationalArea: 'North Zone, Madinah',
      operationalSubArea: 'Near Al Salam Gate (Bab Al Salam)',
      geographySource: pullmanZamzamOfficial,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'The official Accor listing describes the hotel as adjacent to Al-Masjid an-Nabawi and just moments from the Al Salam Gate — a different named gate/orientation to the Mövenpick property above.',
    },
    propertyFacts: [
      {
        claim: 'Proximity to Al-Masjid an-Nabawi',
        value: 'The official listing describes the hotel as "adjacent to Al-Masjid an-Nabawi and just moments away from the Al Salam Gate."',
        state: 'evidenced',
        sources: [pullmanZamzamOfficial],
        method: 'Hotel-published claim, quoted verbatim.',
        limitation: 'No specific metre or minute figure was stated on this official page itself; JetStash does not add one.',
      },
      {
        claim: "Shuttle to Ladies' Gate",
        value: "A shuttle bus service towards the Ladies' Gate of the Prophet's Mosque is listed as a hotel extra.",
        state: 'evidenced',
        sources: [pullmanZamzamOfficial],
      },
      {
        claim: 'Family-oriented positioning',
        value: 'The listing is explicitly tagged "Family friendly" and describes Family Rooms & Suites.',
        state: 'evidenced',
        sources: [pullmanZamzamOfficial],
      },
      {
        claim: 'Airport distance and time',
        value: '10 km / 23-minute drive from Madinah Airport.',
        state: 'evidenced',
        sources: [pullmanZamzamOfficial],
        method: 'Official distance-and-drive-time figure shown on the property\'s Access & Transport listing.',
      },
    ],
    locationJourneyContext: {
      airportDistance: { claim: 'Madinah Airport distance', value: '10 km.', state: 'evidenced', sources: [pullmanZamzamOfficial], method: 'Official property page distance figure.' },
      airportTimeEvidence: [
        { claim: 'Madinah Airport drive time', value: '23-minute drive.', state: 'evidenced', sources: [pullmanZamzamOfficial], method: 'Official property page drive-time figure.', limitation: 'Not a guaranteed live transfer time.' },
      ],
      townCityHistoricRelationships: [
        { claim: 'Mosque-facing views', value: 'Views of the Prophet\'s Mosque, the Green Dome, Uhud Mountain and Al-Baqi Cemetery are listed among the hotel\'s stated features.', state: 'evidenced', sources: [pullmanZamzamOfficial] },
      ],
      limitations: ['No independently measured walking-time figure is available for this property; only the hotel\'s own "adjacent / moments away" wording is recorded.'],
    },
    limitations: ["JetStash makes no claim about which of the two Madinah properties in this batch is closer to the mosque — both officially describe themselves as adjacent, using different named gates (Ladies' Prayer Entrance for Mövenpick, Al Salam Gate for Pullman Zamzam), and no common, independently measured distance unit was available to compare them on. They are presented as two accessible options near different gates, not a ranked pair."],
  },
];

export const expansionHotelEvidence: readonly ExpansionHotelEvidenceRecord[] = [...dubaiRecords, ...istanbulRecords, ...marrakechRecords, ...dalamanRegionRecords, ...bodrumRecords, ...agadirRecords, ...barcelonaRecords, ...faroRecords, ...madinahRecords];

export function getExpansionHotelEvidenceForDestination(destinationSlug: string): readonly ExpansionHotelEvidenceRecord[] {
  return expansionHotelEvidence.filter((record) => record.destinationSlug === destinationSlug);
}

export type ExpansionHotelEvidenceRecordType = ExpansionHotelEvidenceRecord;
