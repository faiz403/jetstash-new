import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';

export const metadata: Metadata = {
  alternates: { canonical: '/india' },
  title: 'India Travel Hub: Flights from the UK',
  description:
    'Flights and travel guidance for Delhi, Mumbai, Ahmedabad and Amritsar from UK airports, including visa timelines and festival season pricing.',
};

export default function IndiaHubPage() {
  const destinations = getDestinationsByRegion('india');

  return (
    <RegionHubPage
      eyebrow="India Hub"
      title="India, from a UK perspective"
      intro="Delhi for the capital and onward connections, Mumbai for business and the coast, Ahmedabad for Gujarat, Amritsar for Punjab and the Golden Temple: four very different reasons to fly the same general direction."
      destinationsInRegion={destinations}
      airportsServed={['London Heathrow', 'London Gatwick', 'Birmingham', 'Manchester']}
      showFamilyVisitCallout
      quoteRegion="india"
      heroKey="india"
      visaNote="UK passport holders require a visa for India. The e-Visa (tourist or business) is processed online and should be applied for at least 4 days before travel, though earlier is recommended during busy periods. Overseas Citizen of India (OCI) cardholders do not require a separate visa."
      practicalNotes={[
        {
          title: 'Diwali and the December–January window see the steepest fares',
          body: 'Festival season and the Christmas–New Year period are the highest-demand windows on UK–India routes. Outside these windows, particularly February–April and September–October, fares are typically more reasonable.',
        },
        {
          title: 'Gatwick is the direct gateway for Gujarat and Punjab specifically',
          body: 'Air India\'s only non-stop UK routes to Ahmedabad and Amritsar both depart from Gatwick, alongside Birmingham\'s direct Amritsar service. Both run 3 times a week rather than daily, so confirm your dates align with an active flight day.',
        },
        {
          title: 'Manchester\'s direct Delhi and Mumbai services have an announced end date',
          body: 'IndiGo\'s direct Manchester services to Delhi and Mumbai are scheduled to be withdrawn from 31 August 2026. If you\'re travelling after that date, plan around a one-stop Gulf-carrier connection rather than assuming the direct flight will still be running. Check the relevant route guide for the realistic alternative.',
        },
        {
          title: 'Domestic onward connections add up',
          body: 'If your final destination is outside Delhi, Mumbai or Ahmedabad themselves, factor in the cost and time of a domestic Indian flight or long train journey. It can shift which UK departure airport makes most sense.',
        },
      ]}
    />
  );
}
