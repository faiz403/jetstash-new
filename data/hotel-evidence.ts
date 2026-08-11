/**
 * Internal-only Antalya property intelligence.
 *
 * This module is deliberately not imported by public pages. Hotel pricing,
 * availability and package evidence are out of scope until Trip.com rights
 * are clarified in writing.
 */

export const ANTALYA_HOTEL_EVIDENCE_CHECKED_DATE = '2026-08-11' as const;

export type HotelEvidenceState =
  | 'evidenced'
  | 'not-stated'
  | 'unknown'
  | 'conflicted'
  | 'unresolved';

export type HotelGeographyConflict = 'yes' | 'no' | 'unknown';

export type HotelClassificationConfidence =
  | 'strong'
  | 'usable-with-caveat'
  | 'unresolved';

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

export interface HotelEvidenceRecord {
  evidenceId: string;
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

const checked = ANTALYA_HOTEL_EVIDENCE_CHECKED_DATE;

const trendyOfficial: HotelEvidenceSource = {
  name: 'Trendy Lara official property page',
  url: 'https://trendy.com.tr/en/trendy-lara/',
  checkedDate: checked,
};

const trendyTrip: HotelEvidenceSource = {
  name: 'Trip.com Trendy Lara property listing',
  url: 'https://www.trip.com/hotels/trendy-lara-hotel-detail-9618012/trendy-lara/',
  checkedDate: checked,
};

const aksuGeography: HotelEvidenceSource = {
  name: 'Aksu Municipality Kemerağzı–Kundu planning notice',
  url: 'https://www.aksu.bel.tr/duyurular/plan-ve-proje-mudurlugu-kemeragzi-kundu-kultur-ve-turizm-koruma-ve-gelisim-bolgesi-kapsaminda-kultur-ve-turizm-bakanliginca-hazirlanan-yol-ve-bisiklet-yoluna-iliskin-2-etap-11000-olcekli-uygulama-imar-plani-degisikligi',
  checkedDate: checked,
};

const regnumOfficial: HotelEvidenceSource = {
  name: 'Regnum Carya official property page',
  url: 'https://www.regnumcarya.co.uk/en/hotels/regnum-carya/',
  checkedDate: checked,
};

const regnumFacts: HotelEvidenceSource = {
  name: 'Regnum Carya official winter factsheet 2025–2026',
  url: 'https://www.regnumcarya.co.uk/media/zkwjkqro/facts-information_winter_2025-2026_en_rc_dp.pdf',
  checkedDate: checked,
};

const regnumTrip: HotelEvidenceSource = {
  name: 'Trip.com Regnum Carya property listing',
  url: 'https://www.trip.com/hotels/belek-hotel-detail-3054789/regnum-carya/',
  checkedDate: checked,
};

const serikGeography: HotelEvidenceSource = {
  name: 'Serik Municipality Belek Tourism Centre notice',
  url: 'https://serik.bel.tr/belek-turizm-merkezi-kadriye-mahallesi-1-1000-olcekli-uygulama-imar-plani-revizyonu-plan-hukmu-degisikligi',
  checkedDate: checked,
};

const aydinbeyOfficial: HotelEvidenceSource = {
  name: "Aydinbey King's Palace official property site",
  url: 'https://www.aydinbeyhotels.com/kings-palace-spa/en/',
  checkedDate: checked,
};

const aydinbeyFacts: HotelEvidenceSource = {
  name: "Aydinbey King's Palace winter factsheet 2025–2026",
  url: 'https://b2ccdn.coral.ru/content/doc/AYDINBEY_KINGS_PALACE_KI%C5%9E_FACTSHEET_2026_ENG.pdf',
  checkedDate: checked,
};

const aydinbeyTrip: HotelEvidenceSource = {
  name: "Trip.com Aydinbey King's Palace property listing",
  url: 'https://www.trip.com/hotels/ilica-mahallesi-hotel-detail-4228551/aydinbey-king%27s-palace-%26-spa-ultra-all-inclusive/',
  checkedDate: checked,
};

const manavgatGeography: HotelEvidenceSource = {
  name: 'Manavgat Municipality Side–Evrenseki road notice',
  url: 'https://www.manavgat.bel.tr/guncel-haberler/manavgat-belediyesi-nden-side-evrenseki-turizm-caddesi-nde-asfalt-yenileme-calismasi',
  checkedDate: checked,
};

const sideHistoricCore: HotelEvidenceSource = {
  name: 'Antalya Governorate Side Ancient City page',
  url: 'https://www.antalya.gov.tr/side-antik-kenti',
  checkedDate: checked,
};

export const antalyaHotelEvidence: readonly HotelEvidenceRecord[] = [
  {
    evidenceId: 'antalya-trendy-lara-2026-08-11',
    hotelName: 'Trendy Lara',
    provider: 'Trip.com',
    providerPropertyUrl: trendyTrip.url,
    officialPropertySource: trendyOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Lara',
      exactSourcedAddress: 'Kundu District, Yaşar Sobutay Blv. No: 454, Aksu, Antalya, Türkiye',
      operationalArea: 'Kundu/Aksu',
      operationalSubArea: 'Kundu / Kemerağzı coastal resort corridor',
      geographySource: aksuGeography,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'yes',
      classificationConfidence: 'strong',
      classificationNotes:
        'The provider uses Lara terminology, but the exact address and municipal evidence place the property in Kundu/Aksu. It is not classified as Lara Beach proper.',
    },
    propertyFacts: [
      {
        claim: 'Family accommodation shown',
        value: 'Family Suites and duplex family rooms are shown.',
        state: 'evidenced',
        sources: [trendyOfficial],
      },
      {
        claim: 'Private beach access',
        value: 'Private sandy beach shown.',
        state: 'evidenced',
        sources: [trendyOfficial],
      },
      {
        claim: 'Pools shown',
        value: 'Indoor and outdoor pools are shown.',
        state: 'evidenced',
        sources: [trendyOfficial],
      },
      {
        claim: 'Aquapark shown',
        value: 'Aquapark is shown.',
        state: 'evidenced',
        sources: [trendyOfficial],
      },
      {
        claim: 'Spa and fitness facilities shown',
        value: 'Spa and fitness facilities are shown.',
        state: 'evidenced',
        sources: [trendyOfficial],
      },
    ],
    locationJourneyContext: {
      airportTimeEvidence: [
        {
          claim: 'Antalya Airport transfer estimate',
          value: 'Approximately 15 minutes by car.',
          state: 'conflicted',
          sources: [trendyOfficial],
          method: 'Hotel-published estimate.',
          limitation: 'The same official hotel page also states approximately 25 minutes; neither estimate is treated as a guaranteed live transfer time.',
        },
        {
          claim: 'Antalya Airport transfer estimate',
          value: 'Approximately 25 minutes by car.',
          state: 'conflicted',
          sources: [trendyOfficial],
          method: 'Hotel-published estimate.',
          limitation: 'The same official hotel page also states approximately 15 minutes; neither estimate is treated as a guaranteed live transfer time.',
        },
      ],
      townCityHistoricRelationships: [
        {
          claim: 'Antalya city-centre relationship',
          value: 'Approximately 30 minutes from Antalya city centre.',
          state: 'evidenced',
          sources: [trendyOfficial],
          method: 'Hotel-published estimate.',
          limitation: 'This is not a guaranteed live transfer time.',
        },
      ],
      limitations: ['Airport-time evidence is internally conflicted on the official property page.'],
    },
    limitations: [
      'The Lara provider label is retained as secondary metadata and must not override Kundu/Aksu geography.',
      'Kids club evidence was not recorded because it was not explicitly established in the approved source set.',
    ],
  },
  {
    evidenceId: 'antalya-regnum-carya-2026-08-11',
    hotelName: 'Regnum Carya',
    provider: 'Trip.com',
    providerPropertyUrl: regnumTrip.url,
    officialPropertySource: regnumOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Belek Golf Area',
      exactSourcedAddress: 'Kadriye Mah. Kadriye 30 Sk. No: 21, Serik, Antalya, Türkiye',
      operationalArea: 'Belek tourism area',
      operationalSubArea: 'Kadriye',
      geographySource: serikGeography,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'no',
      classificationConfidence: 'strong',
      classificationNotes: 'Official address and Serik Municipality evidence support Kadriye within the Belek tourism area.',
    },
    propertyFacts: [
      {
        claim: 'All-inclusive concept shown',
        value: 'All-inclusive concept is shown.',
        state: 'evidenced',
        sources: [regnumFacts],
      },
      {
        claim: 'Private beach access',
        value: 'Private beach is shown.',
        state: 'evidenced',
        sources: [regnumOfficial, regnumFacts],
      },
      {
        claim: 'Golf context shown',
        value: 'Carya Golf Club and golf-resort context are shown.',
        state: 'evidenced',
        sources: [regnumOfficial],
      },
      {
        claim: 'Family accommodation/facilities shown',
        value: 'Villas are described for families and groups; Bamboo Kids World and Aqualantis are shown.',
        state: 'evidenced',
        sources: [regnumOfficial],
      },
      {
        claim: 'Pools and spa shown',
        value: 'Pools and spa/wellbeing facilities are shown.',
        state: 'evidenced',
        sources: [regnumOfficial],
      },
    ],
    locationJourneyContext: {
      airportDistance: {
        claim: 'Antalya Airport distance',
        value: 'Approximately 30 km.',
        state: 'evidenced',
        sources: [regnumFacts],
        method: 'Property factsheet distance.',
        limitation: 'Property-published information, not a guaranteed live transfer time.',
      },
      airportTimeEvidence: [
        {
          claim: 'Antalya Airport transfer estimate',
          value: 'Approximately 30 minutes by car.',
          state: 'evidenced',
          sources: [regnumFacts],
          method: 'Property factsheet estimate.',
          limitation: 'Not a guaranteed live transfer time.',
        },
      ],
      townCityHistoricRelationships: [
        {
          claim: 'Resort/golf setting',
          value: 'Kadriye/Belek tourism-area resort setting with golf facilities.',
          state: 'evidenced',
          sources: [regnumOfficial, serikGeography],
        },
      ],
      limitations: ['Airport distance and time are property-published factsheet information.'],
    },
    limitations: ['No comparative or promotional claim is recorded.'],
  },
  {
    evidenceId: 'antalya-aydinbey-kings-palace-2026-08-11',
    hotelName: "Aydinbey King's Palace & Spa",
    provider: 'Trip.com',
    providerPropertyUrl: aydinbeyTrip.url,
    officialPropertySource: aydinbeyOfficial,
    checkedDate: checked,
    publicationStatus: 'internal-only',
    geography: {
      providerMarketingLocationLabel: 'Side / Manavgat',
      exactSourcedAddress: 'Evren Mah. Sahil Cad. – Evrenseki, Side / Antalya, Türkiye',
      operationalArea: 'Side/Manavgat corridor',
      operationalSubArea: 'Evrenseki',
      geographySource: manavgatGeography,
      geographyCheckedDate: checked,
      providerGeographyConflict: 'unknown',
      classificationConfidence: 'usable-with-caveat',
      classificationNotes:
        'Official and provider sources use different address formats, but both identify Evrenseki. The property is not classified as Side historic core.',
    },
    propertyFacts: [
      {
        claim: 'Ultra all-inclusive concept shown',
        value: 'Ultra all-inclusive concept is shown.',
        state: 'evidenced',
        sources: [aydinbeyFacts, aydinbeyTrip],
      },
      {
        claim: 'Private sandy beach access',
        value: 'Private sandy beach is shown.',
        state: 'evidenced',
        sources: [aydinbeyFacts, aydinbeyOfficial],
      },
      {
        claim: 'Family accommodation shown',
        value: 'Family Room A and Family Room B are shown.',
        state: 'evidenced',
        sources: [aydinbeyOfficial],
      },
      {
        claim: "Children's facilities shown",
        value: 'Children’s pools, a children’s aquapark with three slides and a mini club for ages 4–12 are shown.',
        state: 'evidenced',
        sources: [aydinbeyFacts],
        limitation: 'Facilities and age range are from a seasonal 2025–2026 factsheet and require freshness review.',
      },
      {
        claim: 'Adult and children’s pools shown',
        value: 'Adult and children’s indoor/outdoor pools are shown.',
        state: 'evidenced',
        sources: [aydinbeyFacts],
        limitation: 'Seasonal factsheet evidence requires freshness review.',
      },
    ],
    locationJourneyContext: {
      airportDistance: {
        claim: 'Antalya Airport distance',
        value: 'Approximately 60 km.',
        state: 'evidenced',
        sources: [aydinbeyFacts],
        method: 'Property factsheet distance.',
      },
      airportTimeEvidence: [],
      townCityHistoricRelationships: [
        {
          claim: 'Side Centre relationship',
          value: 'Approximately 8 km from Side Centre.',
          state: 'evidenced',
          sources: [aydinbeyFacts],
          limitation: 'This does not establish walking access to Side Ancient City.',
        },
        {
          claim: 'Manavgat Centre relationship',
          value: 'Approximately 15 km from Manavgat Centre.',
          state: 'evidenced',
          sources: [aydinbeyFacts],
        },
        {
          claim: 'Walking access to Side historic core',
          value: 'Not evidenced.',
          state: 'not-stated',
          sources: [aydinbeyFacts, sideHistoricCore],
          limitation: 'The sources establish distance/context, not a walkable route to Side Ancient City.',
        },
      ],
      limitations: ['Evrenseki is preserved as a distinct sub-area rather than being relabelled Side historic core.'],
    },
    limitations: [
      'Exact address formatting differs between the official factsheet and provider listing; Evrenseki is consistent.',
      'Several facility claims come from a seasonal 2025–2026 factsheet and require freshness review.',
    ],
  },
];

export type AntalyaHotelEvidenceRecord = (typeof antalyaHotelEvidence)[number];
