import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';
import { buildDirectServiceNote } from '@/lib/hub-service-notes';

// Pure ISR, matching the route detail pages — RegionHubPage renders
// getEffectiveRoutePresentation() and DealCard, both of which must
// regenerate without a deploy once a ledger event's effective date passes.
export const revalidate = 21600;

export const metadata: Metadata = {
  alternates: { canonical: '/india' },
  title: 'India Travel Hub: Flights from the UK',
  description:
    'Flights and travel guidance for Delhi, Mumbai, Ahmedabad and Amritsar from UK airports, including visa timelines and festival season pricing.',
};

export default function IndiaHubPage() {
  const destinations = getDestinationsByRegion('india');
  // Derived from canonical route verification so this note cannot contradict
  // the route cards below it (sprint 1, 22 Oct 2026).
  const nowIso = new Date().toISOString().slice(0, 10);
  const amritsarNote = buildDirectServiceNote(
    'Amritsar',
    ['birmingham-amritsar', 'london-gatwick-amritsar', 'manchester-amritsar', 'leeds-bradford-amritsar'],
    nowIso
  );

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
          title: 'Plan around Diwali and the December–January window',
          body: 'Diwali and the Christmas–New Year period are popular times to travel to India, so check dated fares for your own dates early. JetStash tracks dated fare observations, not a seasonal price pattern. Planning guidance, not a fare prediction.',
        },
        amritsarNote,
        {
          title: 'Check current status before booking Manchester\'s Delhi and Mumbai services',
          body: 'The former Manchester–Delhi and Manchester–Mumbai IndiGo direct services have ended. Check the Route Status panel on each route guide for current options before booking.',
        },
        {
          title: 'Domestic onward connections add up',
          body: 'If your final destination is outside Delhi, Mumbai or Ahmedabad themselves, factor in the cost and time of a domestic Indian flight or long train journey. It can shift which UK departure airport makes most sense.',
        },
      ]}
    />
  );
}
