import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';

export const metadata: Metadata = {
  title: 'India Travel Hub — Flights from the UK',
  description:
    'Flights and travel guidance for Delhi, Mumbai and Amritsar from UK airports, including visa timelines and festival season pricing.',
};

export default function IndiaHubPage() {
  const destinations = getDestinationsByRegion('india');

  return (
    <RegionHubPage
      eyebrow="India Hub"
      title="India, from a UK perspective"
      intro="Delhi for the capital and onward connections, Mumbai for business and the coast, Amritsar for Punjab and the Golden Temple — three very different reasons to fly the same general direction."
      destinationsInRegion={destinations}
      airportsServed={['London Heathrow', 'Birmingham']}
      showFamilyVisitCallout
      visaNote="UK passport holders require a visa for India. The e-Visa (tourist or business) is processed online and should be applied for at least 4 days before travel, though earlier is recommended during busy periods. Overseas Citizen of India (OCI) cardholders do not require a separate visa."
      practicalNotes={[
        {
          title: 'Diwali and the December–January window see the steepest fares',
          body: 'Festival season and the Christmas–New Year period are the highest-demand windows on UK–India routes. Outside these windows, particularly February–April and September–October, fares are typically more reasonable.',
        },
        {
          title: 'Birmingham serves Amritsar and Punjab routes well',
          body: 'For travellers heading to Punjab specifically, Birmingham often has stronger seasonal and codeshare connections than flying via London first.',
        },
        {
          title: 'Domestic onward connections add up',
          body: 'If your final destination is outside Delhi or Mumbai, factor in the cost and time of a domestic Indian flight or long train journey — it can shift which UK departure airport makes most sense.',
        },
      ]}
    />
  );
}
