import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';
import { buildDirectRoutesNote } from '@/lib/hub-service-notes';

// Pure ISR, matching the route detail pages — RegionHubPage renders
// getEffectiveRoutePresentation() and DealCard, both of which must
// regenerate without a deploy once a ledger event's effective date passes.
export const revalidate = 21600;

export const metadata: Metadata = {
  alternates: { canonical: '/pakistan' },
  title: 'Pakistan Travel Hub: Flights from the UK',
  description:
    'Flights and travel guidance for Lahore, Islamabad and Karachi from UK airports, including visa requirements and Eid travel timing.',
};

export default function PakistanHubPage() {
  const destinations = getDestinationsByRegion('pakistan');
  const nowIso = new Date().toISOString().slice(0, 10);

  return (
    <RegionHubPage
      eyebrow="Pakistan Hub"
      title="Pakistan, covered properly"
      intro="Route guides, dated fare checks and document guidance for UK travellers flying to Lahore, Islamabad and Karachi."
      destinationsInRegion={destinations}
      airportsServed={['Manchester', 'Birmingham', 'London Heathrow']}
      showFamilyVisitCallout
      quoteRegion="pakistan"
      heroKey="pakistan"
      visaNote="British citizens need a visa for Pakistan and must apply in advance, unless they hold a valid NICOP, SNICOP or Pakistan Origin Card (POC). An expired, lost or renewing card is treated differently. Use the Travel Ready Check, the GOV.UK entry requirements for Pakistan and the official Pakistan online visa portal to confirm your position before you book."
      practicalNotes={[
        {
          title: 'Plan around Eid and the UK summer holidays',
          body: 'The weeks around Eid al-Fitr, Eid al-Adha and the UK summer holidays are popular times to travel to Pakistan, so check dated fares for your own dates early and leave time to compare options. Planning guidance, not a fare prediction.',
        },
        buildDirectRoutesNote(
          'Pakistan',
          ['manchester-lahore', 'manchester-islamabad', 'birmingham-lahore', 'birmingham-islamabad', 'london-heathrow-lahore', 'leeds-bradford-islamabad', 'manchester-karachi'],
          nowIso
        ),
        {
          title: 'Compare stops and total journey time for Karachi',
          body: 'Check each Karachi route guide for what JetStash has verified, and compare the total journey time and number of stops, not only the headline fare.',
        },
      ]}
    />
  );
}
